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
          <h1 className="mt-2 font-display text-[26px] font-bold tracking-tight text-zinc-900 sm:text-3xl">
            Upload your ads.{" "}
            <span className={gradientText}>Get your next tests.</span>
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-zinc-600">
            A decision-first debrief from your Meta Ads CSV — what worked,
            what failed, and what to test next.{" "}
            <Link
              href="/sample"
              className="rounded-sm font-medium text-zinc-800 underline decoration-zinc-400 underline-offset-2 transition hover:text-blue-700 hover:decoration-blue-400 active:text-blue-800"
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
