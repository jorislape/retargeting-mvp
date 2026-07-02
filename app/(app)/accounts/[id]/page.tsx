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
import {
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

function SpendSparkline({
  series,
}: {
  series: { date: string; spend: number }[];
}) {
  const path = useMemo(() => {
    if (series.length < 2) return null;
    const max = Math.max(...series.map((p) => p.spend), 1);
    const w = 100 / (series.length - 1);
    return series
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${(i * w).toFixed(2)},${(
            36 -
            (p.spend / max) * 32
          ).toFixed(2)}`
      )
      .join(" ");
  }, [series]);

  if (!path) return null;

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
      </defs>
      <path
        d={path}
        fill="none"
        stroke="url(#spark)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function AccountPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const accountId = decodeURIComponent(params.id);
  const period = (searchParams.get("period") as Period) || "last_7d";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<InsightsResponse | null>(null);

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

  const currency = "USD"; // interim: read from account once client entities land

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/home" className={`${textLink} text-xs`}>
            ← All accounts
          </Link>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-white">
            Account performance
          </h1>
          <p className="mt-0.5 font-mono text-xs text-zinc-500">{accountId}</p>
        </div>

        <div className="flex gap-1 rounded-lg border border-white/10 bg-zinc-900/60 p-1">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <Link
              key={p}
              href={`?period=${p}`}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
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

      <div className="mt-6">
        <StateWrapper
          loading={loading}
          error={error}
          onRetry={load}
          empty={!!data && data.kpis.spend === 0 && data.campaigns.length === 0}
          emptyTitle="No activity in this period. Try a longer date range."
          skeleton={
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
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
                  <p className={eyebrow}>Daily spend</p>
                  <SpendSparkline series={data.series} />
                </div>
              )}

              <div className={`mt-4 ${tableWrap}`}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className={tableHead}>
                      <th className="px-4 py-2.5">Campaign</th>
                      <th className="px-4 py-2.5 text-right">Spend</th>
                      <th className="px-4 py-2.5 text-right">Conv.</th>
                      <th className="px-4 py-2.5 text-right">CPA</th>
                      <th className="px-4 py-2.5 text-right">ROAS</th>
                      <th className="px-4 py-2.5 text-right">CTR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.campaigns.map((c) => (
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
            </>
          )}
        </StateWrapper>
      </div>
    </div>
  );
}
