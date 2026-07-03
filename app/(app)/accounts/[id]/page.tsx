"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MetricCard,
  StateWrapper,
  fmtAgo,
  fmtMoney,
  fmtNumber,
} from "@/components/ui/data";
import { analyzeAccount } from "@/components/ui/insights";
import { StatusChip } from "@/components/ui/kit";
import { RefreshIcon, SparklesIcon } from "@/components/ui/icons";
import {
  btnPrimarySm,
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

interface SeriesPoint {
  date: string;
  spend: number;
  conversions: number;
}

interface DateRange {
  since: string;
  until: string;
}

interface InsightsResponse {
  ok: boolean;
  error?: string;
  message?: string;
  period: { preset: Period; current: DateRange; previous: DateRange };
  kpis: Kpis;
  deltas: Record<string, number | null>;
  series: SeriesPoint[];
  campaigns: ({ id: string; name: string | null } & Kpis)[];
}

interface AccountMeta {
  externalId: string;
  name: string;
  currency: string;
  timezone: string;
  status: "active" | "disabled" | "unknown";
}

/* Dates arrive as YYYY-MM-DD in the account's timezone — render without
   constructing a Date (avoids UTC off-by-one). */
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function fmtDay(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return m >= 1 && m <= 12 ? `${MONTHS[m - 1]} ${d}` : iso;
}

function fmtRange(range: DateRange): string {
  return `${fmtDay(range.since)} – ${fmtDay(range.until)}`;
}

/* ------------------------------------------------------------------ */
/* Daily spend chart with pointer + keyboard inspection. Hovering (or   */
/* arrow keys after focusing) pins a day: guide line, dot, and a        */
/* tooltip with the exact spend/conversions.                            */
/* ------------------------------------------------------------------ */

function SpendChart({
  series,
  currency,
}: {
  series: SeriesPoint[];
  currency: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (series.length < 2) return null;
    const max = Math.max(...series.map((p) => p.spend), 1);
    const step = 100 / (series.length - 1);
    const points = series.map((p, i) => ({
      x: i * step,
      y: 36 - (p.spend / max) * 32,
    }));
    const line = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(" ");
    return { points, line, area: `${line} L100,36 L0,36 Z` };
  }, [series]);

  if (!geometry) return null;

  const last = geometry.points[geometry.points.length - 1];
  const active = hover != null ? geometry.points[hover] : null;
  const activeDay = hover != null ? series[hover] : null;
  const activePct = hover != null ? (hover / (series.length - 1)) * 100 : 0;

  const moveHover = (delta: number) =>
    setHover((prev) => {
      const base = prev ?? series.length - 1;
      return Math.min(series.length - 1, Math.max(0, base + delta));
    });

  return (
    <div
      role="application"
      tabIndex={0}
      aria-label={`Daily spend chart, ${series.length} days. Use arrow keys to inspect days.`}
      className="relative mt-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const fraction = (e.clientX - rect.left) / rect.width;
        setHover(
          Math.min(
            series.length - 1,
            Math.max(0, Math.round(fraction * (series.length - 1)))
          )
        );
      }}
      onPointerLeave={() => setHover(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          moveHover(-1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          moveHover(1);
        } else if (e.key === "Escape") {
          setHover(null);
        }
      }}
      onBlur={() => setHover(null)}
    >
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="h-28 w-full sm:h-32"
        aria-hidden="true"
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
        <path d={geometry.area} fill="url(#spark-fill)" stroke="none" />
        <path
          d={geometry.line}
          fill="none"
          stroke="url(#spark)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        {active && (
          <line
            x1={active.x}
            y1="0"
            x2={active.x}
            y2="36"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/* Dots are HTML overlays — inside the stretched SVG viewBox they
          would render as ellipses (preserveAspectRatio="none"). */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-950 ${
          active ? "bg-sky-400" : "bg-blue-500"
        }`}
        style={{
          left: `${(active ?? last).x}%`,
          top: `${((active ?? last).y / 40) * 100}%`,
        }}
      />

      {activeDay && (
        <div
          className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full"
          style={{ left: `clamp(3.5rem, ${activePct}%, calc(100% - 3.5rem))` }}
          role="status"
        >
          <div className="whitespace-nowrap rounded-lg border border-white/10 bg-zinc-900/95 px-3 py-2 text-xs shadow-xl shadow-black/40 backdrop-blur">
            <p className="font-semibold text-zinc-200">
              {fmtDay(activeDay.date)}
            </p>
            <p className="mt-0.5 tabular-nums text-zinc-400">
              Spend{" "}
              <span className="font-semibold text-zinc-100">
                {fmtMoney(activeDay.spend, currency)}
              </span>
            </p>
            <p className="tabular-nums text-zinc-400">
              Conv{" "}
              <span className="font-semibold text-zinc-100">
                {fmtNumber(activeDay.conversions)}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountId = decodeURIComponent(params.id);
  const period = (searchParams.get("period") as Period) || "last_7d";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [accounts, setAccounts] = useState<AccountMeta[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "spend",
    dir: "desc",
  });

  const load = useCallback(
    async (force = false) => {
      setLoading(true);
      setError(null);
      setErrorCode(null);
      try {
        const res = await fetch(
          `/api/insights?accountId=${encodeURIComponent(accountId)}&period=${period}`,
          force ? { cache: "no-store" } : undefined
        );
        const body: InsightsResponse = await res.json();
        if (!body.ok) {
          setErrorCode(body.error ?? null);
          setError(
            body.error === "not_connected" || body.error === "auth_expired"
              ? "Your Meta connection expired."
              : body.error === "rate_limited"
                ? "Meta is rate-limiting this account. Try again in a minute."
                : body.message || "Failed to load insights."
          );
          return;
        }
        setData(body);
        setUpdatedAt(Date.now());
      } catch {
        setError("Network error. Retry.");
      } finally {
        setLoading(false);
      }
    },
    [accountId, period]
  );

  useEffect(() => {
    void load();
  }, [load]);

  /* The full account list powers the client switcher and provides
     name/currency context — purely additive; the page renders fine
     before (or without) this resolving. */
  useEffect(() => {
    let cancelled = false;
    fetch("/api/accounts")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled || !body?.ok || !Array.isArray(body.accounts)) return;
        setAccounts(body.accounts as AccountMeta[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const account = accounts.find((a) => a.externalId === accountId) ?? null;
  const currency = account?.currency ?? "USD";

  const analysis = useMemo(
    () =>
      data
        ? analyzeAccount({
            kpis: data.kpis,
            deltas: data.deltas,
            campaigns: data.campaigns,
            currency,
          })
        : null,
    [data, currency]
  );

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

  const authExpired =
    errorCode === "not_connected" || errorCode === "auth_expired";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link href="/home" className={`${textLink} text-xs`}>
              ← All accounts
            </Link>
            {/* Client switcher: agencies hop between accounts constantly —
                one control beats a round-trip through Overview. */}
            {accounts.length > 1 && (
              <select
                value={accountId}
                onChange={(e) =>
                  router.push(
                    `/accounts/${encodeURIComponent(e.target.value)}?period=${period}`
                  )
                }
                aria-label="Switch to another ad account"
                className="h-7 max-w-44 cursor-pointer truncate rounded-lg border border-white/10 bg-zinc-900/60 px-2 text-xs font-medium text-zinc-300 transition hover:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
              >
                {accounts.map((a) => (
                  <option key={a.externalId} value={a.externalId}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}
          </div>
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

        <div className="flex w-full items-center gap-2 sm:w-auto">
          {/* Scrolls horizontally on narrow phones instead of wrapping */}
          <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto sm:flex-none">
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
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            aria-label="Refresh data"
            title="Refresh data"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-zinc-900/60 text-zinc-400 transition hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 disabled:cursor-default disabled:opacity-50"
          >
            <RefreshIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="mt-6">
        <StateWrapper
          loading={loading}
          error={error}
          onRetry={() => load(true)}
          errorAction={
            authExpired ? (
              <a href="/api/meta/oauth/start" className={btnPrimarySm}>
                Reconnect Meta
              </a>
            ) : undefined
          }
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
              <div className={`${skeletonPanel} h-40`} />
              <div className={`${skeletonPanel} h-64`} />
            </div>
          }
        >
          {data && (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className={eyebrow}>Performance</p>
                <p className="text-[11px] tabular-nums text-zinc-500">
                  {fmtRange(data.period.current)} · vs{" "}
                  {fmtRange(data.period.previous)}
                  {updatedAt && (
                    <span className="ml-2 text-zinc-600">
                      Updated {fmtAgo(updatedAt)}
                    </span>
                  )}
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

              {/* Interpretation before inspection: the research finding is
                  that reading numbers is easy — knowing what they mean is
                  the work. Every sentence is computed from the figures on
                  this screen, and labelled as such. */}
              {analysis && (
                <div className={`mt-4 ${card} p-4 sm:p-5`}>
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-300">
                      <SparklesIcon className="h-3.5 w-3.5" />
                      What changed
                    </p>
                    <p className="text-[11px] text-zinc-600">
                      Computed from the period comparison — not a black box
                    </p>
                  </div>
                  <p className="mt-2.5 text-[15px] font-medium leading-relaxed text-zinc-100">
                    {analysis.headline}
                  </p>
                  {analysis.points.length > 0 && (
                    <ul className="mt-2.5 space-y-1.5">
                      {analysis.points.map((point) => (
                        <li
                          key={point}
                          className="flex items-start gap-2.5 text-[13px] leading-relaxed text-zinc-400"
                        >
                          <span
                            className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-blue-400"
                            aria-hidden="true"
                          />
                          {point}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 border-t border-white/5 pt-2.5 text-[11px] text-zinc-600">
                    Client-ready written summaries ship with the Reports
                    module (M4).
                  </p>
                </div>
              )}

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
                  <SpendChart series={data.series} currency={currency} />
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
                      {/* Account-level totals — the honest number, not a sum
                          of the (possibly truncated) campaign rows. */}
                      <tfoot>
                        <tr className="border-t border-white/10 bg-white/[0.02] font-semibold">
                          <td className="px-4 py-2.5 text-zinc-300">
                            Account total
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-zinc-100">
                            {fmtMoney(data.kpis.spend, currency)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-zinc-100">
                            {fmtNumber(data.kpis.conversions)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-zinc-100">
                            {fmtMoney(data.kpis.cpa, currency)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-zinc-100">
                            {data.kpis.roas
                              ? `${data.kpis.roas.toFixed(2)}x`
                              : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-zinc-100">
                            {data.kpis.ctr.toFixed(2)}%
                          </td>
                        </tr>
                      </tfoot>
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
