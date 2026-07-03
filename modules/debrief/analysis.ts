import { ColumnMap } from "./columns";
import {
  AnalysisResult,
  DebriefContext,
  GateReason,
  GatedAd,
  HIGHER_IS_BETTER,
  KpiKey,
  ParsedAd,
  RankedAd,
} from "./types";

/** Absolute minimum spend to trust an ad's numbers when no target CPA
 *  is given. Configurable — change this constant if your floor differs. */
export const DEFAULT_SPEND_FLOOR = 10;

const MAX_WINNERS_LOSERS = 5;
const MIN_ADS_FOR_NAME_SIGNAL = 4;
const NAME_SIGNAL_SHARE = 0.5;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function computeSpendGate(
  ads: ParsedAd[],
  targetCpa: number | null
): { gate: number; basis: "target_cpa" | "floor_or_mean" } {
  if (targetCpa != null && targetCpa > 0) {
    return { gate: targetCpa * 3, basis: "target_cpa" };
  }
  const meanSpend =
    ads.length > 0 ? ads.reduce((sum, a) => sum + a.spend, 0) / ads.length : 0;
  return {
    gate: Math.max(DEFAULT_SPEND_FLOOR, meanSpend * 0.5),
    basis: "floor_or_mean",
  };
}

function gateAds(ads: ParsedAd[], spendGate: number): GatedAd[] {
  return ads.map((ad) => {
    let gate: GateReason;
    if (ad.spend < spendGate) gate = "below_spend_gate";
    else if (ad.kpiValue == null) gate = "no_kpi_value";
    else gate = "judged";
    return { ...ad, gate };
  });
}

function rankJudged(judged: GatedAd[], kpi: KpiKey, benchmark: number): RankedAd[] {
  const higherBetter = HIGHER_IS_BETTER[kpi];
  return judged.map((ad) => {
    const value = ad.kpiValue as number; // judged ads always have a value
    const delta = higherBetter ? value - benchmark : benchmark - value;
    const deltaPct = benchmark !== 0 ? (delta / Math.abs(benchmark)) * 100 : null;
    return { ...ad, deltaFromMedian: delta, deltaPct };
  });
}

/** True when a keyword tag shared by winners (or losers) covers at
 *  least half the group and the group is large enough to say anything —
 *  a soft "tentative" signal, never presented as confirmed. */
function hasNameSignal(winners: RankedAd[], losers: RankedAd[]): boolean {
  const check = (group: RankedAd[]) => {
    if (group.length < 2) return false;
    const counts = new Map<string, number>();
    for (const ad of group) {
      for (const tag of ad.nameTags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    for (const count of counts.values()) {
      if (count / group.length >= NAME_SIGNAL_SHARE) return true;
    }
    return false;
  };
  return (
    winners.length + losers.length >= MIN_ADS_FOR_NAME_SIGNAL &&
    (check(winners) || check(losers))
  );
}

function extractDateRange(
  rawRows: Record<string, string>[],
  columns: ColumnMap
): { start: string; end: string } | null {
  if (!columns.reportingStarts || !columns.reportingEnds) return null;
  const starts = rawRows
    .map((r) => r[columns.reportingStarts!])
    .filter((v) => v && v.trim() !== "")
    .sort();
  const ends = rawRows
    .map((r) => r[columns.reportingEnds!])
    .filter((v) => v && v.trim() !== "")
    .sort();
  if (starts.length === 0 || ends.length === 0) return null;
  return { start: starts[0], end: ends[ends.length - 1] };
}

export function analyze(
  ads: ParsedAd[],
  rawRows: Record<string, string>[],
  columns: ColumnMap,
  context: DebriefContext
): AnalysisResult {
  const { kpi, targetCpa } = context;
  const { gate: spendGate, basis: spendGateBasis } = computeSpendGate(
    ads,
    targetCpa
  );
  const gated = gateAds(ads, spendGate);
  const judged = gated.filter((a) => a.gate === "judged");
  const benchmark = median(judged.map((a) => a.kpiValue as number));

  const ranked = benchmark != null ? rankJudged(judged, kpi, benchmark) : [];
  const winnerPool = ranked
    .filter((a) => a.deltaFromMedian > 0)
    .sort((a, b) => b.deltaFromMedian - a.deltaFromMedian);
  const loserPool = ranked
    .filter((a) => a.deltaFromMedian < 0)
    .sort((a, b) => a.deltaFromMedian - b.deltaFromMedian);

  const winners = winnerPool.slice(0, MAX_WINNERS_LOSERS);
  const losers = loserPool.slice(0, MAX_WINNERS_LOSERS);

  const missingColumns: string[] = [];
  if (!columns.adName) missingColumns.push("Ad name");
  if (!columns.reportingStarts || !columns.reportingEnds) {
    missingColumns.push("Reporting date range");
  }

  return {
    kpi,
    adsAnalyzed: ads.length,
    adsJudged: judged.length,
    adsSetAside: ads.length - judged.length,
    totalSpend: ads.reduce((sum, a) => sum + a.spend, 0),
    currency: columns.currency,
    dateRange: extractDateRange(rawRows, columns),
    spendGate,
    spendGateBasis,
    median: benchmark,
    winners,
    losers,
    belowBenchmarkSpend: loserPool.reduce((sum, a) => sum + a.spend, 0),
    belowBenchmarkCount: loserPool.length,
    hasNameSignal: hasNameSignal(winnerPool, loserPool),
    hasCreativeNotes: context.creativeNotes.trim().length > 0,
    missingColumns,
  };
}
