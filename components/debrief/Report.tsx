"use client";

import { useState } from "react";
import type { Memo, MemoBrief, MemoTest, MemoWinnerLoserRow } from "@/modules/debrief";
import {
  CheckIcon,
  CopyIcon,
  PrinterIcon,
  RefreshIcon,
} from "@/components/ui/icons";
import { btnPrimarySm, btnSecondary } from "@/components/ui/theme";
import { clientizeText, memoToText, type ReportView } from "./memoToText";

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
    <div className="flex items-baseline gap-3 border-b border-white/10 pb-2.5">
      <span className="font-mono text-[11px] font-semibold text-accent-soft">
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

function AdTable({
  rows,
  tone,
  view,
}: {
  rows: MemoWinnerLoserRow[];
  tone: "win" | "loss";
  view: ReportView;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[540px] text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left">
            <th className="w-8 py-2 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              #
            </th>
            <th className="py-2 pr-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Ad
            </th>
            <th className="py-2 pr-4 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Value
            </th>
            <th className="py-2 pr-4 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              {view === "client" ? "vs typical" : "vs median"}
            </th>
            <th className="py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Spend
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((ad, i) => (
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
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                  {ad.reason}
                </p>
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
              <td className="py-3 text-right align-top font-mono text-xs tabular-nums text-zinc-500">
                {ad.spendLabel}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Client view: the top 3 as ruled entries — a reading list, not a
   data table. */
function ClientAdList({
  rows,
  tone,
}: {
  rows: MemoWinnerLoserRow[];
  tone: "win" | "loss";
}) {
  const top = rows.slice(0, 3);
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
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                {ad.spendLabel} spent
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
        <p className="pt-2.5 text-xs leading-relaxed text-zinc-500">
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
  const cards: { label: string; value: string; sub: string }[] = [
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
    },
  ];
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="break-inside-avoid rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
            {card.label}
          </p>
          <p
            className={`mt-1.5 break-words font-mono font-semibold tabular-nums text-zinc-50 ${
              card.value.length > 12
                ? "text-[15px] leading-tight"
                : "text-[19px] leading-none"
            }`}
          >
            {card.value}
          </p>
          <p className="mt-1.5 break-words text-[11px] leading-snug text-zinc-500">
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
      count: memo.winners.length,
      names: memo.winners.slice(0, 3).map((a) => a.name),
      meaning: "These ads performed above the typical result.",
    },
    {
      title: "Needs improvement",
      titleClass: "print-loss text-red-400",
      count: memo.losers.rows.length,
      names: memo.losers.rows.slice(0, 3).map((a) => a.name),
      meaning: "These ads performed below the typical result.",
    },
    {
      title: "Not enough data yet",
      titleClass: "text-zinc-400",
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
          className="break-inside-avoid rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
        >
          <p
            className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${group.titleClass}`}
          >
            {group.title}
            <span className="ml-2 font-mono tabular-nums text-zinc-500">
              {group.count}
            </span>
          </p>
          {group.names.length > 0 && (
            <ul className="mt-2 space-y-0.5">
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
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
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
          className="break-inside-avoid rounded-xl border border-white/[0.08] p-4"
        >
          <p className="font-mono text-[11px] font-semibold text-accent-soft">
            T{i + 1}
          </p>
          <p className="mt-1.5 break-words text-[13px] font-semibold leading-snug text-zinc-100">
            {clientizeText(test.test)}
          </p>
          <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
            Why it&apos;s worth testing
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            {clientizeText(test.why)}
          </p>
          <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
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
    <li className="grid grid-cols-[2.75rem_1fr] gap-x-3 py-5 sm:gap-x-4">
      <span className="pt-0.5 font-mono text-sm font-semibold text-accent-soft">
        T{index + 1}
      </span>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p
            className={`text-base font-semibold leading-snug tracking-tight transition ${
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
        <dl className="mt-2.5 space-y-1.5 text-[13px] leading-relaxed text-zinc-400">
          <div>
            <dt className="inline text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Why{" "}
            </dt>
            <dd className="inline">{c(test.why)}</dd>
          </div>
          <div>
            <dt className="inline text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              {view === "client" ? "How " : "Setup "}
            </dt>
            <dd className="inline">{c(test.setup)}</dd>
          </div>
          <div>
            <dt className="inline text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              {view === "client" ? "Success = " : "Win = "}
            </dt>
            <dd className="inline">{c(test.winningLooksLike)}</dd>
          </div>
        </dl>
        {/* The receipts: which signals produced this recommendation. */}
        {test.signals.length > 0 && (
          <div className="mt-3 border-l border-white/10 pl-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              {view === "client" ? "Why it's worth testing" : "Signals used"}
            </p>
            <ul className="mt-1.5 space-y-1">
              {test.signals.map((signal, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-xs leading-relaxed text-zinc-500"
                >
                  <span
                    aria-hidden="true"
                    className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-zinc-600"
                  />
                  {c(signal)}
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
    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
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
    <article className="rounded-xl border border-white/[0.08] p-5">
      <p className="font-mono text-[11px] font-semibold text-accent-soft">
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
                <span className="shrink-0 font-mono text-[11px] font-semibold text-zinc-500">
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

      <p className="mt-5 border-t border-white/[0.06] pt-3 text-xs leading-relaxed text-zinc-600">
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
}: {
  memo: Memo;
  variant?: "generated" | "sample";
  generatedAt?: number | null;
  onNewDebrief?: () => void;
}) {
  const [view, setView] = useState<ReportView>("buyer");
  const [copied, setCopied] = useState(false);
  const [queued, setQueued] = useState<boolean[]>(() =>
    memo.nextTests.map(() => false)
  );
  const queuedCount = queued.filter(Boolean).length;
  /* Which tests currently have a generated brief shown. Session-only,
     like everything else — snapshot of the selection at click time. */
  const [briefIdxs, setBriefIdxs] = useState<number[]>([]);
  const client = view === "client";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        memoToText(memo, view, view === "buyer" ? briefIdxs : [])
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (permissions/insecure context);
      // fail quietly rather than surface an unactionable error.
    }
  };

  /* Section numbering shifts because the client view drops Patterns
     and the market/avoid sections only exist when they have content. */
  const hasMarket = memo.marketSignal !== null;
  const avoidBullets = client ? memo.avoid.client : memo.avoid.buyer;
  const secNum = (buyerN: number, clientN: number) =>
    String(client ? clientN : buyerN).padStart(2, "0");
  const marketShift = hasMarket ? 1 : 0;
  const avoidShift = avoidBullets.length > 0 ? 1 : 0;

  const stagger = (i: number) => ({ animationDelay: `${i * 80}ms` });

  return (
    <div>
      {/* ---- Toolbar: view tabs + actions. Never prints. ---- */}
      <div
        className="print-hidden animate-rise flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-white/10"
        style={stagger(0)}
      >
        <div role="group" aria-label="Report view" className="flex gap-6">
          {(
            [
              ["buyer", "Buyer memo"],
              ["client", "Client report"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => setView(value)}
              className={`relative cursor-pointer pb-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                view === value
                  ? "text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
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
            onClick={() => window.print()}
            className={`cursor-pointer ${btnSecondary}`}
          >
            <PrinterIcon className="h-3.5 w-3.5" />
            PDF
          </button>
          {onNewDebrief && (
            <button onClick={onNewDebrief} className={`cursor-pointer ${btnPrimarySm}`}>
              <RefreshIcon className="h-4 w-4" />
              New debrief
            </button>
          )}
        </div>
      </div>

      <article>
        {/* ---- Masthead ---- */}
        <header className="animate-rise mt-10" style={stagger(1)}>
          <div aria-hidden="true" className="mb-4 h-1 w-10 rounded-full bg-accent" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent-soft">
            {variant === "sample" ? "Sample · " : ""}
            {client ? "Performance report" : "Creative debrief"}
          </p>
          <h1 className="mt-3 text-[32px] font-semibold leading-tight tracking-tight text-zinc-50 sm:text-4xl">
            {memo.scope.product}
          </h1>

          {/* Meta line: mono facts separated by hairline rules. */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[11px] tabular-nums text-zinc-500">
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
              {variant === "sample"
                ? "Example dataset — no upload required"
                : generatedAt
                  ? `Generated ${new Date(generatedAt).toLocaleString()}`
                  : "Generated this session"}
            </span>
          </div>
          {client && (
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-zinc-500">
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
                  className={`flex min-h-6 items-end break-words font-mono font-semibold tabular-nums text-zinc-50 ${
                    value.length > 12
                      ? "text-[15px] leading-tight"
                      : value.length > 8
                        ? "text-[18px] leading-none"
                        : "text-[22px] leading-none"
                  }`}
                >
                  {value}
                </p>
                <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-500">
                  {label}
                </p>
              </div>
            ))}
          </div>
          )}
        </header>

        {/* ---- 01 · Verdict / Summary ---- */}
        <section className="animate-rise mt-12" style={stagger(2)}>
          <SectionHead n="01" title={client ? "Summary" : "The verdict"} />
          {client ? (
            <>
              {/* "What this means" — the clientSummary lines made
                  visually prominent (same content, not duplicated),
                  followed by the at-a-glance decision split. */}
              <div className="break-inside-avoid mt-5 rounded-xl border border-accent/20 bg-accent/[0.04] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-soft">
                  What this means
                </p>
                <div className="mt-3 space-y-3">
                  {memo.clientSummary.map((line, i) => (
                    <p
                      key={i}
                      className="max-w-3xl text-[15px] font-medium leading-relaxed text-zinc-100"
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </div>
              <ClientDecisionSplit memo={memo} />
            </>
          ) : (
            <div className="mt-5 space-y-3.5">
              {memo.tldr.map((line, i) => (
                <p
                  key={i}
                  className="max-w-3xl text-[18px] font-medium leading-relaxed text-zinc-100 sm:text-[19px]"
                >
                  {line}
                </p>
              ))}
            </div>
          )}
        </section>

        {/* ---- 02 · Winners / What worked ---- */}
        <section className="animate-rise mt-12" style={stagger(3)}>
          <SectionHead n="02" title={client ? "What worked" : "Winners"} />
          <div className="mt-4">
            {memo.winners.length === 0 ? (
              <p className="border-l-2 border-white/15 py-1 pl-4 text-sm leading-relaxed text-zinc-500">
                {client
                  ? "No ad pulled clearly ahead this period — the tests below are designed to find the next standout."
                  : "No ad cleared the benchmark by enough to call a winner — the next tests below are how you find one."}
              </p>
            ) : client ? (
              <ClientAdList rows={memo.winners} tone="win" />
            ) : (
              <AdTable rows={memo.winners} tone="win" view={view} />
            )}
          </div>
        </section>

        {/* ---- 03 · Losers / What underperformed ---- */}
        <section className="animate-rise mt-12" style={stagger(4)}>
          <SectionHead
            n="03"
            title={client ? "What underperformed" : "Losers / kill list"}
          />
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-300">
            {client ? memo.losers.clientInstruction : memo.losers.killInstruction}
          </p>
          {memo.losers.rows.length > 0 && (
            <div className="mt-4">
              {client ? (
                <ClientAdList rows={memo.losers.rows} tone="loss" />
              ) : (
                <AdTable rows={memo.losers.rows} tone="loss" view={view} />
              )}
            </div>
          )}
          <p className="mt-4 text-xs leading-relaxed text-zinc-500">
            {client
              ? memo.scope.adsSetAside > 0
                ? `${memo.scope.adsSetAside} ad${memo.scope.adsSetAside === 1 ? " did" : "s did"} not have enough spend to judge fairly — set aside rather than counted against.`
                : "Every ad had enough spend to be judged fairly."
              : memo.losers.setAsideNote}
          </p>
        </section>

        {/* ---- Market signal / context (only when provided) ---- */}
        {memo.marketSignal && (
          <section className="animate-rise mt-12" style={stagger(5)}>
            <SectionHead
              n="04"
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
            <p className="mt-4 text-xs leading-relaxed text-zinc-500">
              Context quality: {memo.marketSignal.quality.summary}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              {memo.marketSignal.caveat}
            </p>
          </section>
        )}

        {/* ---- Patterns (buyer only) ---- */}
        {!client && (
          <section
            className="animate-rise mt-12"
            style={stagger(5 + marketShift)}
          >
            <SectionHead n={secNum(4 + marketShift, 0)} title="Patterns" />
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

        {/* ---- Next tests: the run-list ledger ---- */}
        <section
          className="animate-rise mt-12"
          style={stagger((client ? 5 : 6) + marketShift)}
        >
          <SectionHead
            n={secNum(5 + marketShift, 4 + marketShift)}
            title={client ? "What we'll test next" : "Next tests — run list"}
            right={
              !client ? (
                <span className="print-hidden font-mono text-[11px] tabular-nums text-zinc-500">
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
                onToggle={() =>
                  setQueued((prev) => prev.map((q, j) => (j === i ? !q : q)))
                }
              />
            ))}
          </ol>
          )}

          {/* Creative briefs: queue a test, turn it into a hand-off
              brief. Buyer view only; session-only like everything. */}
          {!client && (
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
              <p className="text-xs leading-relaxed text-zinc-600">
                {queuedCount === 0
                  ? "Queue at least one test above to generate briefs."
                  : "Briefs are based on your performance data and selected test signals — not generic ad copy."}
              </p>
            </div>
          )}

          {!client && briefIdxs.length > 0 && (
            <div className="mt-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
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

        {/* ---- What not to do (only when the data supports bullets) ---- */}
        {avoidBullets.length > 0 && (
          <section
            className="animate-rise mt-12"
            style={stagger((client ? 6 : 7) + marketShift)}
          >
            <SectionHead
              n={secNum(6 + marketShift, 5 + marketShift)}
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
        <section
          className="animate-rise mt-10"
          style={stagger((client ? 6 : 7) + marketShift + avoidShift)}
        >
          <SectionHead
            n={secNum(6 + marketShift + avoidShift, 5 + marketShift + avoidShift)}
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
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

        {/* Sign-off */}
        <footer className="mt-14">
          <div aria-hidden="true" className="h-px bg-white/[0.08]" />
          <p className="mt-4 text-xs text-zinc-600">
            Deterministic scoring — every number above comes from your CSV, not
            a model.
          </p>
        </footer>
      </article>
    </div>
  );
}
