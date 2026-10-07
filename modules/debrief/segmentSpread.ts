/**
 * Mixed Segment Warning — a dedicated, decision-blind module (same
 * isolation pattern as creativeGroups.ts / briefReadiness.ts): flags an
 * export that mixes ad sets (or campaigns) performing at very different
 * levels, where ranking every ad against ONE account-wide median may
 * compare unlike products. Practitioners raised this in a real-account
 * test and an interview.
 *
 * Display-only by construction: it re-reads the already-ranked judged
 * ads and returns a fact for ONE limits line. It never touches the spend
 * gate, the median, ranking, the committed action or evidenceState —
 * decision.ts reads its result only inside buildLimits' copy.
 */
import type { KpiKey, RankedAd } from "./types";

/** A group needs at least this many judged ads (with a KPI value) for its
 *  own median to mean anything — one ad is an anecdote, not a level. */
export const MIN_ADS_PER_SEGMENT = 2;

/** Flag when the best segment's typical KPI is at least this many times
 *  the worst's (polarity-aware: for CPA/CPC the worst is the HIGHEST
 *  cost). 1.5× is a deliberately blunt, disclosed Debrief default — a
 *  prompt to check the mix, not a statistical test of heterogeneity. */
export const SEGMENT_SPREAD_MULTIPLE = 1.5;

/** The KPIs this warning applies to: ratio KPIs only (ROAS, CPA — incl.
 *  lead-based CPA / cost per lead — CTR, CPC), where segments can sit at
 *  genuinely different efficiency levels. Count KPIs (Purchases, Leads)
 *  are excluded: a gap between ad sets there mostly reflects how much
 *  each one spent, not how well it performs. */
export const SEGMENT_SPREAD_KPIS: readonly KpiKey[] = ["roas", "cpa", "ctr", "cpc"];

export interface SegmentSpread {
  dimension: "ad set" | "campaign";
  /** Qualifying segments (≥ MIN_ADS_PER_SEGMENT judged ads each). */
  segments: number;
  /** Lowest and highest segment median, in KPI units. */
  low: number;
  high: number;
  /** high ÷ low — how far apart the extremes are. */
  ratio: number;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Ratio KPIs only (SEGMENT_SPREAD_KPIS) — null for Purchases/Leads.
 * Groups JUDGED ads that have a KPI value by ad set (campaign when the
 * export has no ad set column), takes each qualifying group's median,
 * and returns the spread when it reaches SEGMENT_SPREAD_MULTIPLE —
 * otherwise null. Ads with a blank segment cell are left out of every
 * group (never guessed). A non-positive segment median makes "× apart"
 * meaningless, so no flag is raised then.
 */
export function detectSegmentSpread(
  ranked: readonly RankedAd[],
  kpi: KpiKey,
  has: { adSet: boolean; campaign: boolean }
): SegmentSpread | null {
  if (!SEGMENT_SPREAD_KPIS.includes(kpi)) return null;
  const dimension = has.adSet ? "ad set" : has.campaign ? "campaign" : null;
  if (!dimension) return null;
  const groups = new Map<string, number[]>();
  for (const ad of ranked) {
    if (ad.kpiValue == null) continue;
    const raw = dimension === "ad set" ? ad.adSetName : ad.campaignName;
    const key = raw?.trim().replace(/\s+/g, " ").toLowerCase();
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), ad.kpiValue]);
  }
  const medians = [...groups.values()]
    .filter((v) => v.length >= MIN_ADS_PER_SEGMENT)
    .map(median);
  if (medians.length < 2) return null;
  const low = Math.min(...medians);
  const high = Math.max(...medians);
  if (!(low > 0)) return null;
  // Polarity: for higher-is-better KPIs best/worst = high/low; for
  // lower-is-better (CPA/CPC) worst/best = high/low. Either way the
  // "best is ≥ N× the worst" test is high/low ≥ N.
  const ratio = high / low;
  if (ratio < SEGMENT_SPREAD_MULTIPLE) return null;
  return { dimension, segments: medians.length, low, high, ratio };
}
