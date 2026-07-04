"use client";

import { useEffect, useRef, useState } from "react";
import { LazyMotion, m, useReducedMotion } from "motion/react";
import { card } from "@/components/ui/theme";

/* ------------------------------------------------------------------ */
/* Hero live proof: six raw export rows sort themselves into SCALE /   */
/* CUT columns while the ROAS figures count up — the deterministic     */
/* engine shown, not described. Auto-plays on a ~4.8s loop.            */
/*                                                                     */
/* Constraints honored here:                                           */
/* - reduced motion → the final sorted state, static, no loop          */
/* - fixed heights everywhere → zero CLS                               */
/* - LazyMotion + async features → motion code stays off the critical  */
/*   path; SSR renders a complete static state                         */
/* - decorative: aria-hidden, with an sr-only description              */
/* ------------------------------------------------------------------ */

const loadFeatures = () =>
  import("./motionFeatures").then((mod) => mod.default);

type Ad = {
  name: string;
  spend: string;
  roas: number;
  delta: number;
  win: boolean;
  /* position among its column when sorted, 0-based */
  rank: number;
};

/* Raw order = export order (interleaved, like real accounts). Numbers
   line up with the sample dataset's story: median ≈ 2.31×. */
const ADS: Ad[] = [
  { name: "Static_SaleBanner_20off", spend: "$210.40", roas: 1.12, delta: -52, win: false, rank: 1 },
  { name: "UGC_MorningRoutine_V1", spend: "$412.09", roas: 4.62, delta: 100, win: true, rank: 0 },
  { name: "Video_BrandAnthem_30s", spend: "$388.75", roas: 1.55, delta: -33, win: false, rank: 0 },
  { name: "Testimonial_CustomerReview", spend: "$296.31", roas: 4.18, delta: 81, win: true, rank: 1 },
  { name: "Static_StockPhoto_Generic", spend: "$175.66", roas: 0.62, delta: -73, win: false, rank: 2 },
  { name: "UGC_Unboxing_Demo", spend: "$243.87", roas: 3.05, delta: 32, win: true, rank: 2 },
];

const RAW_MS = 1500;
const CYCLE_MS = 4800;
const spring = { type: "spring", stiffness: 260, damping: 30 } as const;

/* Counts a number up over ~0.9s when `run` flips true; renders the
   final value immediately otherwise (SSR, reduced motion). */
function Ticker({
  value,
  run,
  format,
}: {
  value: number;
  run: boolean;
  format: (v: number) => string;
}) {
  const [progress, setProgress] = useState(run ? 0 : 1);

  useEffect(() => {
    if (!run) {
      setProgress(1);
      return;
    }
    setProgress(0);
    let raf: number;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      setProgress(1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, value]);

  return <>{format(value * progress)}</>;
}

function ColumnHeader({
  show,
  tone,
  children,
  column,
  animate,
}: {
  show: boolean;
  tone: string;
  children: React.ReactNode;
  column: string;
  animate: boolean;
}) {
  return (
    <m.p
      initial={false}
      animate={animate ? { opacity: show ? 1 : 0 } : undefined}
      style={{
        gridRow: 1,
        gridColumn: column,
        opacity: animate ? undefined : show ? 1 : 0,
      }}
      className={`flex h-6 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${tone}`}
    >
      {children}
    </m.p>
  );
}

export function HeroProof() {
  const reduced = useReducedMotion() ?? false;
  /* SSR + first paint: sorted (the meaningful end state, also the
     reduced-motion state). The loop only starts once mounted+visible. */
  const [sorted, setSorted] = useState(true);
  const [looping, setLooping] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced) return;
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setLooping(entry.isIntersecting),
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  useEffect(() => {
    if (!looping || reduced) return;
    setSorted(false);
    let sortT = setTimeout(() => setSorted(true), RAW_MS);
    const cycle = setInterval(() => {
      setSorted(false);
      sortT = setTimeout(() => setSorted(true), RAW_MS);
    }, CYCLE_MS);
    return () => {
      clearTimeout(sortT);
      clearInterval(cycle);
    };
  }, [looping, reduced]);

  const animate = !reduced;

  return (
    <div ref={rootRef}>
      <p className="sr-only">
        Example of a debrief run: six raw ad rows from a CSV export are
        sorted into a green “scale” column and a red “cut” column by ROAS
        against the account median.
      </p>
      <div aria-hidden="true" className={`${card} p-4 sm:p-5`}>
        {/* Card header — fixed height, content swaps */}
        <div className="flex h-5 items-center justify-between font-mono text-[10px] tabular-nums">
          <span className="truncate text-zinc-500">
            meta-ads-export.csv · 6 ads
          </span>
          <span className="flex items-center gap-1.5 text-zinc-600">
            <span
              className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                sorted ? "bg-accent" : "bg-zinc-600"
              }`}
            />
            {sorted ? "judged against median 2.31×" : "reading rows…"}
          </span>
        </div>

        <LazyMotion features={loadFeatures} strict>
          <div className="mt-3 grid h-[264px] grid-cols-2 content-start gap-x-3 gap-y-1.5 sm:gap-x-4">
            <ColumnHeader
              show={!sorted}
              tone="text-zinc-500"
              column="1 / -1"
              animate={animate}
            >
              Raw export rows
            </ColumnHeader>
            <ColumnHeader
              show={sorted}
              tone="text-emerald-400"
              column="1"
              animate={animate}
            >
              Scale
              <span className="font-mono text-[9px] font-medium normal-case tracking-normal text-zinc-600">
                above median
              </span>
            </ColumnHeader>
            <ColumnHeader
              show={sorted}
              tone="text-red-400"
              column="2"
              animate={animate}
            >
              Cut
              <span className="font-mono text-[9px] font-medium normal-case tracking-normal text-zinc-600">
                below median
              </span>
            </ColumnHeader>

            {ADS.map((ad, i) => {
              const style = sorted
                ? { gridColumn: ad.win ? 1 : 2, gridRow: ad.rank + 2 }
                : { gridColumn: "1 / -1", gridRow: i + 2 };
              return (
                <m.div
                  key={ad.name}
                  layout={animate}
                  transition={spring}
                  style={style}
                  className={`min-w-0 rounded-md border px-2.5 transition-colors duration-300 sm:px-3 ${
                    sorted
                      ? ad.win
                        ? "flex h-[70px] flex-col justify-center border-emerald-400/20 bg-emerald-400/[0.04]"
                        : "flex h-[70px] flex-col justify-center border-red-400/20 bg-red-400/[0.04]"
                      : "flex h-8 items-center gap-3 border-white/[0.07] bg-white/[0.03]"
                  }`}
                >
                  {sorted ? (
                    <>
                      <p className="truncate font-mono text-[10px] text-zinc-400">
                        {ad.name}
                      </p>
                      <p className="mt-1 flex items-baseline gap-2 font-mono tabular-nums">
                        <span className="text-[15px] font-semibold text-zinc-100">
                          <Ticker
                            value={ad.roas}
                            run={animate && looping}
                            format={(v) => `${v.toFixed(2)}×`}
                          />
                        </span>
                        <span
                          className={`text-[10px] font-semibold ${
                            ad.win ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          <Ticker
                            value={ad.delta}
                            run={animate && looping}
                            format={(v) =>
                              `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v))}% vs median`
                            }
                          />
                        </span>
                      </p>
                    </>
                  ) : (
                    <>
                      <span className="w-4 shrink-0 font-mono text-[9px] text-zinc-600">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-zinc-400 sm:text-[11px]">
                        {ad.name}
                      </span>
                      <span className="hidden shrink-0 font-mono text-[10px] tabular-nums text-zinc-600 sm:inline">
                        {ad.spend}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] tabular-nums text-zinc-300">
                        {ad.roas.toFixed(2)}×
                      </span>
                    </>
                  )}
                </m.div>
              );
            })}
          </div>
        </LazyMotion>
      </div>
    </div>
  );
}
