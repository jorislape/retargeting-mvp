"use client";

import { ReactNode } from "react";
import { EmptyState } from "./kit";
import { btnSecondary, cardCompact, eyebrow, skeletonPanel } from "./theme";

/* ------------------------------------------------------------------ */
/* StateWrapper: every data surface renders loading / error / empty /  */
/* ready through this. No screen ships without all four states.        */
/* ------------------------------------------------------------------ */

interface StateWrapperProps {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyTitle: string;
  emptyAction?: ReactNode;
  onRetry?: () => void;
  skeleton?: ReactNode;
  children: ReactNode;
}

export function StateWrapper({
  loading,
  error,
  empty,
  emptyTitle,
  emptyAction,
  onRetry,
  skeleton,
  children,
}: StateWrapperProps) {
  if (loading) {
    return (
      <div aria-busy="true">
        {skeleton ?? (
          <div className="space-y-3">
            <div className={`${skeletonPanel} h-24`} />
            <div className={`${skeletonPanel} h-24`} />
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-6"
      >
        <p className="text-sm font-semibold text-red-200">
          Couldn&apos;t load this data
        </p>
        <p className="mt-1 text-sm text-red-300/90">{error}</p>
        {onRetry && (
          <button onClick={onRetry} className={`mt-4 ${btnSecondary}`}>
            Retry
          </button>
        )}
      </div>
    );
  }

  if (empty) {
    return <EmptyState title={emptyTitle} action={emptyAction} />;
  }

  return <>{children}</>;
}

/* ------------------------------------------------------------------ */
/* DeltaChip: period-over-period change. `invert` for cost metrics      */
/* where a decrease is good (CPA, CPM, CPC).                            */
/* ------------------------------------------------------------------ */

export function DeltaChip({
  value,
  invert = false,
}: {
  value: number | null;
  invert?: boolean;
}) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="text-xs text-zinc-600">—</span>;
  }
  const good = invert ? value < 0 : value > 0;
  const neutral = Math.abs(value) < 0.05;
  const color = neutral
    ? "text-zinc-500"
    : good
      ? "text-emerald-400"
      : "text-red-400";
  const arrow = neutral ? "→" : value > 0 ? "▲" : "▼";

  return (
    <span className={`text-xs font-semibold tabular-nums ${color}`}>
      {arrow} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* MetricCard                                                           */
/* ------------------------------------------------------------------ */

export function MetricCard({
  label,
  value,
  delta,
  invertDelta = false,
}: {
  label: string;
  value: string;
  delta?: number | null;
  invertDelta?: boolean;
}) {
  return (
    <div className={`${cardCompact} p-4`}>
      <p className={eyebrow}>{label}</p>
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <p className="truncate text-xl font-bold tabular-nums text-zinc-50">
          {value}
        </p>
        {delta !== undefined && (
          <DeltaChip value={delta} invert={invertDelta} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                   */
/* ------------------------------------------------------------------ */

export function fmtMoney(value: number | null, currency: string): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

export function fmtNumber(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}
