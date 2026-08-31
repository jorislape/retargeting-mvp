import type { Memo, MemoComparisonRow } from "@/modules/debrief";
import type { ReportView } from "./memoToText";
import {
  buildMovementChartRows,
  maxMovementMagnitude,
  movementBarWidth,
  type MovementRowInput,
} from "./movementChartMath";

/**
 * Presentation-only ranked movement: which ads moved most between the
 * two periods, by how much, and in which direction — the third beat
 * in the evidence-proof layer (Performance Ranking: which ads; Spend
 * Allocation: where the money sits; Movement: what changed since last
 * time). Bars encode RAW period-over-period % change only (compare.ts's
 * already-computed, polarity-corrected `pct`/`better`) — never
 * benchmark-relative movement, which would plot two different
 * periods' medians as though they were one shared reference frame.
 *
 * Renders only when memo.comparison exists and has at least one row to
 * show — the same discipline PerformanceRankingChart/SpendAllocationChart
 * already follow for an empty data set. Never derives an action; never
 * read by decision.ts. Deliberately does not duplicate the full
 * "What changed vs previous period" prose section above it in the
 * report — this chart owns exactly one question (ranked magnitude),
 * and reuses that section's own composed sentences/counts rather than
 * generating new analytical prose.
 */
export function MovementChart({
  comparison,
  view,
  topAdsShown,
}: {
  comparison: Memo["comparison"];
  view: ReportView;
  topAdsShown: 3 | 5;
}) {
  if (comparison == null) return null;

  const client = view === "client";
  const improved = comparison.improved.slice(0, topAdsShown);
  const declined = comparison.declined.slice(0, topAdsShown);
  const rows: MemoComparisonRow[] = [...improved, ...declined];
  if (rows.length === 0) return null;

  const inputs: MovementRowInput[] = rows.map((r) => ({
    name: r.name,
    pct: r.pct,
    better: r.better,
  }));
  const geometry = buildMovementChartRows(inputs);
  const maxMagnitude = maxMovementMagnitude(geometry);

  const compared = comparison.matchedJudgedBoth;
  const excluded = comparison.unmatched.ambiguousOrMissingKey + comparison.unmatched.judgedOnePeriodOnly;
  const comparedLine = client
    ? `${compared} ad${compared === 1 ? "" : "s"} could be compared across both periods.`
    : excluded > 0
      ? `${compared} ad${compared === 1 ? "" : "s"} compared across both periods; ${excluded} could not be compared.`
      : `${compared} ad${compared === 1 ? "" : "s"} compared across both periods.`;

  const caveat = client
    ? "This shows how these ads moved between the two periods — it doesn't explain why."
    : "Two-period movement is descriptive and does not establish why performance changed.";

  return (
    <section
      className="print-avoid-break animate-rise mt-10 border-y border-white/[0.08] py-6"
      aria-labelledby="movement-chart-title"
      aria-describedby="movement-chart-caveat"
    >
      <p
        id="movement-chart-title"
        className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-300"
      >
        Movement
      </p>
      <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-zinc-400">
        {client ? comparison.medianMovement.client : comparison.medianMovement.buyer}
      </p>

      <ul className="mt-5 space-y-3">
        {rows.map((row, index) => {
          const geo = geometry[index];
          const width = movementBarWidth(geo, maxMagnitude);
          const better = geo.direction === "better";
          const worse = geo.direction === "worse";
          return (
            <li key={`${row.name}-${index}`} className="print-avoid-break min-w-0">
              <p className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-0.5 text-[12px] leading-snug">
                <span className="min-w-0 break-words font-medium text-zinc-200">{row.name}</span>
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="shrink-0 font-mono text-zinc-100">
                    {row.previousLabel} → {row.currentLabel}
                  </span>
                  <span
                    className={`min-w-0 break-words font-mono text-[11px] tabular-nums ${
                      better
                        ? "print-win text-emerald-400"
                        : worse
                          ? "print-loss text-red-400"
                          : "text-zinc-400"
                    }`}
                  >
                    {row.changeLabel}
                  </span>
                </span>
              </p>

              <div aria-hidden="true" className="mt-1.5 flex h-3 items-center">
                <div className="flex h-full flex-1 items-center justify-end">
                  {worse && width > 0 && (
                    <div
                      className="chart-bar-loss h-2.5 border border-dashed border-red-400/60 bg-red-400/10"
                      style={{ width: `${width}%` }}
                    />
                  )}
                </div>
                <div className="print-accent-border h-3 w-0 shrink-0 border-l" />
                <div className="flex h-full flex-1 items-center justify-start">
                  {better && width > 0 && (
                    <div
                      className="chart-bar-win h-2.5 border border-emerald-400/70 bg-emerald-400/15"
                      style={{ width: `${width}%` }}
                    />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">{comparedLine}</p>

      <p
        id="movement-chart-caveat"
        className="mt-1.5 max-w-3xl text-[10px] leading-relaxed text-zinc-500"
      >
        {caveat}
      </p>
    </section>
  );
}
