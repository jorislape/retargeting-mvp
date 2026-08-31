import type { MemoWinnerLoserRow } from "../../modules/debrief/types.ts";

/** Pure presentation geometry. Direction comes from analysis.ts's
 * polarity-corrected deltaPct; this module never knows the KPI or an action. */
export interface RankingChartRow {
  row: MemoWinnerLoserRow;
  direction: "better" | "worse" | "none";
  magnitude: number | null;
}

export function buildRankingChartRows(
  winners: MemoWinnerLoserRow[],
  losers: MemoWinnerLoserRow[]
): RankingChartRow[] {
  return [...winners, ...losers].map((row) => ({
    row,
    direction:
      row.deltaPct == null || row.deltaPct === 0
        ? "none"
        : row.deltaPct > 0
          ? "better"
          : "worse",
    magnitude: row.deltaPct == null ? null : Math.abs(row.deltaPct),
  }));
}

/** One absolute scale across both sides. A minimum of 1 prevents zero division. */
export function maxRankingMagnitude(rows: RankingChartRow[]): number {
  return Math.max(1, ...rows.map((row) => row.magnitude ?? 0));
}

/** Null and zero values get no invented geometry. Non-zero values receive
 * a small visibility floor while retaining their direct numeric label. */
export const MIN_VISIBLE_BAR_PERCENT = 8;

export function rankingBarWidth(
  row: RankingChartRow,
  maxMagnitude: number
): number {
  if (row.magnitude == null || row.magnitude === 0) return 0;
  return Math.max(
    MIN_VISIBLE_BAR_PERCENT,
    (row.magnitude / Math.max(1, maxMagnitude)) * 100
  );
}
