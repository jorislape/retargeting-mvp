"use client";

import { useEffect, useState } from "react";
import { SparklesIcon } from "@/components/ui/icons";
import { card } from "@/components/ui/theme";

const MESSAGES = [
  "Reading ads…",
  "Applying the spend gate…",
  "Finding winners and losers…",
  "Writing the debrief…",
];

export function ProcessingState() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => Math.min(i + 1, MESSAGES.length - 1));
    }, 900);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 text-center sm:px-6">
      <div className={`${card} w-full p-8`}>
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
          <SparklesIcon className="h-5 w-5 motion-safe:animate-pulse" />
        </div>
        <p className="mt-5 text-sm font-semibold text-white" role="status" aria-live="polite">
          {MESSAGES[index]}
        </p>
        <div className="mx-auto mt-5 h-1 w-full max-w-xs overflow-hidden rounded-full bg-white/5">
          <div className="h-full w-1/3 rounded-full bg-blue-500 motion-safe:animate-[indeterminate_1.1s_ease-in-out_infinite]" />
        </div>
      </div>

      <style>{`
        @keyframes indeterminate {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </section>
  );
}
