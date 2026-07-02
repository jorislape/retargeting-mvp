import { DateRange, InsightRow } from "../connectors/types";

export type PeriodPreset = "last_7d" | "last_14d" | "last_30d" | "this_month";

/** Aggregate KPIs for a period; derived metrics recomputed from totals. */
export interface KpiSummary {
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

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

/**
 * Resolve a preset into { current, previous } ranges of equal length,
 * ending yesterday (today's data is partial and misleading in comparisons).
 */
export function resolvePeriod(preset: PeriodPreset): {
  current: DateRange;
  previous: DateRange;
} {
  const yesterday = daysAgo(1);

  if (preset === "this_month") {
    const start = new Date(
      Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), 1)
    );
    const elapsed =
      Math.floor((yesterday.getTime() - start.getTime()) / 86_400_000) + 1;
    const prevEnd = new Date(start.getTime() - 86_400_000);
    const prevStart = new Date(prevEnd.getTime() - (elapsed - 1) * 86_400_000);
    return {
      current: { since: toIso(start), until: toIso(yesterday) },
      previous: { since: toIso(prevStart), until: toIso(prevEnd) },
    };
  }

  const days = preset === "last_7d" ? 7 : preset === "last_14d" ? 14 : 30;
  return {
    current: { since: toIso(daysAgo(days)), until: toIso(yesterday) },
    previous: {
      since: toIso(daysAgo(days * 2)),
      until: toIso(daysAgo(days + 1)),
    },
  };
}

export function summarize(rows: InsightRow[]): KpiSummary {
  const t = rows.reduce(
    (acc, row) => {
      acc.spend += row.metrics.spend;
      acc.impressions += row.metrics.impressions;
      acc.clicks += row.metrics.clicks;
      acc.conversions += row.metrics.conversions;
      acc.revenue += row.metrics.revenue;
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 }
  );

  return {
    ...t,
    ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0,
    cpm: t.impressions > 0 ? (t.spend / t.impressions) * 1000 : 0,
    cpc: t.clicks > 0 ? t.spend / t.clicks : 0,
    cpa: t.conversions > 0 ? t.spend / t.conversions : null,
    roas: t.spend > 0 && t.revenue > 0 ? t.revenue / t.spend : null,
  };
}

/** Percentage change; null when the baseline is zero/absent. */
export function pctChange(
  current: number | null,
  previous: number | null
): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
