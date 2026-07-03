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
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <p className={eyebrow}>Debrief generator</p>
          <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-white sm:text-[28px]">
            Upload your ads.{" "}
            <span className={gradientText}>Get your next tests.</span>
          </h1>
          <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-zinc-400">
            A decision-first debrief from your Meta Ads CSV — what worked,
            what failed, and what to test next.{" "}
            <Link
              href="/sample"
              className="font-medium text-zinc-200 underline decoration-zinc-600 underline-offset-2 transition hover:text-white"
            >
              See a sample first
            </Link>
            .
          </p>
        </div>
      </header>

      <div className="mt-6">
        <GeneratorPanel />
      </div>
    </div>
  );
}
