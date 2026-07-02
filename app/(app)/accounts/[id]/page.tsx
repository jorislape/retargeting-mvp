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
      <path
        d={path}
        fill="none"
        stroke="rgb(56 189 248)"
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
          <Link href="/home" className="text-xs text-zinc-500 hover:text-zinc-300">
            ← All accounts
          </Link>
          <h1 className="mt-1 text-lg font-bold tracking-tight">
            Account performance
          </h1>
          <p className="mt-0.5 font-mono text-xs text-zinc-500">{accountId}</p>
        </div>

        <div className="flex gap-1 rounded-lg border border-white/5 bg-white/[0.02] p-1">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <Link
              key={p}
              href={`?period=${p}`}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                p === period
                  ? "bg-white/10 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
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
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />
                ))}
              </div>
              <div className="h-32 animate-pulse rounded-xl bg-white/5" />
              <div className="h-64 animate-pulse rounded-xl bg-white/5" />
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
                <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Daily spend
                  </p>
                  <SpendSparkline series={data.series} />
                </div>
              )}

              <div className="mt-4 overflow-hidden rounded-xl border border-white/5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02] text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
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
                      <tr
                        key={c.id}
                        className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                      >
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
