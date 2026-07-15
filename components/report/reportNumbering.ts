/**
 * Performance report section numbering — generalized.
 *
 * Report.tsx previously computed section numerals with hardcoded
 * literals ("01"/"02"/"03" for Verdict/Winners/Losers) plus a
 * secNum(buyerN, clientN) helper and two hand-threaded shift flags
 * (marketShift, avoidShift) that only ever accounted for TWO
 * conditionally-visible sections. That doesn't generalize to N
 * independently-toggleable sections. This file replaces all of it
 * with one mechanism: a fixed display-order list, and a single
 * running counter over whichever sections are visible.
 *
 * Two sections in this list — "market" and "whatNotToDo" — are NOT
 * part of the user-facing customization toggle surface (see
 * reportSections.ts's PERFORMANCE_SECTIONS, which omits them
 * deliberately). They stay exactly as they are today: visible only
 * when the memo actually has that data. They're included here only
 * because they still occupy a numbered slot and must still shift the
 * numbers after them — omitting them from the numbering input
 * entirely would reintroduce the exact gap this module exists to
 * prevent.
 *
 * "patterns" already combines two conditions today (buyer-view-only,
 * decided by the caller BEFORE calling this function) — this module
 * has no opinion on view/mode, only on final visibility.
 */

export type PerformanceNumberedSectionId =
  | "verdict"
  | "winners"
  | "underperformers"
  | "market"
  | "patterns"
  | "nextTests"
  | "whatNotToDo"
  | "confidence";

/** Fixed display order — matches Report.tsx's existing JSX order
 *  exactly. Never reordered by customization (section reordering is
 *  explicitly out of scope for V1A). */
export const PERFORMANCE_NUMBERED_ORDER: readonly PerformanceNumberedSectionId[] = [
  "verdict",
  "winners",
  "underperformers",
  "market",
  "patterns",
  "nextTests",
  "whatNotToDo",
  "confidence",
];

export type PerformanceSectionVisibility = Record<PerformanceNumberedSectionId, boolean>;

/**
 * One running counter over the visible subset, in fixed order. A
 * hidden section gets `null` (never rendered, so never a numeral to
 * skip past) — every visible section gets the next sequential,
 * zero-padded number with no gaps, by construction.
 */
export function computePerformanceSectionNumbers(
  visibility: PerformanceSectionVisibility
): Record<PerformanceNumberedSectionId, string | null> {
  const numbers = {} as Record<PerformanceNumberedSectionId, string | null>;
  let n = 0;
  for (const id of PERFORMANCE_NUMBERED_ORDER) {
    if (visibility[id]) {
      n++;
      numbers[id] = String(n).padStart(2, "0");
    } else {
      numbers[id] = null;
    }
  }
  return numbers;
}
