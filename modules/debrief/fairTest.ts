/**
 * Batch D2 — "Give a fair test".
 *
 * Meta's "Push delivery to this ad" (and the older duplicate-into-a-test
 * pattern) exists because a new ad can lose the auction's early spend
 * before it ever gets a fair read. Among the ads set aside for low spend,
 * this picks up to 3 whose EARLY signals beat the account median — link
 * CTR, 3-second hook rate, CPC (lower is better), adds to cart per 1,000
 * impressions — on at least 2 signals and ≥ 1,000 impressions. It is a
 * hypothesis from early signals, never a result: decision-blind (never
 * read by the gate, median, ranking or decision), buyer-facing copy only.
 * Ads already on the Burning spend list are excluded — the report can't
 * say "pause" and "push" about the same ad.
 */
import type { GatedAd } from "./types";

export const FAIR_TEST_MIN_IMPRESSIONS = 1000;
export const FAIR_TEST_MIN_SIGNALS = 2;
export const FAIR_TEST_MAX_ADS = 3;

export type FairTestSignalKey = "ctr" | "hookRate" | "cpc" | "atcRate";

export interface FairTestSignal {
  key: FairTestSignalKey;
  value: number;
  median: number;
  /** Relative improvement over the median (positive = better). */
  lift: number;
}

export interface FairTestPick {
  name: string;
  spend: number;
  impressions: number;
  /** Only the signals that beat the median, strongest first. */
  signals: FairTestSignal[];
}

const SIGNALS: { key: FairTestSignalKey; higherIsBetter: boolean; of: (a: GatedAd) => number | null }[] = [
  { key: "ctr", higherIsBetter: true, of: (a) => (a.linkClicks != null && a.impressions ? (a.linkClicks / a.impressions) * 100 : null) },
  { key: "hookRate", higherIsBetter: true, of: (a) => (a.videoPlays3s != null && a.impressions ? (a.videoPlays3s / a.impressions) * 100 : null) },
  { key: "cpc", higherIsBetter: false, of: (a) => (a.linkClicks ? a.spend / a.linkClicks : null) },
  { key: "atcRate", higherIsBetter: true, of: (a) => (a.addToCart != null && a.impressions ? (a.addToCart / a.impressions) * 1000 : null) },
];

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const enoughImpressions = (a: GatedAd) => (a.impressions ?? 0) >= FAIR_TEST_MIN_IMPRESSIONS;

/** Up to 3 low-spend set-aside ads with ≥ 2 early signals above the
 *  account median, or [] (no candidates / no signal columns). */
export function detectFairTest(gated: readonly GatedAd[], exclude: ReadonlySet<string>): FairTestPick[] {
  const pool = gated.filter(enoughImpressions);
  const medians = new Map(
    SIGNALS.map((s) => [s.key, median(pool.map(s.of).filter((v): v is number => v != null && Number.isFinite(v)))] as const)
  );
  const candidates = gated.filter(
    (a) => (a.gate === "below_spend_gate" || a.gate === "zero_outcome_thin") && enoughImpressions(a) && !exclude.has(a.name)
  );
  const picks = candidates
    .map((a): FairTestPick => {
      const signals = SIGNALS.flatMap((s): FairTestSignal[] => {
        const value = s.of(a);
        const med = medians.get(s.key);
        if (value == null || !Number.isFinite(value) || med == null || !(med > 0)) return [];
        if (!s.higherIsBetter && !(value > 0)) return [];
        const lift = s.higherIsBetter ? value / med - 1 : med / value - 1;
        return lift > 0 ? [{ key: s.key, value, median: med, lift }] : [];
      }).sort((x, y) => y.lift - x.lift);
      return { name: a.name, spend: a.spend, impressions: a.impressions as number, signals };
    })
    .filter((p) => p.signals.length >= FAIR_TEST_MIN_SIGNALS);
  const meanLift = (p: FairTestPick) => p.signals.reduce((s, x) => s + x.lift, 0) / p.signals.length;
  return picks
    .sort((x, y) => y.signals.length - x.signals.length || meanLift(y) - meanLift(x) || x.name.localeCompare(y.name))
    .slice(0, FAIR_TEST_MAX_ADS);
}
