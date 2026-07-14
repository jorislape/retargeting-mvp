/**
 * Native Ads Library copy parser proofs (plain Node, no framework).
 *
 * Real-world-shaped samples (AG1, ColonBroom, an ecommerce product, a
 * SaaS ad) prove the pipeline extracts hook/benefits/proof/offer/CTA
 * from UNLABELED copy the way a user actually pastes it — the exact
 * gap the labeled-only parser (adParser.ts) left. Also covers: the
 * detection heuristic staying narrow (positive structural signals
 * only, never "absence of labels" alone), disclaimer paragraphs being
 * excluded from evidence while staying in `raw` verbatim, and
 * `textForAnalysis` keeping that boilerplate out of what would reach
 * the (untouched) recurrence engine.
 */
import assert from "node:assert/strict";
import { looksLikeAdsLibraryCopy, parseAdsLibraryExample } from "../modules/competitorDebrief/adsLibraryParser.ts";
import { computeAdCompleteness, parseAdExample, textForAnalysis } from "../modules/competitorDebrief/adParser.ts";

/* ---------------------------- detection heuristic ---------------------------- */

{
  // Emoji-bullet list — the AG1 shape.
  assert.equal(
    looksLikeAdsLibraryCopy("Some hook line.\n\n💚 Benefit one\n🦠 Benefit two"),
    true
  );
  // Checkmark-bullet list.
  assert.equal(
    looksLikeAdsLibraryCopy("Some hook line.\n\n✔ Free gift\n✔ Free shipping"),
    true
  );
  // A bare, short trailing CTA line on its own.
  assert.equal(looksLikeAdsLibraryCopy("An ad with no bullets at all.\n\nLearn More"), true);
  assert.equal(looksLikeAdsLibraryCopy("An ad with no bullets at all.\n\nShop Now"), true);
}

{
  // Plain single-sentence prose — no bullets, no bare CTA line — must
  // NOT be misrouted into the native pipeline. This is deliberate: a
  // celebrity-endorsement one-liner has no hook/body split to make, so
  // it's better served by the existing keyword-table fallback.
  assert.equal(
    looksLikeAdsLibraryCopy("Since 2021, AG1 has been the morning ritual Hugh Jackman relies on to start his day."),
    false
  );
  // A single line alone, even if it happens to BE a CTA phrase, isn't
  // "structure" — nothing to split it from.
  assert.equal(looksLikeAdsLibraryCopy("Shop Now"), false);
  assert.equal(looksLikeAdsLibraryCopy(""), false);
  assert.equal(looksLikeAdsLibraryCopy("   "), false);
}

/* ------------------------- minimal hook + body prose -------------------------- */
/* Two short, unlabeled prose paragraphs — no bullets, no CTA line — is its own   */
/* structural signal: a minimal "hook line, then a body paragraph" ad. Without    */
/* this, ads like the Huel example below fell through to the single-paragraph    */
/* "plain" fallback (which never infers hook/body at all) and showed "No fields   */
/* or signals detected" even though the copy was genuinely usable.               */

const HUEL_AD =
  "Millions of meals served.\n\n" +
  "Join people replacing unhealthy convenience food with a complete, balanced meal in " +
  "minutes — no prep, no mess, just real nutrition on your schedule, backed by a 30-day guarantee.";

{
  assert.equal(looksLikeAdsLibraryCopy(HUEL_AD), true);
  const p = parseAdsLibraryExample(HUEL_AD);
  assert.equal(p.parseMode, "native");
  assert.equal(p.hook, "Millions of meals served.");
  assert.match(p.body ?? "", /Join people replacing unhealthy convenience food/);
  // Existing trust table still fires over the body — no new vocabulary,
  // just applying the same detect() call this pipeline already made.
  assert.ok(p.detectedTrust.includes("guarantee / risk-reversal"));

  // The completeness UI must never say "No fields or signals detected"
  // for this — Hook + Proof is already real, non-empty evidence.
  const c = computeAdCompleteness(p);
  assert.notEqual(c.status, "empty");
  assert.ok(c.detectedFields.includes("Hook"));
  assert.ok(c.detectedFields.includes("Proof"));
}

{
  // Three+ short prose paragraphs still work — hook is paragraph 1, body
  // is every paragraph after it joined, nothing silently dropped.
  const threePara =
    "Stop guessing what to cook tonight.\n\n" +
    "Every box comes with pre-portioned ingredients and a simple recipe card.\n\n" +
    "Cancel or skip any week, no commitment required.";
  const p = parseAdsLibraryExample(threePara);
  assert.equal(p.hook, "Stop guessing what to cook tonight.");
  assert.match(p.body ?? "", /pre-portioned ingredients/);
  assert.match(p.body ?? "", /Cancel or skip any week/);
}

{
  // Two short JUNK fragments must NOT qualify just because they happen
  // to be two blank-line-separated "paragraphs" — the total-word floor
  // exists specifically to keep this conservative. Falls through to
  // "plain" mode and (correctly) reads as malformed/empty, not a false
  // "Hook" credit.
  assert.equal(looksLikeAdsLibraryCopy("asdf jkl.\n\nqwer tyui."), false);
  const p = parseAdExample("asdf jkl.\n\nqwer tyui.");
  assert.equal(p.parseMode, "plain");
  assert.equal(p.hook, undefined);
  const c = computeAdCompleteness(p);
  assert.equal(c.status, "malformed");
}

{
  // A long, genuinely multi-paragraph essay-shaped paste (well past the
  // "minimal" bounds) should NOT be forced into a two-slot hook/body
  // split — conservative on purpose, per the brief. It still falls
  // through to the existing "plain" fallback (keyword tables over the
  // whole text), unchanged.
  const longProse = Array.from(
    { length: 8 },
    (_, i) => `This is paragraph number ${i + 1} of a much longer piece of pasted text that keeps going on and on.`
  ).join("\n\n");
  assert.equal(looksLikeAdsLibraryCopy(longProse), false);
}

/* -------------------------------- AG1 sample --------------------------------- */

const AG1_AD = `Ready to upgrade your health routine? Most supplements aren't backed by science. AG1 Next Gen is.

💚 Clinically shown to fill nutrient gaps
🦠 With upgraded probiotics
⚡ Designed for absorption
🥄 One scoop a day

Act now and get:
✔ 3 FREE Travel Packs
✔ FREE Bottle Vitamin D3+K2 Drops
✔ FREE Canister + Shaker

Learn More`;

{
  const p = parseAdsLibraryExample(AG1_AD);
  assert.equal(p.parseMode, "native");
  assert.match(p.hook ?? "", /Ready to upgrade your health routine/);
  assert.equal(p.cta, "Learn More");
  assert.match(p.offer ?? "", /FREE Travel Packs/);
  assert.match(p.offer ?? "", /FREE Bottle Vitamin D3\+K2 Drops/);
  assert.ok(p.detectedTrust.some((t) => /clinically shown/i.test(t)), "expected the clinical bullet as a verbatim trust item");
  assert.ok(p.detectedTrust.includes("clinical claims"), "expected the category label alongside the verbatim quote");
  assert.ok(p.detectedBenefits.some((b) => /upgraded probiotics/i.test(b)));
  assert.ok(p.detectedBenefits.some((b) => /designed for absorption/i.test(b)));
  assert.ok(p.detectedFormats.includes("bullet-list / callout format"));
  assert.equal(p.raw, AG1_AD.trim(), "raw must stay byte-identical to the pasted text");
}

/* ------------------------ same AG1 sample, plus disclaimers ------------------ */

const AG1_DISCLAIMER =
  "This statement has not been evaluated by the Food and Drug Administration. This product is not intended " +
  "to diagnose, treat, cure, or prevent any disease. Individual results may vary. © 2026 AG1. All rights reserved.";

{
  const p = parseAdsLibraryExample(`${AG1_AD}\n\n${AG1_DISCLAIMER}`);
  assert.ok(p.ignoredDisclaimers && p.ignoredDisclaimers.length > 0, "disclaimer paragraph should be tracked");
  assert.match(p.ignoredDisclaimers?.[0] ?? "", /Food and Drug Administration/);
  // Extraction is unaffected — same evidence as the disclaimer-free version.
  assert.equal(p.cta, "Learn More");
  assert.match(p.offer ?? "", /FREE Travel Packs/);
  // Disclaimer content never leaks into evidence.
  assert.ok(!p.detectedTrust.some((t) => /results may vary/i.test(t)));
  assert.ok(!p.detectedBenefits.some((b) => /food and drug administration/i.test(b)));
  // But `raw` still preserves everything the user actually pasted —
  // nothing is silently dropped from the record of what was pasted.
  assert.match(p.raw, /Food and Drug Administration/);

  // textForAnalysis removes the disclaimer from what would reach the
  // engine, without touching `raw`.
  const analysisText = textForAnalysis(p);
  assert.doesNotMatch(analysisText, /Food and Drug Administration/);
  assert.doesNotMatch(analysisText, /results may vary/i);
  assert.match(analysisText, /Ready to upgrade your health routine/);
  assert.match(p.raw, /Food and Drug Administration/, "raw itself must remain untouched by textForAnalysis");
}

/* ----------------------------- ColonBroom sample ------------------------------ */

const COLONBROOM_AD = `Bloated after every meal? You're not alone.

🌿 Supports natural gut health
💪 Reduces bloating in days
✅ Clinically studied ingredients
✅ Loved by over 400,000 customers

Get 20% off your first order today.

Shop Now`;

{
  const p = parseAdsLibraryExample(COLONBROOM_AD);
  assert.equal(p.parseMode, "native");
  assert.match(p.hook ?? "", /Bloated after every meal/);
  assert.equal(p.cta, "Shop Now");
  assert.match(p.offer ?? "", /20% off/);
  assert.ok(p.detectedBenefits.some((b) => /gut health/i.test(b)));
  assert.ok(p.detectedTrust.some((t) => /400,000 customers/i.test(t)));
}

/* ------------------------------ ecommerce sample ------------------------------ */

const ECOMMERCE_AD = `Tired of bags that fall apart after a month?

✔ Handcrafted from full-grain leather
✔ Lifetime warranty included
✔ Free shipping on every order

Trusted by over 50,000 happy customers.

Shop Now`;

{
  const p = parseAdsLibraryExample(ECOMMERCE_AD);
  assert.equal(p.parseMode, "native");
  assert.equal(p.cta, "Shop Now");
  assert.match(p.offer ?? "", /[Ff]ree shipping/);
  assert.ok(p.detectedBenefits.some((b) => /full-grain leather/i.test(b)));
  assert.ok(p.detectedTrust.includes("customer count"));
  // "Trusted by over 50,000 customers" is social proof, not a celebrity/
  // influencer endorsement — the two must stay distinct categories.
  assert.ok(!p.detectedTrust.includes("celebrity / influencer endorsement"));
}

/* --------------------------------- SaaS sample -------------------------------- */

const SAAS_AD = `Stop losing leads to missed calls.

📞 Instantly routes calls to the right rep
📊 Real-time dashboard for your whole team
🔒 SOC 2 compliant

Book a demo today and see it in action.

Book a Demo`;

{
  const p = parseAdsLibraryExample(SAAS_AD);
  assert.equal(p.parseMode, "native");
  assert.equal(p.cta, "Book a Demo");
  assert.ok(p.detectedBenefits.some((b) => /routes calls/i.test(b)));
  assert.ok(p.detectedBenefits.some((b) => /soc 2 compliant/i.test(b)));
  // No discount/free-gift language in this ad — offer honestly stays
  // absent rather than being invented from "Book a Demo".
  assert.equal(p.offer, undefined);
}

/* -------------------------- recurrence isn't polluted ------------------------ */

{
  // Two DIFFERENT ads that happen to share the identical disclaimer
  // footer must not let that footer register as a "recurring" signal —
  // proven here by showing textForAnalysis produces distinct,
  // disclaimer-free text for each, which is what would actually reach
  // the (unmodified) recurrence engine.
  const adA = `${AG1_AD}\n\n${AG1_DISCLAIMER}`;
  const adB = `Stop losing leads to missed calls.\n\nBook a Demo\n\n${AG1_DISCLAIMER}`;
  const cleanedA = textForAnalysis(parseAdsLibraryExample(adA));
  const cleanedB = textForAnalysis(parseAdsLibraryExample(adB));
  assert.doesNotMatch(cleanedA, /Food and Drug Administration/);
  assert.doesNotMatch(cleanedB, /Food and Drug Administration/);
}

/* ------------------- labeled input still wins over structure ----------------- */

{
  // Explicit labels take priority even when the text ALSO has bullets —
  // parseAdExample (the router) must never let the native pipeline
  // override a deliberate labeled paste.
  const labeledWithBullets =
    "Headline: Reset your gut\nCTA: Shop Now\n\n💚 Bullet that looks native\n🦠 Another bullet";
  const p = parseAdExample(labeledWithBullets);
  assert.equal(p.parseMode, "labeled");
  assert.equal(p.headline, "Reset your gut");
  assert.equal(p.cta, "Shop Now");
}

console.log("adsLibraryParser: all assertions passed");
