"use client";

import { useState } from "react";
import type { Memo, MemoTest, MemoWinnerLoserRow } from "@/modules/debrief";
import {
  CheckIcon,
  CopyIcon,
  PrinterIcon,
  RefreshIcon,
} from "@/components/ui/icons";
import { btnPrimarySm, btnSecondary } from "@/components/ui/theme";
import { memoToText, type ReportView } from "./memoToText";

/* ------------------------------------------------------------------ */
/* The report as an intelligence DOCUMENT: no sheet-box, no cards-on-  */
/* cards. A masthead under a brass double rule, an editorial stat row, */
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

/* Numbered section head: brass numeral, small-caps title, hairline. */
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
      <span className="font-mono text-[11px] font-semibold text-brass-soft">
        {n}
      </span>
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-300">
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
            <th className="w-8 py-2 pr-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600">
              #
            </th>
            <th className="py-2 pr-4 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600">
              Ad
            </th>
            <th className="py-2 pr-4 text-right font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600">
              Value
            </th>
            <th className="py-2 pr-4 text-right font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600">
              {view === "client" ? "vs typical" : "vs median"}
            </th>
            <th className="py-2 text-right font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600">
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
                <p className="text-[13px] font-semibold leading-snug text-stone-100">
                  {ad.name}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-stone-500">
                  {ad.reason}
                </p>
              </td>
              <td className="py-3 pr-4 text-right align-top font-mono text-[13px] font-semibold tabular-nums text-stone-100">
                {ad.valueLabel}
              </td>
              <td
                className={`py-3 pr-4 text-right align-top font-mono text-xs font-semibold tabular-nums ${
                  tone === "win" ? "print-win text-emerald-400" : "print-loss text-red-400"
                }`}
              >
                {ad.vsMedianLabel}
              </td>
              <td className="py-3 text-right align-top font-mono text-xs tabular-nums text-stone-500">
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
              <p className="truncate text-[13px] font-semibold leading-snug text-stone-100">
                {ad.name}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-stone-500">
                {ad.spendLabel} spent
              </p>
            </div>
            <p className="font-mono text-[15px] font-semibold tabular-nums text-stone-100">
              {ad.valueLabel}
            </p>
            <p
              className={`font-mono text-xs font-semibold tabular-nums ${
                tone === "win" ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {ad.vsMedianLabel}
            </p>
          </div>
        ))}
      </div>
      {more > 0 && (
        <p className="pt-2.5 text-xs leading-relaxed text-stone-500">
          {more} more ad{more === 1 ? "" : "s"}{" "}
          {tone === "win" ? "performed above" : "ran below"} the typical result —
          full detail in the buyer memo.
        </p>
      )}
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
  return (
    <li className="grid grid-cols-[2.75rem_1fr] gap-x-3 py-5 sm:gap-x-4">
      <span className="pt-0.5 font-mono text-sm font-semibold text-brass-soft">
        T{index + 1}
      </span>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p
            className={`font-display text-[17px] font-semibold leading-snug transition ${
              view === "buyer" && checked
                ? "text-stone-500 line-through decoration-stone-600"
                : "text-stone-50"
            }`}
          >
            {test.test}
          </p>
          {view === "buyer" && (
            <button
              type="button"
              role="checkbox"
              aria-checked={checked}
              aria-label={`Mark test ${index + 1} as queued`}
              onClick={onToggle}
              className={`print-hidden mt-0.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border transition motion-safe:duration-200 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/60 focus-visible:ring-offset-2 focus-visible:ring-offset-carbon ${
                checked
                  ? "border-brass bg-brass text-[#141414]"
                  : "border-white/20 bg-transparent text-transparent hover:border-brass/60"
              }`}
            >
              <CheckIcon className="h-3.5 w-3.5 text-current" />
            </button>
          )}
        </div>
        <dl className="mt-2.5 space-y-1.5 text-[13px] leading-relaxed text-stone-400">
          <div>
            <dt className="inline font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600">
              Why{" "}
            </dt>
            <dd className="inline">{test.why}</dd>
          </div>
          <div>
            <dt className="inline font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600">
              {view === "client" ? "How " : "Setup "}
            </dt>
            <dd className="inline">{test.setup}</dd>
          </div>
          <div>
            <dt className="inline font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600">
              {view === "client" ? "Success = " : "Win = "}
            </dt>
            <dd className="inline">{test.winningLooksLike}</dd>
          </div>
        </dl>
      </div>
    </li>
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
  const client = view === "client";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(memoToText(memo, view));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (permissions/insecure context);
      // fail quietly rather than surface an unactionable error.
    }
  };

  /* Section numbering shifts because the client view drops Patterns. */
  const secNum = (buyerN: number, clientN: number) =>
    String(client ? clientN : buyerN).padStart(2, "0");

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
              className={`relative cursor-pointer pb-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/60 ${
                view === value
                  ? "text-stone-100"
                  : "text-stone-500 hover:text-stone-300"
              }`}
            >
              {label}
              <span
                aria-hidden="true"
                className={`absolute inset-x-0 -bottom-px h-0.5 transition-opacity ${
                  view === value ? "bg-brass opacity-100" : "opacity-0"
                }`}
              />
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 pb-2">
          <button onClick={handleCopy} className={`cursor-pointer ${btnSecondary}`}>
            {copied ? (
              <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <CopyIcon className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
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
        <header className="animate-rise mt-8" style={stagger(1)}>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-brass-soft">
            {variant === "sample" ? "Sample · " : ""}
            {client ? "Performance report" : "Creative debrief"}
          </p>
          <h1 className="mt-3 font-display text-[32px] font-semibold leading-tight tracking-tight text-stone-50 sm:text-4xl">
            {memo.scope.product}
          </h1>

          {/* Meta line: mono facts separated by hairline rules. */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[11px] tabular-nums text-stone-500">
            <span title={memo.scope.kpiExplainer} className="text-stone-300">
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
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-stone-500">
              <span className="font-semibold text-stone-300">
                {memo.scope.kpiLabel}
              </span>{" "}
              = {memo.scope.kpiExplainer}.
            </p>
          )}

          {/* The masthead's brass double rule. */}
          <div className="mt-6">
            <div className="border-t-2 border-brass" />
            <div className="mt-[3px] border-t border-white/15" />
          </div>

          {/* Editorial stat row: numerals over small caps, hairline
              separated — no boxes. */}
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
                className={i === 0 ? "" : "sm:border-l sm:border-white/10 sm:pl-5"}
              >
                <p className="font-mono text-[22px] font-semibold leading-none tabular-nums text-stone-50">
                  {value}
                </p>
                <p className="mt-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-stone-600">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </header>

        {/* ---- 01 · Verdict / Summary ---- */}
        <section className="animate-rise mt-12" style={stagger(2)}>
          <SectionHead n="01" title={client ? "Summary" : "The verdict"} />
          <div className="mt-5 space-y-3.5">
            {(client ? memo.clientSummary : memo.tldr).map((line, i) => (
              <p
                key={i}
                className="max-w-3xl font-display text-[18px] font-medium leading-relaxed text-stone-100 sm:text-[19px]"
              >
                {line}
              </p>
            ))}
          </div>
        </section>

        {/* ---- 02 · Winners / What worked ---- */}
        <section className="animate-rise mt-12" style={stagger(3)}>
          <SectionHead n="02" title={client ? "What worked" : "Winners"} />
          <div className="mt-4">
            {memo.winners.length === 0 ? (
              <p className="border-l-2 border-white/15 py-1 pl-4 text-sm leading-relaxed text-stone-500">
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
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-stone-300">
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
          <p className="mt-4 text-xs leading-relaxed text-stone-500">
            {client
              ? memo.scope.adsSetAside > 0
                ? `${memo.scope.adsSetAside} ad${memo.scope.adsSetAside === 1 ? " did" : "s did"} not have enough spend to judge fairly — set aside rather than counted against.`
                : "Every ad had enough spend to be judged fairly."
              : memo.losers.setAsideNote}
          </p>
        </section>

        {/* ---- 04 · Patterns (buyer only) ---- */}
        {!client && (
          <section className="animate-rise mt-12" style={stagger(5)}>
            <SectionHead n="04" title="Patterns" />
            <div className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {(
                [
                  ["What winners share", memo.patterns.winners, "text-emerald-400", "print-win"],
                  ["What losers share", memo.patterns.losers, "text-red-400", "print-loss"],
                ] as const
              ).map(([title, items, color, printClass]) => (
                <div key={title}>
                  <p
                    className={`font-mono text-[10px] font-semibold uppercase tracking-[0.16em] ${color} ${printClass}`}
                  >
                    {title}
                  </p>
                  <ul className="mt-2.5 space-y-2">
                    {items.map((point, i) => (
                      <li
                        key={i}
                        className="border-l border-white/10 pl-3 text-[13px] leading-relaxed text-stone-400"
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
        <section className="animate-rise mt-12" style={stagger(client ? 5 : 6)}>
          <SectionHead
            n={secNum(5, 4)}
            title={client ? "What we'll test next" : "Next tests — run list"}
            right={
              !client ? (
                <span className="print-hidden font-mono text-[11px] tabular-nums text-stone-500">
                  {queuedCount}/{memo.nextTests.length} queued
                </span>
              ) : undefined
            }
          />
          {client && (
            <p className="mt-4 max-w-3xl text-[13px] leading-relaxed text-stone-400">
              We&apos;ll test new creative based on what performed strongest this
              period — each test says why it&apos;s worth running, how it&apos;ll
              be set up, and what success looks like.
            </p>
          )}
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
        </section>

        {/* ---- Confidence ---- */}
        <section className="animate-rise mt-10" style={stagger(client ? 6 : 7)}>
          <SectionHead
            n={secNum(6, 5)}
            title={client ? "Confidence & data used" : "Confidence & missing data"}
            right={
              <span
                className={`font-mono text-[11px] font-semibold uppercase tracking-[0.14em] ${CONFIDENCE_COLOR[memo.confidence.level]}`}
              >
                {memo.confidence.level}
              </span>
            }
          />
          {client ? (
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-stone-300">
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
          ) : (
            <ul className="mt-4 space-y-2">
              {memo.confidence.notes.map((note, i) => (
                <li
                  key={i}
                  className="border-l border-white/10 pl-3 text-[13px] leading-relaxed text-stone-400"
                >
                  {note}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Sign-off */}
        <footer className="mt-12">
          <div className="border-t border-white/15" />
          <div className="mt-[3px] border-t-2 border-brass/60" />
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-stone-600">
            Deterministic scoring — every number above comes from your CSV, not
            a model.
          </p>
        </footer>
      </article>
    </div>
  );
}
