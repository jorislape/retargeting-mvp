import Link from "next/link";
import { Report } from "@/components/debrief/Report";
import { buildSampleMemo } from "@/modules/debrief/sample";
import { ArrowIcon } from "@/components/ui/icons";
import { btnPrimarySm } from "@/components/ui/theme";

export const metadata = {
  title: "Sample report — Debrief",
  description:
    "A fully rendered example of the debrief you get from your own Meta Ads CSV.",
};

/* Server component: the sample memo is computed by the real engine at
   render time from hardcoded data — no upload, no client work. */
export default function SamplePage() {
  const memo = buildSampleMemo();

  return (
    <div>
      <div className="print-hidden animate-rise mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-fuchsia-400/25 bg-fuchsia-400/[0.06] px-4 py-3 shadow-[inset_0_1px_0_rgba(240,171,252,0.06)]">
        <p className="text-[13px] leading-relaxed text-stone-300">
          This is a real report generated from example data by the same
          engine that runs on your CSV.
        </p>
        <Link href="/" className={`shrink-0 ${btnPrimarySm}`}>
          Run it on your ads
          <ArrowIcon className="h-3.5 w-3.5" />
        </Link>
      </div>

      <Report memo={memo} variant="sample" />
    </div>
  );
}
