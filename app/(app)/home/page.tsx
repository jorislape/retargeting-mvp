"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DeltaChip,
  StateWrapper,
  fmtAgo,
  fmtMoney,
  fmtNumber,
} from "@/components/ui/data";
import { findAttention } from "@/components/ui/insights";
import { EmptyState, PageHeader, StatusChip } from "@/components/ui/kit";
import {
  ArrowIcon,
  CheckIcon,
  RefreshIcon,
  SearchIcon,
} from "@/components/ui/icons";
import {
  btnPrimary,
  btnSecondary,
  card,
  cardCompact,
  cardHover,
  eyebrow,
  skeletonTile,
} from "@/components/ui/theme";

interface Account {
  externalId: string;
  name: string;
  currency: string;
  timezone: string;
  status: "active" | "disabled" | "unknown";
}

interface AccountPerformance {
  account: Account;
  kpis: {
    spend: number;
    conversions: number;
    cpa: number | null;
    spendDelta: number | null;
  } | null;
  spendSeries: number[];
  error: string | null;
}

interface PortfolioTotals {
  currency: string;
  accounts: number;
  spend: number;
  conversions: number;
  spendDelta: number | null;
}

interface SummaryResponse {
  ok: boolean;
  error?: string;
  accounts: AccountPerformance[];
  totals: PortfolioTotals[];
}

/* Search only earns its row once scanning the grid stops being instant. */
const SEARCH_THRESHOLD = 6;

/* Tiny trend line for account cards — solid stroke, no gradient defs,
   so any number of instances can coexist without SVG id collisions. */
function MiniSpark({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const step = 100 / (points.length - 1);
  const d = points
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)},${(
          28 -
          (v / max) * 24
        ).toFixed(2)}`
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      className="h-8 w-full"
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke="#3b82f6"
        strokeOpacity="0.7"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [query, setQuery] = useState("");

  /* Performance data loads independently of the account list, so cards
     appear fast and fill in — a failed summary degrades, never blocks. */
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const loadAccounts = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        "/api/accounts",
        force ? { cache: "no-store" } : undefined
      );
      if (res.status === 401) {
        setConnected(false);
        setAccounts([]);
        return;
      }
      const data = await res.json();
      if (!data.ok) {
        setError(data.message || "Failed to load ad accounts.");
        return;
      }
      setConnected(true);
      setAccounts(data.accounts);
    } catch {
      setError("Network error. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async (force = false) => {
    setSummaryLoading(true);
    setSummaryFailed(false);
    try {
      const res = await fetch(
        "/api/insights/summary?period=last_7d",
        force ? { cache: "no-store" } : undefined
      );
      const data: SummaryResponse = await res.json();
      if (!data.ok || !Array.isArray(data.accounts)) {
        setSummaryFailed(true);
        return;
      }
      setSummary(data);
      setUpdatedAt(Date.now());
    } catch {
      setSummaryFailed(true);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
    void loadSummary();
  }, [loadAccounts, loadSummary]);

  const refresh = useCallback(() => {
    void loadAccounts(true);
    void loadSummary(true);
  }, [loadAccounts, loadSummary]);

  const perfById = useMemo(() => {
    const map = new Map<string, AccountPerformance>();
    (summary?.accounts ?? []).forEach((p) => map.set(p.account.externalId, p));
    return map;
  }, [summary]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? accounts.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.externalId.toLowerCase().includes(q)
        )
      : [...accounts];
    // Highest-spend clients first once performance data is in.
    if (perfById.size > 0) {
      list.sort(
        (a, b) =>
          (perfById.get(b.externalId)?.kpis?.spend ?? -1) -
          (perfById.get(a.externalId)?.kpis?.spend ?? -1)
      );
    }
    return list;
  }, [accounts, query, perfById]);

  const primaryTotals = summary?.totals[0];
  const otherCurrencies = (summary?.totals.length ?? 0) - 1;

  /* Triage first: which clients need a look before anything else. */
  const attention = useMemo(
    () => (summary ? findAttention(summary.accounts) : []),
    [summary]
  );

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle={
          !loading && connected && accounts.length > 0
            ? `${accounts.length} connected ad account${accounts.length === 1 ? "" : "s"} · last 7 days`
            : "All connected ad accounts at a glance."
        }
        action={
          connected && accounts.length > 0 ? (
            <div className="flex items-center gap-3">
              {updatedAt && (
                <span className="text-[11px] text-zinc-500">
                  Updated {fmtAgo(updatedAt)}
                </span>
              )}
              <button
                type="button"
                onClick={refresh}
                disabled={loading || summaryLoading}
                className={`${btnSecondary} disabled:cursor-default disabled:opacity-50`}
              >
                <RefreshIcon
                  className={`h-3.5 w-3.5 ${summaryLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="mt-6">
        <StateWrapper
          loading={loading}
          error={error}
          onRetry={() => loadAccounts()}
          empty={connected && accounts.length === 0}
          emptyTitle="No ad accounts found on this Meta login."
          skeleton={
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`${skeletonTile} h-32`} />
              ))}
            </div>
          }
        >
          {!connected ? (
            /* Onboarding: sets expectations for the whole flow, not just
               the next click — and answers the safety question before
               it's asked. */
            <div className={`${card} mx-auto max-w-2xl p-6 sm:p-8`}>
              <h2 className="text-lg font-bold tracking-tight text-white">
                Connect Meta to see every client in one place
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                One read-only connection brings in every ad account you
                manage. About two minutes, start to first insight.
              </p>

              <ol className="mt-6 space-y-4">
                {[
                  {
                    title: "Connect with Meta",
                    text: "Read-only OAuth — no password shared, nothing can be edited.",
                  },
                  {
                    title: "Your accounts appear automatically",
                    text: "Every ad account your login can access, with live spend and trends.",
                  },
                  {
                    title: "Open any account",
                    text: "KPIs with honest comparisons, what changed and why, and a campaign breakdown.",
                  },
                ].map((step, i) => (
                  <li key={step.title} className="flex items-start gap-3.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-blue-400/30 bg-blue-500/10 text-xs font-bold text-blue-300">
                      {i + 1}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-sm font-semibold text-zinc-100">
                        {step.title}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-zinc-500">
                        {step.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <a href="/api/meta/oauth/start" className={btnPrimary}>
                  Connect Meta
                </a>
                <p className="text-xs text-zinc-500">
                  Read-only (ads_read) · no credit card · revoke anytime
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Portfolio strip — totals are per-currency; show the
                  largest book and flag the rest instead of mixing. */}
              {primaryTotals && (
                <div className="mb-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className={eyebrow}>
                      Portfolio · {primaryTotals.currency}
                      {otherCurrencies > 0 && (
                        <span className="ml-1.5 normal-case tracking-normal text-zinc-600">
                          +{otherCurrencies} other{" "}
                          {otherCurrencies === 1 ? "currency" : "currencies"}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Last 7 days · vs previous 7
                    </p>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-3">
                    <div className={`${cardCompact} p-4`}>
                      <p className={eyebrow}>Spend</p>
                      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
                        <p className="text-xl font-bold tabular-nums text-zinc-50">
                          {fmtMoney(primaryTotals.spend, primaryTotals.currency)}
                        </p>
                        <DeltaChip value={primaryTotals.spendDelta} />
                      </div>
                    </div>
                    <div className={`${cardCompact} p-4`}>
                      <p className={eyebrow}>Conversions</p>
                      <p className="mt-1.5 text-xl font-bold tabular-nums text-zinc-50">
                        {fmtNumber(primaryTotals.conversions)}
                      </p>
                    </div>
                    <div className={`${cardCompact} p-4`}>
                      <p className={eyebrow}>Accounts</p>
                      <p className="mt-1.5 text-xl font-bold tabular-nums text-zinc-50">
                        {primaryTotals.accounts}
                        <span className="ml-1 text-sm font-medium text-zinc-500">
                          active
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Triage strip — interpretation, not another metric grid.
                  Quietly confirms "all steady" when there's nothing to do,
                  so silence is information rather than doubt. */}
              {summary && attention.length > 0 && (
                <div className="mb-5">
                  <p className={eyebrow}>Needs attention</p>
                  <div className={`mt-2.5 ${card} divide-y divide-white/5`}>
                    {attention.map((item) => (
                      <Link
                        key={`${item.accountId}-${item.text}`}
                        href={`/accounts/${encodeURIComponent(item.accountId)}`}
                        className="group flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]"
                      >
                        <span
                          aria-hidden="true"
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            item.severity === "warn"
                              ? "bg-amber-400"
                              : "bg-sky-400"
                          }`}
                        />
                        <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-300">
                          <span className="font-semibold text-zinc-100">
                            {item.accountName}
                          </span>{" "}
                          — {item.text}
                        </span>
                        <ArrowIcon className="h-3.5 w-3.5 shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-zinc-300" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {summary && attention.length === 0 && (
                <p className="mb-5 flex items-center gap-2 text-[13px] text-zinc-500">
                  <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                  All accounts steady vs the previous week — nothing needs
                  attention.
                </p>
              )}

              {summaryFailed && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-4 py-3">
                  <p className="text-[13px] text-amber-200/90">
                    Performance data couldn&apos;t load — account list is
                    still current.
                  </p>
                  <button
                    type="button"
                    onClick={() => loadSummary(true)}
                    className={btnSecondary}
                  >
                    Retry
                  </button>
                </div>
              )}

              {accounts.length >= SEARCH_THRESHOLD && (
                <div className="relative mb-4 max-w-sm">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search accounts…"
                    aria-label="Search ad accounts by name or ID"
                    className="h-10 w-full rounded-xl border border-white/10 bg-zinc-900/60 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-400/40 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
                  />
                </div>
              )}

              {filtered.length === 0 ? (
                <EmptyState
                  title={`No accounts match “${query.trim()}”.`}
                  description="Search matches account names and IDs."
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {filtered.map((account) => {
                    const perf = perfById.get(account.externalId);
                    return (
                      <Link
                        key={account.externalId}
                        href={`/accounts/${encodeURIComponent(account.externalId)}`}
                        className={`group ${cardCompact} ${cardHover} p-4`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              aria-hidden="true"
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-400/20 bg-gradient-to-br from-blue-500/25 to-blue-600/5 text-sm font-bold text-blue-200"
                            >
                              {(account.name || "?").charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-zinc-100">
                                {account.name}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {account.currency} · {account.timezone}
                              </p>
                            </div>
                          </div>
                          <StatusChip status={account.status} />
                        </div>

                        {/* Performance block: skeleton → data or a quiet
                            per-account failure note */}
                        <div className="mt-3 border-t border-white/5 pt-3">
                          {summaryLoading && !perf ? (
                            <div className="flex animate-pulse items-end justify-between gap-3">
                              <div className="space-y-2">
                                <div className="h-3 w-16 rounded bg-white/10" />
                                <div className="h-5 w-24 rounded bg-white/10" />
                              </div>
                              <div className="h-8 w-24 rounded bg-white/5" />
                            </div>
                          ) : perf?.kpis ? (
                            <div className="flex items-end justify-between gap-4">
                              <div className="min-w-0">
                                <p className={eyebrow}>Spend · 7d</p>
                                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
                                  <span className="text-lg font-bold tabular-nums text-zinc-50">
                                    {fmtMoney(perf.kpis.spend, account.currency)}
                                  </span>
                                  <DeltaChip value={perf.kpis.spendDelta} />
                                </div>
                                <p className="mt-1 text-xs tabular-nums text-zinc-500">
                                  {fmtNumber(perf.kpis.conversions)} conv ·{" "}
                                  CPA {fmtMoney(perf.kpis.cpa, account.currency)}
                                </p>
                              </div>
                              <div className="w-24 shrink-0 sm:w-28">
                                <MiniSpark points={perf.spendSeries} />
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-500">
                              {perf?.error === "rate_limited"
                                ? "Rate-limited by Meta — refresh in a minute."
                                : "Performance data unavailable."}
                            </p>
                          )}
                        </div>

                        <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-zinc-400 transition group-hover:text-white">
                          View performance
                          <ArrowIcon className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </StateWrapper>
      </div>
    </div>
  );
}
