/**
 * Competitor Debrief V1 — domain types.
 *
 * A separate, CSV-free flow: the user pastes what they observed about a
 * competitor's ads (from the Meta Ads Library or elsewhere) and gets a
 * structured, directional read of it back. No CSV, no performance data,
 * no fetching — see modules/competitorDebrief/engine.ts for the full
 * honesty policy this type shape exists to enforce.
 */

export interface CompetitorDebriefInput {
  competitorName: string;
  /** Reference only — never fetched. The Ads Library is not crawled by
   *  this app in any version. */
  adsLibraryUrl: string;
  /** Reference only — never fetched, unlike the separate one-time
   *  Competitor Landing Page Fetch feature (modules/competitor). */
  websiteUrl?: string;
  /** The actual evidence: pasted ad copy/hooks, formats, offers, CTAs,
   *  dates, or general observations. Everything this flow interprets
   *  comes from this field alone. */
  observations: string;
  /** Number of individual ad examples the "Paste ads" flow split
   *  `observations` into (modules/competitorDebrief/adParser.ts),
   *  when that flow was used — lets the evidence summary state an
   *  exact, honest count instead of vague language. Omitted (not 0)
   *  when the free-text "Advanced manual notes" fallback was used
   *  instead, since there's no ad-by-ad split to count there. */
  exampleCount?: number;
}

export interface CompetitorDebriefApiError {
  title: string;
  message: string;
  fix: string;
}

/** A structured, actionable test — every field is filled from the
 *  detected evidence (or an honest "not observed" placeholder), never
 *  invented. `hypothesis` is the synthesized combination being tested,
 *  not a single echoed category. */
export interface CompetitorDebriefTest {
  hypothesis: string;
  hookOrAngle: string;
  format: string;
  proofMechanism: string;
  offerOrCta: string;
  whatYoullLearn: string;
}

export interface CompetitorDebrief {
  competitorName: string;
  sources: {
    adsLibraryUrl: string;
    websiteUrl: string | null;
  };
  /** Plain description of the evidence actually provided — word count
   *  and category coverage, never a claim about Ads Library coverage. */
  evidenceSummary: string;
  insufficientEvidence: boolean;
  insufficientEvidenceNote: string | null;
  recurringHooks: string[];
  creativeFormats: string[];
  offerPatterns: string[];
  positioningThemes: string[];
  /** Synthesized cross-category patterns and tensions (e.g. "problem-
   *  first messaging reinforced by social proof and risk reversal") —
   *  directional interpretation built by recombining the categories
   *  above, never a new fact. Empty when no combination was found. */
  whatStandsOut: string[];
  nextTests: CompetitorDebriefTest[];
  whatToMonitorNext: string[];
  /** The fixed truthfulness disclaimer — always present, always the
   *  same wording, appended once rather than re-derived per field. */
  caveat: string;
}

export type CompetitorDebriefResponse =
  | { ok: true; debrief: CompetitorDebrief }
  | { ok: false; error: CompetitorDebriefApiError };
