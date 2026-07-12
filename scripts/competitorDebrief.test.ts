/**
 * Competitor Debrief V1 — engine proofs (plain Node, no framework).
 *
 * Covers the two hard truthfulness requirements: insufficient evidence
 * must be stated explicitly (not guessed past), and no field ever
 * asserts a performance/spend claim — the engine is keyword-table
 * driven so this is enforced by construction, verified here by
 * scanning every string field for forbidden claim language. Also
 * proves the engine module never imports network/fetch code, since
 * the whole point of this flow is that the Ads Library and website
 * URLs are references only.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateCompetitorDebrief } from "../modules/competitorDebrief/engine.ts";

const BASE_INPUT = {
  competitorName: "ColonBroom",
  adsLibraryUrl: "https://www.facebook.com/ads/library/?active_status=active&q=colonbroom",
  websiteUrl: "https://colonbroom.com",
};

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
  assert.ok(d.whatStandsOut.length > 0, "expected trust/benefit signals to surface");
  assert.ok(d.nextTests.length >= 3 && d.nextTests.length <= 5);
  assert.ok(d.whatToMonitorNext.length > 0);
  assert.match(d.evidenceSummary, /Based on \d+ words? of pasted observations/);
  // Must disclaim full-library coverage, never affirmatively claim it.
  assert.match(d.evidenceSummary, /not a review of the full Meta Ads Library/i);
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
    ...d.nextTests.flatMap((t) => [t.title, t.rationale]),
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

console.log("competitorDebrief: all assertions passed");
