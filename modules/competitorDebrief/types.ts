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
}

export interface CompetitorDebriefApiError {
  title: string;
  message: string;
  fix: string;
}

export interface CompetitorDebriefTest {
  title: string;
  rationale: string;
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
