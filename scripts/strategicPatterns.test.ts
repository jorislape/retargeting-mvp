/**
 * Strategic-pattern reasoning layer proofs (plain Node, no framework).
 *
 * Covers the core truthfulness rule (a pattern only counts when it
 * recurs across at least 2 distinct pasted ad examples — never from a
 * single ad), the ColonBroom 3-ad fixture surfacing the specific rich
 * patterns it actually supports, and two neutral fixtures (SaaS, local
 * lead-gen/service business) proving the system doesn't inherit
 * health-product assumptions when the pasted evidence doesn't support
 * them — it reports its OWN domain's patterns instead, or stays empty.
 */
import assert from "node:assert/strict";
import {
  buildStrategicSummary,
  buildStrategicTests,
  detectStrategicPatterns,
} from "../modules/competitorDebrief/strategicPatterns.ts";

const COLONBROOM_ADS = [
  "I used to feel like I was thinking about food all day — what I call food noise never stopped, and years of a slowed metabolism made it worse. I tried everything and still felt out of control around cravings. Then I found a way to support natural GLP-1 production without a single injection or needle. No prescriptions, no waiting rooms. Over 425,000+ users have felt what it's like to finally feel in control again. Take our quiz to see your personalized plan — tap below to start.",
  "Cravings controlled my life for years — constant food noise, snacking I couldn't explain. The reason this works: it naturally supports GLP-1, the same pathway injections target, but without needles or a prescription. Clinically studied ingredients back every claim. For a limited time, get 70% off your first order — take the quiz to find your plan.",
  "My story: after years of failed diets and a slowed metabolism that wouldn't budge, I found a natural alternative and finally feel in control of my choices again. Instead of prescriptions or a long waiting list, this works with your body's own systems. Over 300,000 customers have tried it, and the results speak for themselves — clinically studied, no needles required. 70% off ends soon. Tap below to claim your spot.",
];

const SAAS_ADS = [
  "Stop wasting hours on manual data entry. Our AI-powered platform automates your workflow so your team can focus on what matters. Instead of juggling spreadsheets, get everything in one dashboard. Join 10,000+ teams already saving time. Start your free trial today — no credit card required.",
  "Tired of missed deadlines because of manual processes? Our platform works by automatically syncing your tools in real time. See why 12,000+ companies trust us. Limited time: 30% off annual plans. Book a demo today.",
  "Still copying data between spreadsheets by hand? Our AI-powered automation platform syncs everything instantly. Trusted by 15,000+ companies. Get 30% off your first year — book a demo today.",
];

const LOCAL_SERVICE_ADS = [
  "Missed calls mean missed revenue for your business. Our platform makes sure you never miss a lead again — instead of voicemail, customers get an instant text back. Over 5,000 local businesses trust us. Get more customers this month — book a free demo.",
  "Stop losing leads to missed calls. Our system works by automatically texting back every missed call within seconds. Join 6,000+ businesses already converting more leads. Limited time: first month free — book your demo today.",
  "Your front desk can't answer every call. We make sure missed calls turn into booked appointments, automatically. Trusted by thousands of local service businesses. First month free — schedule a call today.",
];

/* ------------------- core rule: no recurrence, no pattern ------------------ */

{
  // Fewer than 2 ad texts — nothing can honestly "recur".
  assert.deepEqual(detectStrategicPatterns([]), detectStrategicPatterns([]));
  const single = detectStrategicPatterns([COLONBROOM_ADS[0]]);
  for (const key of Object.keys(single) as (keyof typeof single)[]) {
    assert.deepEqual(single[key], [], `expected empty ${key} with only 1 ad text`);
  }
}

{
  // A term appearing in exactly ONE of two ads must not be reported —
  // proves "do not treat one example as a recurring pattern".
  const onlyOneMentionsGlp1 = detectStrategicPatterns([
    "This ad naturally supports GLP-1 and nothing else recognizable.",
    "This second ad is about something completely different — free shipping and fast delivery.",
  ]);
  assert.deepEqual(onlyOneMentionsGlp1.dominantNarrative, []);
}

/* ------------------------------- ColonBroom --------------------------------- */

{
  const p = detectStrategicPatterns(COLONBROOM_ADS);

  assert.ok(p.dominantNarrative.some((x) => x.includes("GLP-1")), `expected GLP-1 mechanism, got ${JSON.stringify(p.dominantNarrative)}`);

  assert.ok(p.problemFraming.includes("cravings"));
  assert.ok(p.problemFraming.includes("food noise"));

  assert.ok(p.enemyOrAlternative.includes("injections / needles"));
  assert.ok(p.enemyOrAlternative.includes("prescriptions"));

  assert.ok(p.desiredOutcome.includes("control"));

  assert.ok(p.proofStrategy.some((x) => x.startsWith("customer-count social proof")));
  assert.ok(p.proofStrategy.includes("clinically studied / research claims"));

  assert.ok(p.offerCtaStrategy.some((x) => x.startsWith("deep discount")));
  assert.ok(p.offerCtaStrategy.some((x) => x.includes("quiz")));

  assert.ok(p.creativeStructure.includes("testimonial / first-person story"));
  assert.ok(p.creativeStructure.includes("mechanism explanation"));

  // Verbatim enrichment: the specific pasted numbers, not a generic label.
  const countItem = p.proofStrategy.find((x) => x.startsWith("customer-count social proof"));
  assert.match(countItem ?? "", /\(e\.g\. "[\d,]+\+?\s*(?:users?|customers?)"\)/);

  const summary = buildStrategicSummary("ColonBroom", p);
  assert.ok(summary, "expected a strategic summary for the rich ColonBroom fixture");
  assert.match(summary ?? "", /^ColonBroom /);
  assert.match(summary ?? "", /observed repeatedly across the pasted examples, not a claim about performance/);

  const tests = buildStrategicTests(p, "ColonBroom");
  assert.ok(tests.length >= 3, `expected several specific tests, got ${tests.length}`);
  const hypotheses = tests.map((t) => t.hypothesis).join(" | ");
  assert.match(hypotheses, /craving/i);
  assert.match(hypotheses, /injection/i);
  assert.match(hypotheses, /quiz/i);

  console.log("ColonBroom strategic summary:", summary);
}

/* --------------------------- neutral: SaaS fixture -------------------------- */

{
  const p = detectStrategicPatterns(SAAS_ADS);

  // No health-product assumptions leak into a SaaS fixture.
  const allText = JSON.stringify(p).toLowerCase();
  for (const forbidden of ["glp-1", "craving", "food noise", "injection", "needle", "prescription", "metaboli", "gut ", "bloat"]) {
    assert.ok(!allText.includes(forbidden), `SaaS fixture must not contain health term "${forbidden}": ${allText}`);
  }

  // It's allowed (expected, even) to surface ITS OWN legitimate,
  // domain-appropriate recurring patterns instead of staying blank.
  assert.ok(p.dominantNarrative.some((x) => x.includes("AI")), "expected the AI-powered mechanism to recur");
  assert.ok(p.problemFraming.some((x) => x.includes("manual")), "expected the manual-process problem framing to recur");
  assert.ok(p.offerCtaStrategy.some((x) => x.startsWith("deep discount")));

  const summary = buildStrategicSummary("Acme SaaS", p);
  if (summary) assert.doesNotMatch(summary, /glp-1|craving|injection|needle/i);
}

/* --------------------- neutral: local lead-gen/service fixture ------------- */

{
  const p = detectStrategicPatterns(LOCAL_SERVICE_ADS);

  const allText = JSON.stringify(p).toLowerCase();
  for (const forbidden of ["glp-1", "craving", "food noise", "injection", "needle", "prescription", "metaboli", "gut ", "bloat", "clinically studied"]) {
    assert.ok(!allText.includes(forbidden), `local-service fixture must not contain health term "${forbidden}": ${allText}`);
  }

  assert.ok(
    p.problemFraming.includes("missed calls or leads"),
    `expected missed-calls problem framing, got ${JSON.stringify(p.problemFraming)}`
  );
}

/* -------------------- no forbidden performance/spend claims ---------------- */

{
  const p = detectStrategicPatterns(COLONBROOM_ADS);
  const summary = buildStrategicSummary("ColonBroom", p) ?? "";
  const tests = buildStrategicTests(p, "ColonBroom");
  const FORBIDDEN = /\b(ROAS|CPA|CPC|CTR|conversion rate|winning ad|spend of|impressions|clicks|went viral|outperform(?:ed|s)?\s+(?:for|at)\s+\w+|scaled to)\b/i;

  const fields = [
    summary,
    ...Object.values(p).flat(),
    ...tests.flatMap((t) => [t.hypothesis, t.hookOrAngle, t.format, t.proofMechanism, t.offerOrCta, t.whatYoullLearn]),
  ];
  for (const field of fields) {
    assert.doesNotMatch(field, FORBIDDEN, `forbidden claim in: "${field}"`);
  }
  // Directional wording is present where claims are made.
  assert.match(summary, /observed repeatedly|not a claim about performance/i);
}

console.log("strategicPatterns: all assertions passed");
