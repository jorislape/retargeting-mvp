/**
 * Pure geometry for the ranked diverging movement bars. Deliberately
 * independent from rankingChartMath.ts — no shared import, no coupled
 * geometry — even though the spatial convention (worse left, better
 * right, one shared scale) is the same language Performance Ranking
 * already taught the reader.
 *
 * Widths come from the RAW pct magnitude — compare.ts's already-
 * computed, polarity-corrected period-over-period change on each
 * MemoComparisonRow. Never recomputed here, never benchmark-relative.
 *
 * A visibility floor is appropriate for this chart (a ranked-magnitude
 * list, not a part-to-whole composition like Spend Allocation), but it
 * affects ONLY the rendered bar width: it never reorders rows (row
 * order is whatever the caller supplies, already sorted by compare.ts)
 * and it never becomes the displayed percentage — callers render the
 * true, unrounded-for-geometry magnitude separately.
 *
 * pct === null (a zero-baseline row) gets NO bar — no invented
 * geometry, no fake 0% — magnitude is simply null and callers should
 * render the row's existing honest text state instead of a bar.
 *
 * No KPI, no action, no decision field ever enters this module.
 */

export interface MovementRowInput {
  name: string;
  pct: number | null;
  better: boolean;
}

export interface MovementChartRow {
  name: string;
  direction: "better" | "worse";
  /** True, unrounded |pct| — null for zero-baseline rows (no bar). */
  magnitude: number | null;
}

/** Row order is preserved exactly as supplied — this module never
 *  sorts. compare.ts already sorts improved/declined by magnitude. */
export function buildMovementChartRows(rows: MovementRowInput[]): MovementChartRow[] {
  return rows.map((row) => ({
    name: row.name,
    direction: row.better ? "better" : "worse",
    magnitude: row.pct == null ? null : Math.abs(row.pct),
  }));
}

/** One shared absolute scale across every rendered row, both sides. A
 *  minimum of 1 prevents division by zero when every row is a
 *  zero-baseline (magnitude-less) row. */
export function maxMovementMagnitude(rows: MovementChartRow[]): number {
  return Math.max(1, ...rows.map((row) => row.magnitude ?? 0));
}

/** Visibility floor only — never the displayed value, never the sort
 *  order. A magnitude-less row (zero-baseline) always returns 0 (no
 *  bar), mirroring rankingBarWidth's null/zero handling in spirit
 *  without importing it. */
export const MIN_VISIBLE_BAR_PERCENT = 8;

export function movementBarWidth(row: MovementChartRow, maxMagnitude: number): number {
  if (row.magnitude == null || row.magnitude === 0) return 0;
  return Math.max(
    MIN_VISIBLE_BAR_PERCENT,
    (row.magnitude / Math.max(1, maxMagnitude)) * 100
  );
}
