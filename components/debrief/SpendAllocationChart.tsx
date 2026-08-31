import type { Memo } from "@/modules/debrief";
import type { ReportView } from "./memoToText";
import {
  buildSpendAllocationSegments,
  type SpendAllocationSegmentId,
} from "./spendAllocationMath";

/** Fixed per-segment copy — same pattern as PerformanceRankingChart's
 *  inline referenceName/caveat: small, invariant, and view-aware, so it
 *  lives in the component rather than the memo. */
const SEGMENT_LABEL: Record<SpendAllocationSegmentId, { buyer: string; client: string }> = {
  below: { buyer: "Below benchmark", client: "Below typical result" },
  at: { buyer: "At median", client: "At typical result" },
  above: { buyer: "Above benchmark", client: "Above typical result" },
};

/**
 * Presentation-only judged-spend allocation: a 100%-stacked bar
 * (below -> at -> above) complementing Performance Ranking rather than
 * repeating it — that chart answers "which ads", this one answers
 * "where does the money sit". Segment widths are always the TRUE
 * proportional share of judgedSpend (see spendAllocationMath.ts) — no
 * minimum-visibility floor, so a 95/5 or 99/1 split renders honestly.
 * Set-aside spend is disclosed separately, underneath, denominated
 * against total spend — it never enters the 100% bar. Never derives an
 * action; never read by decision.ts.
 */
export function SpendAllocationChart({
  allocation,
  view,
}: {
  allocation: Memo["spendAllocation"];
  view: ReportView;
}) {
  if (allocation == null || allocation.segments.length === 0) return null;

  const client = view === "client";
  const geometry = buildSpendAllocationSegments(
    allocation.segments.map((s) => ({ id: s.id, spend: s.spend, count: s.count })),
    allocation.judgedSpend
  );

  return (
    <section
      className="print-avoid-break animate-rise mt-10 border-y border-white/[0.08] py-6"
      aria-labelledby="spend-allocation-title"
      aria-describedby="spend-allocation-caveat"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <p
            id="spend-allocation-title"
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-300"
          >
            Spend allocation
          </p>
          <p className="mt-1 max-w-xl text-[13px] font-medium leading-relaxed text-zinc-300">
            {client ? allocation.headline.client : allocation.headline.buyer}
          </p>
        </div>
        <p className="print-accent text-[11px] text-zinc-400">
          {client ? "Working budget" : "Judged spend"}: {allocation.judgedSpendLabel}
        </p>
      </div>

      <div className="mt-5 flex h-4 w-full overflow-hidden rounded-[3px]" aria-hidden="true">
        {geometry.map((seg) => (
          <div
            key={seg.id}
            style={{ width: `${seg.widthPercent}%` }}
            className={
              seg.id === "below"
                ? "chart-bar-loss h-full border border-dashed border-red-400/60 bg-red-400/10"
                : seg.id === "above"
                  ? "chart-bar-win h-full border border-emerald-400/70 bg-emerald-400/15"
                  : "chart-bar-neutral h-full border border-zinc-400/40 bg-white/[0.05]"
            }
          />
        ))}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[12px]">
        {allocation.segments.map((seg) => (
          <li key={seg.id} className="flex min-w-0 items-baseline gap-1.5">
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 translate-y-[1px] rounded-[2px] ${
                seg.id === "below"
                  ? "print-loss bg-red-400/70"
                  : seg.id === "above"
                    ? "print-win bg-emerald-400/80"
                    : "bg-zinc-400/60"
              }`}
            />
            <span className="font-medium text-zinc-200">
              {SEGMENT_LABEL[seg.id][client ? "client" : "buyer"]}
            </span>
            <span className="font-mono text-[11px] text-zinc-400">
              {seg.count} ad{seg.count === 1 ? "" : "s"} · {seg.shareLabel} · {seg.spendLabel}
            </span>
          </li>
        ))}
      </ul>

      {/* Set-aside + caveat read as one quiet honesty footer, visually
          separated from the chart's own detail (segment labels) above
          it — grouped tightly with each other when both are present. */}
      {allocation.setAside && (
        <p className="mt-4 max-w-3xl text-[11px] leading-relaxed text-zinc-500">
          {client ? allocation.setAside.note.client : allocation.setAside.note.buyer}
        </p>
      )}

      <p
        id="spend-allocation-caveat"
        className={`${allocation.setAside ? "mt-1.5" : "mt-4"} max-w-3xl text-[10px] leading-relaxed text-zinc-500`}
      >
        {client ? allocation.caveat.client : allocation.caveat.buyer}
      </p>
    </section>
  );
}
