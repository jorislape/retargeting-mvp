import { extractMarketSignals } from "../debrief/marketSignals.ts";
import { BENEFIT_TERMS, detect, POSITIONING_TERMS, TRUST_TERMS } from "../competitor/pageSignals.ts";
import {
  buildStrategicSummary,
  buildStrategicTests,
  detectStrategicPatterns,
  EMPTY_STRATEGIC_PATTERNS,
} from "./strategicPatterns.ts";
import { applyInternalLearnings, parseInternalLearnings } from "./internalLearnings.ts";
import type { CompetitorDebrief, CompetitorDebriefInput, CompetitorDebriefTest } from "./types.ts";

/**
 * Competitor Debrief V1 engine — deterministic template code, not an
 * LLM call (same seam pattern as modules/debrief/memo.ts). Reuses the
 * existing pure keyword tables rather than inventing a second judgment
 * system: extractMarketSignals (modules/debrief) for hooks/formats/
 * offers, and the positioning/trust/benefit tables from
 * modules/competitor/pageSignals.ts. No network access anywhere in
 * this file (test-enforced) — for the manual paste modes the Ads
 * Library URL and website URL are stored and echoed back as source
 * references only, never fetched; for the Search advertiser mode
 * (input.sourceMode === "adsLibraryApi") the ads were fetched
 * server-side by app/api/meta-ad-library/* BEFORE this engine ran, and
 * arrive here as the same plain observations/adTexts strings.
 * sourceMode changes WORDING ONLY (evidence summary, caveat,
 * monitor-next phrasing) — every analysis rule below is identical for
 * both modes.
 *
 * Honesty policy (mirrors the CSV engine's "metrics only — angle
 * unknown" rule): if nothing recognizable was pasted, the debrief says
 * so plainly instead of inventing hooks/formats/offers/tests.
 *
 * Synthesis: `whatStandsOut` and `nextTests` are built from a fixed
 * rule table (SYNTHESIS_RULES) that recombines the SAME detected
 * labels across categories — never new facts — into named patterns
 * and structured tests. This is what keeps the output from being a
 * flat echo of one category at a time while staying deterministic and
 * traceable to what was actually pasted. Generic slot fill-ins
 * (format/proof/offer, when a rule doesn't pin a specific one) rotate
 * by test position so multiple tests don't all cite the same first
 * item from an array with several entries.
 */

/** Short, non-repetitive — the four things that matter: scope, no
 *  performance inference, the Ads Library URL's status, and that
 *  interpretation is not evidence. Manual (paste) modes only. */
export const COMPETITOR_DEBRIEF_CAVEAT = (competitorName: string): string =>
  `Based only on what you pasted about ${competitorName} — not a review of their Ads Library. No spend, conversion, or performance inference. The Ads Library URL is a reference only, never fetched. Interpretation above (what stands out, next tests) is directional, not evidence.`;

/** The Search advertiser mode's counterpart: the ads WERE fetched from
 *  Meta's Ad Library API, so "what you pasted" / "never fetched" would
 *  both be false here — but it's still only the SELECTED ads, still no
 *  performance inference, and interpretation is still not evidence. */
export const ADS_LIBRARY_API_CAVEAT = (competitorName: string): string =>
  `Based only on the selected ads fetched from Meta's Ads Library for ${competitorName}. No spend, conversion, or performance inference. Interpretation above (what stands out, next tests) is directional, not evidence.`;

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

/** Natural-language "A, B, and C" join — no Oxford-comma edge cases
 *  left to chance for the 1/2/3+ item counts this ever sees. */
function joinWithAnd(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** Names which evidence categories were actually found — never a word
 *  count, which tells the user nothing about content. */
function describeEvidenceCoverage(e: Evidence): string {
  const present: string[] = [];
  if (e.hooks.length > 0) present.push("recurring hooks");
  if (e.formats.length > 0) present.push("creative formats");
  if (e.offers.length > 0) present.push("offer patterns");
  if (e.positioning.length > 0) present.push("positioning themes");
  if (e.trust.length > 0) present.push("trust signals");
  if (e.benefits.length > 0) present.push("benefit claims");
  return joinWithAnd(present);
}

/* ------------------------------------------------------------------ */
/* Synthesis: named cross-category patterns/tensions + structured      */
/* tests built from them. Every string here is assembled only from the */
/* label vocabulary already produced by extractMarketSignals/detect —  */
/* nothing is invented beyond what those pure keyword tables found.    */
/* ------------------------------------------------------------------ */

interface Evidence {
  hooks: string[];
  formats: string[];
  offers: string[];
  positioning: string[];
  trust: string[];
  benefits: string[];
}

const has = (list: string[], ...labels: string[]): boolean =>
  labels.some((l) => list.includes(l));
const first = (list: string[]): string | null => (list.length > 0 ? list[0] : null);
/** Rotates through a list by test position instead of always returning
 *  the first item, so parallel tests that share a fallback pool don't
 *  all cite the same entry. */
const rotate = (list: string[], index: number): string | null =>
  list.length > 0 ? list[index % list.length] : null;

const UNOBSERVED = {
  hook: "No specific hook observed in what was pasted — choose your own angle to contrast against this evidence.",
  format: "No specific format observed in what was pasted — pick a format that fits the hook.",
  proof: "No proof mechanism observed in what was pasted — that's a real gap worth closing (reviews, guarantee, credential), not something to invent here.",
  offer: "No specific offer observed in what was pasted — test against your own standard offer or CTA.",
};

const formatSlot = (e: Evidence, i = 0): string => rotate(e.formats, i) ?? UNOBSERVED.format;
const proofSlot = (e: Evidence, i = 0): string => rotate(e.trust, i) ?? UNOBSERVED.proof;
const offerSlot = (e: Evidence, i = 0): string => rotate(e.offers, i) ?? UNOBSERVED.offer;
const hookSlot = (e: Evidence, i = 0): string =>
  rotate(e.hooks, i) ?? rotate(e.positioning, i) ?? UNOBSERVED.hook;

interface SynthesisRule {
  id: string;
  matches: (e: Evidence) => boolean;
  /** One sentence naming the combined pattern or tension — this is
   *  what fills `whatStandsOut`. */
  pattern: (e: Evidence) => string;
  hypothesis: (e: Evidence, name: string) => string;
  hookOrAngle: (e: Evidence, index: number) => string;
  format: (e: Evidence, index: number) => string;
  proofMechanism: (e: Evidence, index: number) => string;
  offerOrCta: (e: Evidence, index: number) => string;
  whatYoullLearn: (e: Evidence, name: string) => string;
}

const SYNTHESIS_RULES: SynthesisRule[] = [
  {
    id: "problem-first-proof-guarantee",
    matches: (e) =>
      (has(e.hooks, "problem-first hooks") || has(e.positioning, "problem-first")) &&
      has(e.trust, "customer reviews / ratings", "testimonials") &&
      (has(e.trust, "guarantee / risk-reversal") || has(e.hooks, "guarantee / risk-reversal")),
    pattern: () =>
      "Problem-first messaging reinforced by social proof and risk reversal — the pain point is stated up front, then backed by reviews/testimonials and a guarantee to lower the barrier to a first purchase.",
    hypothesis: (_e, name) =>
      `Leading with the pain point before the product, then backing it with proof and a guarantee, may reduce hesitation more than a benefit-first opening — this is the combination ${name} appears to run, not evidence it converts for them.`,
    hookOrAngle: () => "Problem-first opening: state the pain point before introducing the product",
    format: formatSlot,
    proofMechanism: (e, i) =>
      rotate(e.trust.filter((t) => t === "customer reviews / ratings" || t === "testimonials"), i) ??
      proofSlot(e, i),
    offerOrCta: offerSlot,
    whatYoullLearn: (_e, name) =>
      `Whether the problem-first + proof + guarantee combination moves your audience — independent of whether it works for ${name}.`,
  },
  {
    id: "routine-direct-response",
    matches: (e) =>
      has(e.positioning, "routine-based") &&
      has(e.offers, "discounts", "limited-time offers", "first-order offers", "bundle offers"),
    pattern: (e) =>
      `Routine-based positioning combined with a direct-response offer (${first(e.offers.filter((o) => ["discounts", "limited-time offers", "first-order offers", "bundle offers"].includes(o))) ?? "a discount/urgency offer"}) — the product is framed as a daily habit, then pushed toward an immediate decision with a time- or price-based incentive.`,
    hypothesis: (_e, name) =>
      `Framing the product as a routine and then applying urgency/discount pressure may convert differently than either alone — worth isolating whether the routine framing or the offer is doing the work, rather than assuming ${name}'s pairing is optimal.`,
    hookOrAngle: () => "Routine/ritual framing (position the product as a daily habit)",
    format: formatSlot,
    proofMechanism: proofSlot,
    offerOrCta: (e, i) =>
      rotate(
        e.offers.filter((o) => ["discounts", "limited-time offers", "first-order offers", "bundle offers"].includes(o)),
        i
      ) ?? offerSlot(e, i),
    whatYoullLearn: () =>
      "Whether routine framing plus a direct-response offer outperforms either dimension tested alone.",
  },
  {
    id: "natural-clinical-tension",
    matches: (e) =>
      has(e.positioning, "natural / clean") &&
      (has(e.positioning, "clinically tested", "science-backed", "dermatologist-endorsed") ||
        has(e.trust, "clinical claims", "dermatologist mention")),
    pattern: () =>
      "Trust-heavy health messaging balancing natural claims with clinical proof — 'natural' framing is paired with clinical/dermatologist validation, likely preempting a 'does natural actually work' objection.",
    hypothesis: (_e, name) =>
      `Pairing a "natural" claim with clinical/dermatologist backing may resolve doubt that either claim raises on its own — the tension between "natural" and "clinically proven" is worth testing explicitly rather than assuming it reads as reassuring the way it may for ${name}.`,
    hookOrAngle: () => "Natural claim opening, immediately backed by clinical/dermatologist validation",
    format: formatSlot,
    proofMechanism: (e, i) =>
      rotate(e.trust.filter((t) => t === "clinical claims" || t === "dermatologist mention"), i) ??
      rotate(e.positioning.filter((p) => p === "clinically tested" || p === "science-backed" || p === "dermatologist-endorsed"), i) ??
      proofSlot(e, i),
    offerOrCta: offerSlot,
    whatYoullLearn: () =>
      "Whether stacking natural + clinical claims together reduces skepticism more than leading with either alone.",
  },
  {
    id: "founder-ugc-authenticity",
    matches: (e) =>
      (has(e.positioning, "founder-led") || has(e.formats, "founder-led video")) &&
      has(e.formats, "UGC / creator content", "testimonials"),
    pattern: () =>
      "Founder-led narrative reinforced by UGC/testimonial format — authenticity is carried in both the message (founder story) and the format (real customers/creators), not claimed by copy alone.",
    hypothesis: (_e, name) =>
      `Authenticity signaled through format (UGC/testimonial) as well as message (founder story) may build more trust than either alone — a structural pattern worth testing on its own terms, not because it worked for ${name}.`,
    hookOrAngle: () => "Founder-led / personal-story angle",
    format: (e, i) =>
      rotate(e.formats.filter((f) => f === "UGC / creator content" || f === "testimonials" || f === "founder-led video"), i) ??
      formatSlot(e, i),
    proofMechanism: proofSlot,
    offerOrCta: offerSlot,
    whatYoullLearn: () =>
      "Whether matching an authentic message to an authentic format outperforms a polished, non-founder-led version.",
  },
  {
    id: "before-after-benefit-proof",
    matches: (e) => has(e.hooks, "before/after framing") || (has(e.trust, "before/after") && e.benefits.length > 0),
    pattern: (e) =>
      e.benefits.length > 0
        ? `Before/after framing paired with a specific benefit claim (${e.benefits.slice(0, 2).join(", ")}) — visual transformation proof is tied to a concrete, testable outcome rather than a vague promise.`
        : "Before/after framing used as its own proof mechanism, without a specific benefit claim attached to it.",
    hypothesis: (e, name) =>
      e.benefits.length > 0
        ? `Tying before/after proof to one named, specific outcome (${e.benefits[0]}) rather than a general transformation claim may set clearer expectations for your audience — worth testing against a vaguer before/after, independent of ${name}'s results.`
        : `Before/after framing on its own, without a named benefit, is a testable proof format — try pairing it with a specific claim to see if specificity changes response, separate from ${name}'s performance.`,
    hookOrAngle: () => "Before/after transformation framing",
    format: (e, i) => rotate(e.formats.filter((f) => f === "carousels" || f === "video"), i) ?? formatSlot(e, i),
    proofMechanism: () => "Before/after visual proof",
    offerOrCta: offerSlot,
    whatYoullLearn: () =>
      "Whether tying the before/after proof to one specific, named outcome changes response versus a general transformation claim.",
  },
  {
    id: "subscription-bundle-guarantee",
    matches: (e) => has(e.offers, "subscription / trial offers", "bundle offers") && has(e.trust, "guarantee / risk-reversal"),
    pattern: (e) =>
      `Subscription/bundle offer (${first(e.offers.filter((o) => o === "subscription / trial offers" || o === "bundle offers")) ?? "recurring commitment"}) softened by a guarantee — a bigger up-front ask is offset with explicit risk reversal.`,
    hypothesis: (_e, name) =>
      `A bigger-commitment offer (subscription/bundle) paired with an explicit guarantee may lower hesitation more than the same offer without risk reversal — this is a structural test of the pairing, not a performance claim about ${name}.`,
    hookOrAngle: hookSlot,
    format: formatSlot,
    proofMechanism: () => "Guarantee / risk-reversal",
    offerOrCta: (e, i) =>
      rotate(e.offers.filter((o) => o === "subscription / trial offers" || o === "bundle offers"), i) ?? offerSlot(e, i),
    whatYoullLearn: () =>
      "Whether the guarantee is doing meaningful work — test the same offer with and without explicit risk reversal.",
  },
  {
    id: "trust-stacking-weak-hook",
    matches: (e) => e.trust.length >= 3 && e.hooks.length === 0,
    pattern: (e) =>
      `Heavy trust stacking (${e.trust.slice(0, 3).join(", ")}) without a distinct hook detected — credibility appears to be doing more work than a unique angle.`,
    hypothesis: (_e, name) =>
      `${name}'s pasted ads lean on layered proof rather than a sharp hook — testing whether a stronger, more specific hook outperforms proof-heavy creative alone is a real open question, not something these observations answer.`,
    hookOrAngle: () => "A sharper, more specific hook — not yet observed in what was pasted",
    format: formatSlot,
    proofMechanism: (e) => e.trust.slice(0, 2).join(" + "),
    offerOrCta: offerSlot,
    whatYoullLearn: () =>
      "Whether adding a distinct hook on top of strong proof outperforms proof-heavy creative with a generic opening.",
  },
  {
    id: "offer-led-no-proof",
    matches: (e) => e.offers.length > 0 && e.trust.length === 0,
    pattern: (e) =>
      `Offer-led push (${first(e.offers) ?? "discount/urgency"}) with no proof mechanism detected in what was pasted — the ad drives toward a decision without visible reviews, guarantees, or clinical backing.`,
    hypothesis: () =>
      "Adding an explicit proof mechanism (reviews, guarantee, or a specific claim) to an offer-led ad may reduce the hesitation a bare discount doesn't address — this names a gap in the pasted evidence, not a fact about the competitor's full creative mix.",
    hookOrAngle: hookSlot,
    format: formatSlot,
    proofMechanism: () => UNOBSERVED.proof,
    offerOrCta: offerSlot,
    whatYoullLearn: () =>
      "Whether adding a proof mechanism to an offer-led ad changes response versus the offer alone.",
  },
];

function fallbackTest(e: Evidence, competitorName: string): CompetitorDebriefTest {
  const anchor = first(e.hooks) ?? first(e.positioning) ?? first(e.formats) ?? first(e.offers) ?? first(e.trust) ?? first(e.benefits);
  return {
    hypothesis: anchor
      ? `A direct contrast to ${competitorName}'s observed "${anchor}" may perform differently for your audience than mirroring it — worth a controlled test either way, since these observations don't say which wins.`
      : `With limited evidence detected, testing a clear differentiation from ${competitorName} is safer than guessing at a match.`,
    hookOrAngle: hookSlot(e),
    format: formatSlot(e),
    proofMechanism: proofSlot(e),
    offerOrCta: offerSlot(e),
    whatYoullLearn: `Whether differentiating from ${competitorName} outperforms mirroring what you observed.`,
  };
}

/** A second, more general combination test for when fewer than 3 named
 *  rules match — still combines whatever's available across hook /
 *  format / proof / offer into one hypothesis rather than one category
 *  at a time. `index` rotates which array element is emphasized so a
 *  second call doesn't just repeat the first. */
function generalCombinationTest(e: Evidence, competitorName: string, index: number): CompetitorDebriefTest {
  const hook = e.hooks[index] ?? e.positioning[index] ?? hookSlot(e, index);
  const format = e.formats[index] ?? formatSlot(e, index);
  const proof = e.trust[index] ?? proofSlot(e, index);
  const offer = e.offers[index] ?? offerSlot(e, index);
  const parts = [`"${hook}"`, `the "${format}" format`];
  if (proof !== UNOBSERVED.proof) parts.push(`"${proof}" as proof`);
  if (offer !== UNOBSERVED.offer) parts.push(`"${offer}" as the offer`);
  return {
    hypothesis: `Combining ${parts.join(", ")} may perform differently for your audience than testing any one of these in isolation — a combination worth isolating on its own, not a claim about ${competitorName}'s results.`,
    hookOrAngle: hook,
    format,
    proofMechanism: proof,
    offerOrCta: offer,
    whatYoullLearn: "Whether this specific combination — not just one element of it — changes results for your audience.",
  };
}

function buildSynthesis(
  evidence: Evidence,
  competitorName: string
): { whatStandsOut: string[]; nextTests: CompetitorDebriefTest[] } {
  const matchedRules = SYNTHESIS_RULES.filter((r) => r.matches(evidence));
  const whatStandsOut = matchedRules.map((r) => r.pattern(evidence)).slice(0, 5);

  const tests: CompetitorDebriefTest[] = matchedRules.slice(0, 4).map((r, i) => ({
    hypothesis: r.hypothesis(evidence, competitorName),
    hookOrAngle: r.hookOrAngle(evidence, i),
    format: r.format(evidence, i),
    proofMechanism: r.proofMechanism(evidence, i),
    offerOrCta: r.offerOrCta(evidence, i),
    whatYoullLearn: r.whatYoullLearn(evidence, competitorName),
  }));

  const seen = new Set(tests.map((t) => t.hypothesis));
  let rotation = 0;
  while (tests.length < 3 && rotation < 3) {
    const candidate = generalCombinationTest(evidence, competitorName, rotation);
    rotation++;
    if (seen.has(candidate.hypothesis)) continue;
    seen.add(candidate.hypothesis);
    tests.push(candidate);
  }
  if (tests.length === 0) tests.push(fallbackTest(evidence, competitorName));

  return { whatStandsOut, nextTests: tests.slice(0, 5) };
}

function buildWhatToMonitorNext(competitorName: string, sourceMode: "manual" | "adsLibraryApi"): string[] {
  return [
    `Whether ${competitorName} keeps running this offer/hook combination over time, or rotates it.`,
    `Whether new positioning or trust claims appear the next time you review their ads.`,
    `Whether the creative format mix shifts (e.g. new video or UGC vs. static).`,
    sourceMode === "adsLibraryApi"
      ? "This flow does not monitor automatically — revisit this page and fetch the advertiser's current active ads to update the debrief."
      : "This flow does not monitor automatically — revisit this page and paste fresh observations to update the debrief.",
  ];
}

export function generateCompetitorDebrief(
  input: CompetitorDebriefInput
): CompetitorDebrief {
  const competitorName = input.competitorName.trim();
  const observations = input.observations.trim();
  const words = wordCount(observations);

  const marketSignals = extractMarketSignals(observations);
  const positioning = detect(POSITIONING_TERMS, observations);
  const trust = detect(TRUST_TERMS, observations);
  const benefits = detect(BENEFIT_TERMS, observations);

  const evidence: Evidence = {
    hooks: marketSignals.hooks,
    formats: marketSignals.formats,
    offers: marketSignals.offers,
    positioning,
    trust,
    benefits,
  };

  const categoriesMatched = [
    evidence.hooks.length > 0,
    evidence.formats.length > 0,
    evidence.offers.length > 0,
    evidence.positioning.length > 0,
    evidence.trust.length > 0,
    evidence.benefits.length > 0,
  ].filter(Boolean).length;

  const insufficientEvidence = words === 0 || categoriesMatched === 0;

  // Source-accurate wording only — the numbers, categories, and every
  // rule around them are identical for both modes.
  const isApiSource = input.sourceMode === "adsLibraryApi";
  const exampleCountLabel =
    typeof input.exampleCount === "number" && input.exampleCount > 0
      ? isApiSource
        ? `Based on ${input.exampleCount} selected Meta Ads Library ad${input.exampleCount === 1 ? "" : "s"}. `
        : `Based on ${input.exampleCount} pasted ad example${input.exampleCount === 1 ? "" : "s"} for ${competitorName}. `
      : "";

  const evidenceSummary = insufficientEvidence
    ? isApiSource
      ? `Not enough usable ad text was found in the selected Meta Ads Library ads to identify hooks, formats, offers, or positioning for ${competitorName || "this competitor"}.`
      : `Not enough was pasted to identify hooks, formats, offers, or positioning for ${competitorName || "this competitor"}.`
    : `${exampleCountLabel}Observed evidence for ${competitorName} includes ${describeEvidenceCoverage(evidence)}.`;

  const insufficientEvidenceNote = insufficientEvidence
    ? isApiSource
      ? "Select ads with more creative text (or add manual observations) to get a meaningful debrief. Ads with little or no text can't be interpreted."
      : "Paste specific ad copy, hooks, offers, formats, or other observations from the Ads Library to get a meaningful debrief. Generic or empty notes can't be interpreted."
    : null;

  const synthesis = insufficientEvidence
    ? { whatStandsOut: [], nextTests: [] }
    : buildSynthesis(evidence, competitorName);

  // Strategic-pattern layer: needs at least 2 distinct pasted ad texts
  // to ever call anything "recurring" — with fewer (or none, e.g. the
  // "Advanced manual notes" fallback), every field stays empty rather
  // than treating one example as a pattern.
  const strategicPatterns = insufficientEvidence
    ? EMPTY_STRATEGIC_PATTERNS
    : detectStrategicPatterns(input.adTexts ?? []);
  const strategicSummary = insufficientEvidence
    ? null
    : buildStrategicSummary(competitorName, strategicPatterns);
  const strategicTests = insufficientEvidence
    ? []
    : buildStrategicTests(strategicPatterns, competitorName);

  // Richer, pattern-specific tests (when the recurring evidence
  // supports them) surface before the older single-category-combo
  // tests, deduped by hypothesis, capped at 5 total as before.
  const seenHypotheses = new Set<string>();
  const nextTests = [...strategicTests, ...synthesis.nextTests]
    .filter((t) => {
      if (seenHypotheses.has(t.hypothesis)) return false;
      seenHypotheses.add(t.hypothesis);
      return true;
    })
    .slice(0, 5);

  const baseDebrief: CompetitorDebrief = {
    competitorName,
    sourceMode: isApiSource ? "adsLibraryApi" : "manual",
    sources: {
      adsLibraryUrl: input.adsLibraryUrl?.trim() || null,
      websiteUrl: input.websiteUrl?.trim() || null,
    },
    evidenceSummary,
    insufficientEvidence,
    insufficientEvidenceNote,
    recurringHooks: insufficientEvidence ? [] : evidence.hooks,
    creativeFormats: insufficientEvidence ? [] : evidence.formats,
    offerPatterns: insufficientEvidence ? [] : evidence.offers,
    positioningThemes: insufficientEvidence ? [] : evidence.positioning,
    whatStandsOut: synthesis.whatStandsOut,
    dominantNarrative: strategicPatterns.dominantNarrative,
    problemFraming: strategicPatterns.problemFraming,
    enemyOrAlternative: strategicPatterns.enemyOrAlternative,
    desiredOutcome: strategicPatterns.desiredOutcome,
    proofStrategy: strategicPatterns.proofStrategy,
    offerCtaStrategy: strategicPatterns.offerCtaStrategy,
    creativeStructure: strategicPatterns.creativeStructure,
    strategicSummary,
    nextTests,
    whatToMonitorNext: insufficientEvidence
      ? []
      : buildWhatToMonitorNext(competitorName, isApiSource ? "adsLibraryApi" : "manual"),
    caveat: isApiSource
      ? ADS_LIBRARY_API_CAVEAT(competitorName || "this competitor")
      : COMPETITOR_DEBRIEF_CAVEAT(competitorName || "this competitor"),
    internalLearnings: null,
  };

  // Internal Learnings MVP: a pure post-processing pass over the
  // already-complete debrief above — every synthesis/strategic-pattern
  // rule already ran untouched. See internalLearnings.ts for why this
  // stays a separate layer rather than a change to the rules above.
  const learnings = parseInternalLearnings(input.internalLearningsText ?? "");
  return applyInternalLearnings(baseDebrief, learnings);
}
