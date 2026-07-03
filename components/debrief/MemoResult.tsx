"use client";

import { useState } from "react";
import { Memo, MemoWinnerLoserRow } from "@/modules/debrief";
import {
  CheckIcon,
  CopyIcon,
  FlaskIcon,
  RefreshIcon,
  SparklesIcon,
} from "@/components/ui/icons";
import { btnPrimarySm, btnSecondaryMd, card, chipEmerald, chipRed, eyebrow } from "@/components/ui/theme";
import { memoToText } from "./memoToText";

const CONFIDENCE_STYLE: Record<Memo["confidence"]["level"], string> = {
  high: chipEmerald,
  medium: "inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300",
  low: chipRed,
};

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5">
      <p className={eyebrow}>{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function AdRow({ ad, rank, tone }: { ad: MemoWinnerLoserRow; rank: number; tone: "win" | "loss" }) {
  return (
    <div className="flex items-start gap-3 border-t border-white/5 py-3.5 first:border-t-0">
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          tone === "win"
            ? "bg-emerald-500/15 text-emerald-300"
            : "bg-red-500/15 text-red-300"
        }`}
      >
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="truncate text-sm font-semibold text-zinc-100">{ad.name}</p>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-sm font-semibold tabular-nums text-zinc-100">
              {ad.valueLabel}
            </span>
            <span className={tone === "win" ? chipEmerald : chipRed}>{ad.vsMedianLabel}</span>
          </div>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          <span className="tabular-nums text-zinc-400">{ad.spendLabel} spend</span>
          {" — "}
          {ad.reason}
        </p>
      </div>
    </div>
  );
}

export function MemoResult({ memo, onReset }: { memo: Memo; onReset: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(memoToText(memo));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (permissions, insecure context) —
      // fail quietly rather than throwing an error the user can't act on.
    }
  };

  return (
    <section className="mx-auto max-w-2xl px-5 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={eyebrow}>Debrief</p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-white">
            {memo.scope.product}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCopy} className={`cursor-pointer ${btnSecondaryMd}`}>
            {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
            {copied ? "Copied" : "Copy memo"}
          </button>
          <button onClick={onReset} className={`cursor-pointer ${btnPrimarySm}`}>
            <RefreshIcon className="h-4 w-4" />
            Start over
          </button>
        </div>
      </div>

      {/* Scope */}
      <div className={`mt-5 ${card} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className={eyebrow}>{memo.scope.kpiLabel} · Scope</p>
          {memo.scope.dateRangeLabel && (
            <p className="text-[11px] text-zinc-500">{memo.scope.dateRangeLabel}</p>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <StatTile label="Ads analyzed" value={String(memo.scope.adsAnalyzed)} />
          <StatTile label="Ads judged" value={String(memo.scope.adsJudged)} />
          <StatTile label="Set aside" value={String(memo.scope.adsSetAside)} />
          <StatTile label="Total spend" value={memo.scope.totalSpendLabel} />
          <StatTile label={`Median ${memo.scope.kpiLabel}`} value={memo.scope.medianLabel} />
        </div>
      </div>

      {/* The Call */}
      <div className={`mt-4 ${card} p-4 sm:p-5`}>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-300">
          <SparklesIcon className="h-3.5 w-3.5" />
          The call
        </p>
        <div className="mt-2.5 space-y-2">
          {memo.tldr.map((line, i) => (
            <p key={i} className="text-[15px] font-medium leading-relaxed text-zinc-100">
              {line}
            </p>
          ))}
        </div>
      </div>

      {/* Winners */}
      <div className="mt-6">
        <p className={eyebrow}>Winners</p>
        <div className={`mt-2 ${card} divide-y-0 px-4 sm:px-5`}>
          {memo.winners.length === 0 ? (
            <p className="py-4 text-sm text-zinc-500">
              No ad cleared the benchmark by enough to call a winner this period.
            </p>
          ) : (
            memo.winners.map((ad, i) => (
              <AdRow key={ad.name + i} ad={ad} rank={i + 1} tone="win" />
            ))
          )}
        </div>
      </div>

      {/* Losers */}
      <div className="mt-6">
        <p className={eyebrow}>Losers / kill list</p>
        <div className={`mt-2 ${card} p-4 sm:p-5`}>
          <p className="text-sm leading-relaxed text-zinc-300">{memo.losers.killInstruction}</p>
          <div className="mt-1">
            {memo.losers.rows.map((ad, i) => (
              <AdRow key={ad.name + i} ad={ad} rank={i + 1} tone="loss" />
            ))}
          </div>
          <p className="mt-3 border-t border-white/5 pt-3 text-xs text-zinc-500">
            {memo.losers.setAsideNote}
          </p>
        </div>
      </div>

      {/* Patterns */}
      <div className="mt-6">
        <p className={eyebrow}>Patterns</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className={`${card} p-4 sm:p-5`}>
            <p className="text-xs font-semibold text-zinc-300">What winners share</p>
            <ul className="mt-2 space-y-1.5">
              {memo.patterns.winners.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-zinc-400">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className={`${card} p-4 sm:p-5`}>
            <p className="text-xs font-semibold text-zinc-300">What losers share</p>
            <ul className="mt-2 space-y-1.5">
              {memo.patterns.losers.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-zinc-400">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-red-400" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Next tests */}
      <div className="mt-6">
        <p className={eyebrow}>Next 3 tests</p>
        <ol className="mt-2 space-y-3">
          {memo.nextTests.map((test, i) => (
            <li key={i} className={`${card} p-4 sm:p-5`}>
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-blue-400/30 bg-blue-500/10 text-blue-300">
                  <FlaskIcon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{test.test}</p>
                  <dl className="mt-2 space-y-1.5 text-[13px] leading-relaxed">
                    <div>
                      <dt className="inline font-semibold text-zinc-400">Why: </dt>
                      <dd className="inline text-zinc-400">{test.why}</dd>
                    </div>
                    <div>
                      <dt className="inline font-semibold text-zinc-400">Setup: </dt>
                      <dd className="inline text-zinc-400">{test.setup}</dd>
                    </div>
                    <div>
                      <dt className="inline font-semibold text-zinc-400">Winning looks like: </dt>
                      <dd className="inline text-zinc-400">{test.winningLooksLike}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Confidence */}
      <div className="mt-6">
        <p className={eyebrow}>Confidence &amp; missing data</p>
        <div className={`mt-2 ${card} p-4 sm:p-5`}>
          <span className={CONFIDENCE_STYLE[memo.confidence.level]}>
            {memo.confidence.level.toUpperCase()} CONFIDENCE
          </span>
          <ul className="mt-3 space-y-1.5">
            {memo.confidence.notes.map((note, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-zinc-400">
                <span className={`mt-[7px] h-1 w-1 shrink-0 rounded-full ${
                  memo.confidence.level === "high" ? "bg-emerald-400" : memo.confidence.level === "medium" ? "bg-amber-400" : "bg-zinc-500"
                }`} />
                {note}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-zinc-600">
        Nothing from this session is stored. Refreshing or leaving this page
        clears it for good.
      </p>
    </section>
  );
}
