"use client";

import { useState } from "react";
import type { Memo, MemoTest, MemoWinnerLoserRow } from "@/modules/debrief";
import {
  CheckIcon,
  CopyIcon,
  FlaskIcon,
  PrinterIcon,
  RefreshIcon,
  SparklesIcon,
} from "@/components/ui/icons";
import {
  btnPrimarySm,
  btnSecondary,
  card,
  chipBlue,
  chipEmerald,
  chipRed,
  eyebrow,
} from "@/components/ui/theme";
import { memoToText, type ReportView } from "./memoToText";

/* ------------------------------------------------------------------ */
/* The report renderer — shared by generated debriefs and the sample.  */
/* Two audiences, one memo:                                            */
/*   Buyer view  — the technical memo a senior buyer works from:       */
/*                 verdict, evidence tables, patterns, run-list.       */
/*   Client view — the same facts in plain language: summary, what     */
/*                 worked, what underperformed, what we'll test next,  */
/*                 confidence. No "kill list", abbreviations explained.*/
/* The toggle is display-only — the memo is identical underneath, and  */
/* print/PDF exports whichever view is active.                         */
/* ------------------------------------------------------------------ */

const CONFIDENCE_CHIP: Record<Memo["confidence"]["level"], string> = {
  high: chipEmerald,
  medium:
    "inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-300",
  low: chipRed,
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
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-white/10 bg-panel-deep/50 p-3.5 shadow-[inset_0_1px_0_rgba(164,196,255,0.05)] sm:p-4"
        >
          <span
            aria-hidden="true"
            className={`h-9 w-1 shrink-0 rounded-full ${
              tone === "win"
                ? "print-win bg-emerald-400/70"
                : "print-loss bg-red-400/60"
            }`}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-snug text-zinc-100">
              {ad.name}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
              {ad.spendLabel} spent
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="font-mono text-[15px] font-semibold tabular-nums text-zinc-100">
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
        <p className="px-1 pt-0.5 text-xs leading-relaxed text-zinc-500">
          {more} more ad{more === 1 ? "" : "s"}{" "}
          {tone === "win" ? "performed above" : "ran below"} the typical result —
          full detail in the Buyer view.
        </p>
      )}
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
            <th className="w-8 py-2 pr-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              #
            </th>
            <th className="py-2 pr-4 font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Ad
            </th>
            <th className="py-2 pr-4 text-right font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Value
            </th>
            <th className="py-2 pr-4 text-right font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              {view === "client" ? "vs typical" : "vs median"}
            </th>
            <th className="py-2 text-right font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Spend
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((ad, i) => (
            <tr key={ad.name + i} className="border-b border-white/5 last:border-0">
              <td
                className={`py-3 pr-2 align-top font-mono text-xs font-semibold ${
                  tone === "win" ? "print-win text-emerald-400" : "print-loss text-red-400"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
              </td>
              <td className="max-w-72 py-3 pr-4 align-top">
                <p className="text-[13px] font-semibold leading-snug text-zinc-100">
                  {ad.name}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                  {ad.reason}
                </p>
              </td>
              <td className="py-3 pr-4 text-right align-top font-mono text-[13px] font-semibold tabular-nums text-zinc-100">
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
              <td className="py-3 text-right align-top font-mono text-xs tabular-nums text-zinc-400">
                {ad.spendLabel}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
    <li className={`${card} p-4 sm:p-5`}>
      <div className="flex items-start gap-3.5">
        {view === "buyer" && (
          <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-label={`Mark test ${index + 1} as queued`}
            onClick={onToggle}
            className={`print-hidden mt-0.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border transition motion-safe:duration-200 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink ${
              checked
                ? "border-blue-400/60 bg-blue-600 text-white shadow-[0_0_12px_rgba(59,130,246,0.45)]"
                : "border-white/20 bg-white/[0.02] text-transparent hover:border-blue-400/50 hover:bg-blue-500/[0.06]"
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
                  ? "text-zinc-500 line-through decoration-zinc-600"
                  : "text-white"
              }`}
            >
              {test.test}
            </p>
            <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              T{index + 1}
            </span>
          </div>
          <dl className="mt-2.5 space-y-1.5 text-[13px] leading-relaxed text-zinc-400">
            <div>
              <dt className="inline font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Why{" "}
              </dt>
              <dd className="inline">{test.why}</dd>
            </div>
            <div>
              <dt className="inline font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                {view === "client" ? "How " : "Setup "}
              </dt>
              <dd className="inline">{test.setup}</dd>
            </div>
            <div>
              <dt className="inline font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
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
      className="print-hidden inline-flex rounded-lg border border-white/10 bg-panel-deep/70 p-0.5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]"
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
          className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 ${
            view === value
              ? "border border-blue-400/40 bg-blue-500/15 text-white shadow-[0_0_14px_rgba(59,130,246,0.3),inset_0_1px_0_rgba(147,197,253,0.15)]"
              : "border border-transparent text-zinc-400 hover:text-zinc-200"
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

  /* Reveal order: header → verdict → tables → patterns → next tests.
     90ms steps read as one orchestrated cascade, not scattered pops. */
  const stagger = (i: number) => ({ animationDelay: `${i * 90}ms` });

  return (
    <article>
      {/* ---- Header block ---- */}
      <header className="animate-rise" style={stagger(0)}>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
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
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={chipBlue} title={memo.scope.kpiExplainer}>
                KPI · {memo.scope.kpiLabel}
              </span>
              {memo.scope.dateRangeLabel && (
                <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                  {memo.scope.dateRangeLabel}
                </span>
              )}
              <span className="font-mono text-[11px] text-zinc-600">
                {variant === "sample"
                  ? "Example dataset — no upload required"
                  : generatedAt
                    ? `Generated ${new Date(generatedAt).toLocaleString()}`
                    : null}
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
          </div>

          <div className="print-hidden flex flex-wrap items-center gap-2">
            <ViewToggle view={view} onChange={setView} />
            <button onClick={handleCopy} className={`cursor-pointer ${btnSecondary}`}>
              {copied ? (
                <CheckIcon className="h-3.5 w-3.5" />
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

        {/* Scope strip — recessed data wells below the page surface */}
        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 shadow-[inset_0_2px_6px_rgba(0,0,0,0.35)] sm:grid-cols-5">
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
            <div key={label} className="bg-panel-deep px-3.5 py-3">
              <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                {label}
              </p>
              <p className="mt-1 truncate font-mono text-[15px] font-semibold tabular-nums text-zinc-100">
                {value}
              </p>
            </div>
          ))}
        </div>
      </header>

      {/* ---- Verdict / Summary: the one surface allowed to bloom ---- */}
      <section className="animate-rise mt-8" style={stagger(1)}>
        <div className="rounded-2xl border border-blue-400/30 bg-gradient-to-b from-blue-500/[0.16] to-blue-500/[0.05] p-5 shadow-[0_0_64px_-12px_rgba(59,130,246,0.5),0_20px_48px_-16px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(147,197,253,0.18)] sm:p-6">
          <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-300">
            <SparklesIcon className="h-3.5 w-3.5" />
            {client ? "Summary" : "The verdict"}
          </p>
          <div className="mt-3 space-y-2.5">
            {(client ? memo.clientSummary : memo.tldr).map((line, i) => (
              <p
                key={i}
                className="font-display text-[16px] font-medium leading-relaxed text-zinc-50 sm:text-[17px]"
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Winners / What worked ---- */}
      <section className="animate-rise mt-8" style={stagger(2)}>
        <SectionLabel>{client ? "What worked" : "Winners"}</SectionLabel>
        <div className={`mt-2 ${card} ${client ? "p-4 sm:p-5" : "px-4 py-1 sm:px-5"}`}>
          {memo.winners.length === 0 ? (
            <div className="my-4 rounded-lg border border-dashed border-white/15 bg-panel-deep/40 px-4 py-6 text-center">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                {client ? "No clear standout this period" : "No winners this period"}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">
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
      <section className="animate-rise mt-8" style={stagger(3)}>
        <SectionLabel>
          {client ? "What underperformed" : "Losers / kill list"}
        </SectionLabel>
        <div className={`mt-2 ${card} p-4 sm:p-5`}>
          <p className="text-sm leading-relaxed text-zinc-200">
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
          <p className="mt-3 border-t border-white/5 pt-3 text-xs leading-relaxed text-zinc-500">
            {client
              ? memo.scope.adsSetAside > 0
                ? `${memo.scope.adsSetAside} ad${memo.scope.adsSetAside === 1 ? " did" : "s did"} not have enough spend to judge fairly — set aside rather than counted against.`
                : "Every ad had enough spend to be judged fairly."
              : memo.losers.setAsideNote}
          </p>
        </div>
      </section>

      {/* ---- Patterns (buyer view only — the client version folds the
             takeaway into the summary) ---- */}
      {!client && (
        <section className="animate-rise mt-8" style={stagger(4)}>
          <SectionLabel>Patterns</SectionLabel>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["What winners share", memo.patterns.winners, "bg-emerald-400", "print-win"],
                ["What losers share", memo.patterns.losers, "bg-red-400", "print-loss"],
              ] as const
            ).map(([title, items, dot]) => (
              <div key={title} className={`${card} p-4 sm:p-5`}>
                <p className="font-display text-[13px] font-semibold text-zinc-200">
                  {title}
                </p>
                <ul className="mt-2.5 space-y-2">
                  {items.map((point, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-[13px] leading-relaxed text-zinc-400"
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
      <section className="animate-rise mt-8" style={stagger(client ? 4 : 5)}>
        <div className="flex items-baseline justify-between gap-3">
          <SectionLabel>
            {client ? "What we'll test next" : "Next tests — run list"}
          </SectionLabel>
          {!client && (
            <span className="print-hidden shrink-0 font-mono text-[11px] tabular-nums text-zinc-500">
              {queuedCount}/{memo.nextTests.length} queued
            </span>
          )}
        </div>
        {client && (
          <p className="mt-2 text-[13px] leading-relaxed text-zinc-400">
            We&apos;ll test new creative based on what performed strongest this
            period — each test says why it&apos;s worth running, how it&apos;ll
            be set up, and what success looks like.
          </p>
        )}
        <ol className="mt-2 space-y-3">
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
      <section className="animate-rise mt-8" style={stagger(client ? 5 : 6)}>
        <SectionLabel>
          {client ? "Confidence & what data was used" : "Confidence & missing data"}
        </SectionLabel>
        <div className={`mt-2 ${card} p-4 sm:p-5`}>
          <span className={`${CONFIDENCE_CHIP[memo.confidence.level]} font-mono`}>
            {memo.confidence.level.toUpperCase()} CONFIDENCE
          </span>
          {client ? (
            /* Client view: provenance in plain language, no internal
               caveat list — honest about the data, silent about the
               machinery. */
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
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
                  className="flex items-start gap-2.5 text-[13px] leading-relaxed text-zinc-400"
                >
                  <span
                    aria-hidden="true"
                    className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-zinc-500"
                  />
                  {note}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <p className="print-hidden mt-8 flex items-center justify-center gap-2 text-center text-xs text-zinc-600">
        <FlaskIcon className="h-3.5 w-3.5" />
        Deterministic scoring — every number above comes from your CSV, not a model.
      </p>
    </article>
  );
}
