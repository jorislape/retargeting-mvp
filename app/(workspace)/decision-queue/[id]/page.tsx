"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Report } from "@/components/debrief/Report";
import { useDebrief } from "@/components/workspace/DebriefProvider";
import { ArrowIcon } from "@/components/ui/icons";
import { btnSecondary } from "@/components/ui/theme";

/* Opens ONE session-completed account from the Decision Queue. This is
   intentionally NOT the live single-account generator flow — no
   onNewDebrief/onAddToQueue is passed to Report, so those toolbar
   actions don't render here (see the `onNewDebrief &&`/`onAddToQueue &&`
   guards in Report.tsx); resetting or re-adding from a past snapshot
   would be ambiguous (reset what, add what, again?). "Back to Decision
   Queue" is the one navigation action this page adds.

   Creative images are deliberately absent here (see
   DebriefProvider.tsx's Decision Queue section comment): they are
   revoked object URLs tied to whichever file is CURRENTLY loaded in the
   live generator, not to this past snapshot, so passing them here would
   either be wrong (today's file's images on a past account) or empty.
   Report/CreativeEvidenceStrip already renders correctly with none. */
export default function DecisionQueueAccountPage() {
  const params = useParams<{ id: string }>();
  const { portfolio } = useDebrief();
  const id = Number(params.id);
  const snapshot = portfolio.find((entry) => entry.id === id);

  if (!snapshot) {
    return (
      <div className="animate-rise flex flex-col items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.045] px-6 py-14 text-center">
        <p className="text-sm font-medium text-zinc-200">
          This account isn&apos;t in your current session.
        </p>
        <p className="max-w-sm text-xs leading-relaxed text-zinc-400">
          The Decision Queue only holds reports generated this browser
          session — a refresh clears it, the same way it clears an
          in-progress debrief.
        </p>
        <Link href="/decision-queue" className={`mt-1 ${btnSecondary}`}>
          <ArrowIcon className="h-3.5 w-3.5 rotate-180" />
          Back to Decision Queue
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="print-hidden animate-rise mb-6">
        <Link
          href="/decision-queue"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition hover:text-accent-soft"
        >
          <ArrowIcon className="h-3.5 w-3.5 rotate-180" />
          Back to Decision Queue
        </Link>
      </div>
      <Report memo={snapshot.memo} variant="generated" />
    </div>
  );
}
