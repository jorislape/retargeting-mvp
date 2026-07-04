"use client";

import Link from "next/link";
import { GeneratorPanel } from "@/components/debrief/GeneratorPanel";
import { Report } from "@/components/debrief/Report";
import { useDebrief } from "@/components/workspace/DebriefProvider";
import { eyebrow, gradientText } from "@/components/ui/theme";

export default function GeneratorPage() {
  const { status, memo, generatedAt, reset } = useDebrief();

  if (status === "ready" && memo) {
    return <Report memo={memo} generatedAt={generatedAt} onNewDebrief={reset} />;
  }

  return (
    <div>
      <header className="animate-rise flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <p className={eyebrow}>Debrief generator</p>
          <h1 className="mt-2 font-display text-[26px] font-bold tracking-tight text-white sm:text-3xl">
            Upload your ads.{" "}
            <span className={gradientText}>Get your next tests.</span>
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-stone-400">
            A decision-first debrief from your Meta Ads CSV — what worked,
            what failed, and what to test next.{" "}
            <Link
              href="/sample"
              className="rounded-sm font-medium text-stone-200 underline decoration-stone-600 underline-offset-2 transition hover:text-fuchsia-300 hover:decoration-fuchsia-400/60 active:text-fuchsia-200"
            >
              See a sample first
            </Link>
            .
          </p>
        </div>
      </header>

      {/* The wire: a slow editorial ticker — decorative rhythm, never
          information. Hidden from AT and print; static under
          reduced-motion (the track simply doesn't move). */}
      <div
        aria-hidden="true"
        className="print-hidden animate-rise mt-6 overflow-hidden border-y border-white/[0.07] py-1.5 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
        style={{ animationDelay: "60ms" }}
      >
        <div className="marquee-track flex w-max items-center gap-3">
          {[0, 1].map((copy) => (
            <div
              key={copy}
              className="flex shrink-0 items-center gap-3 pr-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-600"
            >
              {[
                "What worked",
                "What failed",
                "What to test next",
                "Deterministic scoring",
                "Nothing stored",
                "Spend-gated verdicts",
                "Median benchmarks",
              ].map((phrase) => (
                <span key={phrase} className="flex items-center gap-3">
                  {phrase}
                  <span className="h-1 w-1 rounded-full bg-fuchsia-400/60" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="animate-rise mt-6" style={{ animationDelay: "120ms" }}>
        <GeneratorPanel />
      </div>
    </div>
  );
}
