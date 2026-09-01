"use client";

import { useState } from "react";
import type {
  Memo,
  MemoBrief,
  MemoComparison,
  MemoTest,
  MemoWinnerLoserRow,
} from "@/modules/debrief";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  PrinterIcon,
  RefreshIcon,
  SlidersIcon,
} from "@/components/ui/icons";
import { btnPrimarySm, btnSecondary } from "@/components/ui/theme";
import { Wordmark } from "@/components/ui/brand";
import { clientizeText, evidenceLine, memoToText, type ReportView } from "./memoToText";
import { CreativeEvidenceStrip } from "./CreativeEvidenceStrip";
import type { CreativeAssetRef } from "@/components/workspace/DebriefProvider";
import { computePerformanceSectionNumbers } from "@/components/report/reportNumbering";
import { PERFORMANCE_SECTIONS, PERFORMANCE_SECTION_IDS } from "@/components/report/reportSections";
import { accentCssVars, getAccentById } from "@/components/report/reportCustomization";
import { useReportCustomization } from "@/components/report/useReportCustomization";
import { ReportCustomizationPanel } from "@/components/report/ReportCustomizationPanel";
import { PERFORMANCE_PRESET_OPTIONS, PERFORMANCE_PRESETS } from "./reportPresets";
import { PerformanceRankingChart } from "./PerformanceRankingChart";
import { SpendAllocationChart } from "./SpendAllocationChart";
import { MovementChart } from "./MovementChart";

/* ------------------------------------------------------------------ */
/* The report as an intelligence DOCUMENT: no sheet-box, no cards-on-  */
/* cards. A masthead opened by a short accent bar, an editorial stat   */
/* numbered sections divided by hairlines, tables set as tables, and   */
/* the run-list as a ruled ledger. Product chrome (view tabs, copy,    */
/* PDF, new) lives in one toolbar above the document and never prints. */
/*                                                                     */
/* Two audiences, one memo:                                            */
/*   Buyer memo    — the technical read a senior buyer works from.     */
/*   Client report — the same facts in plain language, top-3 entries,  */
/*                   no internal jargon.                               */
/* ------------------------------------------------------------------ */

const CONFIDENCE_COLOR: Record<Memo["confidence"]["level"], string> = {
  high: "text-emerald-400",
  medium: "text-amber-300",
  low: "text-red-400",
};

/** Filesystem-safe filename fragment — lowercase, ASCII, hyphenated,
 *  never empty. Applied only to the product name; the rest of the
 *  filename is a fixed, known-safe string. */
function safeFilenamePart(text: string): string {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 60) || "debrief";
}

/* Numbered section head: accent numeral, title, hairline. */
function SectionHead({
  n,
  title,
  right,
}: {
  n: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="print-heading flex items-baseline gap-3 border-b border-white/10 pb-2.5">
      <span className="print-accent font-mono text-[11px] font-semibold text-accent-soft">
        {n}
      </span>
      <h2 className="text-[13px] font-semibold tracking-tight text-zinc-200">
        {title}
      </h2>
      <span className="flex-1" />
      {right}
    </div>
  );
}

/** Print-only executive summary: a handful of short, labeled lines
 *  built ONLY from fields the memo already computed (never a new
 *  interpretation) — the verdict, the main action, the top
 *  recommended test, and the confidence level. A line is omitted
 *  whenever its source field is empty; the whole block is omitted
 *  when nothing qualifies. Print-only because the on-screen report
 *  already shows all of this in the sections below — this exists so
 *  a printed/exported page 1 is scannable in under 20 seconds. */
function ExecutiveSummary({ memo, view }: { memo: Memo; view: ReportView }) {
  const client = view === "client";
  const candidates: { label: string; value: string | undefined }[] = [
    { label: "Verdict", value: (client ? memo.clientSummary : memo.tldr)[0] },
    {
      label: client ? "Main action" : "Kill / reduce",
      value: client ? memo.losers.clientInstruction : memo.losers.killInstruction,
    },
    { label: "Top recommended test", value: memo.nextTests[0]?.test },
    { label: "Confidence", value: memo.confidence.level },
  ];
  const lines = candidates.filter(
    (l): l is { label: string; value: string } => Boolean(l.value)
  );
  if (lines.length === 0) return null;

  return (
    <div className="print-only print-exec-summary print-avoid-break mt-6 border border-white/10 p-3">
      <p className="print-section-label mb-1.5 text-[9px] font-bold uppercase tracking-[0.08em]">
        Executive summary
      </p>
      <div className="space-y-1">
        {lines.map((line) => (
          <p key={line.label} className="flex gap-1.5 text-xs leading-relaxed text-zinc-400">
            <span className="print-kv-label font-medium text-zinc-300">{line.label}: </span>
            <span className="print-kv-value min-w-0 break-words">{line.value}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

/* Period Comparison V2 — "What changed" between the two exports.
   Unnumbered, ABOVE the Next-move card (change is the context the
   decision is read in), rendered only when a previous-period file was
   provided. Strictly descriptive — the caveat and the decision card's
   own copy both state that this never feeds the recommendation. The
   match provenance (Ad ID vs ad name) is surfaced as a visible line at
   the top of the section, per approved adjustment #2 — not only in the
   limits text. */
function WhatChangedSection({
  comparison,
  view,
  topAdsShown,
}: {
  comparison: MemoComparison;
  view: ReportView;
  topAdsShown: 3 | 5;
}) {
  const client = view === "client";
  const account = client ? comparison.account.client : comparison.account.buyer;
  const persistence = client
    ? comparison.persistence.client
    : comparison.persistence.buyer;
  const limits = client ? comparison.limits.client : comparison.limits.buyer;
  const improved = comparison.improved.slice(0, topAdsShown);
  const declined = comparison.declined.slice(0, topAdsShown);

  const deltaList = (
    rows: typeof improved,
    tone: "win" | "loss",
    heading: string
  ) =>
    rows.length > 0 && (
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
          {heading}
        </p>
        <ul className="mt-1.5 space-y-1.5">
          {rows.map((row) => (
            <li
              key={row.name}
              className={`border-l pl-3 text-[13px] leading-relaxed ${
                tone === "win"
                  ? "border-emerald-400/40"
                  : "border-red-400/40"
              }`}
            >
              <span className="font-medium text-zinc-200">{row.name}</span>{" "}
              <span className="font-mono text-[12px] tabular-nums text-zinc-400">
                {row.previousLabel} → {row.currentLabel}
              </span>{" "}
              <span
                className={`font-mono text-[12px] tabular-nums ${
                  tone === "win" ? "text-emerald-400 print-win" : "text-red-400 print-loss"
                }`}
              >
                {row.changeLabel}
              </span>
              {row.conversionChangeLabel && (
                <span className="text-[12px] text-zinc-500">
                  {" "}
                  · {row.conversionChangeLabel}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <section
      aria-label="What changed vs previous period"
      className="print-avoid-break animate-rise mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:p-6"
    >
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-300">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
        What changed vs previous period
      </p>
      {(comparison.periodLabel.previous || comparison.periodLabel.current) && (
        <p className="mt-1.5 font-mono text-[11px] text-zinc-500">
          {comparison.periodLabel.previous ?? "previous period"} →{" "}
          {comparison.periodLabel.current ?? "current period"}
        </p>
      )}
      {/* Match provenance — always visible, never buried in limits. */}
      <p className="mt-2 inline-flex max-w-full items-baseline gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] leading-relaxed text-zinc-400">
        <span className="shrink-0 font-semibold uppercase tracking-[0.08em] text-zinc-300">
          {comparison.matchBasis === "ad_id" ? "Matched by Ad ID" : "Matched by ad name"}
        </span>
        <span className="min-w-0">{comparison.matchNote}</span>
      </p>

      <ul className="mt-4 space-y-1.5">
        {account.map((line, i) => (
          <li key={i} className="text-[13px] leading-relaxed text-zinc-300">
            {line}
          </li>
        ))}
      </ul>

      {(improved.length > 0 || declined.length > 0) && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {deltaList(improved, "win", client ? "Moved ahead" : "Improved")}
          {deltaList(declined, "loss", client ? "Fell behind" : "Declined")}
        </div>
      )}

      {persistence.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
            {client ? "Last period's leaders" : "Winner persistence"}
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {persistence.map((line, i) => (
              <li key={i} className="text-[13px] leading-relaxed text-zinc-400">
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(comparison.appeared.total > 0 || comparison.disappeared.total > 0) && (
        <p className="mt-4 text-[12px] leading-relaxed text-zinc-500">
          {comparison.appeared.total > 0 && (
            <>
              New this period: {comparison.appeared.names.join(", ")}
              {comparison.appeared.total > comparison.appeared.names.length &&
                ` and ${comparison.appeared.total - comparison.appeared.names.length} more`}
              .{" "}
            </>
          )}
          {comparison.disappeared.total > 0 && (
            <>
              No longer present: {comparison.disappeared.names.join(", ")}
              {comparison.disappeared.total > comparison.disappeared.names.length &&
                ` and ${comparison.disappeared.total - comparison.disappeared.names.length} more`}
              .
            </>
          )}
        </p>
      )}

      {limits.length > 0 && (
        <div className="mt-4 border-t border-white/[0.08] pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
            {client ? "Worth knowing about this comparison" : "Comparison limits"}
          </p>
          <ul className="mt-1.5 space-y-1">
            {limits.map((line, i) => (
              <li key={i} className="text-[12px] leading-relaxed text-zinc-500">
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-4 border-t border-white/[0.08] pt-3 text-[12px] leading-relaxed text-zinc-500">
        {comparison.caveat}
      </p>
    </section>
  );
}

/* Expert Commentary V2 — the practitioner's own attributed take.
   Visually distinct from engine sections (amber-tinted commentary
   frame, explicit attribution line) so a reader can never mistake
   professional judgment for something the data established. Renders
   in both views and in print while non-empty. */
function ExpertTakeBlock({
  text,
  agencyName,
}: {
  text: string;
  agencyName: string;
}) {
  return (
    <section
      aria-label="Expert commentary"
      className="print-avoid-break animate-rise mt-6 rounded-xl border border-amber-300/25 border-l-[3px] border-l-amber-300/60 bg-amber-300/[0.04] p-5 sm:p-6"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-200/90">
        Expert commentary
      </p>
      <p className="mt-2 max-w-3xl whitespace-pre-line text-[13px] leading-relaxed text-zinc-200">
        {text}
      </p>
      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
        {agencyName.trim() !== ""
          ? `Added by ${agencyName.trim()}`
          : "Added by the report author"}{" "}
        — professional judgment, not a conclusion derived from the data in
        this report.
      </p>
    </section>
  );
}

/* Decision-First V1 → Evidence-Explicit polish: the one committed call,
   directly under the masthead. Unnumbered on purpose — it sits above
   the numbered sections the way the masthead does, so nothing below
   renumbers. Same memo.decision in both views; only the register
   differs. Visible immediately: headline, rationale, one evidence-
   strength sentence, "Not yet", Preserve/Change/Watch, and the numeric
   reassess trigger — that's the "answer in a few seconds" set. Only the
   detailed limits go behind a native <details>, closed by default.
   evidenceState is the card's ONLY strength signal — the full
   Confidence read keeps its own section further down (unchanged); no
   standalone Confidence line is duplicated here, since the two can
   legitimately disagree (e.g. a clearly flat, sufficient field reads
   evidenceState "supported" while confidence's own rules can still
   land on "low") and showing both on one card reads as a contradiction
   rather than two distinct signals. */
const EVIDENCE_COLOR: Record<Memo["decision"]["evidenceState"], string> = {
  supported: "text-emerald-400",
  limited: "text-amber-300",
  insufficient: "text-red-400",
};

/* Evidence Sufficiency V1 — Brief Readiness's own color scale, kept
   visually distinct in MEANING from EVIDENCE_COLOR above even though
   the palette is shared: this is "is this specific observation worth
   briefing," not "is this dataset's decision supported." */
const READINESS_COLOR: Record<"ready" | "directional" | "insufficient", string> = {
  ready: "text-emerald-400",
  directional: "text-amber-300",
  insufficient: "text-red-400",
};

/** Card-only truncation: keeps "Preserve" compact by dropping any
 *  explanatory clause after the first em dash. The stored value on
 *  MemoDecision is untouched, and text export (memoToText.ts) always
 *  serializes the full sentence — this trims the on-screen card only. */
function firstClause(text: string): string {
  const idx = text.indexOf(" — ");
  return idx === -1 ? text : text.slice(0, idx);
}

function DecisionCard({
  memo,
  view,
  expandLimits,
}: {
  memo: Memo;
  view: ReportView;
  /** Decision & Comparison V2: when a comparison or a user-set
   *  criterion is in play, the limits are promoted from the collapsed
   *  <details> to an always-visible "What we don't know" list — those
   *  runs have new caveats the reader shouldn't have to discover. A
   *  default single-period run keeps the original collapsed disclosure
   *  unchanged. */
  expandLimits: boolean;
}) {
  const d = memo.decision;
  const client = view === "client";
  const avoid = client ? d.avoidNow.client : d.avoidNow.buyer;
  const limits = client ? d.limits.client : d.limits.buyer;
  // nextControlledTest is a single register; clientize defensively in
  // the client view so a future test string can't leak buyer jargon.
  const cz = (text: string) => (client ? clientizeText(text) : text);
  return (
    <section
      aria-label="Next move"
      className="print-avoid-break animate-rise mt-8 rounded-xl border border-accent/25 border-l-[3px] border-l-accent/70 bg-accent/[0.05] p-5 sm:p-6"
    >
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-soft">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
        Next move
      </p>
      <p className="mt-3 max-w-3xl text-[17px] font-semibold leading-snug text-zinc-50 sm:text-[19px]">
        {client ? d.clientHeadline : d.headline}
      </p>
      {/* Decision & Comparison V2: "What we know" labels the evidence
          side of the card — the rationale and evidence-strength line —
          with "What we don't know" (the limits) as its counterpart
          below. Same content as before; the pairing is the change. */}
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
        {client ? "What the data shows" : "What we know"}
      </p>
      <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-zinc-300">
        {client ? d.clientRationale : d.rationale}
      </p>
      <p className="mt-3 max-w-3xl text-xs leading-relaxed text-zinc-400">
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${EVIDENCE_COLOR[d.evidenceState]}`}
        >
          {client ? "How sure we are" : "Evidence"}
        </span>
        {": "}
        {evidenceLine(d, memo.scope.adsJudged, view)}
      </p>
      {/* Evidence Confidence V2 — cross-period consistency of the
          current leader, sourced from memo.comparison (presentation
          context only; the decision and evidenceState above remain
          comparison-blind — isolation is test-enforced). */}
      {memo.comparison?.leaderConsistency && (
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-zinc-400">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
            {client ? "Across periods" : "Consistency"}
          </span>
          {": "}
          {client
            ? memo.comparison.leaderConsistency.client
            : memo.comparison.leaderConsistency.buyer}
        </p>
      )}
      {/* Evidence Sufficiency V1 — a strong budget decision may coexist
          with a creative pattern that isn't durable-established yet.
          Renders ONLY when the committed call actually moves budget
          toward the leader (never a cut, which doesn't rest on the
          winner's pattern at all) AND that leader's own brief-readiness
          hasn't cleared "ready" — surfacing the split explicitly rather
          than letting the confident budget headline imply the creative
          claim is equally proven. Reuses T1's own already-computed
          readiness sentence verbatim (never a second, competing
          explanation of the same fact). decision.ts stays fully
          unaware this line exists — briefReadiness is read from
          memo.nextTests, never fed back into `d`. */}
      {d.action === "budget" &&
        d.budgetVariant !== "cut" &&
        memo.nextTests[0]?.briefReadiness &&
        memo.nextTests[0].briefReadiness.state !== "ready" && (
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-zinc-400">
            <span
              className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${READINESS_COLOR[memo.nextTests[0].briefReadiness.state]}`}
            >
              {client ? "Creative pattern" : "Brief readiness"}
            </span>
            {": "}
            {client
              ? memo.nextTests[0].briefReadiness.client
              : memo.nextTests[0].briefReadiness.buyer}
          </p>
        )}
      {/* Decision Criteria V2 — whose bars decided. Buyer view only
          (the labels carry buyer vocabulary); user-provided criteria
          are visually tagged so a default is never presented as the
          user's own bar, or vice versa. */}
      {!client && d.appliedCriteria.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
            Decision bars applied
          </summary>
          <ul className="mt-1.5 space-y-1">
            {d.appliedCriteria.map((criterion, i) => (
              <li
                key={i}
                className="flex items-baseline gap-2 text-[12px] leading-relaxed text-zinc-500"
              >
                <span
                  className={`shrink-0 rounded-sm border px-1 py-px text-[9px] font-semibold uppercase tracking-[0.08em] ${
                    criterion.source === "user"
                      ? "border-accent/40 text-accent-soft"
                      : "border-white/15 text-zinc-500"
                  }`}
                >
                  {criterion.source === "user" ? "Yours" : "Default"}
                </span>
                <span className="min-w-0">{criterion.label}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {avoid.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
            {client ? "What we're deliberately not doing yet" : "Not yet"}
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {avoid.map((bullet, i) => (
              <li
                key={i}
                className="border-l border-amber-300/40 pl-3 text-[13px] leading-relaxed text-zinc-400"
              >
                {bullet}
              </li>
            ))}
          </ul>
        </div>
      )}
      {d.nextControlledTest && (
        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
            Next controlled test
          </p>
          <dl className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-zinc-300">
            <div className="flex gap-2">
              <dt className="shrink-0 font-medium text-zinc-500">
                {client ? "Keep the same" : "Preserve"}
              </dt>
              <dd>{cz(firstClause(d.nextControlledTest.preserve))}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 font-medium text-zinc-500">Change</dt>
              <dd>{cz(d.nextControlledTest.change)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 font-medium text-zinc-500">Watch</dt>
              <dd>{cz(d.nextControlledTest.watch)}</dd>
            </div>
          </dl>
        </div>
      )}
      <p className="mt-4 border-t border-white/[0.08] pt-3 text-xs leading-relaxed text-zinc-400">
        {client ? d.reassess.client : d.reassess.buyer}
      </p>
      {limits.length > 0 &&
        (expandLimits ? (
          /* Decision & Comparison V2: with a comparison or user
             criteria in play, the limits carry load-bearing caveats —
             always visible as the "What we don't know" counterpart to
             "What we know" above. */
          <div className="mt-4 border-t border-white/[0.08] pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              {client ? "What we still can't conclude" : "What we don't know"}
            </p>
            <ul className="mt-2 space-y-1">
              {limits.map((line, i) => (
                <li key={i} className="text-[12px] leading-relaxed text-zinc-500">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          // key={view}: <details>'s `open` is a native, uncontrolled DOM
          // property — React never resets it on a normal re-render since
          // it's never part of the rendered props. Without this key, a
          // user who manually expands the disclosure in one view finds
          // it still open after toggling Buyer ↔ Client (same DOM node
          // reused). The key forces a fresh node per view, so it's always
          // closed by default again on either side of the toggle.
          <details key={view} className="mt-4 border-t border-white/[0.08] pt-3">
            <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              {client ? "What we still can't conclude" : "Evidence limits"}
            </summary>
            <ul className="mt-2 space-y-1">
              {limits.map((line, i) => (
                <li key={i} className="text-[12px] leading-relaxed text-zinc-500">
                  {line}
                </li>
              ))}
            </ul>
          </details>
        ))}
    </section>
  );
}

function AdTable({
  rows,
  tone,
  view,
  topAdsShown,
  density,
}: {
  rows: MemoWinnerLoserRow[];
  tone: "win" | "loss";
  view: ReportView;
  /** Report Foundation V1 — same value used by the Client list and TXT
   *  export; the engine may compute more rows than this (up to 5), so
   *  an honest "N more" line follows when truncated. */
  topAdsShown: 3 | 5;
  /** "compact" hides the reason/creative-format note and the
   *  conversion-count sub-line — name, value, vs-median, and spend
   *  (the table's actual columns) are never affected. */
  density: "compact" | "standard";
}) {
  const shown = rows.slice(0, topAdsShown);
  const more = rows.length - shown.length;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[540px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left">
            <th className="w-8 py-2 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              #
            </th>
            <th className="py-2 pr-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              Ad
            </th>
            <th className="py-2 pr-4 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              Value
            </th>
            <th className="py-2 pr-4 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              {view === "client" ? "vs typical" : "vs median"}
            </th>
            <th className="py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              Spend
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((ad, i) => (
            <tr
              key={ad.name + i}
              className="border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.02]"
            >
              <td
                className={`py-3 pr-2 align-top font-mono text-xs font-semibold ${
                  tone === "win" ? "print-win text-emerald-400" : "print-loss text-red-400"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
              </td>
              <td className="max-w-72 py-3 pr-4 align-top">
                {/* break-words: underscore-joined ad names have no
                    natural break points — they must wrap, not clip,
                    especially in print where the table can't scroll. */}
                <p className="break-words text-[13px] font-semibold leading-snug text-zinc-100">
                  {ad.name}
                </p>
                {density === "standard" && (
                  <>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                      {ad.reason}
                    </p>
                    {ad.conversionLabel && (
                      <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-zinc-500 tabular-nums">
                        {ad.conversionLabel}
                      </p>
                    )}
                  </>
                )}
              </td>
              <td className="py-3 pr-4 text-right align-top font-mono text-[13px] font-semibold tabular-nums text-zinc-100">
                {ad.valueLabel}
              </td>
              <td
                className={`py-3 pr-4 text-right align-top font-mono text-xs font-semibold tabular-nums ${
                  tone === "win" ? "print-win text-emerald-400" : "print-loss text-red-400"
                }`}
              >
                {ad.vsMedianLabel}
              </td>
              <td className="py-3 text-right align-top font-mono text-xs tabular-nums text-zinc-400">
                {ad.spendLabel}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {more > 0 && (
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          {more} more ad{more === 1 ? "" : "s"} {tone === "win" ? "cleared the benchmark" : "ran below it"} —
          shown count set in Customize report.
        </p>
      )}
    </div>
  );
}

/* Client view: the top N as ruled entries — a reading list, not a
   data table. */
function ClientAdList({
  rows,
  tone,
  topAdsShown,
  density,
}: {
  rows: MemoWinnerLoserRow[];
  tone: "win" | "loss";
  /** Report Foundation V1 — same value used by AdTable and TXT export. */
  topAdsShown: 3 | 5;
  /** "compact" drops the conversion-count sub-line only; spend (the
   *  other half of that same line) always stays. */
  density: "compact" | "standard";
}) {
  const top = rows.slice(0, topAdsShown);
  const more = rows.length - top.length;
  return (
    <div>
      <div className="divide-y divide-white/[0.06]">
        {top.map((ad, i) => (
          <div
            key={ad.name + i}
            className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 border-l-2 py-3 pl-4 ${
              tone === "win"
                ? "print-win border-emerald-400/70"
                : "print-loss border-red-400/60"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-snug text-zinc-100">
                {ad.name}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                {ad.spendLabel} spent
                {density === "standard" && ad.conversionLabel ? ` · ${ad.conversionLabel}` : ""}
              </p>
            </div>
            <p className="font-mono text-[15px] font-semibold tabular-nums text-zinc-100">
              {ad.valueLabel}
            </p>
            <p
              className={`font-mono text-xs font-semibold tabular-nums ${
                tone === "win" ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {clientizeText(ad.vsMedianLabel)}
            </p>
          </div>
        ))}
      </div>
      {more > 0 && (
        <p className="pt-2.5 text-xs leading-relaxed text-zinc-400">
          {more} more ad{more === 1 ? "" : "s"}{" "}
          {tone === "win" ? "performed above" : "ran below"} the typical result —
          full detail in the buyer memo.
        </p>
      )}
    </div>
  );
}

/* ---------- Client-view presentation blocks (V1 polish) ----------- */
/* Presentation ONLY: every value below is read straight off the memo —
   no new calculations, no invented metrics. Debrief is not a
   dashboard; these blocks just make the client-facing decision faster
   to read. Buyer view renders none of this. */

/* Executive summary cards — the client's version of the stat row. */
function ClientStatCards({ memo }: { memo: Memo }) {
  const { scope } = memo;
  const best = memo.winners[0] ?? null;
  /* tone colors the value only — the standout metrics (best performer,
     next tests) get a subtle accent so the card grid reads at a glance.
     print-win keeps the best-performer green in the PDF. */
  const cards: { label: string; value: string; sub: string; tone?: string }[] =
    [
      {
        label: "Total spend",
        value: scope.totalSpendLabel,
        sub: "in the period reviewed",
      },
      {
        label: `Typical ${scope.kpiLabel}`,
        value: scope.medianLabel,
        sub: "the account's midpoint result",
      },
      ...(best
        ? [
            {
              label: "Best performer",
              value: best.valueLabel,
              sub: best.name,
              tone: "print-win text-emerald-400",
            },
          ]
        : []),
      {
        label: "Judged fairly",
        value: `${scope.adsJudged} of ${scope.adsAnalyzed}`,
        sub: "ads had enough spend to judge",
      },
      {
        label: "Next tests",
        value: String(memo.nextTests.length),
        sub: "recommended below",
        tone: "text-accent-soft",
      },
    ];
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="break-inside-avoid flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"
        >
          <p className="print-kv-label text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
            {card.label}
          </p>
          <p
            className={`print-kv-value mt-1.5 break-words font-mono font-semibold tabular-nums ${
              card.tone ?? "text-zinc-50"
            } ${
              card.value.length > 12
                ? "text-[15px] leading-tight"
                : "text-[19px] leading-none"
            }`}
          >
            {card.value}
          </p>
          <p className="mt-1.5 break-words text-[11px] leading-snug text-zinc-400">
            {card.sub}
          </p>
        </div>
      ))}
    </div>
  );
}

/* The at-a-glance decision split: worked / needs improvement / not
   enough data yet. Counts are the groups the report itself shows
   (winners/losers lists, set-aside total) — no new math. */
function ClientDecisionSplit({ memo }: { memo: Memo }) {
  const groups = [
    {
      title: "Worked well",
      titleClass: "print-win text-emerald-400",
      /* Colored left-rail + tint: green survives PDF via print-win. */
      rail: "border-l-emerald-400/60 print-win",
      tint: "bg-emerald-400/[0.04]",
      count: memo.winners.length,
      names: memo.winners.slice(0, 3).map((a) => a.name),
      meaning: "These ads performed above the typical result.",
    },
    {
      title: "Needs improvement",
      titleClass: "print-loss text-red-400",
      rail: "border-l-red-400/50 print-loss",
      tint: "bg-red-400/[0.04]",
      count: memo.losers.rows.length,
      names: memo.losers.rows.slice(0, 3).map((a) => a.name),
      meaning: "These ads performed below the typical result.",
    },
    {
      title: "Not enough data yet",
      titleClass: "text-zinc-400",
      rail: "border-l-white/20 print-neutral",
      tint: "bg-white/[0.02]",
      count: memo.scope.adsSetAside,
      names: [] as string[],
      meaning: "These ads need more spend before judging fairly.",
    },
  ].filter((g) => g.count > 0);
  if (groups.length === 0) return null;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      {groups.map((group) => (
        <div
          key={group.title}
          className={`break-inside-avoid rounded-xl border border-white/[0.06] border-l-2 ${group.rail} ${group.tint} p-4`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <p
              className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${group.titleClass}`}
            >
              {group.title}
            </p>
            <span
              className={`font-mono text-[17px] font-semibold leading-none tabular-nums ${group.titleClass}`}
            >
              {group.count}
            </span>
          </div>
          {group.names.length > 0 && (
            <ul className="mt-2.5 space-y-0.5">
              {group.names.map((name) => (
                <li
                  key={name}
                  className="break-words text-xs leading-snug text-zinc-300"
                >
                  {name}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2.5 text-[11px] leading-relaxed text-zinc-400">
            {group.meaning}
          </p>
        </div>
      ))}
    </div>
  );
}

/* Client next-steps roadmap: the same three tests as scannable cards —
   test idea, why, success. Setup detail stays in the buyer view and in
   the Copy output; the recommendation logic is untouched. */
function ClientTestCards({ tests }: { tests: MemoTest[] }) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      {tests.slice(0, 3).map((test, i) => (
        <article
          key={i}
          className="break-inside-avoid flex flex-col rounded-xl border border-white/[0.08] border-t-2 border-t-accent/40 p-4"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-accent/30 bg-accent/[0.06] font-mono text-[11px] font-semibold text-accent-soft">
              {i + 1}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              Next test
            </span>
          </div>
          <p className="mt-3 break-words text-[13px] font-semibold leading-snug text-zinc-100">
            {clientizeText(test.test)}
          </p>
          {/* Evidence Sufficiency V1 — same plain-language readiness
              read as the buyer badge, jargon-free by construction
              (MemoBriefReadiness.client never uses buyer vocabulary).
              Quiet, not a second headline; omitted entirely once the
              signal is fully established. */}
          {test.briefReadiness && test.briefReadiness.state !== "ready" && (
            <p className="mt-2 break-words text-xs leading-relaxed text-zinc-400">
              {test.briefReadiness.client}
            </p>
          )}
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
            Why it&apos;s worth testing
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            {clientizeText(test.why)}
          </p>
          <p className="mt-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-400 print-win">
            <CheckIcon className="h-3 w-3" />
            Success looks like
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            {clientizeText(test.winningLooksLike)}
          </p>
        </article>
      ))}
    </div>
  );
}

/* One run-list entry: a ledger row, not a card. */
function TestRow({
  test,
  index,
  checked,
  onToggle,
  view,
}: {
  test: MemoTest;
  index: number;
  checked: boolean;
  onToggle: () => void;
  view: ReportView;
}) {
  /* Client view gets the plain-English register; buyer untouched. */
  const c = (text: string) =>
    view === "client" ? clientizeText(text) : text;
  return (
    <li className="print-avoid-break grid grid-cols-[2.75rem_1fr] gap-x-3 py-5 sm:gap-x-4">
      <span className="pt-0.5 font-mono text-sm font-semibold text-accent-soft">
        T{index + 1}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p
            className={`min-w-0 break-words text-base font-semibold leading-snug tracking-tight transition ${
              view === "buyer" && checked
                ? "text-zinc-500 line-through decoration-zinc-600"
                : "text-zinc-50"
            }`}
          >
            {c(test.test)}
          </p>
          {view === "buyer" && (
            <button
              type="button"
              role="checkbox"
              aria-checked={checked}
              aria-label={`Mark test ${index + 1} as queued`}
              onClick={onToggle}
              className={`print-hidden mt-0.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border transition motion-safe:duration-200 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-carbon ${
                checked
                  ? "border-accent bg-accent text-zinc-950"
                  : "border-white/20 bg-transparent text-transparent hover:border-accent/60"
              }`}
            >
              <CheckIcon className="h-3.5 w-3.5 text-current" />
            </button>
          )}
        </div>
        {/* Evidence Sufficiency V1 — present only for tests claiming an
            observed win/loss pattern (T1/T2). A small, quiet badge, not
            a second headline: Ready/Directional/Not enough evidence,
            same color scale as the Decision Card's evidence line. */}
        {test.briefReadiness && (
          <p
            className={`mt-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${READINESS_COLOR[test.briefReadiness.state]}`}
          >
            {test.briefReadiness.state === "ready"
              ? "Ready"
              : test.briefReadiness.state === "directional"
                ? "Directional"
                : "Not enough evidence"}
          </p>
        )}
        <dl className="mt-2.5 space-y-1.5 text-[13px] leading-relaxed text-zinc-400">
          <div>
            <dt className="print-kv-label inline text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              Why{" "}
            </dt>
            <dd className="print-kv-value inline break-words">{c(test.why)}</dd>
          </div>
          {test.briefReadiness &&
            (test.briefReadiness.state !== "ready" ||
              (view !== "client" && test.briefReadiness.disclosureNote)) && (
              <div>
                <dt className="print-kv-label inline text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                  {view === "client" ? "Worth knowing " : "Evidence check "}
                </dt>
                <dd className="print-kv-value inline break-words">
                  {test.briefReadiness.state !== "ready"
                    ? c(view === "client" ? test.briefReadiness.client : test.briefReadiness.buyer)
                    : c(test.briefReadiness.disclosureNote ?? "")}
                </dd>
              </div>
            )}
          <div>
            <dt className="print-kv-label inline text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              Hypothesis{" "}
            </dt>
            <dd className="print-kv-value inline break-words">{c(test.hypothesis)}</dd>
          </div>
          <div>
            <dt className="print-kv-label inline text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              {view === "client" ? "How " : "Setup "}
            </dt>
            <dd className="print-kv-value inline break-words">{c(test.setup)}</dd>
          </div>
          <div>
            <dt className="print-kv-label inline text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              {view === "client" ? "Success = " : "Win = "}
            </dt>
            <dd className="print-kv-value inline break-words">{c(test.winningLooksLike)}</dd>
          </div>
        </dl>
        {/* The receipts: which signals produced this recommendation. */}
        {test.signals.length > 0 && (
          <div className="print-accent-border mt-3 border-l border-white/10 pl-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              {view === "client" ? "Why it's worth testing" : "Signals used"}
            </p>
            <ul className="mt-1.5 space-y-1">
              {test.signals.map((signal, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-xs leading-relaxed text-zinc-400"
                >
                  <span
                    aria-hidden="true"
                    className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-zinc-600"
                  />
                  <span className="min-w-0 break-words">{c(signal)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </li>
  );
}

/* A generated creative brief — a hand-off document block. Everything
   in it was computed deterministically with the memo; this component
   only reveals it. Prints as part of the report when visible. */
function BriefCard({ brief, index }: { brief: MemoBrief; index: number }) {
  const label = (text: string) => (
    <p className="print-kv-label text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
      {text}
    </p>
  );
  const bullets = (items: string[]) => (
    <ul className="mt-1.5 space-y-1">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex gap-2 text-[13px] leading-relaxed text-zinc-400"
        >
          <span
            aria-hidden="true"
            className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-zinc-600"
          />
          {item}
        </li>
      ))}
    </ul>
  );

  return (
    <article className="print-avoid-break rounded-xl border border-white/[0.08] p-5">
      <p className="print-accent font-mono text-[11px] font-semibold text-accent-soft">
        Brief · T{index + 1}
      </p>
      <h3 className="mt-1.5 text-[15px] font-semibold tracking-tight text-zinc-50">
        {brief.title}
      </h3>
      <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-zinc-300">
        {brief.objective}
      </p>

      <div className="mt-5 space-y-5">
        <div>
          {label("Based on")}
          {bullets(brief.basedOn)}
        </div>
        <div>
          {label("Concept")}
          <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-zinc-400">
            {brief.concept}
          </p>
        </div>
        <div>
          {label("Hook options")}
          <ol className="mt-1.5 space-y-1">
            {brief.hooks.map((hook, i) => (
              <li
                key={i}
                className="flex gap-2.5 text-[13px] leading-relaxed text-zinc-400"
              >
                <span className="shrink-0 font-mono text-[11px] font-semibold text-zinc-400">
                  {i + 1}.
                </span>
                {hook}
              </li>
            ))}
          </ol>
        </div>
        <div>
          {label("Shot / asset direction")}
          {bullets(brief.assetDirection)}
        </div>
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            {label("Keep constant")}
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">
              {brief.keepConstant}
            </p>
          </div>
          <div>
            {label("Change")}
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">
              {brief.change}
            </p>
          </div>
        </div>
        <div>
          {label("Success metric")}
          <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-300">
            {brief.successMetric}
          </p>
        </div>
        <div>
          {label("Guardrails")}
          {bullets(brief.guardrails)}
        </div>
      </div>

      <p className="mt-5 border-t border-white/[0.06] pt-3 text-xs leading-relaxed text-zinc-400">
        {brief.basisNote}
      </p>
    </article>
  );
}

export function Report({
  memo,
  variant = "generated",
  generatedAt = null,
  onNewDebrief,
  creativeAssets = {},
}: {
  memo: Memo;
  variant?: "generated" | "sample";
  generatedAt?: number | null;
  onNewDebrief?: () => void;
  /** Creative Evidence V1 — session-only creative images keyed by
   *  normalized ad name (DebriefProvider's map for generated runs, the
   *  bundled demo map for /sample). Presentation only: an empty map
   *  renders the report exactly as before the feature existed. */
  creativeAssets?: Record<string, CreativeAssetRef>;
}) {
  /* White-label Report Customization V1A: one shared hook owns mode,
     identity fields, accent, and section visibility — session-only,
     same lifecycle as every other piece of state on this page. The
     existing buyer/client register (`view`/`ReportView`, used
     throughout this file and by memoToText.ts) is now DERIVED from
     customization.mode rather than tracked separately — one source of
     truth, translated at this single boundary so nothing downstream
     needs to know customization exists. */
  const customizationActions = useReportCustomization(PERFORMANCE_SECTION_IDS, PERFORMANCE_PRESETS);
  const { customization } = customizationActions;
  const [panelOpen, setPanelOpen] = useState(false);
  const view: ReportView = customization.mode === "client" ? "client" : "buyer";

  const [copied, setCopied] = useState(false);
  const [queued, setQueued] = useState<boolean[]>(() =>
    memo.nextTests.map(() => false)
  );
  const queuedCount = queued.filter(Boolean).length;
  /* Which tests currently have a generated brief shown. Session-only,
     like everything else — snapshot of the selection at click time. */
  const [briefIdxs, setBriefIdxs] = useState<number[]>([]);
  const client = view === "client";
  const accent = getAccentById(customization.accentId);
  const displayTitle = customization.reportTitle.trim() || memo.scope.product;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        memoToText(memo, view, customization.topAdsShown, view === "buyer" ? briefIdxs : [], customization.expertTake)
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (permissions/insecure context);
      // fail quietly rather than surface an unactionable error.
    }
  };

  /* Same client-only Blob + <a download> pattern as downloadSample()
     in GeneratorPanel.tsx — no server round-trip, nothing stored, the
     file exists only in the browser that generated it. Exports the
     currently active view, same content Copy would put on the
     clipboard. */
  const handleDownload = () => {
    const text = memoToText(memo, view, customization.topAdsShown, view === "buyer" ? briefIdxs : [], customization.expertTake);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFilenamePart(memo.scope.product)}-${view}-debrief.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* Section numbering: one running counter over the visible subset, in
     fixed order (see components/report/reportNumbering.ts) — replaces
     the old hardcoded-literal + secNum()/marketShift/avoidShift
     scheme, which only ever accounted for two conditionally-visible
     sections and couldn't generalize to independently toggleable
     ones. "market" and "whatNotToDo" stay exactly as before: visible
     only when the memo has that data, never part of the customization
     toggle surface (see reportSections.ts) — they're still passed in
     because they still occupy a numbered slot and must still shift
     the numbers after them. "patterns" keeps its existing buyer-view-
     only gate (`!client`) ANDed with the user's own toggle — hiding
     Patterns by hand behaves exactly like the view-gate already did:
     it disappears and every later number closes the gap. */
  const hasMarket = memo.marketSignal !== null;
  const avoidBullets = client ? memo.avoid.client : memo.avoid.buyer;
  const sections = customization.sections;
  const sectionNumbers = computePerformanceSectionNumbers({
    verdict: sections.verdict,
    winners: sections.winners,
    underperformers: sections.underperformers,
    market: hasMarket,
    patterns: sections.patterns && !client,
    nextTests: sections.nextTests,
    whatNotToDo: avoidBullets.length > 0,
    confidence: sections.confidence,
  });

  /* Stagger index always equals a visible section's own number + 1
     (toolbar=0, masthead=1, then each numbered section in order) —
     proven true for every existing case, so it's derived from the
     same numbers rather than tracked as a second, parallel scheme. */
  const staggerFor = (n: string | null) => (n === null ? 0 : Number(n) + 1);
  const stagger = (i: number) => ({ animationDelay: `${i * 80}ms` });

  return (
    <div style={accentCssVars(accent) as React.CSSProperties}>
      {/* ---- Toolbar: view tabs + actions. Never prints. ---- */}
      <div
        className="print-hidden animate-rise flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-white/10"
        style={stagger(0)}
      >
        <div role="group" aria-label="Report view" className="flex gap-6">
          {(
            [
              ["buyer", "Buyer"],
              ["client", "Client"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => customizationActions.setMode(value === "client" ? "client" : "internal")}
              className={`relative cursor-pointer pb-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                view === value
                  ? "text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-300"
              }`}
            >
              {label}
              <span
                aria-hidden="true"
                className={`absolute inset-x-0 -bottom-px h-0.5 transition-opacity ${
                  view === value ? "bg-accent opacity-100" : "opacity-0"
                }`}
              />
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 pb-2">
          {/* Toolbar hierarchy: Print / Save PDF is the one primary
              action once a report exists. Customize report and Copy
              are secondary. Export TXT and New debrief are quieter,
              lower-priority actions — same capabilities as before,
              just less visual weight. */}
          <button
            onClick={() => window.print()}
            title="Choose “Save as PDF” in the print dialog and disable browser headers and footers for the cleanest export."
            className={`cursor-pointer ${btnPrimarySm}`}
          >
            <PrinterIcon className="h-3.5 w-3.5" />
            Print / Save PDF
          </button>
          {/* Customization only ever appears once a report already
              exists — this button lives here, inside Report itself,
              never in the generator form. */}
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className={`cursor-pointer ${btnSecondary}`}
          >
            <SlidersIcon className="h-3.5 w-3.5" />
            Customize report
          </button>
          <button
            onClick={handleCopy}
            className={`min-w-[5.5rem] cursor-pointer ${btnSecondary}`}
          >
            {/* Keyed remount plays the settle morph on state change. */}
            <span
              key={copied ? "copied" : "copy"}
              className="flex items-center gap-1.5 motion-safe:animate-settle"
            >
              {copied ? (
                <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <CopyIcon className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </span>
          </button>
          <button
            onClick={handleDownload}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-xs font-medium text-zinc-400 underline decoration-zinc-700 underline-offset-2 transition hover:text-accent-soft hover:decoration-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            Export TXT
          </button>
          {onNewDebrief && (
            <button
              onClick={onNewDebrief}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-xs font-medium text-zinc-400 underline decoration-zinc-700 underline-offset-2 transition hover:text-accent-soft hover:decoration-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <RefreshIcon className="h-3.5 w-3.5" />
              New debrief
            </button>
          )}
        </div>
      </div>

      <article>
        {/* Print-only brand line — the on-screen sidebar wordmark is
            .print-hidden, so the printed document needs its own,
            otherwise the exported PDF carries no indication of what
            produced it. Report type, account name, and generation date
            already render just below via the existing (print-visible)
            masthead — this adds only what's missing: a one-line
            subtitle, kept compact rather than a separate cover page. */}
        <div className="print-only mb-1">
          <Wordmark className="text-sm" />
          <p className="text-[10px] leading-relaxed text-zinc-500">
            Deterministic Meta Ads creative performance analysis —{" "}
            {client ? "Client" : "Buyer"} version.
          </p>
        </div>

        {/* ---- Masthead ---- */}
        <header className="animate-rise mt-10" style={stagger(1)}>
          <div className="flex items-start justify-between gap-4">
            <div aria-hidden="true" className="mb-4 h-1 w-10 rounded-full bg-accent" />
            {customization.agencyLogo && (
              // eslint-disable-next-line @next/next/no-img-element -- blob: object URL, no next/image loader applies
              <img
                src={customization.agencyLogo.url}
                alt={customization.agencyName ? `${customization.agencyName} logo` : "Agency logo"}
                className="print-logo h-8 w-auto max-w-[140px] shrink-0 object-contain sm:h-10"
              />
            )}
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent-soft">
            {variant === "sample" ? "Sample · " : ""}
            {client ? "Performance report" : "Creative debrief"}
          </p>
          <h1 className="mt-3 text-[32px] font-semibold leading-tight tracking-tight text-zinc-50 sm:text-4xl">
            {displayTitle}
          </h1>
          {(customization.agencyName || customization.clientName) && (
            <p className="mt-1.5 text-[13px] text-zinc-400">
              {customization.agencyName && (
                <>
                  Prepared by <span className="font-medium text-zinc-300">{customization.agencyName}</span>
                </>
              )}
              {customization.agencyName && customization.clientName && " · "}
              {customization.clientName && (
                <>
                  for <span className="font-medium text-zinc-300">{customization.clientName}</span>
                </>
              )}
            </p>
          )}

          {/* Meta line: mono facts separated by hairline rules. */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[11px] tabular-nums text-zinc-400">
            <span title={memo.scope.kpiExplainer} className="text-zinc-300">
              KPI · {memo.scope.kpiLabel}
            </span>
            {memo.scope.dateRangeLabel && (
              <>
                <span aria-hidden="true" className="h-3 w-px bg-white/15" />
                <span>{memo.scope.dateRangeLabel}</span>
              </>
            )}
            <span aria-hidden="true" className="h-3 w-px bg-white/15" />
            <span>
              {customization.dateOverride
                ? new Date(`${customization.dateOverride}T00:00:00`).toLocaleDateString()
                : variant === "sample"
                  ? "Example dataset — no upload required"
                  : generatedAt
                    ? `Generated ${new Date(generatedAt).toLocaleString()}`
                    : "Generated this session"}
            </span>
          </div>
          {client && (
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-zinc-400">
              <span className="font-semibold text-zinc-300">
                {memo.scope.kpiLabel}
              </span>{" "}
              = {memo.scope.kpiExplainer}.
            </p>
          )}

          <div aria-hidden="true" className="mt-8 h-px bg-white/[0.08]" />

          {/* Client view: executive summary cards (existing values
              only). Buyer view keeps the editorial stat row below. */}
          {client ? (
            <ClientStatCards memo={memo} />
          ) : (
          <div className="mt-6 grid grid-cols-2 gap-y-5 sm:grid-cols-5">
            {[
              ["Analyzed", String(memo.scope.adsAnalyzed)],
              ["Judged", String(memo.scope.adsJudged)],
              ["Set aside", String(memo.scope.adsSetAside)],
              ["Total spend", memo.scope.totalSpendLabel],
              [
                `${client ? "Typical" : "Median"} ${memo.scope.kpiLabel}`,
                memo.scope.medianLabel,
              ],
            ].map(([label, value], i) => (
              <div
                key={label}
                className={`min-w-0 ${i === 0 ? "" : "sm:border-l sm:border-white/10 sm:pl-5"}`}
              >
                {/* Long values (e.g. "434,288.00 EUR") step down in size
                    and may wrap as a last resort — they must never spill
                    into the neighboring stat, on screen or in print. */}
                <p
                  className={`print-kv-value flex min-h-6 items-end break-words font-mono font-semibold tabular-nums text-zinc-50 ${
                    value.length > 12
                      ? "text-[15px] leading-tight"
                      : value.length > 8
                        ? "text-[18px] leading-none"
                        : "text-[22px] leading-none"
                  }`}
                >
                  {value}
                </p>
                <p className="print-kv-label mt-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-400">
                  {label}
                </p>
              </div>
            ))}
          </div>
          )}
        </header>

        {/* Period Comparison V2 — change is the context the decision is
            read in, so it renders above the Next-move card. Unnumbered,
            like the card. */}
        {memo.comparison && sections.whatChanged && (
          <WhatChangedSection
            comparison={memo.comparison}
            view={view}
            topAdsShown={customization.topAdsShown}
          />
        )}

        <DecisionCard
          memo={memo}
          view={view}
          expandLimits={
            memo.comparison != null ||
            memo.decision.appliedCriteria.some((c) => c.source === "user")
          }
        />

        {/* Creative Evidence V1 — which actual ads the decision above is
            about. Spotlights come from evidence only; renders only when
            at least one creative image exists this session. */}
        <CreativeEvidenceStrip memo={memo} view={view} assets={creativeAssets} />

        {/* Expert Commentary V2 — attributed judgment, never mixed with
            engine claims. */}
        {customization.expertTake.trim() !== "" && (
          <ExpertTakeBlock
            text={customization.expertTake}
            agencyName={customization.agencyName}
          />
        )}

        {sections.executiveSummary && <ExecutiveSummary memo={memo} view={view} />}

        {/* ---- Verdict / Summary ---- */}
        {sections.verdict && (
        <section className="animate-rise mt-12" style={stagger(staggerFor(sectionNumbers.verdict))}>
          <SectionHead n={sectionNumbers.verdict!} title={client ? "Summary" : "The verdict"} />
          {client ? (
            <>
              {/* "What this means" — the clientSummary lines made
                  visually prominent (same content, not duplicated),
                  followed by the at-a-glance decision split. */}
              <div className="break-inside-avoid mt-5 rounded-xl border border-accent/25 border-l-[3px] border-l-accent/70 bg-accent/[0.05] p-5 sm:p-6">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-soft">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-accent"
                  />
                  What this means
                </p>
                <div className="mt-3 space-y-3">
                  {memo.clientSummary.map((line, i) => (
                    <p
                      key={i}
                      className={`max-w-3xl leading-relaxed text-zinc-100 ${
                        i === 0
                          ? "text-[16px] font-semibold sm:text-[17px]"
                          : "text-[15px] font-medium"
                      }`}
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </div>
              <ClientDecisionSplit memo={memo} />
            </>
          ) : (
            <div className="mt-5 space-y-3">
              {/* First line is the one thing to read if you read nothing
                  else — sized and weighted apart from the supporting
                  lines below it, no box needed (document, not a card). */}
              {memo.tldr.map((line, i) => (
                <p
                  key={i}
                  className={
                    i === 0
                      ? "max-w-3xl text-[20px] font-semibold leading-snug text-zinc-50 sm:text-[22px]"
                      : "max-w-3xl text-[15px] leading-relaxed text-zinc-300"
                  }
                >
                  {line}
                </p>
              ))}
            </div>
          )}
        </section>
        )}

        {/* Main analytical proof layer: the exact visible judged rows below,
            placed after the committed decision/evidence and before detail. */}
        {customization.showRankingChart && (
          <PerformanceRankingChart
            winners={sections.winners ? memo.winners.slice(0, customization.topAdsShown) : []}
            losers={sections.underperformers ? memo.losers.rows.slice(0, customization.topAdsShown) : []}
            kpiLabel={memo.scope.kpiLabel}
            medianLabel={memo.scope.medianLabel}
            view={view}
            density={customization.density}
          />
        )}

        {/* Spend Allocation V1 — complements Performance Ranking (which
            ads) rather than repeating it (where the money is). Always
            the FULL judged pool — deliberately independent of
            customization.topAdsShown / sections.winners /
            sections.underperformers, which only slice the row-level
            detail below. */}
        {customization.showSpendAllocationChart && (
          <SpendAllocationChart allocation={memo.spendAllocation} view={view} />
        )}

        {/* Movement V1 — ranked KPI movement between the two periods,
            for ads honestly comparable in both. Conditional on
            memo.comparison existing (a single-period run never
            renders this at all) and independent of the existing
            "What changed vs previous period" prose section above the
            Next-move card — that section owns the full narrative;
            this chart owns ranked magnitude only, and reuses its
            already-composed sentences/counts rather than generating
            new analytical prose. */}
        {customization.showMovementChart && (
          <MovementChart comparison={memo.comparison} view={view} topAdsShown={customization.topAdsShown} />
        )}

        {/* ---- Winners / What worked ---- */}
        {sections.winners && (
        <section className="animate-rise mt-12" style={stagger(staggerFor(sectionNumbers.winners))}>
          <SectionHead n={sectionNumbers.winners!} title={client ? "What worked" : "Winners"} />
          {memo.leadingConversion && (
            <p className="mt-3 max-w-3xl text-xs leading-relaxed text-zinc-400">
              {client ? memo.leadingConversion.client : memo.leadingConversion.buyer}
            </p>
          )}
          <div className="mt-4">
            {memo.winners.length === 0 ? (
              <p className="border-l-2 border-white/15 py-1 pl-4 text-sm leading-relaxed text-zinc-400">
                {client
                  ? "No ad pulled clearly ahead this period — the tests below are designed to find the next standout."
                  : "No ad cleared the benchmark by enough to call a winner — the next tests below are how you find one."}
              </p>
            ) : client ? (
              <ClientAdList rows={memo.winners} tone="win" topAdsShown={customization.topAdsShown} density={customization.density} />
            ) : (
              <AdTable rows={memo.winners} tone="win" view={view} topAdsShown={customization.topAdsShown} density={customization.density} />
            )}
          </div>
        </section>
        )}

        {/* ---- Losers / What underperformed ---- */}
        {sections.underperformers && (
        <section className="animate-rise mt-12" style={stagger(staggerFor(sectionNumbers.underperformers))}>
          <SectionHead
            n={sectionNumbers.underperformers!}
            title={client ? "What underperformed" : "Losers / kill list"}
          />
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-300">
            {client ? memo.losers.clientInstruction : memo.losers.killInstruction}
          </p>
          {memo.losers.rows.length > 0 && (
            <div className="mt-4">
              {client ? (
                <ClientAdList rows={memo.losers.rows} tone="loss" topAdsShown={customization.topAdsShown} density={customization.density} />
              ) : (
                <AdTable rows={memo.losers.rows} tone="loss" view={view} topAdsShown={customization.topAdsShown} density={customization.density} />
              )}
            </div>
          )}
          <p className="mt-4 text-xs leading-relaxed text-zinc-400">
            {client
              ? memo.scope.adsSetAside > 0
                ? `${memo.scope.adsSetAside} ad${memo.scope.adsSetAside === 1 ? " did" : "s did"} not have enough spend to judge fairly — set aside rather than counted against.`
                : "Every ad had enough spend to be judged fairly."
              : memo.losers.setAsideNote}
          </p>
        </section>
        )}

        {/* ---- Market signal / context (only when provided; not part
            of the customization toggle surface — data-driven exactly
            as before) ---- */}
        {memo.marketSignal && (
          <section className="animate-rise mt-12" style={stagger(staggerFor(sectionNumbers.market))}>
            <SectionHead
              n={sectionNumbers.market!}
              title={client ? "Market context" : "Market signal"}
            />
            <ul className="mt-4 space-y-2">
              {memo.marketSignal.bullets.map((bullet, i) => (
                <li
                  key={i}
                  className="border-l border-white/10 pl-3 text-[13px] leading-relaxed text-zinc-400"
                >
                  {bullet}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-zinc-400">
              {memo.marketSignal.quality.summary}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              {memo.marketSignal.caveat}
            </p>
          </section>
        )}

        {/* ---- Patterns (buyer only, and only when its toggle is on) ---- */}
        {sections.patterns && !client && (
          <section
            className="animate-rise mt-12"
            style={stagger(staggerFor(sectionNumbers.patterns))}
          >
            <SectionHead n={sectionNumbers.patterns!} title="Patterns" />
            <div className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {(
                [
                  ["What winners share", memo.patterns.winners, "text-emerald-400", "print-win"],
                  ["What losers share", memo.patterns.losers, "text-red-400", "print-loss"],
                ] as const
              ).map(([title, items, color, printClass]) => (
                <div key={title}>
                  <p
                    className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${color} ${printClass}`}
                  >
                    {title}
                  </p>
                  <ul className="mt-2.5 space-y-2">
                    {items.map((point, i) => (
                      <li
                        key={i}
                        className="border-l border-white/10 pl-3 text-[13px] leading-relaxed text-zinc-400"
                      >
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---- Next tests: the run-list ledger. Creative briefs live
            nested inside, never as their own numbered section — hiding
            Next tests hides the nested briefs block too, regardless of
            the Creative briefs toggle's own state, simply because
            nothing inside an unrendered section can render. ---- */}
        {sections.nextTests && (
        <section
          className="animate-rise mt-12"
          style={stagger(staggerFor(sectionNumbers.nextTests))}
        >
          <SectionHead
            n={sectionNumbers.nextTests!}
            title={client ? "What we'll test next" : "Next tests — run list"}
            right={
              !client ? (
                <span className="print-hidden font-mono text-[11px] tabular-nums text-zinc-400">
                  {queuedCount}/{memo.nextTests.length} queued
                </span>
              ) : undefined
            }
          />
          {client ? (
            <>
              <p className="mt-4 max-w-3xl text-[13px] leading-relaxed text-zinc-400">
                We&apos;ll test new creative based on what performed strongest
                this period — each test says why it&apos;s worth running and
                what success looks like.
              </p>
              <ClientTestCards tests={memo.nextTests} />
            </>
          ) : (
          <ol className="mt-1 divide-y divide-white/[0.08]">
            {memo.nextTests.map((test, i) => (
              <TestRow
                key={i}
                test={test}
                index={i}
                checked={queued[i]}
                view={view}
                onToggle={() => {
                  const wasQueued = queued[i];
                  setQueued((prev) => prev.map((q, j) => (j === i ? !q : q)));
                  /* Unqueuing a test drops any brief already shown for it,
                     so visible briefs (and Copy/PDF) never outlive the
                     selection. Re-select + Generate brings it back. */
                  if (wasQueued) {
                    setBriefIdxs((prev) => prev.filter((idx) => idx !== i));
                  }
                }}
              />
            ))}
          </ol>
          )}

          {/* Creative briefs: queue a test, turn it into a hand-off
              brief. Buyer view only; session-only like everything.
              Gated on sections.creativeBriefs too — never a numbered
              section of its own (see the note above the section open),
              so hiding it never touches numbering. Both the "Generate"
              affordance and any already-generated briefs hide together
              — showing a button whose output is permanently hidden
              would be confusing. */}
          {!client && sections.creativeBriefs && (
            <div className="print-hidden flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.08] pt-4">
              <button
                type="button"
                disabled={queuedCount === 0}
                onClick={() =>
                  setBriefIdxs(
                    queued.flatMap((isQueued, i) => (isQueued ? [i] : []))
                  )
                }
                className={`cursor-pointer ${btnSecondary}`}
              >
                Generate creative briefs
                {queuedCount > 0 ? ` (${queuedCount})` : ""}
              </button>
              <p className="text-xs leading-relaxed text-zinc-400">
                {queuedCount === 0
                  ? "Queue at least one test above to generate briefs."
                  : "Briefs are based on your performance data and selected test signals — not generic ad copy."}
              </p>
            </div>
          )}

          {!client && sections.creativeBriefs && briefIdxs.length > 0 && (
            <div className="mt-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                Creative briefs
              </p>
              <div className="mt-3 space-y-4">
                {briefIdxs.map(
                  (i) =>
                    memo.nextTests[i] && (
                      <BriefCard
                        key={i}
                        brief={memo.nextTests[i].brief}
                        index={i}
                      />
                    )
                )}
              </div>
            </div>
          )}
        </section>
        )}

        {/* ---- What not to do (only when the data supports bullets; not
            part of the customization toggle surface — data-driven
            exactly as before) ---- */}
        {avoidBullets.length > 0 && (
          <section
            className="animate-rise mt-12"
            style={stagger(staggerFor(sectionNumbers.whatNotToDo))}
          >
            <SectionHead
              n={sectionNumbers.whatNotToDo!}
              title={client ? "What we're avoiding" : "What not to do"}
            />
            <ul className="mt-4 space-y-2">
              {avoidBullets.map((bullet, i) => (
                <li
                  key={i}
                  className="border-l border-amber-300/40 pl-3 text-[13px] leading-relaxed text-zinc-400"
                >
                  {bullet}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ---- Confidence ---- */}
        {sections.confidence && (
        <section
          className="animate-rise mt-10"
          style={stagger(staggerFor(sectionNumbers.confidence))}
        >
          <SectionHead
            n={sectionNumbers.confidence!}
            title={client ? "Confidence & data used" : "Confidence & missing data"}
            right={
              <span
                className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${CONFIDENCE_COLOR[memo.confidence.level]}`}
              >
                {memo.confidence.level}
              </span>
            }
          />
          {client ? (
            <>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-300">
                {memo.confidence.clientWhy}
              </p>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">
                This result is based on {memo.scope.adsAnalyzed} ads and{" "}
                {memo.scope.totalSpendLabel} in ad spend
                {memo.scope.dateRangeLabel
                  ? ` between ${memo.scope.dateRangeLabel}`
                  : ""}
                . {memo.scope.adsJudged} ads had enough spend to judge fairly
                {memo.scope.adsSetAside > 0
                  ? `; ${memo.scope.adsSetAside} did not and were set aside`
                  : ""}
                . Every number comes directly from the ad account — nothing is
                estimated.
              </p>
            </>
          ) : (
            <div className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                  Why {memo.confidence.level}
                </p>
                <ul className="mt-2.5 space-y-2">
                  {memo.confidence.reasons.map((reason, i) => (
                    <li
                      key={i}
                      className="border-l border-white/10 pl-3 text-[13px] leading-relaxed text-zinc-400"
                    >
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                  Caveats & missing data
                </p>
                <ul className="mt-2.5 space-y-2">
                  {memo.confidence.notes.map((note, i) => (
                    <li
                      key={i}
                      className="border-l border-white/10 pl-3 text-[13px] leading-relaxed text-zinc-400"
                    >
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
        )}

        {/* Sign-off. The optional editorial line below is what
            sections.signOff controls; the Meta disclaimer and
            "Generated with Debrief" line further down are MANDATORY —
            never hidden by any customization toggle. */}
        <footer className="mt-14">
          <div aria-hidden="true" className="h-px bg-white/[0.08]" />
          {sections.signOff && (
            <p className="print-footer mt-4 text-xs text-zinc-400">
              Deterministic scoring — every number above comes from your CSV, not
              a model.
            </p>
          )}
          {/* Print-only: the on-screen site footer carrying this
              disclaimer is .print-hidden, so the exported document
              needs its own — repeated here rather than assumed from
              page 1, since a multi-page PDF may be handed off apart
              from this app. Same .print-footer treatment as the line
              above (and as Competitor Debrief's own footer) so both
              reports read as one consistent, quiet sign-off style. */}
          <p className="print-only print-footer mt-2 leading-relaxed text-zinc-500">
            Not affiliated with Meta Platforms, Inc. Generated by Debrief
            {generatedAt ? ` on ${new Date(generatedAt).toLocaleString()}` : ""}.
          </p>
        </footer>
      </article>

      <ReportCustomizationPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        actions={customizationActions}
        sections={PERFORMANCE_SECTIONS}
        defaultTitlePlaceholder={memo.scope.product}
        modeReadout={{ internal: "Buyer", client: "Client" }}
        presetOptions={PERFORMANCE_PRESET_OPTIONS}
        showRankingChartControl
        showSpendAllocationChartControl
        showMovementChartControl
      />
    </div>
  );
}
