/**
 * Meta Ad Library API Integration V1 — plain-Node proofs for the
 * "Search advertiser" flow's pure logic and trust rules. No network:
 * the request SHAPE is asserted via buildAdsArchiveParams, the
 * response handling via hand-built fixtures, and the architectural
 * trust rules (discovery never yields ad payload; the token never
 * reaches a log or response) via source scans, following the same
 * pattern as scripts/monitoring-isolation.test.ts.
 *
 * The manual paste modes' unchanged behavior is covered by the
 * existing suites (adParser, adsLibraryParser, pageDump,
 * pageDumpReview, competitorDebrief), which all run in the same
 * `npm test` — this file only adds the new mode's coverage.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AdLibraryApiError, buildAdsArchiveParams, type RawArchivedAd } from "../modules/metaAdLibrary/client.ts";
import {
  AD_TEXT_HEAD_CHARS,
  AD_TEXT_TAIL_CHARS,
  buildEngineAdTexts,
  competitorAdToText,
  dedupePageCandidates,
  isSupportedCountry,
  MAX_AD_TEXT_CHARS,
  partitionAdsByPage,
  SUPPORTED_COUNTRIES,
} from "../modules/metaAdLibrary/discovery.ts";
import {
  buildSearchPayload,
  mergeFetchedAds,
  SEARCH_OBSERVATIONS_LIMIT,
  type ApiAd,
} from "../components/competitorDebrief/searchAdsPayload.ts";
import { describeAdLibraryError, MISSING_TOKEN_ERROR } from "../modules/metaAdLibrary/errors.ts";
import { normalizeArchivedAd, sanitizeSnapshotUrl } from "../modules/metaAdLibrary/normalize.ts";
import type { CompetitorAd } from "../modules/metaAdLibrary/types.ts";

const FAKE_TOKEN = "TEST_TOKEN_NOT_REAL";

function makeAd(overrides: Partial<CompetitorAd>): CompetitorAd {
  return {
    source: "meta-ad-library-api",
    advertiserName: "Brand",
    advertiserPageId: "111",
    adId: "1",
    body: "Body text.",
    headline: "Headline text.",
    cta: null,
    startedAt: "2026-07-01",
    endedAt: null,
    countries: [],
    platforms: ["facebook"],
    snapshotUrl: null,
    sourceUrl: null,
    ...overrides,
  };
}

/* ===================== buildAdsArchiveParams (request shape) ===================== */

{
  // ACTIVE-filter request shape + page-scoped query + no search_terms
  // leakage when none was given.
  const params = buildAdsArchiveParams({
    accessToken: FAKE_TOKEN,
    searchPageIds: ["12345"],
    adReachedCountries: ["DE"],
    adType: "ALL",
    adActiveStatus: "ACTIVE",
    limit: 10,
  });
  assert.equal(params.get("ad_active_status"), "ACTIVE");
  assert.equal(params.get("search_page_ids"), '["12345"]');
  assert.equal(params.get("ad_reached_countries"), '["DE"]');
  assert.equal(params.get("ad_type"), "ALL");
  assert.equal(params.get("limit"), "10");
  assert.equal(params.get("search_terms"), null, "no search_terms param unless explicitly set");
  assert.equal(params.get("after"), null, "no cursor param unless explicitly set");
}

{
  // Pagination cursor passthrough + discovery (search_terms) shape.
  const params = buildAdsArchiveParams({
    accessToken: FAKE_TOKEN,
    searchTerms: "Nike",
    adReachedCountries: ["FR"],
    after: "CURSOR_ABC",
  });
  assert.equal(params.get("search_terms"), "Nike");
  assert.equal(params.get("after"), "CURSOR_ABC");
  assert.equal(params.get("search_page_ids"), null);
  assert.equal(params.get("ad_type"), "ALL", "ad_type defaults to ALL");
}

/* ===================== dedupePageCandidates (discovery) ===================== */

{
  const raw: RawArchivedAd[] = [
    { id: "a1", page_id: "111", page_name: "Nike" },
    { id: "a2", page_id: "222", page_name: "NovelFlow" },
    { id: "a3", page_id: "111", page_name: "Nike" },
    { id: "a4" }, // no page_id — must be dropped, not guessed
    { id: "a5", page_id: "333" }, // page_id but no name
  ];
  const pages = dedupePageCandidates(raw);
  assert.equal(pages.length, 3, "deduped by page_id, null page_id dropped");
  assert.deepEqual(pages[0], { pageId: "111", pageName: "Nike", sampleAdCount: 2 });
  assert.deepEqual(pages[1], { pageId: "222", pageName: "NovelFlow", sampleAdCount: 1 });
  assert.equal(pages[2].pageName, "(unnamed Page)");
  // Discovery output is Page identity ONLY — no ad field survives.
  for (const p of pages) {
    assert.deepEqual(Object.keys(p).sort(), ["pageId", "pageName", "sampleAdCount"]);
  }
}

{
  // Empty discovery result is a valid, empty candidate list.
  assert.deepEqual(dedupePageCandidates([]), []);
}

/* ===================== partitionAdsByPage (attribution gate) ===================== */

{
  const ads = [
    makeAd({ adId: "1", advertiserPageId: "111" }),
    makeAd({ adId: "2", advertiserPageId: "999", advertiserName: "SomeoneElse" }),
    makeAd({ adId: "3", advertiserPageId: "111" }),
    makeAd({ adId: "4", advertiserPageId: null }),
  ];
  const { matching, excludedMismatchedCount } = partitionAdsByPage(ads, "111");
  assert.deepEqual(
    matching.map((a) => a.adId),
    ["1", "3"],
    "only ads whose page_id equals the selected Page survive — mismatched AND unattributed are excluded"
  );
  assert.equal(excludedMismatchedCount, 2);
}

{
  // Empty ad results: nothing matching, nothing excluded — the UI's
  // "no active ads found" state, not an error.
  const { matching, excludedMismatchedCount } = partitionAdsByPage([], "111");
  assert.deepEqual(matching, []);
  assert.equal(excludedMismatchedCount, 0);
}

/* ===================== competitorAdToText / buildEngineAdTexts ===================== */

{
  // Serialization uses ONLY the ad's own creative fields.
  assert.equal(competitorAdToText(makeAd({})), "Body text.\nHeadline text.");
  assert.equal(competitorAdToText(makeAd({ headline: null })), "Body text.");
  assert.equal(competitorAdToText(makeAd({ body: null })), "Headline text.");
  assert.equal(competitorAdToText(makeAd({ body: null, headline: "  " })), "", "whitespace-only fields don't count");
  // Nothing except body/headline can reach the engine text — not the
  // Page name, not the ad id, not the source URL.
  const text = competitorAdToText(
    makeAd({ advertiserName: "SHOULD_NOT_APPEAR", adId: "97531", sourceUrl: "https://example.com/SHOULD_NOT_APPEAR" })
  );
  assert.ok(!text.includes("SHOULD_NOT_APPEAR") && !text.includes("97531"));
}

{
  const texts = buildEngineAdTexts([
    makeAd({ adId: "1" }),
    makeAd({ adId: "2", body: null, headline: null }), // unusable — dropped
    makeAd({ adId: "3", body: "Other body." }),
  ]);
  assert.deepEqual(texts, ["Body text.\nHeadline text.", "Other body.\nHeadline text."]);
  assert.deepEqual(buildEngineAdTexts([]), []);
}

/* ===================== sanitizeSnapshotUrl / normalizeArchivedAd ===================== */

{
  const dirty = `https://www.facebook.com/ads/archive/render_ad/?id=123&access_token=${FAKE_TOKEN}`;
  const clean = sanitizeSnapshotUrl(dirty);
  assert.ok(clean !== null && !clean.includes(FAKE_TOKEN), "access_token stripped");
  assert.ok(clean!.includes("id=123"), "non-token params preserved");
  assert.equal(sanitizeSnapshotUrl("not a url"), null, "unparseable URL can't be proven token-free — dropped");
  assert.equal(sanitizeSnapshotUrl(undefined), null);
}

{
  // End to end: a raw Graph node with a token-bearing snapshot URL
  // normalizes into a record that provably carries no token.
  const raw: RawArchivedAd = {
    id: "555",
    page_id: "111",
    page_name: "Brand",
    ad_creative_bodies: ["Body A", "Body B"],
    ad_creative_link_titles: ["Title A"],
    ad_delivery_start_time: "2026-07-01",
    ad_snapshot_url: `https://www.facebook.com/ads/archive/render_ad/?id=555&access_token=${FAKE_TOKEN}`,
    publisher_platforms: ["facebook", "instagram"],
  };
  const ad = normalizeArchivedAd(raw, "https://www.facebook.com/ads/library/?view_all_page_id=111");
  assert.equal(ad.advertiserPageId, "111");
  assert.equal(ad.body, "Body A");
  assert.equal(ad.headline, "Title A");
  assert.equal(ad.cta, null, "no CTA field exists for commercial ads — never invented");
  assert.ok(!JSON.stringify(ad).includes(FAKE_TOKEN), "no field of the normalized record contains the token");
}

/* ===================== describeAdLibraryError (Meta error normalization) ===================== */

{
  const expired = describeAdLibraryError(new AdLibraryApiError("Session has expired", 400, 190, "OAuthException", 463));
  assert.ok(expired.title.toLowerCase().includes("expired"));
  assert.ok(expired.fix.includes("META_AD_LIBRARY_ACCESS_TOKEN"));

  const permission = describeAdLibraryError(new AdLibraryApiError("Not authorized", 403, 10, "OAuthException", null));
  assert.ok(permission.title.toLowerCase().includes("permission"));

  for (const code of [4, 17, 32, 613]) {
    const limited = describeAdLibraryError(new AdLibraryApiError("Rate limited", 400, code, "OAuthException", null));
    assert.ok(limited.title.toLowerCase().includes("rate limit"), `code ${code} maps to rate-limit copy`);
  }

  const generic = describeAdLibraryError(new AdLibraryApiError("???", 500, 1234, "FacebookApiException", null));
  assert.ok(generic.title.length > 0 && !generic.message.includes("???"), "unknown upstream text is never echoed");

  assert.ok(MISSING_TOKEN_ERROR.fix.includes("META_AD_LIBRARY_ACCESS_TOKEN"));
}

/* ===================== country allowlist ===================== */

{
  assert.ok(isSupportedCountry("DE"));
  assert.ok(isSupportedCountry("GB"));
  assert.ok(!isSupportedCountry("US"));
  assert.ok(!isSupportedCountry(""));
  assert.ok(!isSupportedCountry("de"), "codes are exact-match uppercase");
  assert.ok(SUPPORTED_COUNTRIES.length >= 10);
}

/* ===================== source scans (architectural trust rules) ===================== */

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

{
  // The engine and parsers must never learn the API source exists —
  // ads reach them as the same plain adTexts/observations strings the
  // paste flows produce.
  for (const file of [
    "modules/competitorDebrief/engine.ts",
    "modules/competitorDebrief/adParser.ts",
    "modules/competitorDebrief/adsLibraryParser.ts",
    "modules/competitorDebrief/pageDump.ts",
  ]) {
    assert.ok(!read(file).includes("metaAdLibrary"), `${file} must not import metaAdLibrary`);
  }
}

{
  // Discovery route: candidate Pages ONLY — it must never normalize or
  // return ad objects, so search_terms results can't become payload.
  const search = read("app/api/meta-ad-library/search/route.ts");
  assert.ok(search.includes("dedupePageCandidates"));
  assert.ok(!search.includes("normalizeArchivedAd"), "search route must not produce ad objects");
  assert.ok(!search.includes("console.log"), "no free-form logging in the search route");

  // Ads route: page-scoped ACTIVE query + per-ad attribution gate.
  const pageAds = read("app/api/meta-ad-library/page-ads/route.ts");
  assert.ok(pageAds.includes('adActiveStatus: "ACTIVE"'));
  assert.ok(pageAds.includes("searchPageIds: [pageId]"));
  assert.ok(!pageAds.includes("searchTerms"), "ads route must never query by search_terms");
  assert.ok(pageAds.includes("partitionAdsByPage"), "every returned ad is re-validated against the selected page_id");
  assert.ok(!pageAds.includes("console.log"), "no free-form logging in the page-ads route");

  // The token is read from the server env in both routes and never
  // NEXT_PUBLIC_, never handed to any console call.
  for (const src of [search, pageAds]) {
    assert.ok(src.includes("process.env.META_AD_LIBRARY_ACCESS_TOKEN"));
    assert.ok(!src.includes("NEXT_PUBLIC_"), "token env var must not be NEXT_PUBLIC_");
    for (const line of src.split("\n")) {
      if (line.includes("console.")) {
        assert.ok(!line.includes("accessToken") && !line.includes("META_AD_LIBRARY"), "token never reaches a log call");
      }
    }
  }
}

{
  // Panel trust rules: the mandatory-selection note is present, the
  // search payload reads includedApiAds (never blocks), and nothing is
  // auto-selected from discovery results.
  const panel = read("components/competitorDebrief/CompetitorDebriefPanel.tsx");
  assert.ok(panel.includes("You choose the exact advertiser"));
  assert.ok(panel.includes("includedApiAds"), "search-mode payload derives from included fetched ads");
  assert.ok(!panel.includes("setSelectedPage(body.pages"), "no auto-selection of a discovery result");
  assert.ok(!panel.includes("NEXT_PUBLIC_"));
}

/* ===================== per-ad text cap (competitorAdToText) ===================== */

{
  // Confirmed live: single ads_archive bodies run 40k–47k characters
  // (long-form story ads), so an uncapped serialization overflowed the
  // debrief API's 20,000-char observations limit even with ONE ad
  // selected — the exact reported bug. The cap keeps head (hook) and
  // tail (offer/CTA), never the signal-thin middle.
  const hugeBody = `HOOK_OPENING ${"middle filler ".repeat(3500)}FINAL_OFFER_CTA`;
  assert.ok(hugeBody.length > 40_000, "fixture mirrors the live 40k+ case");
  const text = competitorAdToText(makeAd({ body: hugeBody, headline: null }));
  assert.ok(
    text.length <= MAX_AD_TEXT_CHARS + 3,
    `capped to ~${MAX_AD_TEXT_CHARS} chars (got ${text.length})`
  );
  assert.ok(text.startsWith("HOOK_OPENING"), "head (hook) preserved");
  assert.ok(text.endsWith("FINAL_OFFER_CTA"), "tail (offer/CTA) preserved");
  assert.ok(text.includes("…"), "truncation is visible, never silent");

  // A normal-sized ad is byte-identical to before the cap existed.
  assert.equal(competitorAdToText(makeAd({})), "Body text.\nHeadline text.");
  const exactFit = "x".repeat(MAX_AD_TEXT_CHARS);
  assert.equal(competitorAdToText(makeAd({ body: exactFit, headline: null })), exactFit);
  assert.equal(AD_TEXT_HEAD_CHARS + AD_TEXT_TAIL_CHARS, MAX_AD_TEXT_CHARS);
}

/* ===================== buildSearchPayload (selection -> exact payload) ===================== */

function apiAd(adId: string, text: string, included: boolean): ApiAd {
  return { ad: makeAd({ adId, body: text, headline: null }), text, included };
}

{
  // THE reported bug's shape: 10 fetched, only 1 selected -> the
  // payload contains exactly that one ad and nothing else.
  const ads: ApiAd[] = Array.from({ length: 10 }, (_, i) =>
    apiAd(String(i + 1), `Distinct ad body number ${i + 1}.`, i === 3)
  );
  const payload = buildSearchPayload(ads, "");
  assert.deepEqual(payload.adTexts, ["Distinct ad body number 4."], "exactly the one selected ad");
  assert.equal(payload.observations, "Distinct ad body number 4.");
  // Deselected ads never enter observations OR adTexts.
  for (let i = 1; i <= 10; i++) {
    if (i === 4) continue;
    assert.ok(!payload.observations.includes(`number ${i}.`), `deselected ad ${i} absent from observations`);
  }
}

{
  // Unchecking removes immediately; rechecking restores — the payload
  // is a pure function of current state, no caching to go stale.
  let ads: ApiAd[] = [apiAd("1", "First ad.", true), apiAd("2", "Second ad.", true)];
  assert.equal(buildSearchPayload(ads, "").adTexts.length, 2);
  ads = ads.map((a) => (a.ad.adId === "2" ? { ...a, included: false } : a));
  assert.deepEqual(buildSearchPayload(ads, "").adTexts, ["First ad."]);
  ads = ads.map((a) => (a.ad.adId === "2" ? { ...a, included: true } : a));
  assert.equal(buildSearchPayload(ads, "").adTexts.length, 2);
}

{
  // The readout's character count IS the sent payload's length — same
  // function, same string; also true with advanced notes appended, and
  // the over-budget comparison uses that exact value.
  const ads = [apiAd("1", "A".repeat(500), true), apiAd("2", "B".repeat(600), true)];
  const withNotes = buildSearchPayload(ads, "  some notes  ");
  assert.equal(withNotes.observations, `${"A".repeat(500)}\n\n${"B".repeat(600)}\n\nsome notes`);
  assert.equal(withNotes.observations.length, 500 + 2 + 600 + 2 + 10);
  assert.equal(SEARCH_OBSERVATIONS_LIMIT, 20_000, "mirrors the route's MAX_OBSERVATIONS_CHARS");

  // Duplicate creative variants collapse to one payload entry (same
  // normalizeForDedupe key the paste flows use).
  const dupes = [apiAd("1", "Same creative.", true), apiAd("2", "same   CREATIVE.", true)];
  assert.equal(buildSearchPayload(dupes, "").adTexts.length, 1);
}

/* ===================== mergeFetchedAds (Load more selection preservation) ===================== */

{
  const first: ApiAd[] = [apiAd("1", "One.", true), apiAd("2", "Two.", false), apiAd("3", "Three.", true)];

  // Load more: appended page preserves every existing checkbox state
  // verbatim; new ads follow the one documented default (included).
  const secondPage = [apiAd("4", "Four.", true), apiAd("5", "Five.", true)];
  const merged = mergeFetchedAds(first, secondPage, true);
  assert.deepEqual(
    merged.map((a) => [a.ad.adId, a.included]),
    [["1", true], ["2", false], ["3", true], ["4", true], ["5", true]]
  );

  // A cursor that re-delivers an already-listed ad (id 2, deselected,
  // re-arriving as included:true) is dropped — it can neither duplicate
  // the row nor silently re-select what the user unchecked.
  const overlapping = [apiAd("2", "Two.", true), apiAd("6", "Six.", true)];
  const afterOverlap = mergeFetchedAds(merged, overlapping, true);
  assert.equal(afterOverlap.filter((a) => a.ad.adId === "2").length, 1, "no duplicate row");
  assert.equal(afterOverlap.find((a) => a.ad.adId === "2")?.included, false, "deselection survives cursor overlap");
  assert.equal(afterOverlap.find((a) => a.ad.adId === "6")?.included, true, "genuinely new ad gets the default");

  // Fresh fetch (not load-more) replaces the list entirely.
  const fresh = mergeFetchedAds(afterOverlap, [apiAd("9", "Nine.", true)], false);
  assert.deepEqual(fresh.map((a) => a.ad.adId), ["9"]);
}

/* ===================== panel wiring (source scans for this fix) ===================== */

{
  const panel = read("components/competitorDebrief/CompetitorDebriefPanel.tsx");
  // Generate and the readout must read the SAME payload object.
  assert.ok(panel.includes("searchPayload.observations.length"), "readout measures the exact payload string");
  assert.ok(panel.includes("distinctAdTexts = searchPayload.adTexts"), "generate sends the exact payload adTexts");
  assert.ok(panel.includes("observations = searchPayload.observations"), "generate sends the exact payload observations");
  assert.ok(!panel.includes("Trim the pasted text"), "paste-specific size copy never shown by the panel");
  assert.ok(panel.includes("Select fewer or shorter ads before generating"), "search-mode size copy present");
  // The paste branch still serializes from blocks via textForAnalysis —
  // unchanged by this fix (its own suites prove behavior; this pins the
  // source path).
  assert.ok(panel.includes("distinctAdTexts.push(textForAnalysis(b.parsed))"));
}

console.log("metaAdLibraryIntegration: all assertions passed");
