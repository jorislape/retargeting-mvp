/**
 * Pure geometry for the judged-spend 100%-stacked bar. Segment order is
 * fixed — below, then at, then above — mirroring the spatial worse-
 * left/better-right convention Performance Ranking already established,
 * without repeating that chart's diverging shape.
 *
 * Widths are the TRUE proportional share of judgedSpend: unlike
 * rankingChartMath.ts's diverging bars, there is deliberately no
 * minimum-visibility floor here. This chart is about part-to-whole
 * composition, so a floored 2% segment would misstate the exact thing
 * it exists to show. Callers that need a readable label for a very
 * narrow segment should render that label outside/below the segment,
 * never inflate the segment itself.
 *
 * No KPI, no action, no decision field ever enters this module —
 * inputs are raw spend/count numbers only.
 */

export const SPEND_ALLOCATION_SEGMENT_ORDER = ["below", "at", "above"] as const;

export type SpendAllocationSegmentId = (typeof SPEND_ALLOCATION_SEGMENT_ORDER)[number];

export interface SpendAllocationSegmentInput {
  id: SpendAllocationSegmentId;
  spend: number;
  count: number;
}

export interface SpendAllocationGeometrySegment extends SpendAllocationSegmentInput {
  /** True proportional share of judgedSpend, 0–100 — never floored,
   *  never inflated. Feeds the rendered bar's width only; displayed
   *  percentages are rounded separately (memo.ts) for readability. */
  widthPercent: number;
}

/** Raw spend/count numbers -> ordered, proportional bar segments.
 *  Zero- or absent-count segments are dropped entirely — never a fake
 *  zero-width segment. Returns [] when there's no judged spend to show
 *  geometry for (judgedSpend <= 0). */
export function buildSpendAllocationSegments(
  segments: SpendAllocationSegmentInput[],
  judgedSpend: number
): SpendAllocationGeometrySegment[] {
  if (judgedSpend <= 0) return [];
  const byId = new Map(segments.map((s) => [s.id, s]));
  const ordered: SpendAllocationGeometrySegment[] = [];
  for (const id of SPEND_ALLOCATION_SEGMENT_ORDER) {
    const s = byId.get(id);
    if (s == null || s.count <= 0) continue;
    ordered.push({ ...s, widthPercent: (s.spend / judgedSpend) * 100 });
  }
  return ordered;
}
