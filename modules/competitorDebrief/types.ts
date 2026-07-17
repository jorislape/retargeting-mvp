import type { InternalLearningNote, InternalLearningsSummary } from "./internalLearnings.ts";

/**
 * Competitor Debrief V1 — domain types.
 *
 * A separate, CSV-free flow: the user pastes what they observed about a
 * competitor's ads (from the Meta Ads Library or elsewhere) and gets a
 * structured, directional read of it back. No CSV, no performance data,
 * no fetching — see modules/competitorDebrief/engine.ts for the full
 * honesty policy this type shape exists to enforce.
 */

/** Where the ad evidence came from. "manual" = the paste flows
 *  (unchanged, the default); "adsLibraryApi" = the Search advertiser
 *  mode, whose ads were fetched server-side from Meta's Ad Library API
 *  (app/api/meta-ad-library/*). Affects WORDING ONLY — evidence
 *  summary, caveat, monitor-next phrasing, and the report's source-link
 *  annotation. Every analysis/interpretation rule is identical for
 *  both values. */
export type CompetitorDebriefSourceMode = "manual" | "adsLibraryApi";

export interface CompetitorDebriefInput {
  competitorName: string;
  /** Optional; omitted means "manual" — pre-existing callers and
   *  payloads behave exactly as before this field existed. */
  sourceMode?: CompetitorDebriefSourceMode;
  /** The URL itself is a reference — this engine never fetches it (the
   *  Search advertiser mode's ads are fetched by app/api/meta-ad-library/*
   *  via the official Ad Library API BEFORE this engine runs, and in
   *  that mode this field is the selected Page's public library URL,
   *  used as the report's source link). Optional: a competitor debrief
   *  can be built from pasted ad copy alone, without a library URL on
   *  hand — see the "Generate" button eligibility fix in
   *  CompetitorDebriefPanel. */
  adsLibraryUrl?: string;
  /** Reference only — never fetched, unlike the separate one-time
   *  Competitor Landing Page Fetch feature (modules/competitor). */
  websiteUrl?: string;
  /** The actual evidence: ad copy/hooks, formats, offers, CTAs, dates,
   *  or general observations — pasted by the user, or serialized from
   *  the ads selected in the Search advertiser mode. Everything this
   *  flow interprets comes from this field alone. */
  observations: string;
  /** Number of individual ad examples the "Paste ads" flow split
   *  `observations` into (modules/competitorDebrief/adParser.ts),
   *  when that flow was used — lets the evidence summary state an
   *  exact, honest count instead of vague language. Omitted (not 0)
   *  when the free-text "Advanced manual notes" fallback was used
   *  instead, since there's no ad-by-ad split to count there. */
  exampleCount?: number;
  /** The individual ad blocks' raw text (from the "Paste ads" review
   *  step), when that flow was used — lets the strategic-pattern layer
   *  (modules/competitorDebrief/strategicPatterns.ts) check for
   *  RECURRENCE across distinct ads rather than treating one example
   *  as a pattern. Needs at least 2 entries for any recurring-pattern
   *  section to be non-empty; omitted or fewer than 2 entries means
   *  those sections stay empty, same as insufficient evidence. */
  adTexts?: string[];
  /** Internal Learnings MVP — raw pasted text, one learning per line
   *  ("Worked: ...", "Failed: ...", "Avoid: ...", "Learning: ..."),
   *  parsed and applied by modules/competitorDebrief/internalLearnings.ts.
   *  Optional, manual input only — omitted or empty leaves the debrief
   *  exactly as it was before this feature existed. */
  internalLearningsText?: string;
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
  /** Set only when an internal learning materially changed this test —
   *  see modules/competitorDebrief/internalLearnings.ts. Never present
   *  otherwise; the UI shows a badge + explanation only when this is set. */
  internalLearningNote?: InternalLearningNote;
}

export interface CompetitorDebrief {
  competitorName: string;
  /** Echoed from the input (default "manual") so the report can pick
   *  source-accurate wording — e.g. the Ads Library link's "reference
   *  only — not fetched" note is wrong when the ads WERE fetched via
   *  the Ad Library API. Presentation only, never a calculation. */
  sourceMode: CompetitorDebriefSourceMode;
  sources: {
    adsLibraryUrl: string | null;
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
  /** Recurring strategic-pattern sections — each entry only appears
   *  when the underlying pattern recurs across at least 2 distinct
   *  pasted ad examples (never from a single example, and never when
   *  `adTexts` had fewer than 2 entries). All directional
   *  interpretation, never a performance/spend/audience-response
   *  claim. See modules/competitorDebrief/strategicPatterns.ts. */
  dominantNarrative: string[];
  problemFraming: string[];
  enemyOrAlternative: string[];
  desiredOutcome: string[];
  proofStrategy: string[];
  offerCtaStrategy: string[];
  creativeStructure: string[];
  /** One template sentence synthesizing mechanism + enemy + proof +
   *  offer when at least 2 of those recurring patterns exist; null
   *  when there isn't enough recurring evidence to support it. */
  strategicSummary: string | null;
  nextTests: CompetitorDebriefTest[];
  whatToMonitorNext: string[];
  /** The fixed truthfulness disclaimer — always present, always the
   *  same wording, appended once rather than re-derived per field. */
  caveat: string;
  /** Internal Learnings MVP — the parsed, deduped learnings actually
   *  used, or null when none were pasted (the UI section doesn't
   *  render at all in that case). See internalLearnings.ts. */
  internalLearnings: InternalLearningsSummary | null;
}

export type CompetitorDebriefResponse =
  | { ok: true; debrief: CompetitorDebrief }
  | { ok: false; error: CompetitorDebriefApiError };
