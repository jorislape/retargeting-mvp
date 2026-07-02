"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MetricCard,
  StateWrapper,
  fmtMoney,
  fmtNumber,
} from "@/components/ui/data";
import { StatusChip } from "@/components/ui/kit";
import {
  btnSecondary,
  card,
  eyebrow,
  skeletonPanel,
  skeletonTile,
  tableHead,
  tableRow,
  tableWrap,
  textLink,
} from "@/components/ui/theme";

type Period = "last_7d" | "last_14d" | "last_30d" | "this_month";

const PERIOD_LABELS: Record<Period, string> = {
  last_7d: "Last 7 days",
  last_14d: "Last 14 days",
  last_30d: "Last 30 days",
  this_month: "This month",
};

interface Kpis {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpm: number;
  cpc: number;
  cpa: number | null;
  roas: number | null;
}

interface InsightsResponse {
  ok: boolean;
  error?: string;
  message?: string;
  kpis: Kpis;
  deltas: Record<string, number | null>;
  series: { date: string; spend: number; conversions: number }[];
  campaigns: ({ id: string; name: string | null } & Kpis)[];
}

interface AccountMeta {
  externalId: string;
  name: string;
  currency: string;
  timezone: string;
  status: "active" | "disabled" | "unknown";
}

function SpendSparkline({
  series,
}: {
  series: { date: string; spend: number }[];
}) {
  const paths = useMemo(() => {
    if (series.length < 2) return null;
    const max = Math.max(...series.map((p) => p.spend), 1);
    const w = 100 / (series.length - 1);
    const points = series.map((p, i) => ({
      x: i * w,
      y: 36 - (p.spend / max) * 32,
    }));
    const line = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(" ");
    return { line, area: `${line} L100,36 L0,36 Z`, last: points[points.length - 1] };
  }, [series]);

  if (!paths) return null;

  return (
    <svg
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      className="h-24 w-full"
      role="img"
      aria-label="Daily spend trend"
    >
      <defs>
        {/* sky-400 → blue-500, echoing the landing's hero gradient */}
        <linearGradient id="spark" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#38bdf8" stopOpacity="0.15" />
          <stop offset="1" stopColor="#38bdf8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={paths.area} fill="url(#spark-fill)" stroke="none" />
      <path
        d={paths.line}
        fill="none"
        stroke="url(#spark)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      {/* End dot marks "yesterday" — the freshest complete day */}
      <circle
        cx={paths.last.x}
        cy={paths.last.y}
        r="2"
        fill="#3b82f6"
        stroke="#09090b"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* Dates arrive as YYYY-MM-DD in the account's timezone — render without
   constructing a Date (avoids UTC off-by-one). */
function fmtDay(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return m >= 1 && m <= 12 ? `${MONTHS[m - 1]} ${d}` : iso;
}

type SortKey = "spend" | "conversions" | "cpa" | "roas" | "ctr";

const CAMPAIGN_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "spend", label: "Spend" },
  { key: "conversions", label: "Conv." },
  { key: "cpa", label: "CPA" },
  { key: "roas", label: "ROAS" },
  { key: "ctr", label: "CTR" },
];

export default function AccountPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const accountId = decodeURIComponent(params.id);
  const period = (searchParams.get("period") as Period) || "last_7d";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [account, setAccount] = useState<AccountMeta | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "spend",
    dir: "desc",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/insights?accountId=${encodeURIComponent(accountId)}&period=${period}`
      );
      const body: InsightsResponse = await res.json();
      if (!body.ok) {
        setError(
          body.error === "not_connected" || body.error === "auth_expired"
            ? "Your Meta connection expired. Reconnect from Settings."
            : body.error === "rate_limited"
              ? "Meta is rate-limiting this account. Try again in a minute."
              : body.message || "Failed to load insights."
        );
        return;
      }
      setData(body);
    } catch {
      setError("Network error. Retry.");
    } finally {
      setLoading(false);
    }
  }, [accountId, period]);

  useEffect(() => {
    void load();
  }, [load]);

  /* Account name/currency come from the existing accounts endpoint —
     purely additive context; the page renders fine before (or without)
     this resolving. */
  useEffect(() => {
    let cancelled = false;
    fetch("/api/accounts")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled || !body?.ok) return;
        const match = (body.accounts as AccountMeta[]).find(
          (a) => a.externalId === accountId
        );
        if (match) setAccount(match);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const currency = account?.currency ?? "USD";

  const campaigns = useMemo(() => {
    if (!data) return [];
    const dirMul = sort.dir === "desc" ? -1 : 1;
    return [...data.campaigns].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // nulls always sink to the bottom
      if (bv == null) return -1;
      return (av - bv) * dirMul;
    });
  }, [data, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" }
    );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-4">
        <div className="min-w-0">
          <Link href="/home" className={`${textLink} text-xs`}>
            ← All accounts
          </Link>
          <div className="mt-1 flex items-center gap-2.5">
            <h1 className="truncate text-xl font-bold tracking-tight text-white">
              {account?.name ?? "Account performance"}
            </h1>
            {account && <StatusChip status={account.status} />}
          </div>
          <p className="mt-0.5 font-mono text-xs text-zinc-500">
            {accountId}
            {account && (
              <span className="font-sans">
                {" "}
                · {account.currency} · {account.timezone}
              </span>
            )}
          </p>
        </div>

        {/* Scrolls horizontally on narrow phones instead of wrapping */}
        <div className="no-scrollbar w-full overflow-x-auto sm:w-auto">
          <div className="flex w-max gap-1 rounded-lg border border-white/10 bg-zinc-900/60 p-1">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <Link
                key={p}
                href={`?period=${p}`}
                aria-current={p === period ? "true" : undefined}
                className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium ${
                  p === period
                    ? "bg-blue-500/10 text-white"
                    : "text-zinc-400 transition hover:text-white"
                }`}
              >
                {PERIOD_LABELS[p]}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <StateWrapper
          loading={loading}
          error={error}
          onRetry={load}
          empty={!!data && data.kpis.spend === 0 && data.campaigns.length === 0}
          emptyTitle="No activity in this period."
          emptyAction={
            period !== "last_30d" ? (
              <Link href="?period=last_30d" className={btnSecondary}>
                View last 30 days
              </Link>
            ) : undefined
          }
          skeleton={
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={skeletonTile} />
                ))}
              </div>
              <div className={`${skeletonPanel} h-32`} />
              <div className={`${skeletonPanel} h-64`} />
            </div>
          }
        >
          {data && (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <p className={eyebrow}>Performance</p>
                <p className="text-[11px] text-zinc-500">
                  {PERIOD_LABELS[period]} · vs previous period
                </p>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <MetricCard
                  label="Spend"
                  value={fmtMoney(data.kpis.spend, currency)}
                  delta={data.deltas.spend}
                />
                <MetricCard
                  label="Conversions"
                  value={fmtNumber(data.kpis.conversions)}
                  delta={data.deltas.conversions}
                />
                <MetricCard
                  label="CPA"
                  value={fmtMoney(data.kpis.cpa, currency)}
                  delta={data.deltas.cpa}
                  invertDelta
                />
                <MetricCard
                  label="ROAS"
                  value={data.kpis.roas ? `${data.kpis.roas.toFixed(2)}x` : "—"}
                  delta={data.deltas.roas}
                />
                <MetricCard
                  label="CTR"
                  value={`${data.kpis.ctr.toFixed(2)}%`}
                  delta={data.deltas.ctr}
                />
                <MetricCard
                  label="CPM"
                  value={fmtMoney(data.kpis.cpm, currency)}
                  delta={data.deltas.cpm}
                  invertDelta
                />
              </div>

              {data.series.length > 1 && (
                <div className={`mt-4 ${card} p-4`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className={eyebrow}>
                      Daily spend ·{" "}
                      <span className="normal-case tracking-normal text-zinc-300">
                        {fmtMoney(data.kpis.spend, currency)}
                      </span>
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {PERIOD_LABELS[period]}
                    </p>
                  </div>
                  <SpendSparkline series={data.series} />
                  <div className="mt-1 flex justify-between text-[11px] tabular-nums text-zinc-500">
                    <span>{fmtDay(data.series[0].date)}</span>
                    <span>{fmtDay(data.series[data.series.length - 1].date)}</span>
                  </div>
                </div>
              )}

              <div className="mt-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className={eyebrow}>Campaigns</p>
                  <p className="text-[11px] text-zinc-500">
                    {campaigns.length} with activity
                  </p>
                </div>

                {/* Outer shell keeps the rounded frame; the inner div owns
                    horizontal scroll so the table is reachable on phones. */}
                <div className={`mt-2.5 ${tableWrap}`}>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead>
                        <tr className={tableHead}>
                          <th className="px-4 py-2.5 font-semibold">Campaign</th>
                          {CAMPAIGN_COLUMNS.map((col) => {
                            const active = sort.key === col.key;
                            return (
                              <th
                                key={col.key}
                                aria-sort={
                                  active
                                    ? sort.dir === "desc"
                                      ? "descending"
                                      : "ascending"
                                    : undefined
                                }
                                className="px-2 py-1"
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleSort(col.key)}
                                  className={`ml-auto flex w-full cursor-pointer items-center justify-end gap-1 rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${
                                    active ? "text-zinc-200" : "text-zinc-500"
                                  }`}
                                >
                                  {col.label}
                                  <span
                                    aria-hidden="true"
                                    className={active ? "text-blue-400" : "invisible"}
                                  >
                                    {active && sort.dir === "asc" ? "↑" : "↓"}
                                  </span>
                                </button>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {campaigns.map((c) => (
                          <tr key={c.id} className={tableRow}>
                            <td className="max-w-xs truncate px-4 py-2.5 font-medium text-zinc-200">
                              {c.name || c.id}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-zinc-300">
                              {fmtMoney(c.spend, currency)}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-zinc-300">
                              {fmtNumber(c.conversions)}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-zinc-300">
                              {fmtMoney(c.cpa, currency)}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-zinc-300">
                              {c.roas ? `${c.roas.toFixed(2)}x` : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums text-zinc-300">
                              {c.ctr.toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </StateWrapper>
      </div>
    </div>
  );
}
