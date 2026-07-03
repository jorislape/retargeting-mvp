import Link from "next/link";
import { PageHeader } from "@/components/ui/kit";
import {
  CheckIcon,
  FileTextIcon,
  SparklesIcon,
} from "@/components/ui/icons";
import { btnSecondaryMd, card } from "@/components/ui/theme";

/* Pre-launch empty state: says what the page will do, what's coming,
   and routes people to the value that exists today. */
export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Scheduled and shared client reports."
      />
      <div className={`mt-6 ${card} mx-auto max-w-xl p-8 text-center sm:p-10`}>
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
          <FileTextIcon className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-white">
          Client reports are coming in milestone M4
        </h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-zinc-400">
          Each client gets a live share link and a written summary that says
          what changed, why, and what&apos;s worth testing next — built from
          the account data you already see today.
        </p>

        {/* Preview of the deliverable — sets expectations for what "a
            report" means here: interpretation, not a metrics dump. */}
        <div
          aria-hidden="true"
          className="mx-auto mt-6 max-w-sm select-none rounded-lg border border-blue-400/15 bg-blue-500/[0.05] p-3.5 text-left"
        >
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-300">
            <SparklesIcon className="h-3 w-3" />
            Summary · example
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-300">
            CPA improved 9% while spend scaled 13% — efficiency held.
            Retargeting drove the gain; next test: refresh prospecting
            creative before fatigue sets in.
          </p>
        </div>

        <ul className="mx-auto mt-6 max-w-xs space-y-2.5 text-left text-[13px] text-zinc-300">
          <li className="flex items-start gap-2.5">
            <CheckIcon className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
            Live report link per client — no login needed
          </li>
          <li className="flex items-start gap-2.5">
            <CheckIcon className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
            Written summary you edit and approve before it sends
          </li>
          <li className="flex items-start gap-2.5">
            <CheckIcon className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
            Weekly or monthly delivery schedule per report
          </li>
        </ul>

        <div className="mt-7">
          <Link href="/home" className={btnSecondaryMd}>
            View live account performance
          </Link>
        </div>
      </div>
    </div>
  );
}
