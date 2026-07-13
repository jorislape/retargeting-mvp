import { detect } from "../competitor/pageSignals.ts";
import type { CompetitorDebriefTest } from "./types.ts";

/**
 * Strategic-pattern reasoning layer — deterministic, keyword/regex
 * only, no AI, no invented claims. Goes one level deeper than the
 * existing hooks/formats/offers/positioning categories: instead of
 * classifying broad signals, it looks for the SAME kind of thing —
 * recurring mechanism, problem framing, rejected alternative, desired
 * outcome, proof strategy, offer/CTA structure, and creative structure
 * — across MULTIPLE pasted ad examples, and only reports a pattern
 * when it appears in at least two distinct ads (never treats one
 * example as a recurring pattern).
 *
 * Every string this module returns traces to a fixed regex/keyword
 * match against the pasted ad text — nothing is inferred about
 * performance, spend, winners, or audience response.
 */

export interface StrategicPatterns {
  dominantNarrative: string[];
  problemFraming: string[];
  enemyOrAlternative: string[];
  desiredOutcome: string[];
  proofStrategy: string[];
  offerCtaStrategy: string[];
  creativeStructure: string[];
}

export const EMPTY_STRATEGIC_PATTERNS: StrategicPatterns = {
  dominantNarrative: [],
  problemFraming: [],
  enemyOrAlternative: [],
  desiredOutcome: [],
  proofStrategy: [],
  offerCtaStrategy: [],
  creativeStructure: [],
};

/* ------------------------------------------------------------------ */
/* Term tables — one per report section. Deliberately broad enough to  */
/* cover the domain of the example evidence (health/wellness DTC ads)  */
/* plus a handful of domain-agnostic patterns, so a SaaS or local-      */
/* service competitor is judged by the same code path rather than a    */
/* second system — it just won't match these specific phrases, and the */
/* section is correctly omitted rather than forced.                    */
/* ------------------------------------------------------------------ */

const NARRATIVE_MECHANISM_TERMS: { label: string; re: RegExp }[] = [
  { label: "GLP-1 mechanism", re: /\bglp[\s-]?1\b/i },
  { label: "gut-health / microbiome mechanism", re: /\bgut\s*(?:health|microbiome|flora)\b/i },
  { label: "metabolism / metabolic mechanism", re: /\bmetaboli(?:sm|c)\b/i },
  { label: "hormone mechanism", re: /\bhormon(?:e|al)\b/i },
  { label: "appetite-signaling mechanism", re: /\bappetite\s*(?:signal(?:ing)?|hormone|regulat\w*)\b/i },
  { label: "AI/algorithm-driven mechanism", re: /\bai[\s-]?powered\b|\balgorithm(?:ic)?\b/i },
  { label: "proven-system mechanism", re: /\bproven\s*system\b|\bscience-?backed\s*system\b/i },
];

const PROBLEM_FRAMING_TERMS: { label: string; re: RegExp }[] = [
  { label: "cravings", re: /\bcravings?\b/i },
  { label: "food noise", re: /\bfood\s*noise\b/i },
  { label: "failed diets / yo-yo dieting", re: /\bfailed\s*diets?\b|\byo-?yo\s*diet(?:ing)?\b/i },
  { label: "slowed metabolism", re: /\bslow(?:ed|ing)?\s*metabolism\b/i },
  { label: "bloating", re: /\bbloat(?:ing|ed)?\b/i },
  { label: "manual/tedious process", re: /\bmanual(?:ly)?\s*(?:process(?:es)?|spreadsheets?|data\s*entry)\b/i },
  { label: "missed calls or leads", re: /\bmissed\s*(?:calls?|leads?|appointments?|bookings?)\b/i },
];

const ENEMY_ALTERNATIVE_TERMS: { label: string; re: RegExp }[] = [
  { label: "injections / needles", re: /\binjections?\b|\bneedles?\b/i },
  { label: "prescriptions", re: /\bprescriptions?\b|\bRx\b/i },
  { label: "side effects", re: /\bside\s*effects?\b/i },
  { label: "high cost", re: /\bexpensive\b|\bhigh[\s-]cost\b/i },
  { label: "waiting / waitlists", re: /\bwaitlists?\b|\bwaiting\s*(?:room|list|period)\b|\blong\s*wait(?:s|ing)?\b/i },
  { label: "legacy tools / old way", re: /\blegacy\s*(?:system|software|tool)\b|\bold\s*way\b|\bspreadsheets?\b/i },
];

const DESIRED_OUTCOME_TERMS: { label: string; re: RegExp }[] = [
  { label: "control", re: /\b(?:take|regain|feel(?:ing)?\s*in)\s*control\b|\bin\s*control\b/i },
  { label: "freedom", re: /\bfreedom\b|\bfree(?:d)?\s*from\b/i },
  { label: "lighter / easier digestion", re: /\blighter\b|\beasier\s*digestion\b/i },
  { label: "confidence", re: /\bconfiden(?:ce|t)\b/i },
  { label: "more customers / leads", re: /\bmore\s*(?:customers|leads|bookings|clients)\b/i },
  { label: "time saved", re: /\bsave[s]?\s*(?:time|hours)\b|\btime[\s-]back\b/i },
];

const CUSTOMER_COUNT_LABEL = "customer-count social proof";
const DEEP_DISCOUNT_LABEL = "deep discount";

const PROOF_STRATEGY_TERMS: { label: string; re: RegExp }[] = [
  { label: CUSTOMER_COUNT_LABEL, re: /\b\d[\d,]{2,}\+?\s*(?:users?|customers?|people|members?)\b/i },
  {
    label: "clinically studied / research claims",
    re: /\bclinically\s*studied\b|\bclinical(?:ly)?\s*(?:tested|proven|research(?:ed)?)\b|\bresearch(?:ed)?[\s-]backed\b/i,
  },
  { label: "testimonials", re: /\btestimonial(?:s)?\b|\breal\s*(?:customer|user)s?\s*(?:review|stor)/i },
  { label: "before/after timeline", re: /\bbefore\s*(?:and|&|\/)\s*after\b|\bin\s*(?:just\s*)?\d+\s*(?:days?|weeks?)\b/i },
];

const OFFER_CTA_STRATEGY_TERMS: { label: string; re: RegExp }[] = [
  { label: DEEP_DISCOUNT_LABEL, re: /\b\d{2,3}%\s*off\b/i },
  { label: "urgency", re: /\blimited\s*time\b|\bends?\s*(?:soon|tonight|today)\b|\bhurry\b|\btoday\s*only\b/i },
  { label: "quiz funnel", re: /\btake\s*(?:the|our|this)?\s*quiz\b|\bquiz\b/i },
  { label: "tap/click-below CTA", re: /\btap\s*below\b|\bclick\s*below\b|\btap\s*(?:the\s*)?link\b/i },
  { label: "seasonal offer", re: /\bblack\s*friday\b|\bholiday\s*(?:sale|offer)\b|\bnew\s*year\b/i },
];

/** Structure is detected per-ad from shape, not vocabulary: a rough
 *  word count plus connector/marker words. Still fully deterministic —
 *  no invented structure, only what the regex/length actually shows. */
function detectStructureLabels(adText: string): string[] {
  const labels: string[] = [];
  const wordCount = adText.trim().split(/\s+/).filter(Boolean).length;

  const isFirstPersonStory =
    /\bI\s+(?:used\s+to|was|felt|struggled|started)\b/i.test(adText) ||
    /\bmy\s+(?:journey|story|life)\b/i.test(adText);
  if (isFirstPersonStory) labels.push("testimonial / first-person story");

  const hasExplainerConnector = /\b(?:works\s*by|the\s*reason|instead\s*of|because)\b/i.test(adText);
  if (hasExplainerConnector && detect(NARRATIVE_MECHANISM_TERMS, adText).length > 0) {
    labels.push("mechanism explanation");
  }

  if (/\b(?:step\s*\d|day\s*\d+|week\s*\d+|\d+\.\s)/i.test(adText)) {
    labels.push("timeline / step structure");
  }

  if (wordCount >= 60 && !isFirstPersonStory && detect(PROBLEM_FRAMING_TERMS, adText).length > 0) {
    labels.push("long-form problem-awareness");
  }

  return labels;
}

/** A label is only reported when it recurs across at least TWO
 *  distinct ads — the core truthfulness rule for this whole module.
 *  Order preserved from first appearance for determinism. */
function recurring(adTexts: string[], detectFn: (text: string) => string[]): string[] {
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const text of adTexts) {
    const labelsInThisAd = new Set(detectFn(text));
    for (const label of labelsInThisAd) {
      if (!counts.has(label)) {
        counts.set(label, 0);
        order.push(label);
      }
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return order.filter((label) => (counts.get(label) ?? 0) >= 2);
}

function firstVerbatimMatch(adTexts: string[], re: RegExp): string | null {
  for (const text of adTexts) {
    const m = text.match(re);
    if (m) return m[0].replace(/\s+/g, " ").trim();
  }
  return null;
}

/** customer-count / deep-discount labels carry a specific number that
 *  varies per ad — recurrence is still judged by category (the label),
 *  but the displayed string is enriched with one real verbatim example
 *  rather than staying generic. */
function enrichWithVerbatimExample(
  labels: string[],
  adTexts: string[],
  table: { label: string; re: RegExp }[]
): string[] {
  return labels.map((label) => {
    if (label !== CUSTOMER_COUNT_LABEL && label !== DEEP_DISCOUNT_LABEL) return label;
    const entry = table.find((t) => t.label === label);
    const example = entry ? firstVerbatimMatch(adTexts, entry.re) : null;
    return example ? `${label} (e.g. "${example}")` : label;
  });
}

/**
 * Detects recurring strategic patterns across multiple pasted ad
 * examples. Requires at least 2 ad texts — with fewer, no recurrence
 * can honestly be established, so every field stays empty.
 */
export function detectStrategicPatterns(adTexts: string[]): StrategicPatterns {
  const texts = adTexts.map((t) => t.trim()).filter((t) => t !== "");
  if (texts.length < 2) return EMPTY_STRATEGIC_PATTERNS;

  const proofStrategy = enrichWithVerbatimExample(
    recurring(texts, (t) => detect(PROOF_STRATEGY_TERMS, t)),
    texts,
    PROOF_STRATEGY_TERMS
  );
  const offerCtaStrategy = enrichWithVerbatimExample(
    recurring(texts, (t) => detect(OFFER_CTA_STRATEGY_TERMS, t)),
    texts,
    OFFER_CTA_STRATEGY_TERMS
  );

  return {
    dominantNarrative: recurring(texts, (t) => detect(NARRATIVE_MECHANISM_TERMS, t)),
    problemFraming: recurring(texts, (t) => detect(PROBLEM_FRAMING_TERMS, t)),
    enemyOrAlternative: recurring(texts, (t) => detect(ENEMY_ALTERNATIVE_TERMS, t)),
    desiredOutcome: recurring(texts, (t) => detect(DESIRED_OUTCOME_TERMS, t)),
    proofStrategy,
    offerCtaStrategy,
    creativeStructure: recurring(texts, detectStructureLabels),
  };
}

/* ------------------------------------------------------------------ */
/* Section 8: strategic pattern summary — a template sentence built     */
/* only from clauses that have recurring evidence. Needs at least two   */
/* of the four core building blocks (mechanism/enemy/proof/offer) or    */
/* it's omitted rather than forced into a thin sentence.                */
/* ------------------------------------------------------------------ */

export function buildStrategicSummary(
  competitorName: string,
  p: StrategicPatterns
): string | null {
  const clauses: string[] = [];
  if (p.dominantNarrative.length > 0) {
    clauses.push(`repeatedly frames its mechanism around ${p.dominantNarrative[0]}`);
  }
  if (p.enemyOrAlternative.length > 0) {
    clauses.push(`positions against ${p.enemyOrAlternative[0]}`);
  }
  if (p.proofStrategy.length > 0) {
    clauses.push(`backs this with ${p.proofStrategy[0]}`);
  }
  if (p.offerCtaStrategy.length > 0) {
    clauses.push(`converts through ${p.offerCtaStrategy[0]}`);
  }
  if (clauses.length < 2) return null;
  return `${competitorName} ${clauses.join(", then ")} — observed repeatedly across the pasted examples, not a claim about performance.`;
}

/* ------------------------------------------------------------------ */
/* Section 9: next-test recommendations built from the SAME recurring   */
/* patterns — each one names a specific, observed contrast rather than  */
/* a generic "test clinically tested" suggestion.                       */
/* ------------------------------------------------------------------ */

interface StrategicTestRule {
  id: string;
  matches: (p: StrategicPatterns) => boolean;
  build: (p: StrategicPatterns, competitorName: string) => CompetitorDebriefTest;
}

const STRATEGIC_TEST_RULES: StrategicTestRule[] = [
  {
    id: "craving-vs-metabolism-framing",
    matches: (p) =>
      (p.problemFraming.includes("cravings") || p.problemFraming.includes("food noise")) &&
      (p.dominantNarrative.some((m) => m.includes("metabolism")) ||
        p.problemFraming.includes("slowed metabolism")),
    build: (p, name) => ({
      hypothesis: `${name}'s pasted ads repeatedly frame the problem as both an emotional craving/food-noise issue and a physiological metabolism issue — testing a craving-control story against a metabolism-root-cause story isolates which framing your audience responds to, worth testing rather than assuming either worked for ${name}.`,
      hookOrAngle: "Craving-control story vs. metabolism-root-cause story",
      format: "Hold format constant — vary only the problem framing",
      proofMechanism: p.proofStrategy[0] ?? "Keep your usual proof mechanism constant across both variants",
      offerOrCta: p.offerCtaStrategy[0] ?? "Keep your usual offer/CTA constant across both variants",
      whatYoullLearn:
        "Whether an emotional (craving) or physiological (metabolism) problem framing gets more response from your audience.",
    }),
  },
  {
    id: "testimonial-vs-mechanism-opening",
    matches: (p) =>
      p.creativeStructure.includes("testimonial / first-person story") &&
      p.creativeStructure.includes("mechanism explanation"),
    build: (p, name) => ({
      hypothesis: `${name}'s pasted ads recur in both a testimonial/first-person opening and a mechanism-explanation opening — worth testing which opening earns attention faster, a pattern observed in the pasted examples, not a claim about which performs better for ${name}.`,
      hookOrAngle: "Testimonial/first-person opening vs. mechanism-explanation opening",
      format: p.creativeStructure[0] ?? "UGC or long-form video",
      proofMechanism: p.proofStrategy[0] ?? "Keep proof constant across both variants",
      offerOrCta: p.offerCtaStrategy[0] ?? "Keep offer/CTA constant across both variants",
      whatYoullLearn: "Whether leading with a personal story or a mechanism explanation holds attention longer for your audience.",
    }),
  },
  {
    id: "anti-injection-contrast",
    matches: (p) => p.enemyOrAlternative.includes("injections / needles"),
    build: (p, name) => ({
      hypothesis: `${name}'s pasted ads repeatedly position against injections/needles as the rejected alternative — testing an explicit anti-injection contrast against a neutral, benefit-only framing (no mention of injections) checks whether naming the alternative sharpens response or is unnecessary, worth testing rather than assumed from ${name}'s pattern.`,
      hookOrAngle: "Explicit anti-injection contrast vs. neutral natural-benefit framing (no alternative named)",
      format: p.creativeStructure[0] ?? "Same format both ways",
      proofMechanism: p.proofStrategy[0] ?? "Keep proof constant across both variants",
      offerOrCta: p.offerCtaStrategy[0] ?? "Keep offer/CTA constant across both variants",
      whatYoullLearn: "Whether naming the rejected alternative directly increases response versus a purely positive framing.",
    }),
  },
  {
    id: "quiz-vs-discount-cta",
    matches: (p) =>
      p.offerCtaStrategy.some((o) => o.includes("quiz")) &&
      p.offerCtaStrategy.some((o) => o.startsWith(DEEP_DISCOUNT_LABEL)),
    build: (p, name) => ({
      hypothesis: `${name}'s pasted ads recur with both a quiz-funnel CTA and a direct discount CTA — testing a quiz CTA against a direct discount CTA isolates which conversion path your audience prefers, a pattern worth testing rather than assuming ${name}'s mix is optimal.`,
      hookOrAngle: p.dominantNarrative[0] ?? "Hold the hook constant",
      format: p.creativeStructure[0] ?? "Hold format constant",
      proofMechanism: p.proofStrategy[0] ?? "Keep proof constant across both variants",
      offerOrCta: "Quiz-funnel CTA vs. direct discount CTA",
      whatYoullLearn: "Whether a quiz funnel or a direct discount CTA drives more completed conversions for your audience.",
    }),
  },
  {
    id: "customer-count-vs-ingredient-proof",
    matches: (p) =>
      p.proofStrategy.some((x) => x.startsWith(CUSTOMER_COUNT_LABEL)) &&
      p.proofStrategy.includes("clinically studied / research claims"),
    build: (p, name) => ({
      hypothesis: `${name}'s pasted ads recur with both large-scale customer-count proof and clinically-studied-ingredient proof — testing a social-proof-led variant against an ingredient-proof-led variant isolates which credibility signal moves your audience, worth testing rather than assuming ${name}'s combination is necessary.`,
      hookOrAngle: p.dominantNarrative[0] ?? "Hold the hook constant",
      format: p.creativeStructure[0] ?? "Hold format constant",
      proofMechanism: "Customer-count social proof vs. clinically-studied-ingredient proof",
      offerOrCta: p.offerCtaStrategy[0] ?? "Keep offer/CTA constant across both variants",
      whatYoullLearn: "Whether scale-of-customers proof or ingredient/research proof is the stronger credibility signal for your audience.",
    }),
  },
];

/** Builds the richer, pattern-specific tests described in section 9.
 *  Only rules whose specific recurring combination was actually
 *  detected produce a test — never a generic filler. */
export function buildStrategicTests(
  p: StrategicPatterns,
  competitorName: string
): CompetitorDebriefTest[] {
  return STRATEGIC_TEST_RULES.filter((r) => r.matches(p)).map((r) => r.build(p, competitorName));
}
