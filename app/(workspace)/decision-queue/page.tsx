"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useDebrief } from "@/components/workspace/DebriefProvider";
import { buildSampleMemo } from "@/modules/debrief/sample";
import {
  deriveDecisionQueue,
  QUEUE_CATEGORY_LABELS,
  type QueueCategory,
  type QueueEntry,
} from "@/modules/debrief";
import { ArrowIcon, ListChecksIcon, XIcon } from "@/components/ui/icons";
import {
  badgeAccent,
  badgeMuted,
  btnPrimarySm,
  card,
  cardHover,
  eyebrow,
  gradientText,
} from "@/components/ui/theme";

/* Decision Queue / Multi-Account V1 — a session-only portfolio surface
   over already-completed, independent Debrief results (see
   modules/debrief/decisionQueue.ts for the pure projection this page
   renders). Buyer/internal only — there is deliberately no Client
   register here (see that module's header comment and CLAUDE.md's
   Step 14: individual reports keep their own Buyer/Client toggle;
   this page is a triage tool, not a deliverable).

   Decision Queue Usability V1 — this file's redesign, in one pass:
   Phase 1 (density): the card is now a single clickable row (label,
   badge, headline, optional context lines, a text affordance) instead
   of a boxed report card with its own separate CTA button — a "queue"
   should read as a list to scan, not a stack of report excerpts.
   Phase 2 (trust): the intro line now explicitly disclaims business
   importance, not just "score". Phase 3: an optional reassessment
   line, reused verbatim from decision.ts, on the two categories where
   "when do I look again" is the live question. Phase 5: the empty
   state now teaches the four-category taxonomy up front (a legend
   built from the same constants the populated queue uses — zero new
   copy to keep in sync) plus ONE real-engine example card sourced
   from buildSampleMemo() (the exact function that powers /sample) —
   never a hardcoded fake Memo, never mixed into the real portfolio
   state (it only ever renders in the zero-account branch below, and
   is never added to `portfolio`). */

/* Category badge tone: needs_decision reuses the existing "recommendation
   / ready" accent tone; watch_review gets the product's amber warning
   tone; the two hold states share the quiet muted tone — visually less
   urgent than an actionable entry, on purpose (see CLAUDE.md's
   emerald/red-are-win/loss-only and amber-is-warnings-only rules —
   none of those are performance claims here, just UI hierarchy). */
const CATEGORY_BADGE_CLASS: Record<QueueCategory, string> = {
  needs_decision: badgeAccent,
  watch_review:
    "shrink-0 whitespace-nowrap rounded-full border border-amber-400/25 bg-amber-400/[0.08] px-2 py-0.5 text-[10px] font-medium text-amber-300",
  no_action_yet: badgeMuted,
  stable_hold: badgeMuted,
};

const CATEGORY_ORDER: QueueCategory[] = [
  "needs_decision",
  "watch_review",
  "no_action_yet",
  "stable_hold",
];

const CATEGORY_DESCRIPTION: Record<QueueCategory, string> = {
  needs_decision:
    "A committed budget or test move, backed by this account's strongest evidence label.",
  watch_review:
    "A committed move exists, but the evidence behind it is thinner — worth a context check before acting.",
  no_action_yet:
    "Too few judged ads yet for this account's own evidence bar. Nothing to review — it needs more data.",
  stable_hold:
    "Evaluated and found flat — no ad separated from the median. A settled read, not an unresolved one.",
};

/** One queue row. The whole card is the "open" affordance (a single
 *  <Link>, one tab stop) — remove is a separate sibling control, never
 *  nested inside the link (two independent interactive elements per
 *  row, exactly as before; this only changes which element carries the
 *  "open" action). `demo` renders a dashed border + a "Sample data"
 *  chip and disables remove — used ONLY by the empty-state example
 *  below, never for a real portfolio entry. */
function QueueEntryCard({
  entry,
  href,
  onRemove,
  demo = false,
}: {
  entry: QueueEntry;
  href: string;
  onRemove?: () => void;
  demo?: boolean;
}) {
  const label = entry.label || "this account";
  return (
    <li className={`relative ${card} ${cardHover} ${demo ? "border-dashed" : ""}`}>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${label} from the Decision Queue`}
          onClick={onRemove}
          className="absolute right-2.5 top-2.5 z-10 cursor-pointer rounded-sm p-1 text-zinc-500 transition hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <XIcon className="h-4 w-4" />
        </button>
      )}
      <Link
        href={href}
        aria-label={`Open the full Debrief for ${label}`}
        className="block rounded-xl p-3.5 pr-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-inset"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* min-w-0 is load-bearing: a flex item's default min-width
              is "auto" (content-based), which silently defeats
              `truncate` — a long label would push the row wider (or
              get cut off with no "…") instead of actually shrinking to
              make room for the badge beside it. */}
          <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-zinc-100">{label}</p>
          <span className={CATEGORY_BADGE_CLASS[entry.category]}>{entry.categoryLabel}</span>
          {demo && (
            <span className="shrink-0 whitespace-nowrap rounded-full border border-dashed border-white/15 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
              Sample data
            </span>
          )}
        </div>
        {/* The badge already shows categoryLabel; only add this line
            when priorityReason says something MORE specific (e.g.
            "Budget decision ready · supported evidence" vs the
            badge's plain "Decision ready") — the two hold categories
            currently have nothing more specific to add, so skip the
            redundant repeat rather than show the same words twice. */}
        {entry.priorityReason !== entry.categoryLabel && (
          <p className="mt-1 text-xs font-medium text-zinc-500">{entry.priorityReason}</p>
        )}
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-300">{entry.headline}</p>
        {entry.reassessTrigger && (
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{entry.reassessTrigger}</p>
        )}
        {entry.comparisonAnnotation && (
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{entry.comparisonAnnotation}</p>
        )}
        <span className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-accent-soft">
          Open Debrief
          <ArrowIcon className="h-3 w-3" />
        </span>
      </Link>
    </li>
  );
}

/** Phase 5 empty-state teaching aid: the four categories, in order,
 *  reusing the exact labels/descriptions/badge classes the populated
 *  queue renders — never a second copy of this taxonomy to drift out
 *  of sync. */
function CategoryLegend() {
  return (
    <ul className="grid gap-2 text-left sm:grid-cols-2">
      {CATEGORY_ORDER.map((category) => (
        <li
          key={category}
          className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-3"
        >
          <span className={CATEGORY_BADGE_CLASS[category]}>{QUEUE_CATEGORY_LABELS[category]}</span>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
            {CATEGORY_DESCRIPTION[category]}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Phase 5: ONE example row built from buildSampleMemo() — the same
 *  real-engine function that renders /sample, from the same shipped
 *  sampleCsv.ts fixture. Never a hardcoded MemoDecision, never added
 *  to the session's real `portfolio` state, and only ever rendered in
 *  the zero-account branch below — so it can never appear alongside,
 *  or be mistaken for, a real account. "Open Debrief" leads to the
 *  existing /sample report (there is no queue-item id for a card that
 *  was never added to the portfolio). */
function DemoQueueEntry() {
  const demoQueue = useMemo(() => {
    const memo = buildSampleMemo();
    return deriveDecisionQueue([{ id: "demo", label: `Sample — ${memo.scope.product}`, memo }]);
  }, []);
  const entry = demoQueue.entries[0];
  if (!entry) return null;
  return (
    <ul>
      <QueueEntryCard entry={entry} href="/sample" demo />
    </ul>
  );
}

export default function DecisionQueuePage() {
  const { portfolio, removeFromQueue, status, reset } = useDebrief();

  /* "Add another account" must always land on a BLANK generator form —
     otherwise a completed report the user navigated away from without
     explicitly adding or resetting would reappear here, which reads as
     a stuck/duplicate state. Only reset when a report is actually
     showing (status "ready"): an in-progress, not-yet-generated form
     (status "idle") is left completely alone, so this link can never
     discard fields the user is still typing. */
  const handleAddAnother = () => {
    if (status === "ready") reset();
  };

  const queue = useMemo(
    () =>
      deriveDecisionQueue(
        portfolio.map((snapshot) => ({
          id: snapshot.id,
          label: snapshot.label,
          memo: snapshot.memo,
        }))
      ),
    [portfolio]
  );

  return (
    <div>
      <header className="animate-rise flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <p className={eyebrow}>Decision Queue</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Which accounts <span className={gradientText}>deserve a look first?</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-zinc-400">
            Review the accounts with a decision ready first. Each priority comes
            from that account&apos;s own criteria and evidence — never a score,
            and never a signal of which account matters more to your business.
          </p>
        </div>
        <Link href="/generator" onClick={handleAddAnother} className={`shrink-0 ${btnPrimarySm}`}>
          Add another account
          <ArrowIcon className="h-3.5 w-3.5" />
        </Link>
      </header>

      {portfolio.length === 0 ? (
        <div className="animate-rise mt-10 space-y-6" style={{ animationDelay: "90ms" }}>
          <div className={`flex flex-col items-center gap-3 ${card} px-6 py-10 text-center`}>
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-zinc-400">
              <ListChecksIcon className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-zinc-200">
              Your queue fills as you debrief accounts.
            </p>
            <p className="max-w-sm text-xs leading-relaxed text-zinc-400">
              Analyze your first account in the generator, then add it here —
              the queue only ever holds reports you&apos;ve generated this
              session.
            </p>
            <Link href="/generator" onClick={handleAddAnother} className={`mt-1 ${btnPrimarySm}`}>
              Go to generator
              <ArrowIcon className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div>
            <p className={eyebrow}>How accounts get grouped</p>
            <div className="mt-3">
              <CategoryLegend />
            </div>
          </div>

          <div>
            <p className={eyebrow}>What a queue entry looks like</p>
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-zinc-500">
              Generated by the same engine that will analyze your CSV, from
              Debrief&apos;s own sample dataset — not a real account, and never
              added to your queue.
            </p>
            <div className="mt-3">
              <DemoQueueEntry />
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-rise mt-10 space-y-8" style={{ animationDelay: "90ms" }}>
          {portfolio.length === 1 && (
            <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs leading-relaxed text-zinc-400">
              One account so far — prioritization becomes useful once there&apos;s
              more than one to compare. Add another account to see it in
              context.
            </p>
          )}

          {CATEGORY_ORDER.map((category) => {
            const entries = queue.entries.filter((e) => e.category === category);
            if (entries.length === 0) return null;
            return (
              <section key={category}>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
                    {QUEUE_CATEGORY_LABELS[category]}
                  </h2>
                  <span className="text-xs text-zinc-500">({entries.length})</span>
                </div>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-zinc-500">
                  {CATEGORY_DESCRIPTION[category]}
                </p>
                <ul className="mt-3 space-y-2">
                  {entries.map((entry) => (
                    <QueueEntryCard
                      key={entry.id}
                      entry={entry}
                      href={`/decision-queue/${entry.id}`}
                      onRemove={() => removeFromQueue(Number(entry.id))}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <p className="animate-rise mt-10 text-xs leading-relaxed text-zinc-500" style={{ animationDelay: "140ms" }}>
        This queue is a first-level prioritization, not automated account
        management — each entry still needs its own context check.{" "}
        {portfolio.length > 0
          ? "Your reports stay in this browser tab for the session only — refreshing the page clears the queue, the same way it clears an in-progress debrief."
          : "Reports stay in this browser tab for the session only and are never stored server-side."}
      </p>
    </div>
  );
}
