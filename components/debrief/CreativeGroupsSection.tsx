"use client";

import { useId, useState } from "react";
import type { Memo } from "@/modules/debrief";
import type { ReportView } from "./memoToText";

/**
 * Creative Grouping V1 — descriptive repeated-evidence summary for
 * user-declared creative groups (see modules/debrief/creativeGroups.ts
 * for the pure summarizer this renders). Renders ONLY when
 * memo.creativeGroups has at least one repeated (>=2 judged
 * executions) group — a run with no declared groups, or none
 * repeated, renders nothing and the report is unchanged.
 *
 * Honesty rules baked into this component:
 *  - Every number here is a direct read of memo.creativeGroups, which
 *    is itself a pure re-classification of analysis.rankedAds by a
 *    label the user typed — no causal wording anywhere ("above/at/
 *    below median", never "winning"/"stronger"/"caused").
 *  - The fixed evidence-limitation caveat (memo.creativeGroups.limits)
 *    renders once for the whole section, not per group.
 *  - Member executions are progressively disclosed (screen-collapsed,
 *    same pattern as Next Tests' Setup/Signals — see
 *    components/debrief/Report.tsx's TestRow and .print-force-block in
 *    globals.css) rather than always shown, to keep cards compact; the
 *    full list is still always in the DOM and always renders in print,
 *    regardless of on-screen state.
 */

function GroupCard({
  label,
  judgedCount,
  aboveCount,
  atCount,
  belowCount,
  members,
  client,
}: {
  label: string;
  judgedCount: number;
  aboveCount: number;
  atCount: number;
  belowCount: number;
  members: { name: string; category: "below" | "at" | "above" }[];
  client: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();

  const tallyParts: string[] = [];
  if (aboveCount > 0) {
    tallyParts.push(
      `${aboveCount} ${client ? "above the typical result" : "above median"}`
    );
  }
  if (atCount > 0) {
    tallyParts.push(`${atCount} ${client ? "at the typical result" : "at median"}`);
  }
  if (belowCount > 0) {
    tallyParts.push(
      `${belowCount} ${client ? "below the typical result" : "below median"}`
    );
  }

  const categoryLabel = (c: "below" | "at" | "above") =>
    c === "above"
      ? client
        ? "above typical"
        : "above median"
      : c === "below"
        ? client
          ? "below typical"
          : "below median"
        : client
          ? "at typical"
          : "at median";

  return (
    <div className="print-avoid-break rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
      <p className="break-words text-[13px] font-semibold text-zinc-100">{label}</p>
      <p className="mt-1 text-xs text-zinc-400">
        {judgedCount} judged execution{judgedCount === 1 ? "" : "s"}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
        {tallyParts.join(" · ")}
      </p>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded((v) => !v)}
        className="print-hidden mt-2 cursor-pointer text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500 transition-colors hover:text-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-carbon"
      >
        {expanded ? "Hide executions" : "Show executions"}
      </button>
      <ul
        id={detailsId}
        className={`print-force-block mt-2 space-y-1 ${expanded ? "block" : "hidden"}`}
      >
        {members.map((m) => (
          <li key={m.name} className="flex gap-2 text-[11px] leading-relaxed text-zinc-500">
            <span aria-hidden="true" className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
            <span className="min-w-0 break-words">
              {m.name} — {categoryLabel(m.category)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CreativeGroupsSection({ memo, view }: { memo: Memo; view: ReportView }) {
  const creativeGroups = memo.creativeGroups;
  if (!creativeGroups || creativeGroups.groups.length === 0) return null;

  const client = view === "client";

  return (
    <section
      aria-label="Creative groups"
      className="print-avoid-break animate-rise mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"
    >
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-300">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
        Creative groups
      </p>
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-zinc-400">
        {client
          ? "Groups you labeled yourself, and how the ads carrying each one performed."
          : "Your own group labels, and how the judged ads carrying each one performed."}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {creativeGroups.groups.map((group) => (
          <GroupCard
            key={group.label}
            label={group.label}
            judgedCount={group.judgedCount}
            aboveCount={group.aboveCount}
            atCount={group.atCount}
            belowCount={group.belowCount}
            members={group.members}
            client={client}
          />
        ))}
      </div>
      <p className="mt-4 max-w-3xl text-xs leading-relaxed text-zinc-500">
        {client ? creativeGroups.limits.client : creativeGroups.limits.buyer}
      </p>
    </section>
  );
}
