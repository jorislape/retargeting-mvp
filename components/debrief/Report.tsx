"use client";

import { useState } from "react";
import type { Memo, MemoTest, MemoWinnerLoserRow } from "@/modules/debrief";
import {
  CheckIcon,
  CopyIcon,
  PrinterIcon,
  RefreshIcon,
} from "@/components/ui/icons";
import {
  btnPrimarySm,
  btnSecondary,
  chipAmber,
  chipBlue,
  chipEmerald,
  chipRed,
  eyebrow,
} from "@/components/ui/theme";
import { memoToText, type ReportView } from "./memoToText";

/* ------------------------------------------------------------------ */
/* The report renderer — shared by generated debriefs and the sample.  */
/* The report is a SHEET: one elevated graphite memo with a            */
/* letterhead, a signal-ruled verdict, and sections separated by       */
/* drawn rules — the                                                   */
/* on-screen document and the PDF are the same artifact. Product       */
/* chrome (view toggle, copy, PDF, new debrief) sits in a toolbar      */
/* above the sheet and never prints.                                   */
/*                                                                     */
/* Two audiences, one memo:                                            */
/*   Buyer view  — the technical memo a senior buyer works from.       */
/*   Client view — the same facts in plain language, top-3 cards,      */
/*                 no internal jargon.                                  */
/* ------------------------------------------------------------------ */

const CONFIDENCE_CHIP: Record<Memo["confidence"]["level"], string> = {
  high: `${chipEmerald} font-mono uppercase tracking-wider`,
  medium: `${chipAmber} font-mono uppercase tracking-wider`,
  low: `${chipRed} font-mono uppercase tracking-wider`,
};

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <p className={`shrink-0 ${eyebrow}`}>{children}</p>
      <span
        aria-hidden="true"
        className="h-px min-w-8 flex-1 bg-gradient-to-r from-white/12 to-transparent"
      />
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
            <th className="w-8 py-2 pr-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-stone-600">
              #
            </th>
            <th className="py-2 pr-4 font-mono text-[10px] font-semibold uppercase tracking-widest text-stone-600">
              Ad
            </th>
            <th className="py-2 pr-4 text-right font-mono text-[10px] font-semibold uppercase tracking-widest text-stone-600">
              Value
            </th>
            <th className="py-2 pr-4 text-right font-mono text-[10px] font-semibold uppercase tracking-widest text-stone-600">
              {view === "client" ? "vs typical" : "vs median"}
            </th>
            <th className="py-2 text-right font-mono text-[10px] font-semibold uppercase tracking-widest text-stone-600">
              Spend
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((ad, i) => (
            <tr
              key={ad.name + i}
              className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.03]"
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
              <td className="py-3 pr-4 text-right align-top">
                <span
                  className={`${tone === "win" ? chipEmerald : chipRed} ${
                    tone === "win" ? "print-win" : "print-loss"
                  } whitespace-nowrap font-mono`}
                >
                  {ad.vsMedianLabel}
                </span>
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

/* Client view renders performers as summary cards, not data tables:
   top 3 only, name + plain reading + the two numbers that matter. */
function ClientAdCards({
  rows,
  tone,
}: {
  rows: MemoWinnerLoserRow[];
  tone: "win" | "loss";
}) {
  const top = rows.slice(0, 3);
  const more = rows.length - top.length;
  return (
    <div className="space-y-2">
      {top.map((ad, i) => (
        <div
          key={ad.name + i}
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-white/[0.08] bg-black/20 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-4"
        >
          <span
            aria-hidden="true"
            className={`h-9 w-1 shrink-0 rounded-full ${
              tone === "win" ? "print-win bg-emerald-400" : "print-loss bg-red-400"
            }`}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-snug text-stone-100">
              {ad.name}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-stone-500">
              {ad.spendLabel} spent
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="font-mono text-[15px] font-semibold tabular-nums text-stone-100">
              {ad.valueLabel}
            </p>
            <span
              className={`${tone === "win" ? chipEmerald : chipRed} ${
                tone === "win" ? "print-win" : "print-loss"
              } whitespace-nowrap font-mono`}
            >
              {ad.vsMedianLabel}
            </span>
          </div>
        </div>
      ))}
      {more > 0 && (
        <p className="px-1 pt-0.5 text-xs leading-relaxed text-stone-500">
          {more} more ad{more === 1 ? "" : "s"}{" "}
          {tone === "win" ? "performed above" : "ran below"} the typical result —
          full detail in the Buyer view.
        </p>
      )}
    </div>
  );
}

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
    <li className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:border-white/20 sm:p-5">
      <div className="flex items-start gap-3.5">
        {view === "buyer" && (
          <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-label={`Mark test ${index + 1} as queued`}
            onClick={onToggle}
            className={`print-hidden mt-0.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border transition motion-safe:duration-200 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-carbon ${
              checked
                ? "border-fuchsia-500 bg-fuchsia-600 text-white"
                : "border-white/20 bg-white/[0.02] text-transparent hover:border-fuchsia-400/50"
            }`}
          >
            <CheckIcon className="h-3.5 w-3.5 text-current" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p
              className={`font-display text-[15px] font-semibold leading-snug transition ${
                view === "buyer" && checked
                  ? "text-stone-500 line-through decoration-stone-600"
                  : "text-white"
              }`}
            >
              {test.test}
            </p>
            <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-widest text-stone-600">
              T{index + 1}
            </span>
          </div>
          <dl className="mt-2.5 space-y-1.5 text-[13px] leading-relaxed text-stone-400">
            <div>
              <dt className="inline font-mono text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                Why{" "}
              </dt>
              <dd className="inline">{test.why}</dd>
            </div>
            <div>
              <dt className="inline font-mono text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                {view === "client" ? "How " : "Setup "}
              </dt>
              <dd className="inline">{test.setup}</dd>
            </div>
            <div>
              <dt className="inline font-mono text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                {view === "client" ? "Success = " : "Win = "}
              </dt>
              <dd className="inline">{test.winningLooksLike}</dd>
            </div>
          </dl>
        </div>
      </div>
    </li>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: ReportView;
  onChange: (view: ReportView) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Report view"
      className="print-hidden inline-flex rounded-lg border border-white/10 bg-white/[0.04] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    >
      {(
        [
          ["buyer", "Buyer view"],
          ["client", "Client view"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          onClick={() => onChange(value)}
          className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60 ${
            view === value
              ? "bg-gradient-to-b from-fuchsia-500 to-pink-600 text-white shadow-[0_1px_10px_-1px_rgba(217,70,239,0.55)]"
              : "text-stone-400 hover:text-stone-100"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
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

  /* Reveal order: toolbar → sheet header → verdict → sections. 90ms
     steps read as one orchestrated cascade, not scattered pops. */
  const stagger = (i: number) => ({ animationDelay: `${i * 90}ms` });

  return (
    <div>
      {/* ---- Toolbar: product chrome, never prints ---- */}
      <div
        className="print-hidden animate-rise flex flex-wrap items-center justify-between gap-3"
        style={stagger(0)}
      >
        <ViewToggle view={view} onChange={setView} />
        <div className="flex flex-wrap items-center gap-2">
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

      {/* ---- The sheet: one white memo, letterhead to sign-off ---- */}
      <article className="animate-rise mt-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#1c1b21] to-[#141318] shadow-[0_32px_64px_-24px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(240,171,252,0.07)]">
        {/* The slate strip — hazard tape across the sheet's top edge. */}
        <div aria-hidden="true" className="tape h-1.5" />
        <div className="px-5 py-6 sm:px-8 sm:py-8">
        {/* Letterhead */}
        <header style={stagger(1)}>
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <p className={eyebrow}>
                {variant === "sample"
                  ? client
                    ? "Sample performance report"
                    : "Sample creative debrief"
                  : client
                    ? "Performance report"
                    : "Creative debrief"}
              </p>
              <h1 className="mt-2 font-display text-[26px] font-bold tracking-tight text-white sm:text-3xl">
                {memo.scope.product}
              </h1>
            </div>
            <div className="flex flex-col items-end gap-1.5 pt-1">
              <span className={chipBlue} title={memo.scope.kpiExplainer}>
                KPI · {memo.scope.kpiLabel}
              </span>
              {memo.scope.dateRangeLabel && (
                <span className="font-mono text-[11px] tabular-nums text-stone-500">
                  {memo.scope.dateRangeLabel}
                </span>
              )}
            </div>
          </div>
          <p className="mt-2 font-mono text-[11px] text-stone-600">
            {variant === "sample"
              ? "Example dataset — no upload required"
              : generatedAt
                ? `Generated ${new Date(generatedAt).toLocaleString()}`
                : null}
          </p>
          {client && (
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-stone-500">
              <span className="font-semibold text-stone-300">
                {memo.scope.kpiLabel}
              </span>{" "}
              = {memo.scope.kpiExplainer}.
            </p>
          )}

          {/* Scope strip: one ruled row of facts */}
          <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-lg border border-white/[0.08] bg-black/25 shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)] sm:grid-cols-5 sm:divide-x sm:divide-white/[0.06]">
            {[
              ["Analyzed", String(memo.scope.adsAnalyzed)],
              ["Judged", String(memo.scope.adsJudged)],
              ["Set aside", String(memo.scope.adsSetAside)],
              ["Total spend", memo.scope.totalSpendLabel],
              [
                `${client ? "Typical" : "Median"} ${memo.scope.kpiLabel}`,
                memo.scope.medianLabel,
              ],
            ].map(([label, value]) => (
              <div key={label} className="px-3.5 py-3 transition-colors hover:bg-white/[0.03]">
                <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-600">
                  {label}
                </p>
                <p className="mt-1 truncate font-mono text-[15px] font-semibold tabular-nums text-stone-100">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </header>

        {/* ---- Verdict / Summary: the ink-ruled callout ---- */}
        <section className="animate-rise mt-8" style={stagger(2)}>
          <div className="border-y-2 border-fuchsia-500/80 py-5">
            <p className={eyebrow}>{client ? "Summary" : "The verdict"}</p>
            <div className="mt-3 space-y-2.5">
              {(client ? memo.clientSummary : memo.tldr).map((line, i) => (
                <p
                  key={i}
                  className="font-display text-[16px] font-medium leading-relaxed text-stone-50 sm:text-[17px]"
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Winners / What worked ---- */}
        <section className="animate-rise mt-8" style={stagger(3)}>
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="tape-emerald h-2.5 w-10 shrink-0 rounded-sm" />
            <SectionLabel>{client ? "What worked" : "Winners"}</SectionLabel>
          </div>
          <div className="mt-3">
            {memo.winners.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/15 bg-black/20 px-4 py-6 text-center">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  {client ? "No clear standout this period" : "No winners this period"}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-500">
                  {client
                    ? "No ad pulled clearly ahead — the tests below are designed to find the next standout."
                    : "No ad cleared the benchmark by enough to call a winner — the next tests below are how you find one."}
                </p>
              </div>
            ) : client ? (
              <ClientAdCards rows={memo.winners} tone="win" />
            ) : (
              <AdTable rows={memo.winners} tone="win" view={view} />
            )}
          </div>
        </section>

        {/* ---- Losers / What underperformed ---- */}
        <section className="animate-rise mt-8" style={stagger(4)}>
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="tape-red h-2.5 w-10 shrink-0 rounded-sm" />
            <SectionLabel>
              {client ? "What underperformed" : "Losers / kill list"}
            </SectionLabel>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-stone-300">
            {client ? memo.losers.clientInstruction : memo.losers.killInstruction}
          </p>
          {memo.losers.rows.length > 0 && (
            <div className="mt-3">
              {client ? (
                <ClientAdCards rows={memo.losers.rows} tone="loss" />
              ) : (
                <AdTable rows={memo.losers.rows} tone="loss" view={view} />
              )}
            </div>
          )}
          <p className="mt-3 border-t border-white/[0.06] pt-3 text-xs leading-relaxed text-stone-500">
            {client
              ? memo.scope.adsSetAside > 0
                ? `${memo.scope.adsSetAside} ad${memo.scope.adsSetAside === 1 ? " did" : "s did"} not have enough spend to judge fairly — set aside rather than counted against.`
                : "Every ad had enough spend to be judged fairly."
              : memo.losers.setAsideNote}
          </p>
        </section>

        {/* ---- Patterns (buyer view only — the client version folds
               the takeaway into the summary) ---- */}
        {!client && (
          <section className="animate-rise mt-8" style={stagger(5)}>
            <SectionLabel>Patterns</SectionLabel>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["What winners share", memo.patterns.winners, "bg-emerald-400"],
                  ["What losers share", memo.patterns.losers, "bg-red-400"],
                ] as const
              ).map(([title, items, dot]) => (
                <div
                  key={title}
                  className="rounded-lg border border-white/[0.08] bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5"
                >
                  <p className="font-display text-[13px] font-semibold text-stone-200">
                    {title}
                  </p>
                  <ul className="mt-2.5 space-y-2">
                    {items.map((point, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 text-[13px] leading-relaxed text-stone-400"
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-[7px] h-1 w-1 shrink-0 rounded-full ${dot}`}
                        />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---- Next tests: an actionable run-list ---- */}
        <section className="animate-rise mt-8" style={stagger(client ? 5 : 6)}>
          <div className="flex items-baseline justify-between gap-3">
            <SectionLabel>
              {client ? "What we'll test next" : "Next tests — run list"}
            </SectionLabel>
            {!client && (
              <span className="print-hidden shrink-0 font-mono text-[11px] tabular-nums text-stone-500">
                {queuedCount}/{memo.nextTests.length} queued
              </span>
            )}
          </div>
          {client && (
            <p className="mt-3 text-[13px] leading-relaxed text-stone-400">
              We&apos;ll test new creative based on what performed strongest this
              period — each test says why it&apos;s worth running, how it&apos;ll
              be set up, and what success looks like.
            </p>
          )}
          <ol className="mt-3 space-y-3">
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
        <section className="animate-rise mt-8" style={stagger(client ? 6 : 7)}>
          <SectionLabel>
            {client ? "Confidence & what data was used" : "Confidence & missing data"}
          </SectionLabel>
          <div className="mt-3">
            <span className={CONFIDENCE_CHIP[memo.confidence.level]}>
              {memo.confidence.level.toUpperCase()} CONFIDENCE
            </span>
            {client ? (
              /* Client view: provenance in plain language, no internal
                 caveat list — honest about the data, silent about the
                 machinery. */
              <p className="mt-3 text-sm leading-relaxed text-stone-300">
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
              <ul className="mt-3 space-y-1.5">
                {memo.confidence.notes.map((note, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-[13px] leading-relaxed text-stone-400"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-stone-500"
                    />
                    {note}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Sign-off rule */}
        <p className="mt-8 border-t border-white/[0.08] pt-4 text-xs leading-relaxed text-stone-500">
          Deterministic scoring — every number above comes from your CSV, not a
          model.
        </p>
        </div>
      </article>
    </div>
  );
}
