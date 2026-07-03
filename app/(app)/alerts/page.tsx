import Link from "next/link";
import { PageHeader } from "@/components/ui/kit";
import { BellIcon, CheckIcon } from "@/components/ui/icons";
import { btnSecondaryMd, card } from "@/components/ui/theme";

/* Pre-launch empty state: says what the page will do, what's coming,
   and routes people to the value that exists today. */
export default function AlertsPage() {
  return (
    <div>
      <PageHeader
        title="Alerts"
        subtitle="Anomalies and account health, checked hourly."
      />
      <div className={`mt-6 ${card} mx-auto max-w-xl p-8 text-center sm:p-10`}>
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
          <BellIcon className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-white">
          Monitoring is coming in milestone M6
        </h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-zinc-400">
          Hourly checks on every account become your reminder system —
          nothing lives only in a chat thread, and nothing slips while
          you&apos;re heads-down on another client.
        </p>

        <ul className="mx-auto mt-6 max-w-xs space-y-2.5 text-left text-[13px] text-zinc-300">
          <li className="flex items-start gap-2.5">
            <CheckIcon className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
            Spend spikes, CPA deviations, delivery drops
          </li>
          <li className="flex items-start gap-2.5">
            <CheckIcon className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
            Rejected ads and policy flags, the hour they happen
          </li>
          <li className="flex items-start gap-2.5">
            <CheckIcon className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
            Every alert links to the affected account — context in one click
          </li>
        </ul>

        <p className="mx-auto mt-5 max-w-sm text-xs leading-relaxed text-zinc-500">
          Until then, the Overview flags accounts whose spend moved sharply
          week over week.
        </p>

        <div className="mt-7">
          <Link href="/home" className={btnSecondaryMd}>
            View live account performance
          </Link>
        </div>
      </div>
    </div>
  );
}
