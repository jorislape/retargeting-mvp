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
              className="rounded-sm font-medium text-stone-200 underline decoration-stone-600 underline-offset-2 transition hover:text-brass-soft hover:decoration-brass/60 active:text-brass-soft"
            >
              See a sample first
            </Link>
            .
          </p>
        </div>
      </header>

      <div className="animate-rise mt-8" style={{ animationDelay: "90ms" }}>
        <GeneratorPanel />
      </div>
    </div>
  );
}
