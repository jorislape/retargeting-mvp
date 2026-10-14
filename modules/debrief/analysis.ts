import { ColumnMap, attributionFieldsFor, attributionSplitHeaders, clickBasisFor, hookMetricColumns, kpiColumnSourcesFor, requiredColumnsFor } from "./columns";
import { kpiUsability, preferredUsableKpi } from "./kpiUsability";
import { detectSegmentSpread } from "./segmentSpread";
import { detectLowIntent } from "./intentFlags";
import { computeAccountKpi } from "./accountKpi";
import { fmtKpiValue } from "./format";
import { extractAds } from "./extract";
import {
  AnalysisResult,
  DebriefContext,
  GateReason,
  GatedAd,
  HIGHER_IS_BETTER,
  KpiGaps,
  KpiKey,
  ParsedAd,
  RankedAd,
  outcomeNounsFor,
} from "./types";

/** Absolute minimum spend to trust an ad's numbers when no target CPA
 *  is given. Configurable — change this constant if your floor differs. */
export const DEFAULT_SPEND_FLOOR = 10;

/** Tester Feedback follow-up: a zero-conversion CPA ad is judged (as the
 *  worst) only once its spend makes "0 conversions" meaningful — at least
 *  this multiple of max(the median CPA of the ads that DO have a CPA,
 *  the target CPA when set). At 2× the typical cost of one conversion,
 *  an ad with none has missed by a clear margin; below that, 0 can be
 *  ordinary noise, so the ad stays set aside ("not enough spend yet to
 *  call it"). A disclosed Debrief default, not a statistical test. */
export const ZERO_CONVERSION_SPEND_MULTIPLE = 2;

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
  targetCpa: number | null,
  spendGateOverride: number | null
): { gate: number; basis: "target_cpa" | "floor_or_mean" | "user_gate" } {
  /* Decision Criteria V2: the user's own evidence bar wins over both
     default rules — practitioners' thresholds vary by context, and a
     stated criterion beats a universal default. Provenance is carried
     via the basis and surfaced in the decision's appliedCriteria. */
  if (spendGateOverride != null && spendGateOverride > 0) {
    return { gate: spendGateOverride, basis: "user_gate" };
  }
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
    /* Tester Feedback Fix 2: a CPA ad with a real 0 conversion count
       that cleared the spend gate is judged (as the worst), not set
       aside — spending past the gate with nothing to show IS a result. */
    else if (ad.kpiValue == null && !ad.zeroConversions) gate = "no_kpi_value";
    else gate = "judged";
    return { ...ad, gate };
  });
}

function rankJudged(judged: GatedAd[], kpi: KpiKey, benchmark: number): RankedAd[] {
  const higherBetter = HIGHER_IS_BETTER[kpi];
  return judged.map((ad) => {
    /* Tester Feedback Fix 2: a zero-conversion CPA ad has no value to
       compare. It ranks below every real loser via the most-negative
       finite delta (finite on purpose — never Infinity, which JSON
       turns into null and arithmetic turns into NaN); deltaPct stays
       null so no surface invents a percentage for it. */
    if (ad.zeroConversions) return { ...ad, deltaFromMedian: -Number.MAX_VALUE, deltaPct: null };
    const value = ad.kpiValue as number; // every other judged ad has a value
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
  /* CPA Leads Label: extract.ts tags every ad when all CPA values are
     lead-based; the analysis carries that as cpaBasis for wording. */
  const cpaBasis: "leads" | undefined =
    kpi === "cpa" && ads.some((a) => a.kpiValue != null) &&
    ads.every((a) => a.kpiValue == null || a.cpaBasis === "lead")
      ? "leads"
      : undefined;
  const kpiSources = kpiColumnSourcesFor(kpi, columns, cpaBasis);
  const hookColumns = hookMetricColumns(columns);
  /* Attribution & Intent 1: the attribution-split columns relevant to
     this KPI (disclosure; Item 2 decides what ranks on them). */
  const attributionColumns = attributionSplitHeaders(columns, attributionFieldsFor(kpi, cpaBasis));
  const { gate: spendGate, basis: spendGateBasis } = computeSpendGate(
    ads,
    targetCpa,
    context.spendGateOverride
  );
  /* First-Run Robustness 2: the user's own outcome minimum, applied
     right after the spend gate and BEFORE the median — a set-aside ad
     never shapes the benchmark. Outcome KPIs only; an ad whose count
     isn't in the export is never treated as zero (judged, disclosed).
     Zero-conversion CPA ads keep their own spend-based rule. */
  const floorNouns = outcomeNounsFor({ kpi, cpaBasis });
  const floorMin =
    context.minJudgeOutcomes != null && context.minJudgeOutcomes > 0 && floorNouns
      ? Math.floor(context.minJudgeOutcomes)
      : null;
  let floorUnverifiable = 0;
  const firstPass: GatedAd[] = gateAds(ads, spendGate).map((a) => {
    if (floorMin == null || a.gate !== "judged" || a.zeroConversions) return a;
    if (a.conversions == null) {
      floorUnverifiable += 1;
      return a;
    }
    return a.conversions < floorMin ? { ...a, gate: "below_outcome_floor" } : a;
  });
  /* Zero-conversion CPA ads never enter the median (Tester Feedback
     Fix 2) — it's computed from the ads that have a value. */
  const benchmark = median(
    firstPass
      .filter((a) => a.gate === "judged" && a.kpiValue != null)
      .map((a) => a.kpiValue as number)
  );
  /* Follow-up guard: past the spend gate, a zero-conversion ad is judged
     only at ≥ ZERO_CONVERSION_SPEND_MULTIPLE × max(median CPA, target
     CPA); below that it's set aside. No median and no target → there is
     nothing to measure "0" against, so it's set aside too. */
  const zeroBarBase = Math.max(benchmark ?? 0, targetCpa != null && targetCpa > 0 ? targetCpa : 0);
  const zeroBar = zeroBarBase > 0 ? ZERO_CONVERSION_SPEND_MULTIPLE * zeroBarBase : null;
  const gated: GatedAd[] = firstPass.map((a) =>
    a.gate === "judged" && a.zeroConversions && !(zeroBar != null && a.spend >= zeroBar)
      ? { ...a, gate: "zero_outcome_thin" }
      : a
  );
  const zeroThin = gated.filter((a) => a.gate === "zero_outcome_thin");
  const floorAside = gated.filter((a) => a.gate === "below_outcome_floor");
  const judged = gated.filter((a) => a.gate === "judged");
  const kpiGaps = computeKpiGaps(gated, kpi, rawRows, columns);

  const ranked = benchmark != null ? rankJudged(judged, kpi, benchmark) : [];
  const winnerPool = ranked
    .filter((a) => a.deltaFromMedian > 0)
    .sort((a, b) => b.deltaFromMedian - a.deltaFromMedian);
  const loserPool = ranked
    .filter((a) => a.deltaFromMedian < 0)
    /* Zero-conversion ads share one sentinel delta; among them, more
       spend wasted ranks worse. Every other comparison is unchanged. */
    .sort((a, b) =>
      a.zeroConversions && b.zeroConversions
        ? b.spend - a.spend
        : a.deltaFromMedian - b.deltaFromMedian
    );
  /* Spend Allocation V1: the third bucket rankedAds' own doc comment
     already names ("winners ∪ losers ∪ ads exactly at the median") but
     never aggregates. Same classification the winner/loser pools
     already use — no new decision logic, just the mirrored sum. */
  const atPool = ranked.filter((a) => a.deltaFromMedian === 0);

  /* Attribution & Intent 4 — display-only, from the ranked ads. */
  const lowIntent = detectLowIntent(ranked);

  /* Mixed Segment Warning — computed AFTER ranking from the ranked ads,
     and only ever attached as a fact for one limits line. */
  const spread = detectSegmentSpread(ranked, kpi, {
    adSet: columns.adSetName != null,
    campaign: columns.campaignName != null,
  });

  /* Trust Pass: the FULL pools. The decision and the kill-list copy
     always counted every below-median ad ("…and 4 more"), but the lists
     were cut to 5, so a 6th ad was mentioned and shown nowhere. The
     report caps only the DISPLAY now (customization.topAdsShown, with
     "+N more … Show all" and full TXT/PDF listing). */
  const winners = winnerPool;
  const losers = loserPool;

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
    judgedSpend: judged.reduce((sum, a) => sum + a.spend, 0),
    currency: columns.currency,
    dateRange: extractDateRange(rawRows, columns),
    spendGate,
    spendGateBasis,
    median: benchmark,
    winners,
    losers,
    rankedAds: ranked,
    belowBenchmarkSpend: loserPool.reduce((sum, a) => sum + a.spend, 0),
    belowBenchmarkCount: loserPool.length,
    aboveBenchmarkSpend: winnerPool.reduce((sum, a) => sum + a.spend, 0),
    aboveBenchmarkCount: winnerPool.length,
    atBenchmarkSpend: atPool.reduce((sum, a) => sum + a.spend, 0),
    atBenchmarkCount: atPool.length,
    hasNameSignal: hasNameSignal(winnerPool, loserPool),
    hasCreativeNotes: context.creativeNotes.trim().length > 0,
    missingColumns,
    /* Duplicate Identity fix: distinct raw names that extract.ts found
       on multiple rows (their ads carry sourceName). Drives the limits
       disclosure; never affects gating, ranking, or the decision. */
    duplicateAdNames: [
      ...new Set(ads.filter((a) => a.sourceName != null).map((a) => a.sourceName as string)),
    ],
    /* KPI Source Column Disclosure: only attached when non-empty, so a
       standard export's AnalysisResult is unchanged key-for-key. */
    ...(kpiSources.length > 0 ? { kpiColumnSources: kpiSources } : {}),
    ...(kpiGaps ? { kpiGaps } : {}),
    ...(floorMin != null && floorNouns
      ? {
          outcomeFloor: {
            min: floorMin,
            nouns: floorNouns,
            setAside: floorAside.map((a) => ({ name: a.name, count: a.conversions as number })),
            unverifiable: floorUnverifiable,
          },
        }
      : {}),
    ...(zeroThin.length > 0
      ? {
          zeroOutcomeThin: {
            ads: zeroThin.map((z) => ({ name: z.name, spend: z.spend })),
            needs: zeroBar,
          },
        }
      : {}),
    ...(cpaBasis ? { cpaBasis } : {}),
    /* Tester Feedback Fix 3: wording only; absent when none present. */
    ...(hookColumns.length > 0 ? { hookMetricColumns: hookColumns } : {}),
    ...(attributionColumns.length > 0 ? { attributionColumns } : {}),
    ...(lowIntent ? { lowIntent } : {}),
    /* Attribution & Intent 2: ranked on click-only (absent ⇒ blended). */
    ...((): { attributionBasis?: NonNullable<AnalysisResult["attributionBasis"]> } => {
      const click = clickBasisFor(kpi, columns);
      return click ? { attributionBasis: { windowLabel: click.windowLabel, headers: click.headers } } : {};
    })(),
    /* Trust Pass 4: proxy/count KPI — which outcome KPIs the export
       could compute instead (ROAS preferred); First-Run Robustness 3a:
       plus where each judged ad sits on that outcome KPI, so no next
       test is built on an ad that's below median on results. */
    ...(kpi === "ctr" || kpi === "cpc" || kpi === "purchases" || kpi === "leads"
      ? { proxyKpi: buildProxyKpi(kpi, columns, rawRows, ranked) }
      : {}),
    /* Trust Pass 2: the blended account result (display-only). */
    ...((): { accountKpi?: NonNullable<AnalysisResult["accountKpi"]> } => {
      const acct = computeAccountKpi(ads, kpi);
      return acct ? { accountKpi: acct } : {};
    })(),
    ...(spread
      ? {
          mixedSegments: {
            dimension: spread.dimension,
            segments: spread.segments,
            lowLabel: fmtKpiValue(spread.low, kpi, columns.currency),
            highLabel: fmtKpiValue(spread.high, kpi, columns.currency),
            ratio: spread.ratio,
          },
        }
      : {}),
    /* Tester Feedback Fix 5: wording only; absent unless CPA w/o target. */
    ...(kpi === "cpa" && !(targetCpa != null && targetCpa > 0)
      ? { cpaWithoutTarget: { roasAvailable: requiredColumnsFor("roas", columns).length === 0 } }
      : {}),
  };
}

/** Trust Pass 4 + First-Run Robustness 3a — the outcome KPIs a proxy/
 *  count run could use instead, and (for the preferred one) where each
 *  judged ad sits against its own median. Read only by the next-test
 *  builder and decision copy — never the gate, median or ranking. */
function buildProxyKpi(
  kpi: KpiKey,
  columns: ColumnMap,
  rawRows: Record<string, string>[],
  ranked: RankedAd[]
): NonNullable<AnalysisResult["proxyKpi"]> {
  const outcomeKpis: NonNullable<AnalysisResult["proxyKpi"]>["outcomeKpis"] = [
    ...(requiredColumnsFor("roas", columns).length === 0
      ? [{ kpi: "roas" as const, label: "ROAS", clientLabel: "return on ad spend" }]
      : []),
    ...(requiredColumnsFor("cpa", columns).length === 0
      ? [
          columns.costPerPurchase || columns.purchases
            ? { kpi: "cpa" as const, label: "CPA", clientLabel: "cost per purchase" }
            : { kpi: "cpa" as const, label: "CPA (cost per lead)", clientLabel: "cost per lead" },
        ]
      : []),
  ];
  const pref = outcomeKpis[0];
  if (!pref || ranked.length === 0) return { outcomeKpis };
  // Same rows, same extraction ⇒ same (disambiguated) names, same order.
  const byName = new Map(extractAds(rawRows, columns, pref.kpi).map((a) => [a.name, a]));
  const values = ranked.map((r) => {
    const o = byName.get(r.name);
    // A zero-purchase ad has no CPA but is unambiguously the worst result.
    return { name: r.name, value: o?.kpiValue ?? null, zero: o?.zeroConversions === true };
  });
  const known = values.filter((v) => v.value != null).map((v) => v.value as number);
  const med = median(known);
  if (med == null) return { outcomeKpis };
  const higher = HIGHER_IS_BETTER[pref.kpi];
  const better = (v: number) => (higher ? v > med : v < med);
  const worse = (v: number) => (higher ? v < med : v > med);
  const belowMedian = values.filter((v) => v.zero || (v.value != null && worse(v.value))).map((v) => v.name);
  const aboveMedian = values.filter((v) => v.value != null && better(v.value)).map((v) => v.name);
  const best = values
    .filter((v) => v.value != null)
    .sort((a, b) => (higher ? (b.value as number) - (a.value as number) : (a.value as number) - (b.value as number)))[0];
  return {
    outcomeKpis,
    outcome: {
      kpi: pref.kpi,
      label: pref.label,
      medianLabel: fmtKpiValue(med, pref.kpi, columns.currency),
      leader: best ? { name: best.name, valueLabel: fmtKpiValue(best.value as number, pref.kpi, columns.currency) } : null,
      belowMedian,
      aboveMedian,
    },
  };
}

/** First-Run Fixes: see KpiGaps in types.ts. Returns null unless an ad
 *  cleared the spend gate yet has no KPI value. Reads only facts the
 *  gate already established — never re-gates or re-ranks. */
function computeKpiGaps(
  gated: { gate: string; kpiValue: number | null; conversions?: number | null; zeroConversions?: true }[],
  kpi: KpiKey,
  rawRows: Record<string, string>[],
  columns: ColumnMap
): KpiGaps | null {
  const setAsideNoValue = gated.filter((a) => a.gate === "no_kpi_value").length;
  if (setAsideNoValue === 0) return null;
  /* Tester Feedback Fix 2: zero-conversion CPA ads are a result, not a
     missing value — judged above the gate, "too little spend" below it.
     So for CPA, zeroOutcome no longer counts them (no set-aside copy
     claims "CPA couldn't be computed" for an ad the memo judged). */
  const noValueAds = gated.filter((a) => a.kpiValue == null && !a.zeroConversions);
  const zeroOutcome =
    kpi === "roas" || kpi === "cpa"
      ? noValueAds.filter((a) => a.conversions === 0).length
      : 0;
  const belowGateWithValue = gated.filter(
    (a) =>
      (a.gate === "below_spend_gate" && (a.kpiValue != null || a.zeroConversions)) ||
      a.gate === "zero_outcome_thin"
  ).length;
  const missing = noValueAds.length - zeroOutcome;
  const belowOutcomeFloor = gated.filter((a) => a.gate === "below_outcome_floor").length;
  let suggestedKpi: KpiKey | null = null;
  let suggestedCpaBasis: "leads" | undefined;
  if (missing * 2 >= gated.length) {
    const usability = kpiUsability(rawRows, columns);
    suggestedKpi = preferredUsableKpi(usability, kpi);
    if (suggestedKpi === "cpa" && usability.cpa.cpaLeadBased) suggestedCpaBasis = "leads";
  }
  return {
    setAsideNoValue,
    noValue: noValueAds.length,
    zeroOutcome,
    belowGateWithValue,
    ...(belowOutcomeFloor > 0 ? { belowOutcomeFloor } : {}),
    suggestedKpi,
    ...(suggestedCpaBasis ? { suggestedCpaBasis } : {}),
  };
}
