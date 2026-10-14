/**
 * Attribution & Intent 4 — Low Intent flag, a dedicated decision-blind
 * module (creativeGroups.ts / segmentSpread.ts isolation pattern).
 *
 * An ad that stops the scroll (high hook rate) but doesn't move people
 * on (low outbound CTR or low hold rate) is getting engagement without
 * purchase intent. Per judged ad:
 *   hook rate    = 3-second video plays ÷ impressions
 *   outbound CTR = outbound clicks ÷ impressions
 *   hold rate    = ThruPlays ÷ 3-second video plays
 * Flagged when its hook rate is in the TOP quartile of judged ads AND
 * its outbound CTR or hold rate is in the BOTTOM quartile. Quartiles are
 * nearest-rank over the judged ads that have that metric.
 *
 * Display-only by construction: returns ad names for a row note. Never
 * read by the gate, median, ranking, action or evidenceState.
 */
import type { RankedAd } from "./types";

/** Below this many judged ads with the needed columns, quartiles are
 *  too coarse to mean anything — the flag is skipped silently. */
export const MIN_ADS_FOR_INTENT = 8;

/** Nearest-rank percentile of an ascending-sorted list. */
function percentile(sorted: number[], p: number): number {
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

export function detectLowIntent(ranked: readonly RankedAd[]): string[] | null {
  const rows = ranked
    .map((a) => {
      const imp = a.impressions ?? null;
      const plays = a.videoPlays3s ?? null;
      const hook = imp != null && imp > 0 && plays != null ? plays / imp : null;
      const outCtr = imp != null && imp > 0 && a.outboundClicks != null ? a.outboundClicks / imp : null;
      const hold = plays != null && plays > 0 && a.thruPlays != null ? a.thruPlays / plays : null;
      return { name: a.name, hook, outCtr, hold };
    })
    .filter((r) => r.hook != null && (r.outCtr != null || r.hold != null));
  if (rows.length < MIN_ADS_FOR_INTENT) return null;

  const sortedOf = (vals: (number | null)[]) => vals.filter((v): v is number => v != null).sort((a, b) => a - b);
  const hooks = sortedOf(rows.map((r) => r.hook));
  const ctrs = sortedOf(rows.map((r) => r.outCtr));
  const holds = sortedOf(rows.map((r) => r.hold));
  const hookTop = percentile(hooks, 0.75);
  const ctrLow = ctrs.length >= MIN_ADS_FOR_INTENT ? percentile(ctrs, 0.25) : null;
  const holdLow = holds.length >= MIN_ADS_FOR_INTENT ? percentile(holds, 0.25) : null;
  if (ctrLow == null && holdLow == null) return null;

  return rows
    .filter(
      (r) =>
        (r.hook as number) >= hookTop &&
        ((ctrLow != null && r.outCtr != null && r.outCtr <= ctrLow) ||
          (holdLow != null && r.hold != null && r.hold <= holdLow))
    )
    .map((r) => r.name);
}
