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
import { memoToText } from "./memoToText";

/* ------------------------------------------------------------------ */
/* The report renderer — shared by generated debriefs and the sample.  */
/* Reads like a memo a senior buyer would send: verdict first, then    */
/* evidence tables, then an actionable run-list of next tests.         */
/* ------------------------------------------------------------------ */

const CONFIDENCE_CHIP: Record<Memo["confidence"]["level"], string> = {
  high: chipEmerald,
  medium:
    "inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-300",
  low: chipRed,
};

function SectionLabel({ children }: { children: string }) {
  return <p className={eyebrow}>{children}</p>;
}

function AdTable({ rows, tone }: { rows: MemoWinnerLoserRow[]; tone: "win" | "loss" }) {
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
              vs median
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
}: {
  test: MemoTest;
  index: number;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li className={`${card} p-4 sm:p-5`}>
      <div className="flex items-start gap-3.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label={`Mark test ${index + 1} as queued`}
          onClick={onToggle}
          className={`print-hidden mt-0.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${
            checked
              ? "border-blue-400/60 bg-blue-600 text-white"
              : "border-white/20 bg-white/[0.02] text-transparent hover:border-white/40"
          }`}
        >
          <CheckIcon className="h-3.5 w-3.5 text-current" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p
              className={`font-display text-[15px] font-semibold leading-snug transition ${
                checked ? "text-zinc-500 line-through decoration-zinc-600" : "text-white"
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
                Setup{" "}
              </dt>
              <dd className="inline">{test.setup}</dd>
            </div>
            <div>
              <dt className="inline font-mono text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Win ={" "}
              </dt>
              <dd className="inline">{test.winningLooksLike}</dd>
            </div>
          </dl>
        </div>
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
  const [copied, setCopied] = useState(false);
  const [queued, setQueued] = useState<boolean[]>(() =>
    memo.nextTests.map(() => false)
  );
  const queuedCount = queued.filter(Boolean).length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(memoToText(memo));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (permissions/insecure context);
      // fail quietly rather than surface an unactionable error.
    }
  };

  const stagger = (i: number) => ({ animationDelay: `${i * 70}ms` });

  return (
    <article>
      {/* ---- Header block ---- */}
      <header className="animate-rise" style={stagger(0)}>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <p className={eyebrow}>
              {variant === "sample" ? "Sample creative debrief" : "Creative debrief"}
            </p>
            <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-white sm:text-[28px]">
              {memo.scope.product}
            </h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className={chipBlue}>KPI · {memo.scope.kpiLabel}</span>
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
          </div>

          <div className="print-hidden flex items-center gap-2">
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

        {/* Scope strip */}
        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-5">
          {[
            ["Analyzed", String(memo.scope.adsAnalyzed)],
            ["Judged", String(memo.scope.adsJudged)],
            ["Set aside", String(memo.scope.adsSetAside)],
            ["Total spend", memo.scope.totalSpendLabel],
            [`Median ${memo.scope.kpiLabel}`, memo.scope.medianLabel],
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

      {/* ---- Verdict ---- */}
      <section className="animate-rise mt-6" style={stagger(1)}>
        <div className="rounded-2xl border border-blue-400/25 bg-gradient-to-b from-blue-500/[0.13] to-blue-500/[0.04] p-5 shadow-[0_0_48px_-16px_rgba(59,130,246,0.4),inset_0_1px_0_rgba(147,197,253,0.12)] sm:p-6">
          <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-300">
            <SparklesIcon className="h-3.5 w-3.5" />
            The verdict
          </p>
          <div className="mt-3 space-y-2.5">
            {memo.tldr.map((line, i) => (
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

      {/* ---- Winners ---- */}
      <section className="animate-rise mt-7" style={stagger(2)}>
        <SectionLabel>Winners</SectionLabel>
        <div className={`mt-2 ${card} px-4 py-1 sm:px-5`}>
          {memo.winners.length === 0 ? (
            <p className="py-4 text-sm text-zinc-500">
              No ad cleared the benchmark by enough to call a winner this period.
            </p>
          ) : (
            <AdTable rows={memo.winners} tone="win" />
          )}
        </div>
      </section>

      {/* ---- Losers ---- */}
      <section className="animate-rise mt-7" style={stagger(3)}>
        <SectionLabel>Losers / kill list</SectionLabel>
        <div className={`mt-2 ${card} p-4 sm:p-5`}>
          <p className="text-sm leading-relaxed text-zinc-200">
            {memo.losers.killInstruction}
          </p>
          {memo.losers.rows.length > 0 && (
            <div className="mt-2">
              <AdTable rows={memo.losers.rows} tone="loss" />
            </div>
          )}
          <p className="mt-3 border-t border-white/5 pt-3 text-xs leading-relaxed text-zinc-500">
            {memo.losers.setAsideNote}
          </p>
        </div>
      </section>

      {/* ---- Patterns ---- */}
      <section className="animate-rise mt-7" style={stagger(4)}>
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

      {/* ---- Next tests: an actionable run-list ---- */}
      <section className="animate-rise mt-7" style={stagger(5)}>
        <div className="flex items-baseline justify-between gap-3">
          <SectionLabel>Next tests — run list</SectionLabel>
          <span className="print-hidden font-mono text-[11px] tabular-nums text-zinc-500">
            {queuedCount}/{memo.nextTests.length} queued
          </span>
        </div>
        <ol className="mt-2 space-y-3">
          {memo.nextTests.map((test, i) => (
            <TestRow
              key={i}
              test={test}
              index={i}
              checked={queued[i]}
              onToggle={() =>
                setQueued((prev) => prev.map((q, j) => (j === i ? !q : q)))
              }
            />
          ))}
        </ol>
      </section>

      {/* ---- Confidence ---- */}
      <section className="animate-rise mt-7" style={stagger(6)}>
        <SectionLabel>Confidence &amp; missing data</SectionLabel>
        <div className={`mt-2 ${card} p-4 sm:p-5`}>
          <span className={`${CONFIDENCE_CHIP[memo.confidence.level]} font-mono`}>
            {memo.confidence.level.toUpperCase()} CONFIDENCE
          </span>
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
        </div>
      </section>

      <p className="print-hidden mt-8 flex items-center justify-center gap-2 text-center text-xs text-zinc-600">
        <FlaskIcon className="h-3.5 w-3.5" />
        Deterministic scoring — every number above comes from your CSV, not a model.
      </p>
    </article>
  );
}
