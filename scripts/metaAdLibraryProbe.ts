/**
 * Meta Ad Library API spike — one-shot manual probe.
 *
 * NOT part of `npm test` (it makes a real network call and needs real
 * credentials — it must never run in CI or block the deterministic
 * test suite). Run it by hand:
 *
 *   Discovery mode (keyword search — NOT advertiser attribution):
 *     META_AD_LIBRARY_ACCESS_TOKEN=... node scripts/metaAdLibraryProbe.ts [searchTerms] [countryCode]
 *
 *   Advertiser mode (exact Page query via search_page_ids — also
 *   exercises paging and ACTIVE-status filtering):
 *     META_AD_LIBRARY_ACCESS_TOKEN=... node scripts/metaAdLibraryProbe.ts --page <pageId> [countryCode]
 *
 * Output is a SANITIZED SUMMARY only: result count, unique page
 * names/ids, the first 3 ads with truncated body/title, and paging
 * presence. Never full creative bodies, and never `ad_snapshot_url`
 * as returned — CONFIRMED LIVE: Meta embeds the caller's own access
 * token inside that URL, so every printed/stored copy must go through
 * sanitizeSnapshotUrl first (see modules/metaAdLibrary/normalize.ts).
 *
 * No UI, no persistence, no database, no auth changes, no production
 * route. The token is read from an env var only and never printed.
 */
import { queryAdsArchive, AdLibraryApiError, type AdsArchiveResponse } from "../modules/metaAdLibrary/client.ts";
import { normalizeArchivedAd } from "../modules/metaAdLibrary/normalize.ts";
import type { CompetitorAd } from "../modules/metaAdLibrary/types.ts";

const pageMode = process.argv[2] === "--page";
const pageId = pageMode ? process.argv[3] : undefined;
const searchTerms = pageMode ? undefined : (process.argv[2] ?? "Nike");
const countryCode = (pageMode ? process.argv[4] : process.argv[3]) ?? "DE";

function truncate(value: string | null, max: number): string {
  if (!value) return "(missing)";
  const oneLine = value.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}...` : oneLine;
}

function printSummary(label: string, response: AdsArchiveResponse): CompetitorAd[] {
  const ads = response.data.map((raw) => normalizeArchivedAd(raw, null));

  console.log(`\n=== ${label} ===`);
  console.log(`Result count: ${ads.length}`);

  const pages = new Map<string, string>();
  for (const ad of ads) {
    if (ad.advertiserPageId) pages.set(ad.advertiserPageId, ad.advertiserName ?? "(unnamed)");
  }
  console.log(`Unique advertiser Pages: ${pages.size}`);
  for (const [id, name] of pages) console.log(`  - ${name} (page_id ${id})`);

  for (const ad of ads.slice(0, 3)) {
    console.log("  ---");
    console.log(`    adId:      ${ad.adId}`);
    console.log(`    page:      ${ad.advertiserName ?? "(missing)"} (${ad.advertiserPageId ?? "no page_id"})`);
    console.log(`    headline:  ${truncate(ad.headline, 60)}`);
    console.log(`    body:      ${truncate(ad.body, 60)}`);
    console.log(`    dates:     ${ad.startedAt ?? "?"} -> ${ad.endedAt ?? "(running)"}`);
    console.log(`    platforms: ${ad.platforms.join(", ") || "(missing)"}`);
    console.log(`    snapshot:  ${ad.snapshotUrl ? "present (token stripped)" : "(missing)"}`);
  }

  const after = response.paging?.cursors?.after;
  console.log(`Paging: next=${response.paging?.next ? "yes" : "no"}, after-cursor=${after ? "yes" : "no"}`);
  return ads;
}

function classifyAndExit(err: AdLibraryApiError): void {
  console.log(`\nBLOCKED: Graph API error (status=${err.status} code=${err.code ?? "n/a"} type=${err.type ?? "n/a"})`);
  console.log(`  message: ${err.message}`);
  if (err.isAuthError) {
    console.log("  Classification: AUTH — token invalid/expired. Generate a fresh User Access Token.");
  } else if (err.isPermissionError) {
    console.log("  Classification: PERMISSION — token valid but not authorized for the Ad Library API.");
  } else if (err.isRateLimit) {
    console.log("  Classification: RATE LIMIT — wait and retry.");
  } else {
    console.log("  Classification: OTHER — see message/code above.");
  }
  process.exitCode = 1;
}

async function main() {
  const accessToken = process.env.META_AD_LIBRARY_ACCESS_TOKEN;
  if (!accessToken) {
    console.log("BLOCKED: META_AD_LIBRARY_ACCESS_TOKEN is not set.");
    console.log("Generate a User Access Token with ads_read in Graph API Explorer and export it.");
    process.exitCode = 1;
    return;
  }
  if (pageMode && !pageId) {
    console.log("Usage: node scripts/metaAdLibraryProbe.ts --page <pageId> [countryCode]");
    process.exitCode = 1;
    return;
  }

  try {
    if (!pageMode) {
      console.log(`Discovery query: search_terms="${searchTerms}" country=${countryCode} ad_type=ALL`);
      console.log("(Reminder: search_terms matches creative TEXT, not the advertiser — expect unrelated Pages.)");
      const response = await queryAdsArchive({
        accessToken,
        searchTerms,
        adReachedCountries: [countryCode],
        adType: "ALL",
        limit: 5,
      });
      printSummary("Discovery results", response);
      return;
    }

    /* ---- Advertiser mode: the load-bearing attribution test ---- */

    console.log(`Advertiser query: search_page_ids=["${pageId}"] country=${countryCode} ad_type=ALL limit=2`);
    const first = await queryAdsArchive({
      accessToken,
      searchPageIds: [pageId!],
      adReachedCountries: [countryCode],
      adType: "ALL",
      limit: 2,
    });
    const firstAds = printSummary("Page 1 (limit 2)", first);

    const offPage = firstAds.filter((a) => a.advertiserPageId !== pageId);
    console.log(
      offPage.length === 0
        ? "Attribution check (page 1): PASS — every result belongs to the queried page_id."
        : `Attribution check (page 1): FAIL — ${offPage.length} result(s) from other Pages: ${offPage
            .map((a) => `${a.advertiserName} (${a.advertiserPageId})`)
            .join("; ")}`
    );

    const after = first.paging?.cursors?.after;
    if (after && first.paging?.next) {
      const second = await queryAdsArchive({
        accessToken,
        searchPageIds: [pageId!],
        adReachedCountries: [countryCode],
        adType: "ALL",
        limit: 2,
        after,
      });
      const secondAds = printSummary("Page 2 (via after-cursor)", second);
      const secondOffPage = secondAds.filter((a) => a.advertiserPageId !== pageId);
      const firstIds = new Set(firstAds.map((a) => a.adId));
      const overlap = secondAds.filter((a) => firstIds.has(a.adId)).length;
      console.log(
        secondOffPage.length === 0
          ? "Attribution check (page 2): PASS"
          : `Attribution check (page 2): FAIL — ${secondOffPage.length} off-page result(s)`
      );
      console.log(`Cursor advanced correctly: ${overlap === 0 ? "yes (no overlap with page 1)" : `NO — ${overlap} duplicate ad id(s)`}`);
    } else {
      console.log("Paging test: skipped — no next cursor (advertiser has too few ads for a second page at limit 2).");
    }

    console.log(`\nActive-only query: search_page_ids=["${pageId}"] ad_active_status=ACTIVE limit=5`);
    const active = await queryAdsArchive({
      accessToken,
      searchPageIds: [pageId!],
      adReachedCountries: [countryCode],
      adType: "ALL",
      adActiveStatus: "ACTIVE",
      limit: 5,
    });
    const activeAds = printSummary("ACTIVE-only results", active);
    const ended = activeAds.filter((a) => a.endedAt !== null).length;
    console.log(
      ended === 0
        ? "Active-status check: PASS — no returned ad has an end date."
        : `Active-status check: SOFT FAIL — ${ended} result(s) carry an end date despite ACTIVE filter.`
    );
  } catch (err) {
    if (err instanceof AdLibraryApiError) {
      classifyAndExit(err);
      return;
    }
    throw err;
  }
}

main();
