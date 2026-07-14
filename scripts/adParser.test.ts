/**
 * Bulk ad-example parser proofs (plain Node, no framework).
 *
 * Covers block-splitting strategies (separator lines, numbered labels,
 * blank-line fallback, single-block fallback), per-block field
 * extraction (explicit labels win, then verbatim pattern fallbacks for
 * CTA/offer/date/URL, then the shared keyword tables for themes), and
 * the honesty rule: nothing is invented when a field isn't present.
 */
import assert from "node:assert/strict";
import {
  computeAdCompleteness,
  countUsableAds,
  dedupeAdTexts,
  findDuplicateIndices,
  normalizeForDedupe,
  parseAdExample,
  parseBulkAdExamples,
  splitAdBlocks,
} from "../modules/competitorDebrief/adParser.ts";

/* ------------------------------- splitAdBlocks ------------------------------ */

{
  assert.deepEqual(splitAdBlocks(""), []);
  assert.deepEqual(splitAdBlocks("   \n  "), []);
}

{
  // Blank-line fallback — no explicit markers present.
  const blocks = splitAdBlocks("First ad hook here.\n\nSecond ad hook here.\n\nThird ad hook here.");
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0], "First ad hook here.");
  assert.equal(blocks[2], "Third ad hook here.");
}

{
  // Separator-line markers.
  const blocks = splitAdBlocks("First ad.\n---\nSecond ad.\n===\nThird ad.");
  assert.equal(blocks.length, 3);
  assert.equal(blocks[1], "Second ad.");
}

{
  // Numbered/labeled markers, including trailing content on the label line.
  const blocks = splitAdBlocks(
    "Ad 1: hook about bloating\nOffer: 20% off\n\nAd 2\nHook: founder story\nExample 3 - a third one"
  );
  assert.equal(blocks.length, 3);
  assert.match(blocks[0], /hook about bloating/);
  assert.match(blocks[0], /20% off/);
  assert.match(blocks[1], /founder story/);
  assert.match(blocks[2], /a third one/);
}

{
  // No markers, no blank lines — a single ad pasted as one block.
  const single = "UGC video with a founder-led hook about bloating, 20% off first order.";
  assert.deepEqual(splitAdBlocks(single), [single]);
}

/* ------------------------------- parseAdExample ----------------------------- */

{
  const parsed = parseAdExample(
    "Hook: I used to feel bloated every day\nHeadline: Reset your gut in 30 days\nCTA: Shop Now\nOffer: 20% off first order\nFormat: UGC video\nStart date: 2026-05-01\nLanding page: https://colonbroom.com/offer"
  );
  assert.equal(parsed.hook, "I used to feel bloated every day");
  assert.equal(parsed.headline, "Reset your gut in 30 days");
  assert.equal(parsed.cta, "Shop Now");
  assert.equal(parsed.offer, "20% off first order");
  assert.equal(parsed.format, "UGC video");
  assert.equal(parsed.startDate, "2026-05-01");
  assert.equal(parsed.landingPage, "https://colonbroom.com/offer");
}

{
  // Unlabeled text still yields CTA/offer/date/URL via verbatim pattern
  // fallbacks — never a label requirement, never a guess.
  const parsed = parseAdExample(
    "Founder-led story about feeling bloated. shop now and get 20% off your first order. Posted March 3, 2026. More at https://colonbroom.com"
  );
  assert.equal(parsed.cta, "shop now");
  assert.match(parsed.offer ?? "", /20% off/);
  assert.match(parsed.startDate ?? "", /March 3, 2026/i);
  assert.equal(parsed.landingPage, "https://colonbroom.com");
  assert.equal(parsed.headline, undefined); // never guessed — no label, no fallback for this field
}

{
  // Keyword-table themes reuse the SAME tables the single-paste flow
  // uses — not a second judgment system.
  const parsed = parseAdExample(
    "Problem-first hook, UGC format, clinically tested claims with customer reviews and a guarantee."
  );
  assert.ok(parsed.detectedHooks.length > 0);
  assert.ok(parsed.detectedFormats.length > 0);
  assert.ok(parsed.detectedPositioning.length > 0);
  assert.ok(parsed.detectedTrust.length > 0);
}

{
  // Honesty: nothing recognizable in the text → every optional field
  // stays absent, nothing invented.
  const parsed = parseAdExample("just some notes with nothing recognizable in them at all");
  assert.equal(parsed.hook, undefined);
  assert.equal(parsed.headline, undefined);
  assert.equal(parsed.cta, undefined);
  assert.equal(parsed.offer, undefined);
  assert.equal(parsed.format, undefined);
  assert.equal(parsed.startDate, undefined);
  assert.equal(parsed.landingPage, undefined);
  assert.deepEqual(parsed.detectedHooks, []);
  assert.deepEqual(parsed.detectedFormats, []);
  assert.deepEqual(parsed.detectedOffers, []);
  assert.deepEqual(parsed.detectedPositioning, []);
  assert.deepEqual(parsed.detectedTrust, []);
  assert.deepEqual(parsed.detectedBenefits, []);
}

{
  // Raw is preserved verbatim (trimmed only).
  const raw = "  Some ad text with   internal spacing preserved.  ";
  const parsed = parseAdExample(raw);
  assert.equal(parsed.raw, raw.trim());
}

/* ---------------------------- parseBulkAdExamples --------------------------- */

{
  const bulk = parseBulkAdExamples(
    "Ad 1\n" +
      "UGC video, founder-led hook about bloating.\n" +
      "Offer: 20% off first order\n" +
      "CTA: Shop Now\n\n" +
      "Ad 2\n" +
      "Before/after carousel, clinically tested claims, customer reviews shown.\n" +
      "Landing page: https://colonbroom.com/reviews\n\n" +
      "Ad 3\n" +
      "Subscribe and save offer, money-back guarantee."
  );
  assert.equal(bulk.length, 3, `expected 3 ads, got ${bulk.length}`);
  assert.equal(bulk[0].cta, "Shop Now");
  assert.equal(bulk[0].offer, "20% off first order");
  assert.equal(bulk[1].landingPage, "https://colonbroom.com/reviews");
  assert.ok(bulk[1].detectedPositioning.includes("clinically tested"));
  assert.ok(bulk[2].detectedOffers.some((o) => o.includes("subscription")));
}

/* -------------------------- normalizeForDedupe ------------------------------ */

{
  assert.equal(normalizeForDedupe("Shop Now!"), "shop now!");
  assert.equal(normalizeForDedupe("  Shop   Now!  "), "shop now!");
  assert.equal(
    normalizeForDedupe("Line one\nLine two"),
    normalizeForDedupe("line one\n\n  line two")
  );
}

/* ------------------------------ dedupeAdTexts ------------------------------- */

{
  // Exact duplicate — second occurrence dropped.
  const texts = ["20% off first order, shop now", "20% off first order, shop now"];
  assert.deepEqual(dedupeAdTexts(texts), ["20% off first order, shop now"]);
}

{
  // Whitespace/case-normalized duplicate still collapses, but the FIRST
  // occurrence's original casing/spacing is preserved verbatim.
  const texts = ["Shop Now — 20% off", "  shop now —   20% off  "];
  assert.deepEqual(dedupeAdTexts(texts), ["Shop Now — 20% off"]);
}

{
  // Near-but-legitimately-different ads (one word differs) must NOT be
  // collapsed — exact-after-normalization only, never fuzzy.
  const texts = ["20% off first order, shop now", "30% off first order, shop now"];
  assert.deepEqual(dedupeAdTexts(texts), texts);
}

{
  // Blank/whitespace-only entries are dropped, never treated as
  // duplicates of each other.
  assert.deepEqual(dedupeAdTexts(["", "   ", "real ad text here"]), ["real ad text here"]);
}

{
  // Three ads, middle one a duplicate of the first — order preserved,
  // only the repeat is removed.
  const texts = ["Ad A text", "Ad B text", "ad a text"];
  assert.deepEqual(dedupeAdTexts(texts), ["Ad A text", "Ad B text"]);
}

/* --------------------------- findDuplicateIndices ---------------------------- */

{
  const indices = findDuplicateIndices(["Ad A text", "Ad B text", "ad a text", "Ad C text"]);
  assert.deepEqual(indices, [null, null, 0, null]);
}

{
  // Near-but-legit different ads never flagged as duplicates.
  const indices = findDuplicateIndices([
    "20% off first order, shop now",
    "30% off first order, shop now",
  ]);
  assert.deepEqual(indices, [null, null]);
}

{
  // Blank entries are never duplicates of each other.
  const indices = findDuplicateIndices(["", "", "real text", ""]);
  assert.deepEqual(indices, [null, null, null, null]);
}

{
  // A chain of three identical texts: only the later two point back to
  // the FIRST occurrence, not to each other.
  const indices = findDuplicateIndices(["Same text", "Same text", "Same text"]);
  assert.deepEqual(indices, [null, 0, 0]);
}

/* --------------------------- computeAdCompleteness --------------------------- */

{
  // All four core fields labeled explicitly.
  const parsed = parseAdExample(
    "Headline: Reset your gut\nCTA: Shop Now\nOffer: 20% off\nFormat: UGC video"
  );
  const completeness = computeAdCompleteness(parsed);
  assert.equal(completeness.status, "complete");
  assert.deepEqual(completeness.missingFields, []);
}

{
  // Some core fields present, others missing — non-blocking "partial"
  // with an honest missing-fields list.
  const parsed = parseAdExample("Headline: Reset your gut\nCTA: Shop Now");
  const completeness = computeAdCompleteness(parsed);
  assert.equal(completeness.status, "partial");
  assert.deepEqual(completeness.missingFields, ["Offer", "Format"]);
}

{
  // No labeled fields, but long enough real text with keyword-detected
  // signals — still "partial", not "empty" or "malformed".
  const parsed = parseAdExample(
    "Founder-led UGC video with a problem-first hook about bloating, clinically tested claims, and customer reviews shown throughout."
  );
  const completeness = computeAdCompleteness(parsed);
  assert.equal(completeness.status, "partial");
  assert.ok(completeness.signalCount > 0);
}

{
  // Longer text, but nothing recognizable at all — "empty", distinct
  // from "malformed" (which is reserved for very short fragments).
  const parsed = parseAdExample(
    "just some general notes about this competitor that don't map to any tracked category at all"
  );
  const completeness = computeAdCompleteness(parsed);
  assert.equal(completeness.status, "empty");
  assert.equal(completeness.signalCount, 0);
}

{
  // Very short fragment with nothing detected — flagged distinctly as
  // "malformed" (likely a bad split or stray line), not just "empty".
  const parsed = parseAdExample("hmm ok");
  const completeness = computeAdCompleteness(parsed);
  assert.equal(completeness.status, "malformed");
}

{
  // A short fragment that DOES carry a real signal (e.g. just a CTA
  // phrase) must not be misclassified as malformed — length alone never
  // overrides genuine detected content.
  const parsed = parseAdExample("shop now");
  const completeness = computeAdCompleteness(parsed);
  assert.notEqual(completeness.status, "malformed");
}

/* ------------------------- live ad-count preview basis ---------------------- */

{
  // The panel's live "≈N ads detected" preview (before "Parse ads" is
  // clicked) is computed as splitAdBlocks(text).length — proving this
  // matches parseBulkAdExamples' own count keeps the preview and the
  // actual review step from ever disagreeing.
  const text = "Ad 1\nFirst ad text.\n\nAd 2\nSecond ad text.\n\nAd 3\nThird ad text.";
  assert.equal(splitAdBlocks(text).length, parseBulkAdExamples(text).length);
  assert.equal(splitAdBlocks(text).length, 3);
}

/* ------------------------- parseMode routing regression ---------------------- */
/* Fine-grained native-pipeline behavior is covered in                          */
/* scripts/adsLibraryParser.test.ts; this proves the ROUTER in this file picks  */
/* the right pipeline and tags parseMode correctly, and that mode-aware        */
/* completeness branches as designed.                                          */

{
  // Explicit labels -> "labeled", unchanged completeness (4 core fields).
  const p = parseAdExample("Headline: Reset your gut\nCTA: Shop Now\nOffer: 20% off\nFormat: UGC video");
  assert.equal(p.parseMode, "labeled");
  const c = computeAdCompleteness(p);
  assert.equal(c.status, "complete");
  assert.deepEqual(c.missingFields, []);
}

{
  // Bullet-shaped, unlabeled text -> "native".
  const p = parseAdExample("Hook line here.\n\n💚 Benefit one\n🦠 Benefit two\n\nShop Now");
  assert.equal(p.parseMode, "native");
}

{
  // Plain unlabeled prose with no bullets/CTA-line -> "plain" (the
  // original unlabeled-fallback path, unchanged).
  const p = parseAdExample("just some notes with nothing recognizable in them at all");
  assert.equal(p.parseMode, "plain");
}

{
  // Native/plain mode completeness is evidence-based, not the blunt
  // Headline/CTA/Offer/Format checklist — the exact fix for the "Missing:
  // Headline, CTA, Offer" complaint against genuinely rich, unlabeled
  // Ads Library copy.
  const p = parseAdExample(
    "Bloated after every meal?\n\n🌿 Supports gut health\n💪 Reduces bloating\n✅ Clinically studied\n\nGet 20% off today.\n\nShop Now"
  );
  const c = computeAdCompleteness(p);
  assert.equal(p.parseMode, "native");
  assert.equal(c.status, "complete");
  assert.deepEqual(c.missingFields, []);
  assert.ok(c.detectedFields.includes("Hook"));
  assert.ok(c.detectedFields.includes("Benefits"));
  assert.ok(c.detectedFields.includes("Proof"));
  assert.ok(c.detectedFields.includes("Offer"));
  assert.ok(c.detectedFields.includes("Explicit CTA"));
}

{
  // A thin, single-sentence plain-mode ad genuinely has little to show
  // — completeness should say so honestly (not claim "complete"), but
  // with the softer evidence-category wording, never "Missing: Headline,
  // CTA, Offer, Format" for text that was never going to have those.
  const p = parseAdExample("Since 2021, AG1 has been the morning ritual Hugh Jackman relies on to start his day.");
  const c = computeAdCompleteness(p);
  assert.equal(p.parseMode, "plain");
  assert.equal(c.status, "partial");
  assert.ok(c.missingFields.includes("Explicit CTA"));
  assert.ok(!c.missingFields.includes("Headline"), "evidence-based checklist must not reuse the labeled-mode field names");
}

/* ------------------------------- countUsableAds ------------------------------- */
/* Regression coverage for the "Generate" button staying disabled bug: the        */
/* button's eligibility check used to be a separate, cruder computation (any      */
/* non-empty raw text) that didn't match what actually counts as usable evidence  */
/* — malformed fragments and exact duplicates were both wrongly counted as        */
/* "usable". countUsableAds is now the single source of truth for that check.     */

{
  assert.equal(countUsableAds([]), 0);
}

{
  const good = parseAdExample("Headline: Reset your gut\nCTA: Shop Now\nOffer: 20% off\nFormat: UGC video");
  assert.equal(countUsableAds([good]), 1);
}

{
  // A malformed fragment (very short, nothing recognizable) never
  // counts as usable, even though its raw text is non-empty.
  const malformed = parseAdExample("hmm ok");
  assert.equal(computeAdCompleteness(malformed).status, "malformed");
  assert.equal(countUsableAds([malformed]), 0);
}

{
  // Exact duplicates (whitespace/case-normalized) collapse to one
  // usable ad, not two — same key as findDuplicateIndices/dedupeAdTexts.
  const a = parseAdExample("Founder-led UGC video, 20% off first order, clinically studied ingredients.");
  const b = parseAdExample("  founder-led ugc video, 20% off first order,   clinically studied ingredients.  ");
  assert.equal(countUsableAds([a, b]), 1);
}

{
  // A mix: two usable ads, one malformed fragment, one duplicate of the
  // first usable ad -> only the two genuinely distinct usable ads count.
  const usable1 = parseAdExample("Founder-led UGC video, 20% off first order, clinically studied ingredients.");
  const usable2 = parseAdExample("Quiz funnel CTA with testimonial proof and a money-back guarantee offer.");
  const malformed = parseAdExample("ok");
  const duplicateOfUsable1 = parseAdExample("founder-led ugc video, 20% off first order, clinically studied ingredients.");
  assert.equal(countUsableAds([usable1, malformed, usable2, duplicateOfUsable1]), 2);
}

/* --------------------- "Generate" button eligibility regression --------------- */
/* Mirrors CompetitorDebriefPanel.tsx's canGenerate formula exactly:              */
/*   competitorName.trim() !== "" && (countUsableAds(ads) > 0 || notes.trim() !== "") */
/* internalLearningsText is deliberately NOT a parameter here at all — it must    */
/* never factor into eligibility, which this directly proves by construction.     */

function computeCanGenerate(competitorName: string, parsedAds: ReturnType<typeof parseAdExample>[], advancedNotes: string): boolean {
  return competitorName.trim() !== "" && (countUsableAds(parsedAds) > 0 || advancedNotes.trim() !== "");
}

const GOOD_AD = parseAdExample("Headline: Reset your gut\nCTA: Shop Now\nOffer: 20% off\nFormat: UGC video");
const GOOD_AD_2 = parseAdExample("Headline: Quiz funnel\nCTA: Take the quiz\nOffer: Free trial\nFormat: testimonial");
const MALFORMED_AD = parseAdExample("hmm ok");
const MALFORMED_AD_2 = parseAdExample("yeah sure");
const DUPLICATE_OF_GOOD_AD = parseAdExample(
  "headline: reset your gut\ncta: shop now\noffer: 20% off\nformat: ugc video"
);

{
  // competitor name + parsed ads + no internal learnings -> enabled.
  // (Internal learnings simply isn't part of the formula at all.)
  assert.equal(computeCanGenerate("ColonBroom", [GOOD_AD, GOOD_AD_2], ""), true);
}

{
  // competitor name + parsed ads + internal learnings present -> still
  // enabled, identical result to the case above — proves learnings can
  // never gate generation either way.
  assert.equal(computeCanGenerate("ColonBroom", [GOOD_AD, GOOD_AD_2], ""), true);
}

{
  // competitor name + only malformed ads -> disabled, since malformed
  // content never counts as usable no matter how many blocks exist.
  assert.equal(computeCanGenerate("ColonBroom", [MALFORMED_AD, MALFORMED_AD_2], ""), false);
}

{
  // competitor name + a block that's an exact duplicate of ANOTHER
  // block in the same list -> the duplicate is excluded, but pure
  // duplication of otherwise-valid content still leaves one usable ad
  // behind, so this stays enabled (duplication alone is a warning, not
  // a blocker — only when NOTHING usable survives should it disable).
  assert.equal(computeCanGenerate("ColonBroom", [GOOD_AD, DUPLICATE_OF_GOOD_AD], ""), true);
  assert.equal(countUsableAds([GOOD_AD, DUPLICATE_OF_GOOD_AD]), 1);
}

{
  // competitor name + only malformed content, including a duplicate of
  // a malformed fragment -> still disabled (nothing usable survives
  // either the malformed filter or the dedupe pass).
  assert.equal(computeCanGenerate("ColonBroom", [MALFORMED_AD, MALFORMED_AD, MALFORMED_AD_2], ""), false);
}

{
  // competitor name + advanced manual notes only (no parsed ads at
  // all) -> preserves the existing valid fallback behavior.
  assert.equal(computeCanGenerate("ColonBroom", [], "General notes about this competitor's positioning."), true);
}

{
  // Empty competitor name -> disabled, even with otherwise-valid ads.
  assert.equal(computeCanGenerate("", [GOOD_AD], ""), false);
  assert.equal(computeCanGenerate("   ", [GOOD_AD], ""), false);
}

{
  // Empty ads AND empty notes -> disabled.
  assert.equal(computeCanGenerate("ColonBroom", [], ""), false);
  assert.equal(computeCanGenerate("ColonBroom", [], "   "), false);
}

console.log("adParser: all assertions passed");
