/**
 * White-label Report Customization V1A — the two per-report section-id
 * lists, in display order. Pure data, no React, no logic beyond the
 * lists themselves — shared by the customization panel (to render the
 * checklist) and each report component (to decide what to render).
 *
 * Deliberately NOT every visual block in each report: sections that
 * are already data-driven and not part of this task's approved
 * toggle surface (Performance's Market signal and What-not-to-do;
 * both stay conditional on data, exactly as today) are intentionally
 * absent from these lists — see reportNumbering.ts for how they still
 * participate in Performance's section numbering without being
 * user-toggleable.
 */

export type PerformanceSectionId =
  | "executiveSummary"
  | "verdict"
  | "winners"
  | "underperformers"
  | "patterns"
  | "nextTests"
  | "creativeBriefs"
  | "confidence"
  | "signOff";

export type CompetitorSectionId =
  | "executiveSummary"
  | "observedEvidence"
  | "strategicPatterns"
  | "strategicSummary"
  | "whatStandsOut"
  | "internalLearnings"
  | "nextTests"
  | "whatToMonitor"
  | "sources"
  | "footer";

export interface SectionDescriptor<Id extends string> {
  id: Id;
  label: string;
}

export const PERFORMANCE_SECTIONS: readonly SectionDescriptor<PerformanceSectionId>[] = [
  { id: "executiveSummary", label: "Executive summary" },
  { id: "verdict", label: "Verdict" },
  { id: "winners", label: "Winners" },
  { id: "underperformers", label: "Underperformers" },
  { id: "patterns", label: "Patterns" },
  { id: "nextTests", label: "Next tests" },
  { id: "creativeBriefs", label: "Creative briefs" },
  { id: "confidence", label: "Confidence / methodology" },
  { id: "signOff", label: "Sign-off" },
];

export const COMPETITOR_SECTIONS: readonly SectionDescriptor<CompetitorSectionId>[] = [
  { id: "executiveSummary", label: "Executive summary" },
  { id: "observedEvidence", label: "Observed evidence" },
  { id: "strategicPatterns", label: "Strategic patterns" },
  { id: "strategicSummary", label: "Strategic summary" },
  { id: "whatStandsOut", label: "What stands out" },
  { id: "internalLearnings", label: "Internal learnings" },
  { id: "nextTests", label: "Next creative tests" },
  { id: "whatToMonitor", label: "What to monitor next" },
  { id: "sources", label: "Sources / methodology" },
  { id: "footer", label: "Footer" },
];

export const PERFORMANCE_SECTION_IDS: readonly PerformanceSectionId[] = PERFORMANCE_SECTIONS.map((s) => s.id);
export const COMPETITOR_SECTION_IDS: readonly CompetitorSectionId[] = COMPETITOR_SECTIONS.map((s) => s.id);

/** Sections recommended hidden when a user switches Report mode to
 *  "Client-ready" — a starting point the user can still override by
 *  hand afterward, not a hard rule. Performance's "patterns" already
 *  had a hard, non-negotiable buyer-only gate before this feature
 *  existed (see reportNumbering.ts) — it's listed here too so the
 *  checklist UI reflects reality even though the underlying render
 *  gate doesn't strictly need it. */
export const PERFORMANCE_CLIENT_MODE_HIDDEN: readonly PerformanceSectionId[] = ["patterns", "confidence"];
export const COMPETITOR_CLIENT_MODE_HIDDEN: readonly CompetitorSectionId[] = [
  "internalLearnings",
  "strategicPatterns",
  "sources",
];
