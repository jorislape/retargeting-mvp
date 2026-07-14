import Link from "next/link";
import { Report } from "@/components/debrief/Report";
import { buildSampleMemo } from "@/modules/debrief/sample";
import { ArrowIcon } from "@/components/ui/icons";
import { btnPrimarySm } from "@/components/ui/theme";

export const metadata = {
  // Root layout's "%s · Debrief" template supplies the brand suffix —
  // no manual "— Debrief" here, or it doubles up.
  title: "Sample report",
  description:
    "A fully rendered example of the debrief you get from your own Meta Ads CSV.",
  alternates: { canonical: "/sample" },
};

/* Server component: the sample memo is computed by the real engine at
   render time from hardcoded data — no upload, no client work. */
export default function SamplePage() {
  const memo = buildSampleMemo();

  return (
    <div>
      <div className="print-hidden animate-rise mb-8 flex flex-wrap items-center justify-between gap-3 border-l-2 border-accent bg-accent/[0.05] px-4 py-3">
        <p className="text-[13px] leading-relaxed text-zinc-300">
          This is a real report generated from example data by the same
          engine that runs on your CSV.
        </p>
        <Link href="/generator" className={`shrink-0 ${btnPrimarySm}`}>
          Run it on your ads
          <ArrowIcon className="h-3.5 w-3.5" />
        </Link>
      </div>

      <Report memo={memo} variant="sample" />
    </div>
  );
}
