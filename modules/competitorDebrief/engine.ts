import { extractMarketSignals } from "../debrief/marketSignals.ts";
import { BENEFIT_TERMS, detect, POSITIONING_TERMS, TRUST_TERMS } from "../competitor/pageSignals.ts";
import type { CompetitorDebrief, CompetitorDebriefInput, CompetitorDebriefTest } from "./types.ts";

/**
 * Competitor Debrief V1 engine — deterministic template code, not an
 * LLM call (same seam pattern as modules/debrief/memo.ts). Reuses the
 * existing pure keyword tables rather than inventing a second judgment
 * system: extractMarketSignals (modules/debrief) for hooks/formats/
 * offers, and the positioning/trust/benefit tables from
 * modules/competitor/pageSignals.ts. No network access anywhere in
 * this file — the Ads Library URL and website URL are stored and
 * echoed back as source references only, never fetched.
 *
 * Honesty policy (mirrors the CSV engine's "metrics only — angle
 * unknown" rule): if nothing recognizable was pasted, the debrief says
 * so plainly instead of inventing hooks/formats/offers/tests.
 */

const CATEGORY_COUNT = 6; // hooks, formats, offers, positioning, trust, benefits

export const COMPETITOR_DEBRIEF_CAVEAT = (competitorName: string): string =>
  `This debrief is based only on what you pasted about ${competitorName} — it never infers spend, conversions, ROAS, performance, or winning ads. Observed evidence and interpretation are kept separate above, and where evidence is thin that is stated explicitly rather than guessed. The Ads Library URL is a source reference only: it is not fetched, and this does not claim to have analyzed ${competitorName}'s full Ads Library.`;

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

function buildNextTests(
  competitorName: string,
  hooks: string[],
  formats: string[],
  offers: string[],
  positioning: string[]
): CompetitorDebriefTest[] {
  const tests: CompetitorDebriefTest[] = [];

  if (hooks.length > 0) {
    tests.push({
      title: `Test a hook inspired by ${competitorName}'s observed pattern: ${hooks[0]}`,
      rationale: `You noted ${competitorName} using ${hooks.join(", ")}. Testing a version in your own creative checks whether the angle resonates with your audience — not whether it worked for them.`,
    });
  }
  if (formats.length > 0) {
    tests.push({
      title: `Test the ${formats[0]} format`,
      rationale: `You noted ${competitorName} running ${formats.join(", ")}. If this isn't already in your creative mix, it's a low-cost format to test.`,
    });
  }
  if (offers.length > 0) {
    tests.push({
      title: `Test an offer structure along the lines of ${offers[0]}`,
      rationale: `${competitorName}'s observed offer pattern (${offers.join(", ")}) is a structural idea worth testing against your own margins and KPI — not evidence that it converts.`,
    });
  }
  if (positioning.length > 0) {
    tests.push({
      title: `Test a positioning angle: ${positioning[0]}`,
      rationale: `You noted ${competitorName} leaning on ${positioning.join(", ")} positioning. Testing a matching or contrasting angle in your own copy is a way to see how your audience reacts.`,
    });
  }
  if (tests.length < 3) {
    tests.push({
      title: "Test a direct contrast to what you observed",
      rationale: `With limited categories detected in what was pasted, the safest next step is a straightforward differentiation from ${competitorName} — a distinct hook, format, or offer instead of mirroring it.`,
    });
  }
  return tests.slice(0, 5);
}

function buildWhatToMonitorNext(competitorName: string): string[] {
  return [
    `Whether ${competitorName} keeps running this offer/hook combination over time, or rotates it.`,
    `Whether new positioning or trust claims appear the next time you review their ads.`,
    `Whether the creative format mix shifts (e.g. new video or UGC vs. static).`,
    "This flow does not monitor automatically — revisit this page and paste fresh observations to update the debrief.",
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

  const whatStandsOut: string[] = [];
  if (trust.length > 0) whatStandsOut.push(`Trust & proof signals noted: ${trust.join(", ")}.`);
  if (benefits.length > 0) whatStandsOut.push(`Benefit claims noted: ${benefits.join(", ")}.`);

  const categoriesMatched = [
    marketSignals.hooks.length > 0,
    marketSignals.formats.length > 0,
    marketSignals.offers.length > 0,
    positioning.length > 0,
    trust.length > 0,
    benefits.length > 0,
  ].filter(Boolean).length;

  const insufficientEvidence = words === 0 || categoriesMatched === 0;

  const evidenceSummary = insufficientEvidence
    ? `Not enough was pasted to identify hooks, formats, offers, or positioning for ${competitorName || "this competitor"}.`
    : `Based on ${words} word${words === 1 ? "" : "s"} of pasted observations for ${competitorName}, covering ${categoriesMatched} of ${CATEGORY_COUNT} tracked categories (hooks, formats, offers, positioning, trust signals, benefit claims). This reflects only what was pasted — not a review of the full Meta Ads Library.`;

  const insufficientEvidenceNote = insufficientEvidence
    ? "Paste specific ad copy, hooks, offers, formats, or other observations from the Ads Library to get a meaningful debrief. Generic or empty notes can't be interpreted."
    : null;

  return {
    competitorName,
    sources: {
      adsLibraryUrl: input.adsLibraryUrl.trim(),
      websiteUrl: input.websiteUrl?.trim() || null,
    },
    evidenceSummary,
    insufficientEvidence,
    insufficientEvidenceNote,
    recurringHooks: insufficientEvidence ? [] : marketSignals.hooks,
    creativeFormats: insufficientEvidence ? [] : marketSignals.formats,
    offerPatterns: insufficientEvidence ? [] : marketSignals.offers,
    positioningThemes: insufficientEvidence ? [] : positioning,
    whatStandsOut: insufficientEvidence ? [] : whatStandsOut,
    nextTests: insufficientEvidence
      ? []
      : buildNextTests(competitorName, marketSignals.hooks, marketSignals.formats, marketSignals.offers, positioning),
    whatToMonitorNext: insufficientEvidence ? [] : buildWhatToMonitorNext(competitorName),
    caveat: COMPETITOR_DEBRIEF_CAVEAT(competitorName || "this competitor"),
  };
}
