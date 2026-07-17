/**
 * Internal Learnings MVP proofs (plain Node, no framework).
 *
 * Covers line parsing (outcome labels, malformed lines, duplicates,
 * empty input), the conservative term-overlap matcher in isolation,
 * applyInternalLearnings' three adjustment paths (suppress/adjust,
 * comparative reframe, builds-on tag) against hand-built fixtures for
 * precise control, and two full end-to-end runs through
 * generateCompetitorDebrief — a health-product fixture (the exact
 * ColonBroom scenario from the brief's manual-validation section) and
 * a SaaS fixture — proving no contamination between domains.
 */
import assert from "node:assert/strict";
import {
  applyInternalLearnings,
  parseInternalLearnings,
  parseLearningLine,
  termsOverlap,
} from "../modules/competitorDebrief/internalLearnings.ts";
import { generateCompetitorDebrief } from "../modules/competitorDebrief/engine.ts";
import type { CompetitorDebrief, CompetitorDebriefTest } from "../modules/competitorDebrief/types.ts";

/* ------------------------------- line parsing --------------------------------- */

{
  assert.deepEqual(parseLearningLine("Worked: UGC testimonial openings"), {
    outcome: "worked",
    raw: "Worked: UGC testimonial openings",
    text: "UGC testimonial openings",
    normalizedTerms: parseLearningLine("Worked: UGC testimonial openings").normalizedTerms,
  });
  assert.equal(parseLearningLine("Worked: UGC testimonial openings").outcome, "worked");
  assert.equal(parseLearningLine("Failed: Founder-led ads").outcome, "failed");
  assert.equal(parseLearningLine("Avoid: Anti-injection angle — already saturated").outcome, "avoid");
  assert.equal(parseLearningLine("Learning: Short hooks outperform long explanations").outcome, "learning");
  // Case-insensitive label, dash separator both work.
  assert.equal(parseLearningLine("worked - quiz cta").outcome, "worked");
  assert.equal(parseLearningLine("WORKED: Quiz CTA").outcome, "worked");
}

{
  // Malformed lines: no recognized label -> "unknown", never guessed,
  // whole line preserved as both raw and text.
  const p = parseLearningLine("just some random note with no label");
  assert.equal(p.outcome, "unknown");
  assert.equal(p.raw, "just some random note with no label");
  assert.equal(p.text, "just some random note with no label");
}

{
  // A recognized word used as prose, not a label (no separator) ->
  // still unknown, not mistaken for a real label.
  assert.equal(parseLearningLine("Worked great for us last quarter").outcome, "unknown");
  // Bare label with nothing after it -> unknown (no captured text).
  assert.equal(parseLearningLine("Worked").outcome, "unknown");
  assert.equal(parseLearningLine("Worked:").outcome, "unknown");
}

{
  // Empty input.
  assert.deepEqual(parseInternalLearnings(""), []);
  assert.deepEqual(parseInternalLearnings("   \n\n  "), []);
}

{
  // Duplicate learnings (exact + whitespace/case-normalized) collapse
  // to one entry, first occurrence's casing preserved.
  const parsed = parseInternalLearnings(
    "Worked: Quiz CTA\nWorked: Quiz CTA\nworked:   quiz cta  \nFailed: Founder-led ads"
  );
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].raw, "Worked: Quiz CTA");
  assert.equal(parsed[1].raw, "Failed: Founder-led ads");
}

{
  // One learning per line, mixed outcomes, malformed line included —
  // every line survives parsing (nothing silently dropped).
  const parsed = parseInternalLearnings(
    "Worked: UGC testimonial openings\n" +
      "Worked: Quiz CTA\n" +
      "Failed: Founder-led ads\n" +
      "Failed: Generic discount hooks\n" +
      "Avoid: Anti-injection angle — already saturated\n" +
      "Learning: Short hooks outperform long explanations\n" +
      "random note with no label"
  );
  assert.equal(parsed.length, 7);
  assert.deepEqual(
    parsed.map((p) => p.outcome),
    ["worked", "worked", "failed", "failed", "avoid", "learning", "unknown"]
  );
}

/* ------------------------------- termsOverlap ---------------------------------- */

{
  // The brief's own anti-injection example.
  const r = termsOverlap(
    "Anti-injection angle — already saturated",
    "Explicit anti-injection contrast vs. neutral natural-benefit framing (no alternative named)"
  );
  assert.equal(r.overlap, true);
  assert.ok(r.sharedTerms.includes("anti") && r.sharedTerms.includes("injection"));
}

{
  // Plural/singular ("injections" vs "injection", "needles" vs
  // "needle") still matches via the crude stemmer — two shared
  // distinctive terms clears the >=2-shared-terms threshold.
  const r = termsOverlap("Avoid: Injections and needles", "injections / needles");
  assert.equal(r.overlap, true);
}

{
  // A SINGLE shared term is deliberately NOT enough on its own unless
  // it dominates the shorter phrase's vocabulary — here only
  // "injection" is shared (the other word differs, "angle"/"needles"),
  // so a 2-word evidence label against a 4-word learning stays below
  // the two-thirds coverage bar. The real suppression path (tested
  // end-to-end below) doesn't depend on this exact pairing anyway — it
  // matches against the TEST's hookOrAngle text, which shares two
  // distinctive terms ("anti" + "injection"), clearing the >=2-shared
  // -terms/40%-coverage branch instead.
  const r = termsOverlap("Anti-injection angle — already saturated", "injections / needles");
  assert.equal(r.overlap, false);
}

{
  // A single incidentally-shared word from a longer, otherwise-
  // unrelated field must NOT count as overlap — the exact precision
  // fix that keeps "Quiz CTA" from tagging every test that happens to
  // reuse "quiz funnel" as a generic offer fallback.
  const r = termsOverlap("Quiz CTA", "quiz funnel");
  assert.equal(r.overlap, false);
}

{
  // But when the ENTIRE shorter field IS (functionally) the flagged
  // term, one shared word is enough — high-confidence case.
  const r = termsOverlap("Generic discount hooks", "discounts");
  assert.equal(r.overlap, true);
}

{
  // Two shared distinctive terms with strong coverage — the quiz-vs-
  // discount test genuinely being about quiz.
  const r = termsOverlap("Quiz CTA", "Quiz-funnel CTA vs. direct discount CTA");
  assert.equal(r.overlap, true);
}

{
  // Genuinely unrelated phrases never overlap.
  const r = termsOverlap("Email subject lines with emojis", "guarantee / risk-reversal");
  assert.equal(r.overlap, false);
  assert.deepEqual(r.sharedTerms, []);
}

/* ---------------------- applyInternalLearnings: hand-built fixtures ------------ */

const BASE_TEST: CompetitorDebriefTest = {
  hypothesis: "Original hypothesis text, unchanged unless adjusted.",
  hookOrAngle: "Problem-first opening: state the pain point before introducing the product",
  format: "UGC video",
  proofMechanism: "Customer reviews",
  offerOrCta: "20% off first order",
  whatYoullLearn: "Whether this angle moves the audience.",
};

function baseDebrief(nextTests: CompetitorDebriefTest[]): CompetitorDebrief {
  return {
    competitorName: "TestCo",
    sourceMode: "manual",
    sources: { adsLibraryUrl: "https://example.com/ads", websiteUrl: null },
    evidenceSummary: "Observed evidence for TestCo includes offer patterns.",
    insufficientEvidence: false,
    insufficientEvidenceNote: null,
    recurringHooks: [],
    creativeFormats: [],
    offerPatterns: ["discounts"],
    positioningThemes: ["problem-first"],
    whatStandsOut: [],
    dominantNarrative: ["mechanism-first framing"],
    problemFraming: [],
    enemyOrAlternative: ["injections / needles"],
    desiredOutcome: [],
    proofStrategy: ["testimonials"],
    offerCtaStrategy: [],
    creativeStructure: ["mechanism explanation"],
    strategicSummary: null,
    nextTests,
    whatToMonitorNext: [],
    caveat: "caveat text",
    internalLearnings: null,
  };
}

{
  // Empty learnings: debrief passes through unchanged, internalLearnings null.
  const debrief = baseDebrief([BASE_TEST]);
  const result = applyInternalLearnings(debrief, []);
  assert.deepEqual(result.nextTests, [BASE_TEST]);
  assert.equal(result.internalLearnings, null);
}

{
  // Malformed/"unknown" learnings never affect nextTests, but do
  // appear in the summary for transparency.
  const debrief = baseDebrief([BASE_TEST]);
  const learnings = parseInternalLearnings("just a note with no label");
  const result = applyInternalLearnings(debrief, learnings);
  assert.deepEqual(result.nextTests, [BASE_TEST]);
  assert.equal(result.internalLearnings?.items.length, 1);
  assert.equal(result.internalLearnings?.items[0].outcome, "unknown");
}

{
  // Unrelated learning changes nothing about the test itself — only
  // shows up in the considered-learnings list.
  const debrief = baseDebrief([BASE_TEST]);
  const learnings = parseInternalLearnings("Worked: Email subject lines with emojis");
  const result = applyInternalLearnings(debrief, learnings);
  assert.deepEqual(result.nextTests[0], BASE_TEST);
  assert.equal(result.nextTests[0].internalLearningNote, undefined);
  assert.equal(result.internalLearnings?.items.length, 1);
}

{
  // Worked learning overlapping a next-test's offerOrCta -> builds-on
  // tag, hypothesis prefixed to acknowledge validation, hookOrAngle/
  // format/proof/offer fields untouched (idea itself doesn't change).
  const debrief = baseDebrief([BASE_TEST]);
  const learnings = parseInternalLearnings("Worked: 20% off first order");
  const result = applyInternalLearnings(debrief, learnings);
  const t = result.nextTests[0];
  assert.equal(t.internalLearningNote?.kind, "builds-on");
  assert.equal(t.internalLearningNote?.label, "Builds on internal learning");
  assert.match(t.internalLearningNote?.explanation ?? "", /20% off first order/);
  assert.match(t.hypothesis, /already validated this direction/i);
  assert.equal(t.hookOrAngle, BASE_TEST.hookOrAngle);
  assert.equal(t.offerOrCta, BASE_TEST.offerOrCta);
}

{
  // Worked learning overlapping COMPETITOR EVIDENCE only (not any
  // next-test field) -> no test is force-changed (requirement: don't
  // force an internal-learning reference when there's no meaningful
  // match to a recommendation), but the learning still shows in the
  // considered list.
  const debrief = baseDebrief([BASE_TEST]);
  const learnings = parseInternalLearnings("Worked: Mechanism-first framing");
  const result = applyInternalLearnings(debrief, learnings);
  assert.equal(result.nextTests[0].internalLearningNote, undefined);
  assert.equal(result.internalLearnings?.items.length, 1);
}

{
  // Failed learning overlapping a proposed test's hookOrAngle ->
  // suppressed/adjusted, never left as-is. Alternative angle drawn
  // from the debrief's OWN evidence fields (never invented) since one
  // is available here (dominantNarrative/proofStrategy/etc.).
  const debrief = baseDebrief([BASE_TEST]);
  const learnings = parseInternalLearnings("Failed: Problem-first pain point opening");
  const result = applyInternalLearnings(debrief, learnings);
  const t = result.nextTests[0];
  assert.equal(t.internalLearningNote?.kind, "adjusted");
  assert.equal(t.internalLearningNote?.label, "Adjusted because this was previously tested");
  assert.notEqual(t.hookOrAngle, BASE_TEST.hookOrAngle, "must never recommend the flagged angle as-is");
  assert.match(t.hypothesis, /Skip this angle/);
  // The substituted angle must come from the debrief's own evidence,
  // never fabricated — here that's testimonials/mechanism-first/etc.
  assert.ok(
    ["testimonials", "mechanism-first framing", "injections / needles", "mechanism explanation"].some((e) =>
      t.hookOrAngle.toLowerCase().includes(e.toLowerCase())
    )
  );
}

{
  // Avoid learning overlapping a test's offerOrCta -> suppressed/
  // adjusted with the "avoids-failed" tag specifically — and ONLY the
  // conflicting field (offerOrCta here) is rewritten; hookOrAngle,
  // which wasn't part of the conflict, is left exactly as-is.
  const test: CompetitorDebriefTest = { ...BASE_TEST, offerOrCta: "Anti-injection angle contrast" };
  const debrief = baseDebrief([test]);
  const learnings = parseInternalLearnings("Avoid: Anti-injection angle — already saturated");
  const result = applyInternalLearnings(debrief, learnings);
  const t = result.nextTests[0];
  assert.equal(t.internalLearningNote?.kind, "avoids-failed");
  assert.equal(t.internalLearningNote?.label, "Avoids repeating a failed test");
  assert.notEqual(t.offerOrCta, test.offerOrCta);
  assert.equal(t.hookOrAngle, test.hookOrAngle, "the field that DIDN'T conflict must stay untouched");
}

{
  // No alternative evidence available -> still never recommends the
  // flagged angle as-is (honest placeholder instead of a fabricated
  // alternative), and still tags the conflict.
  const debrief: CompetitorDebrief = {
    ...baseDebrief([BASE_TEST]),
    dominantNarrative: [],
    proofStrategy: [],
    positioningThemes: [],
    creativeStructure: [],
  };
  const learnings = parseInternalLearnings("Failed: Problem-first pain point opening");
  const result = applyInternalLearnings(debrief, learnings);
  const t = result.nextTests[0];
  assert.notEqual(t.hookOrAngle, BASE_TEST.hookOrAngle);
  assert.equal(t.internalLearningNote?.kind, "adjusted");
  assert.doesNotMatch(t.hookOrAngle, /pain point/i, "must not restate the flagged angle");
}

{
  // Comparative "Learning:" line reframes an "A vs. B" hookOrAngle to
  // lead with the validated side, whichever position it started in.
  const testBFirst: CompetitorDebriefTest = {
    ...BASE_TEST,
    hookOrAngle: "Mechanism-explanation opening vs. testimonial/first-person opening",
  };
  const debrief = baseDebrief([testBFirst]);
  const learnings = parseInternalLearnings("Learning: Testimonial openings outperform mechanism-heavy openings");
  const result = applyInternalLearnings(debrief, learnings);
  const t = result.nextTests[0];
  assert.equal(t.internalLearningNote?.kind, "builds-on");
  assert.match(t.hookOrAngle, /^Testimonial\/first-person opening \(favored/i, "must reorder to lead with the validated side");
  assert.match(t.hypothesis, /outperforms mechanism-explanation opening/i);
}

{
  // Duplicate learnings pasted twice must not double-apply or produce
  // conflicting notes — parseInternalLearnings already dedupes, so
  // applyInternalLearnings only ever sees one copy.
  const debrief = baseDebrief([BASE_TEST]);
  const learnings = parseInternalLearnings("Worked: 20% off first order\nWorked: 20% off first order");
  assert.equal(learnings.length, 1);
  const result = applyInternalLearnings(debrief, learnings);
  assert.equal(result.nextTests[0].internalLearningNote?.kind, "builds-on");
  assert.equal(result.internalLearnings?.items.length, 1);
}

{
  // Requirement: competitor evidence is never silently deleted —
  // every evidence array passes through byte-identical regardless of
  // what learnings are applied.
  const debrief = baseDebrief([BASE_TEST]);
  const learnings = parseInternalLearnings("Avoid: Mechanism-first framing\nFailed: 20% off first order");
  const result = applyInternalLearnings(debrief, learnings);
  assert.deepEqual(result.recurringHooks, debrief.recurringHooks);
  assert.deepEqual(result.offerPatterns, debrief.offerPatterns);
  assert.deepEqual(result.positioningThemes, debrief.positioningThemes);
  assert.deepEqual(result.dominantNarrative, debrief.dominantNarrative);
  assert.deepEqual(result.enemyOrAlternative, debrief.enemyOrAlternative);
  assert.deepEqual(result.proofStrategy, debrief.proofStrategy);
  assert.deepEqual(result.creativeStructure, debrief.creativeStructure);
}

/* --------------------- end-to-end: health-product (ColonBroom) fixture --------- */
/* The exact scenario from the brief's "Manual validation" section.              */

const COLONBROOM_ADS = [
  "I used to feel like I was thinking about food all day — what I call food noise never stopped, and years of a slowed metabolism made it worse. I tried everything and still felt out of control around cravings. Then I found a way to support natural GLP-1 production without a single injection or needle. No prescriptions, no waiting rooms. Over 425,000+ users have felt what it's like to finally feel in control again. Take our quiz to see your personalized plan — tap below to start.",
  "Cravings controlled my life for years — constant food noise, snacking I couldn't explain. The reason this works: it naturally supports GLP-1, the same pathway injections target, but without needles or a prescription. Clinically studied ingredients back every claim. For a limited time, get 70% off your first order — take the quiz to find your plan.",
  "My story: after years of failed diets and a slowed metabolism that wouldn't budge, I found a natural alternative and finally feel in control of my choices again. Instead of prescriptions or a long waiting list, this works with your body's own systems. Over 300,000 customers have tried it, and the results speak for themselves — clinically studied, no needles required. 70% off ends soon. Tap below to claim your spot.",
];

const COLONBROOM_LEARNINGS =
  "Worked: Quiz CTA\n" +
  "Failed: Generic discount hooks\n" +
  "Avoid: Anti-injection angle — already saturated\n" +
  "Learning: Testimonial openings outperform mechanism-heavy openings";

function buildColonBroomDebrief(internalLearningsText?: string) {
  return generateCompetitorDebrief({
    competitorName: "ColonBroom",
    adsLibraryUrl: "https://www.facebook.com/ads/library/?active_status=active&q=colonbroom",
    observations: COLONBROOM_ADS.join("\n\n"),
    exampleCount: COLONBROOM_ADS.length,
    adTexts: COLONBROOM_ADS,
    internalLearningsText,
  });
}

{
  const withLearnings = buildColonBroomDebrief(COLONBROOM_LEARNINGS);
  const without = buildColonBroomDebrief();

  // Competitor evidence is identical with or without learnings —
  // anti-injection, discount, quiz, testimonial/mechanism patterns
  // all still present.
  assert.deepEqual(withLearnings.enemyOrAlternative, without.enemyOrAlternative);
  assert.deepEqual(withLearnings.offerCtaStrategy, without.offerCtaStrategy);
  assert.deepEqual(withLearnings.creativeStructure, without.creativeStructure);
  assert.deepEqual(withLearnings.dominantNarrative, without.dominantNarrative);
  assert.ok(withLearnings.enemyOrAlternative.includes("injections / needles"));
  assert.ok(withLearnings.offerCtaStrategy.some((o) => o.includes("quiz")));
  assert.ok(withLearnings.offerCtaStrategy.some((o) => o.startsWith("deep discount")));
  assert.ok(withLearnings.creativeStructure.includes("testimonial / first-person story"));
  assert.ok(withLearnings.creativeStructure.includes("mechanism explanation"));

  // Internal learnings considered — all 4 lines, correctly categorized.
  assert.equal(withLearnings.internalLearnings?.items.length, 4);
  assert.deepEqual(
    withLearnings.internalLearnings?.items.map((i) => i.outcome),
    ["worked", "failed", "avoid", "learning"]
  );

  // Anti-injection is never presented as a fresh idea: no next test's
  // hookOrAngle proposes it as-is.
  const antiInjectionAsIs = withLearnings.nextTests.some((t) =>
    /anti-injection contrast/i.test(t.hookOrAngle)
  );
  assert.equal(antiInjectionAsIs, false, "anti-injection must never appear as a fresh, unflagged recommendation");
  const suppressedTest = withLearnings.nextTests.find((t) => t.internalLearningNote?.kind === "avoids-failed");
  assert.ok(suppressedTest, "expected one test flagged as avoiding the failed/avoided anti-injection angle");
  assert.match(suppressedTest?.internalLearningNote?.explanation ?? "", /Anti-injection angle/);

  // Quiz CTA treated as validated, not novel — specifically the test
  // that's actually ABOUT quiz vs. discount (not just any test that
  // happens to reuse "quiz funnel" as a generic offer fallback, which
  // must NOT get a false "builds-on" tag — see the termsOverlap
  // precision tests above).
  const quizVsDiscountTest = withLearnings.nextTests.find((t) => /quiz-funnel cta vs\. direct discount cta/i.test(t.offerOrCta));
  assert.ok(quizVsDiscountTest, "expected the quiz-vs-discount-cta strategic test to be present");
  assert.equal(quizVsDiscountTest?.internalLearningNote?.kind, "builds-on");
  assert.match(quizVsDiscountTest?.internalLearningNote?.explanation ?? "", /Quiz CTA/);

  // Conversely, a test where "quiz funnel" is merely a generic offer
  // fallback (not the test's actual subject) must NOT be tagged.
  const genericQuizFallbackTest = withLearnings.nextTests.find(
    (t) => t.offerOrCta === "quiz funnel" && !/quiz/i.test(t.hookOrAngle)
  );
  if (genericQuizFallbackTest) {
    assert.equal(genericQuizFallbackTest.internalLearningNote, undefined);
  }

  // Testimonial vs mechanism recommendation adapted using the supplied learning.
  const reframedTest = withLearnings.nextTests.find((t) =>
    /testimonial\/first-person opening \(favored/i.test(t.hookOrAngle)
  );
  assert.ok(reframedTest, "expected the testimonial-vs-mechanism test reframed to lead with testimonial");

  // Generic-discount "Failed" learning must not have wrongly suppressed
  // the quiz-vs-discount test (that test's offerOrCta is a quiz-vs-
  // discount COMPARISON with weak/incidental "discount" overlap, not a
  // generic discount hook — its own dedicated "Worked: Quiz CTA" match
  // wins instead).
  assert.notEqual(quizVsDiscountTest?.internalLearningNote?.kind, "adjusted");
}

/* --------------------------- end-to-end: SaaS fixture --------------------------- */

const SAAS_ADS = [
  "Missed calls mean missed revenue for every service business. Our founder built this after losing deals to slow follow-up himself. Now every call routes instantly to the right rep — no more voicemail, no more lost leads. Book a demo today and see your dashboard live. Trusted by over 12,000 teams.",
  "Stop losing leads to voicemail. Real-time call routing gets every customer to a human, fast — built by a founder who lived this problem firsthand. See it in action: book a demo. SOC 2 compliant and backed by a money-back guarantee.",
  "Every missed call is a missed sale. Our platform instantly connects callers to the right rep, day or night. Book a demo to see your team's dashboard live. 20% off your first three months for new customers.",
];

function buildSaasDebrief(internalLearningsText?: string) {
  return generateCompetitorDebrief({
    competitorName: "CallRoute",
    adsLibraryUrl: "https://www.facebook.com/ads/library/?active_status=active&q=callroute",
    observations: SAAS_ADS.join("\n\n"),
    exampleCount: SAAS_ADS.length,
    adTexts: SAAS_ADS,
    internalLearningsText,
  });
}

{
  const d = buildSaasDebrief();
  assert.equal(d.insufficientEvidence, false);
  assert.ok(d.positioningThemes.includes("founder-led"));
  assert.ok(d.nextTests.length >= 1);
}

{
  // A SaaS-relevant "Failed" learning suppresses/adjusts the matching
  // SaaS test(s) — checked against the UNADJUSTED baseline so the
  // fixture sanity check isn't looking at already-rewritten output.
  const baseline = buildSaasDebrief();
  const baselineDiscountCount = baseline.nextTests.filter((t) => t.offerOrCta.toLowerCase() === "discounts").length;
  assert.ok(baselineDiscountCount > 0, "fixture sanity check: expected at least one test offering a plain discount");

  const withLearning = buildSaasDebrief("Failed: Generic discount offers");
  let adjustedCount = 0;
  withLearning.nextTests.forEach((t, i) => {
    if (baseline.nextTests[i].offerOrCta.toLowerCase() === "discounts") {
      assert.equal(t.internalLearningNote?.kind, "adjusted");
      assert.notEqual(t.offerOrCta, "discounts");
      adjustedCount++;
    }
  });
  assert.equal(adjustedCount, baselineDiscountCount);
}

/* ------------------------- no contamination between domains -------------------- */

{
  // A health-domain learning must have ZERO effect on the SaaS debrief.
  const withHealthLearning = buildSaasDebrief("Avoid: Anti-injection angle — already saturated");
  const withoutLearning = buildSaasDebrief();
  assert.deepEqual(withHealthLearning.nextTests, withoutLearning.nextTests);
  assert.equal(withHealthLearning.internalLearnings?.items.length, 1, "learning still shown, just inert");
}

{
  // A SaaS-domain learning must have ZERO effect on the ColonBroom
  // (health) debrief.
  const withSaasLearning = buildColonBroomDebrief("Failed: Generic discount offers for SaaS trials");
  const withoutLearning = buildColonBroomDebrief();
  assert.deepEqual(withSaasLearning.nextTests, withoutLearning.nextTests);
}

console.log("internalLearnings: all assertions passed");
