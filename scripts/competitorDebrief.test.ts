/**
 * Competitor Debrief V1 — engine + result-UI proofs (plain Node, no
 * framework).
 *
 * Covers the hard truthfulness requirements: insufficient evidence
 * must be stated explicitly (not guessed past), no field ever asserts
 * a performance/spend claim (verified by scanning every string field
 * for forbidden claim language), and the engine module never imports
 * network/fetch code, since the Ads Library and website URLs are
 * references only. Also covers the synthesis requirement (next tests
 * and "what stands out" must combine multiple evidence categories,
 * not just echo one label at a time) and a static check that the
 * result UI never renders a raw source URL as unwrapped visible text.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateCompetitorDebrief } from "../modules/competitorDebrief/engine.ts";

const BASE_INPUT = {
  competitorName: "ColonBroom",
  adsLibraryUrl: "https://www.facebook.com/ads/library/?active_status=active&q=colonbroom",
  websiteUrl: "https://colonbroom.com",
};

const UNOBSERVED_PREFIXES = [
  "No specific hook observed",
  "No specific format observed",
  "No proof mechanism observed",
  "No specific offer observed",
];
const isObserved = (value: string): boolean =>
  !UNOBSERVED_PREFIXES.some((p) => value.startsWith(p));

/* -------------------------- insufficient evidence -------------------------- */

{
  const d = generateCompetitorDebrief({ ...BASE_INPUT, observations: "" });
  assert.equal(d.insufficientEvidence, true);
  assert.ok(d.insufficientEvidenceNote && d.insufficientEvidenceNote.length > 0);
  assert.deepEqual(d.recurringHooks, []);
  assert.deepEqual(d.creativeFormats, []);
  assert.deepEqual(d.offerPatterns, []);
  assert.deepEqual(d.positioningThemes, []);
  assert.deepEqual(d.whatStandsOut, []);
  assert.deepEqual(d.nextTests, []);
  assert.deepEqual(d.whatToMonitorNext, []);
}

{
  // Text present but nothing recognizable in any tracked category.
  const d = generateCompetitorDebrief({
    ...BASE_INPUT,
    observations: "saw a couple of ads, not sure what they said exactly",
  });
  assert.equal(d.insufficientEvidence, true);
  assert.match(d.evidenceSummary, /Not enough was pasted/);
}

/* ---------------------------- sufficient evidence --------------------------- */

{
  const d = generateCompetitorDebrief({
    ...BASE_INPUT,
    observations:
      "UGC video with a founder-led hook, problem-first framing about bloating. " +
      "Offer: 20% off first order and free shipping. CTA: shop now. " +
      "Positioning leans clinically tested / science-backed claims, with customer reviews shown.",
  });
  assert.equal(d.insufficientEvidence, false);
  assert.equal(d.insufficientEvidenceNote, null);
  assert.ok(d.recurringHooks.length > 0, "expected at least one hook detected");
  assert.ok(d.creativeFormats.length > 0, "expected at least one format detected");
  assert.ok(d.offerPatterns.length > 0, "expected at least one offer pattern detected");
  assert.ok(d.positioningThemes.length > 0, "expected at least one positioning theme detected");
  assert.ok(d.nextTests.length >= 3 && d.nextTests.length <= 5);
  assert.ok(d.whatToMonitorNext.length > 0);
  assert.match(d.evidenceSummary, /Based on \d+ words? of pasted observations/);
  // Must disclaim full-library coverage, never affirmatively claim it.
  assert.match(d.evidenceSummary, /not a review of the full Meta Ads Library/i);
  for (const test of d.nextTests) {
    for (const key of ["hypothesis", "hookOrAngle", "format", "proofMechanism", "offerOrCta", "whatYoullLearn"]) {
      assert.equal(typeof (test as unknown as Record<string, string>)[key], "string");
    }
  }
}

/* --------------------- synthesis: combines multiple categories -------------- */

{
  // Deliberately rich: triggers several named synthesis rules at once
  // (problem-first+proof+guarantee, routine+direct-response offer,
  // natural+clinical, founder+UGC, before/after+benefit,
  // subscription+guarantee) so this proves real cross-category
  // combination, not a coincidence of one rule.
  const d = generateCompetitorDebrief({
    ...BASE_INPUT,
    observations:
      "UGC video from a founder telling her story about why she built this. " +
      "Problem-first hook about feeling bloated every day, backed by dozens of customer reviews " +
      "and a 30-day money-back guarantee. Positioning is natural and clean ingredients, clinically " +
      "tested and dermatologist-approved. It's framed as a daily routine, with 20% off your first " +
      "order as a limited-time offer. A before/after carousel shows results after 30 days, " +
      "promoting fast results. Subscribe and save is also offered, with the same money-back " +
      "guarantee applied.",
  });

  assert.equal(d.insufficientEvidence, false);
  // Multiple distinct combined patterns, not one flat label list.
  assert.ok(
    d.whatStandsOut.length >= 3,
    `expected several synthesized patterns, got ${d.whatStandsOut.length}: ${JSON.stringify(d.whatStandsOut)}`
  );
  // Every whatStandsOut entry must read as a synthesized pattern (uses
  // combinator language), not a bare "category: item, item" echo.
  const combinatorRe = /reinforc|combin|paired?|balanc|stack|tension|softened|preempt/i;
  for (const item of d.whatStandsOut) {
    assert.match(item, combinatorRe, `expected combinator language in: "${item}"`);
  }
  // whatStandsOut must never be reducible to a single raw category
  // list already shown elsewhere (e.g. exactly the positioning array
  // joined) — it has to add synthesis on top.
  assert.notDeepEqual(d.whatStandsOut, d.positioningThemes);
  assert.notDeepEqual(d.whatStandsOut, d.recurringHooks);

  assert.ok(d.nextTests.length >= 3);
  for (const test of d.nextTests) {
    const observedSlots = [test.hookOrAngle, test.format, test.proofMechanism, test.offerOrCta].filter(
      isObserved
    );
    assert.ok(
      observedSlots.length >= 2,
      `expected a test to combine >=2 observed dimensions, got ${observedSlots.length}: ${JSON.stringify(test)}`
    );
  }
  // At least one test must be an explicit synthesis (not the generic
  // fallback/rotation shape) — i.e. its hypothesis names a combination.
  assert.ok(
    d.nextTests.some((t) => combinatorRe.test(t.hypothesis) || /combin/i.test(t.hypothesis)),
    "expected at least one test hypothesis to explicitly name a combination"
  );
}

/* --------------------------- sources are references only -------------------- */

{
  const d = generateCompetitorDebrief({
    ...BASE_INPUT,
    observations: "founder-led video, 20% off first order, ugc format",
  });
  assert.equal(d.sources.adsLibraryUrl, BASE_INPUT.adsLibraryUrl);
  assert.equal(d.sources.websiteUrl, BASE_INPUT.websiteUrl);
  const serialized = JSON.stringify(d);
  assert.doesNotMatch(serialized, /"fetched"/i);
}

/* -------------------- no forbidden performance/spend claims ------------------ */

const FORBIDDEN = /\b(ROAS|CPA|CPC|CTR|conversion rate|winning ad|spend of|impressions|clicks)\b/i;

{
  const d = generateCompetitorDebrief({
    ...BASE_INPUT,
    observations:
      "founder-led video, before/after framing, bundle offer, discount, subscribe and save, " +
      "premium positioning, dermatologist reviews, guarantee, testimonials, fast results",
  });
  const fieldsToCheck = [
    d.evidenceSummary,
    ...d.recurringHooks,
    ...d.creativeFormats,
    ...d.offerPatterns,
    ...d.positioningThemes,
    ...d.whatStandsOut,
    ...d.nextTests.flatMap((t) => [
      t.hypothesis,
      t.hookOrAngle,
      t.format,
      t.proofMechanism,
      t.offerOrCta,
      t.whatYoullLearn,
    ]),
    ...d.whatToMonitorNext,
  ];
  for (const field of fieldsToCheck) {
    assert.doesNotMatch(field, FORBIDDEN, `forbidden performance claim in: "${field}"`);
  }
  // The caveat itself is the one place spend/performance/ROAS are
  // mentioned — deliberately, to disclaim them.
  assert.match(d.caveat, /never infers spend, conversions, ROAS, performance/);
  assert.match(d.caveat, /source reference only/);
  assert.match(d.caveat, /not fetched/);
  assert.match(d.caveat, /does not claim to have analyzed/);
}

/* --------------------- engine never imports network/fetch code -------------- */

{
  const src = readFileSync(
    new URL("../modules/competitorDebrief/engine.ts", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(src, /node:http|node:dns|node:net|fetch\(|guardedFetch|\bserver\.ts\b/);
}

/* ------------- result UI never renders a raw source URL as text ------------- */

{
  const src = readFileSync(
    new URL("../components/competitorDebrief/CompetitorDebriefResult.tsx", import.meta.url),
    "utf8"
  );
  // The raw URL must only ever be used as an attribute value (href /
  // title / aria-label), never interpolated as bare visible JSX text
  // between tags — that's the exact pattern that broke the header.
  assert.doesNotMatch(
    src,
    />\s*\{[^{}]*\.(adsLibraryUrl|websiteUrl)\}\s*</,
    "raw source URL must not be rendered as visible JSX text"
  );
  assert.match(src, /href=\{url\}/, "source rows must be real anchors, not styled text");
  assert.match(src, /target="_blank"/, "source links should open in a new tab");
  assert.match(src, /break-words|break-all/, "long text content needs safe word-wrapping");
  assert.match(src, /min-w-0/, "flex/grid children need min-w-0 so long content can shrink instead of overflowing");
  assert.match(src, /truncate/, "the short link label should be defensively truncated too");
}

console.log("competitorDebrief: all assertions passed");
