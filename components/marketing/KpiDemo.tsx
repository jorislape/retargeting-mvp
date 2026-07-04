"use client";

import { useState } from "react";
import { LazyMotion, m, useReducedMotion } from "motion/react";
import { card } from "@/components/ui/theme";

/* ------------------------------------------------------------------ */
/* Interactive proof of the deterministic claim: pick the KPI, watch   */
/* the same five sample ads re-rank against the new median. No upload, */
/* no network — the numbers are fixed sample data, the ranking is      */
/* arithmetic in front of the visitor.                                 */
/* Reduced motion swaps the order instantly (layout anim disabled).    */
/* ------------------------------------------------------------------ */

const loadFeatures = () =>
  import("./motionFeatures").then((mod) => mod.default);

type DemoKpi = "roas" | "cpa" | "ctr";

const ADS: { name: string; roas: number; cpa: number; ctr: number }[] = [
  { name: "UGC_MorningRoutine_V1", roas: 4.62, cpa: 14.2, ctr: 2.1 },
  { name: "Testimonial_CustomerReview", roas: 4.18, cpa: 11.35, ctr: 1.6 },
  { name: "UGC_Unboxing_Demo", roas: 3.05, cpa: 18.6, ctr: 3.4 },
  { name: "Video_BrandAnthem_30s", roas: 1.55, cpa: 16.1, ctr: 2.6 },
  { name: "Static_StockPhoto_Generic", roas: 0.62, cpa: 41.9, ctr: 0.8 },
];

const KPIS: {
  key: DemoKpi;
  label: string;
  higher: boolean;
  fmt: (v: number) => string;
}[] = [
  { key: "roas", label: "ROAS", higher: true, fmt: (v) => `${v.toFixed(2)}×` },
  { key: "cpa", label: "CPA", higher: false, fmt: (v) => `$${v.toFixed(2)}` },
  { key: "ctr", label: "CTR", higher: true, fmt: (v) => `${v.toFixed(1)}%` },
];

const spring = { type: "spring", stiffness: 320, damping: 32 } as const;

export function KpiDemo() {
  const reduced = useReducedMotion() ?? false;
  const [kpiKey, setKpiKey] = useState<DemoKpi>("roas");
  const kpi = KPIS.find((k) => k.key === kpiKey)!;

  const median = [...ADS].map((a) => a[kpiKey]).sort((a, b) => a - b)[2];
  const ranked = [...ADS].sort((a, b) =>
    kpi.higher ? b[kpiKey] - a[kpiKey] : a[kpiKey] - b[kpiKey]
  );

  /* Positive = better than the median, regardless of KPI polarity. */
  const deltaPct = (v: number) =>
    Math.round(((kpi.higher ? v - median : median - v) / median) * 100);

  return (
    <div className={`${card} p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div
          role="group"
          aria-label="Demo KPI"
          className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1"
        >
          {KPIS.map((k) => {
            const active = k.key === kpiKey;
            return (
              <button
                key={k.key}
                type="button"
                aria-pressed={active}
                onClick={() => setKpiKey(k.key)}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                  active
                    ? "bg-white text-zinc-950"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {k.label}
                <span
                  aria-hidden="true"
                  className={`ml-1 ${active ? "text-zinc-500" : "text-zinc-600"}`}
                >
                  {k.higher ? "↑" : "↓"}
                </span>
              </button>
            );
          })}
        </div>
        <p className="font-mono text-[11px] tabular-nums text-zinc-500">
          account median&nbsp;
          <span className="text-zinc-300">{kpi.fmt(median)}</span>
        </p>
      </div>

      <LazyMotion features={loadFeatures} strict>
        <ol className="mt-4 space-y-1.5" aria-label="Sample ads ranked by the selected KPI">
          {ranked.map((ad, i) => {
            const v = ad[kpiKey];
            const d = deltaPct(v);
            const win = d > 0;
            const atMedian = d === 0;
            return (
              <m.li
                key={ad.name}
                layout={!reduced}
                transition={spring}
                className={`flex h-11 items-center gap-3 rounded-md border px-3 ${
                  atMedian
                    ? "border-white/[0.07] bg-white/[0.02]"
                    : win
                      ? "border-emerald-400/15 bg-emerald-400/[0.03]"
                      : "border-red-400/15 bg-red-400/[0.03]"
                }`}
              >
                <span className="w-5 shrink-0 font-mono text-[10px] tabular-nums text-zinc-600">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-300">
                  {ad.name}
                </span>
                <span className="shrink-0 font-mono text-[12px] font-semibold tabular-nums text-zinc-100">
                  {kpi.fmt(v)}
                </span>
                <span
                  className={`w-24 shrink-0 text-right font-mono text-[10px] font-semibold tabular-nums sm:w-28 ${
                    atMedian
                      ? "text-zinc-500"
                      : win
                        ? "text-emerald-400"
                        : "text-red-400"
                  }`}
                >
                  {atMedian
                    ? "median"
                    : `${win ? "+" : "−"}${Math.abs(d)}% vs median`}
                </span>
              </m.li>
            );
          })}
        </ol>
      </LazyMotion>

      <p className="mt-3.5 text-xs leading-relaxed text-zinc-600">
        Five ads from the sample dataset. Change the KPI and the ranking,
        median, and deltas recompute — nothing else moves the numbers.
      </p>
    </div>
  );
}
