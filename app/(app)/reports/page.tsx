import Link from "next/link";
import { PageHeader } from "@/components/ui/kit";
import { CheckIcon, FileTextIcon } from "@/components/ui/icons";
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
          Each client will get a live share link, an editable written summary,
          and scheduled email delivery — built from the account data you
          already see today.
        </p>

        <ul className="mx-auto mt-6 max-w-xs space-y-2.5 text-left text-[13px] text-zinc-300">
          <li className="flex items-start gap-2.5">
            <CheckIcon className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
            Live report link per client — no login needed
          </li>
          <li className="flex items-start gap-2.5">
            <CheckIcon className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
            Written summary you can edit before it sends
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
