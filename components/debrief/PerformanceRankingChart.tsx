import type { MemoWinnerLoserRow } from "@/modules/debrief";
import type { Density } from "@/components/report/reportCustomization";
import { clientizeText, type ReportView } from "./memoToText";
import {
  buildRankingChartRows,
  maxRankingMagnitude,
  rankingBarWidth,
} from "./rankingChartMath";

/**
 * Presentation-only benchmark-distance ranking. It mirrors the exact rows
 * supplied by Report.tsx and never derives an action, threshold, or cause.
 */
export function PerformanceRankingChart({
  winners,
  losers,
  kpiLabel,
  medianLabel,
  view,
  density,
}: {
  winners: MemoWinnerLoserRow[];
  losers: MemoWinnerLoserRow[];
  kpiLabel: string;
  medianLabel: string;
  view: ReportView;
  density: Density;
}) {
  const rows = buildRankingChartRows(winners, losers);
  if (rows.length === 0) return null;

  const client = view === "client";
  const maxMagnitude = maxRankingMagnitude(rows);
  const referenceName = client ? "Typical result" : "Median";
  const caveat = client
    ? "This shows distance from the account's typical result. It does not by itself say what to increase or reduce, what caused the result, or what will happen next."
    : "Distance from this dataset's median is descriptive evidence, not an instruction to scale or cut and not a causal, profitability, significance, or future-performance claim.";

  return (
    <section
      className="print-avoid-break animate-rise mt-10 border-y border-white/[0.08] py-6"
      aria-labelledby="performance-ranking-title"
      aria-describedby="performance-ranking-caveat"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <p
            id="performance-ranking-title"
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-300"
          >
            Performance ranking
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Displayed judged ads relative to one shared reference point
          </p>
        </div>
        <p className="print-accent text-[11px] text-zinc-400">
          {referenceName} {kpiLabel}: {medianLabel}
        </p>
      </div>

      <ul className="mt-5 space-y-3">
        {rows.map((chartRow, index) => {
          const width = rankingBarWidth(chartRow, maxMagnitude);
          const better = chartRow.direction === "better";
          const worse = chartRow.direction === "worse";
          const referenceLabel = client
            ? clientizeText(chartRow.row.vsMedianLabel)
            : chartRow.row.vsMedianLabel;
          return (
            <li key={`${chartRow.row.name}-${index}`} className="print-avoid-break min-w-0">
              <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px] leading-snug">
                <span className="min-w-0 flex-1 break-words font-medium text-zinc-200">
                  {chartRow.row.name}
                </span>
                <span className="shrink-0 font-mono font-semibold tabular-nums text-zinc-100">
                  {chartRow.row.valueLabel}
                </span>
                <span
                  className={`shrink-0 font-mono text-[11px] tabular-nums ${
                    better
                      ? "print-win text-emerald-400"
                      : worse
                        ? "print-loss text-red-400"
                        : "text-zinc-400"
                  }`}
                >
                  {density === "compact"
                    ? referenceLabel
                    : `(${referenceLabel})`}
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

      <p id="performance-ranking-caveat" className="mt-4 max-w-3xl text-[10px] leading-relaxed text-zinc-500">
        {caveat}
      </p>
    </section>
  );
}
