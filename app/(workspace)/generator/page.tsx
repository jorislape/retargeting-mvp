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
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Load your ads.{" "}
            <span className={gradientText}>Get your next tests.</span>
          </h1>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-zinc-400">
            A decision-first debrief from your Meta Ads data — what worked,
            what failed, and what to test next.{" "}
            <Link
              href="/sample"
              className="rounded-sm font-medium text-zinc-200 underline decoration-zinc-600 underline-offset-2 transition hover:text-accent-soft hover:decoration-accent/60 active:text-accent-soft"
            >
              See a sample first
            </Link>
            .
          </p>

          {/* One short line on why this isn't just a ChatGPT prompt —
              no state, no interaction, just positioning. */}
          <p className="mt-3 max-w-lg text-xs leading-relaxed text-zinc-400">
            AI can generate an analysis. Debrief structures the full workflow
            from Meta Ads data to a consistent buyer memo, client report,
            next tests, and creative briefs.
          </p>

          {/* Compact, non-interactive overview of the flow below —
              purely a mental model, not a second state machine. The
              generator's own numbered stages remain the source of truth
              for what's actually done. */}
          <ol className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs font-medium text-zinc-400">
            {["Add Meta Ads data", "Add optional context", "Get the decision"].map(
              (step, i, arr) => (
                <li key={step} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/15 font-mono text-[10px] font-semibold text-zinc-300">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                  {i < arr.length - 1 && (
                    <span aria-hidden="true" className="text-zinc-600">
                      →
                    </span>
                  )}
                </li>
              )
            )}
          </ol>
        </div>
      </header>

      <div className="animate-rise mt-8" style={{ animationDelay: "90ms" }}>
        <GeneratorPanel />
      </div>
    </div>
  );
}
