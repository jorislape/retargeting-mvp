// The ".ts" extension on this import is deliberate and load-bearing —
// same pattern as decision.ts: types.ts imports nothing, so this whole
// file resolves under plain Node's type-stripping test runner
// (scripts/compare.test.ts). Formatters are injected rather than
// imported from format.ts (extensionless internals) for the same
// reason.
import { HIGHER_IS_BETTER, outcomeNounsForKpi } from "./types.ts";
import type {
  AnalysisResult,
  ComparisonMatchBasis,
  MemoComparison,
  MemoComparisonRow,
  ParsedAd,
  RankedAd,
} from "./types.ts";

/**
 * Period Comparison V2 — "What changed" between two independently
 * analyzed exports.
 *
 * Honesty contract (the whole point of this module):
 *  - DESCRIPTIVE ONLY. Every sentence is "X moved from A to B" — never
 *    why it moved, never a causal claim (test-enforced against a
 *    causal-vocabulary blocklist).
 *  - NEVER an input to the decision. decision.ts does not import or
 *    receive anything from this file (test-enforced by a source scan);
 *    the Next move stays a current-period read.
 *  - MATCHING NEVER GUESSES. Ad ID (exact) when both exports carry it;
 *    otherwise exact normalized ad name. A key that repeats within
 *    either period — or a missing id in id mode — makes those ads
 *    unmatchable: they are excluded and COUNTED, never fuzzy-matched,
 *    never aggregated, and never listed as appeared/disappeared.
 *  - Deltas only for ads judged in BOTH periods. An ad judged in one
 *    period only has no comparable other side — it's counted, not
 *    compared.
 *  - The match basis is surfaced prominently (matchNote), not buried
 *    in the limits.
 */

/** Display caps — counts stay honest ("and N more") when truncated. */
const MAX_DELTA_ROWS = 5;
const MAX_NAME_LIST = 5;
/** |Δ%| below this reads as "effectively unchanged" in the tally. */
const UNCHANGED_BAND_PCT = 1;
/** Period-length mismatch beyond this share draws a limits line. */
const LENGTH_MISMATCH_PCT = 25;

export const COMPARISON_CAVEAT =
  "This section shows what changed between the two exports — it does not establish why anything changed, and it never feeds the Next-move recommendation, which is based on the current period only.";

export interface ComparisonPeriod {
  analysis: AnalysisResult;
  /** ALL extracted ads for the period (including below-gate ones) —
   *  appeared/disappeared must see the whole export, not just the
   *  judged slice. */
  ads: ParsedAd[];
}

export interface ComparisonFormatters {
  money: (value: number) => string;
  kpiValue: (value: number) => string;
  kpiLabel: string;
}

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

const nameKey = (ad: ParsedAd): string => ad.name.trim().replace(/\s+/g, " ");
const idKey = (ad: ParsedAd): string | null =>
  ad.id != null && ad.id.trim() !== "" ? ad.id.trim() : null;

function keyCounts(ads: ParsedAd[], key: (ad: ParsedAd) => string | null): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ad of ads) {
    const k = key(ad);
    if (k == null) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

/* ------------------------------------------------------------------ */
/* Deltas                                                              */
/* ------------------------------------------------------------------ */

interface MatchedPair {
  key: string;
  current: ParsedAd;
  previous: ParsedAd;
}

/** Signed better-direction % change vs the previous value; null when
 *  the previous value is 0 (not expressible as a %). Positive always
 *  means "better" for the KPI's own polarity. */
function betterPct(prev: number, curr: number, higherBetter: boolean): number | null {
  if (prev === 0) return null;
  const raw = ((curr - prev) / Math.abs(prev)) * 100;
  return higherBetter ? raw : -raw;
}

function parseDay(value: string): number | null {
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* The builder                                                         */
/* ------------------------------------------------------------------ */

export function buildComparison(
  current: ComparisonPeriod,
  previous: ComparisonPeriod,
  fmt: ComparisonFormatters
): MemoComparison {
  const kpi = current.analysis.kpi;
  const higherBetter = HIGHER_IS_BETTER[kpi];
  const nouns = outcomeNounsForKpi(kpi);

  /* ---- basis: Ad ID only when BOTH exports actually carry ids;
     otherwise exact name. One file having ids and the other not would
     match nothing under ids — name matching is the honest fallback,
     and the basis is disclosed either way. ---- */
  const prevIdCount = previous.ads.filter((a) => idKey(a) != null).length;
  const currIdCount = current.ads.filter((a) => idKey(a) != null).length;
  const matchBasis: ComparisonMatchBasis =
    prevIdCount > 0 && currIdCount > 0 ? "ad_id" : "ad_name";
  const key = matchBasis === "ad_id" ? idKey : (ad: ParsedAd) => nameKey(ad);

  const prevCounts = keyCounts(previous.ads, key);
  const currCounts = keyCounts(current.ads, key);
  /* Keys that repeat within EITHER period are globally ambiguous: a
     current ad whose name was duplicated last period existed before —
     listing it as "new" would be false, so it's excluded everywhere. */
  const ambiguousKeys = new Set<string>();
  for (const [k, n] of prevCounts) if (n > 1) ambiguousKeys.add(k);
  for (const [k, n] of currCounts) if (n > 1) ambiguousKeys.add(k);

  const usable = (ad: ParsedAd): string | null => {
    const k = key(ad);
    return k != null && !ambiguousKeys.has(k) ? k : null;
  };
  const currAmbiguous = current.ads.filter((a) => usable(a) == null).length;

  const prevByKey = new Map<string, ParsedAd>();
  for (const ad of previous.ads) {
    const k = usable(ad);
    if (k != null) prevByKey.set(k, ad);
  }
  const matched: MatchedPair[] = [];
  const appearedNames: string[] = [];
  const matchedKeys = new Set<string>();
  for (const ad of current.ads) {
    const k = usable(ad);
    if (k == null) continue;
    const prev = prevByKey.get(k);
    if (prev) {
      matched.push({ key: k, current: ad, previous: prev });
      matchedKeys.add(k);
    } else {
      appearedNames.push(ad.name);
    }
  }
  const disappearedNames: string[] = [];
  for (const ad of previous.ads) {
    const k = usable(ad);
    if (k != null && !matchedKeys.has(k)) disappearedNames.push(ad.name);
  }

  /* ---- judged lookup per period (gate cleared AND a KPI value) ---- */
  const judgedByKey = (period: ComparisonPeriod): Map<string, RankedAd> => {
    const map = new Map<string, RankedAd>();
    for (const ad of period.analysis.rankedAds) {
      const k = usable(ad);
      if (k != null) map.set(k, ad);
    }
    return map;
  };
  const currJudged = judgedByKey(current);
  const prevJudged = judgedByKey(previous);

  interface Delta {
    pair: MatchedPair;
    prevValue: number;
    currValue: number;
    pct: number | null;
    better: boolean;
  }
  const deltas: Delta[] = [];
  let judgedOnePeriodOnly = 0;
  for (const pair of matched) {
    const cj = currJudged.get(pair.key);
    const pj = prevJudged.get(pair.key);
    if (cj && pj) {
      const prevValue = pj.kpiValue as number;
      const currValue = cj.kpiValue as number;
      const pctMove = betterPct(prevValue, currValue, higherBetter);
      const better = higherBetter ? currValue > prevValue : currValue < prevValue;
      deltas.push({ pair, prevValue, currValue, pct: pctMove, better });
    } else if (cj || pj) {
      judgedOnePeriodOnly += 1;
    }
  }

  const changed = deltas.filter(
    (d) => d.pct != null && Math.abs(d.pct) >= UNCHANGED_BAND_PCT
  );
  const improvedAll = changed
    .filter((d) => d.better)
    .sort((a, b) => Math.abs(b.pct!) - Math.abs(a.pct!));
  const declinedAll = changed
    .filter((d) => !d.better)
    .sort((a, b) => Math.abs(b.pct!) - Math.abs(a.pct!));
  const unchangedCount = deltas.length - changed.length;

  const toRow = (d: Delta): MemoComparisonRow => {
    const sign = d.better ? "+" : "−";
    const magnitude = d.pct != null ? `${sign}${Math.abs(Math.round(d.pct))}%` : "n/a";
    const row: MemoComparisonRow = {
      name: d.pair.current.name,
      previousLabel: fmt.kpiValue(d.prevValue),
      currentLabel: fmt.kpiValue(d.currValue),
      changeLabel:
        d.pct != null
          ? `${magnitude} (${d.better ? "better" : "worse"})`
          : `from ${fmt.kpiValue(d.prevValue)} — change not expressible as a %`,
      spendChangeLabel: `${fmt.money(d.pair.previous.spend)} → ${fmt.money(d.pair.current.spend)}`,
    };
    if (
      nouns != null &&
      d.pair.previous.conversions != null &&
      d.pair.current.conversions != null
    ) {
      row.conversionChangeLabel = `${Math.round(d.pair.previous.conversions)} → ${Math.round(d.pair.current.conversions)} ${nouns.many}`;
    }
    return row;
  };

  /* ---- account-level movement ---- */
  const accountBuyer: string[] = [];
  const accountClient: string[] = [];
  const prevMedian = previous.analysis.median;
  const currMedian = current.analysis.median;
  if (prevMedian != null && currMedian != null) {
    const medianPct = betterPct(prevMedian, currMedian, higherBetter);
    const direction =
      medianPct == null || medianPct === 0
        ? "unchanged"
        : medianPct > 0
          ? "better"
          : "worse";
    const pctLabel =
      medianPct != null && medianPct !== 0
        ? ` (${medianPct > 0 ? "+" : "−"}${Math.abs(Math.round(medianPct))}%, ${direction})`
        : medianPct === 0
          ? " (unchanged)"
          : "";
    accountBuyer.push(
      `Median ${fmt.kpiLabel} moved from ${fmt.kpiValue(prevMedian)} to ${fmt.kpiValue(currMedian)}${pctLabel}.`
    );
    accountClient.push(
      `The account's typical ${fmt.kpiLabel} result moved from ${fmt.kpiValue(prevMedian)} to ${fmt.kpiValue(currMedian)}${
        direction === "unchanged" ? "" : ` — ${direction} than last period`
      }.`
    );
  } else {
    const missing =
      prevMedian == null && currMedian == null
        ? "either period"
        : prevMedian == null
          ? "the previous period"
          : "the current period";
    accountBuyer.push(
      `No benchmark could be computed for ${missing} (too few judged ads) — account-level movement is limited to spend and counts.`
    );
    accountClient.push(
      `There wasn't enough qualifying data in ${missing} to compare typical results — the comparison covers spend and ad counts.`
    );
  }
  const prevSpend = previous.analysis.totalSpend;
  const currSpend = current.analysis.totalSpend;
  const spendPct =
    prevSpend > 0 ? Math.round(((currSpend - prevSpend) / prevSpend) * 100) : null;
  const spendPctLabel =
    spendPct != null ? ` (${spendPct >= 0 ? "+" : "−"}${Math.abs(spendPct)}%)` : "";
  accountBuyer.push(
    `Total spend ${fmt.money(prevSpend)} → ${fmt.money(currSpend)}${spendPctLabel}; judged ads ${previous.analysis.adsJudged} → ${current.analysis.adsJudged}.`
  );
  accountClient.push(
    `Total spend went from ${fmt.money(prevSpend)} to ${fmt.money(currSpend)}${spendPctLabel}.`
  );
  if (deltas.length > 0) {
    accountBuyer.push(
      `Of ${deltas.length} ad${deltas.length === 1 ? "" : "s"} judged in both periods: ${improvedAll.length} improved, ${declinedAll.length} declined, ${unchangedCount} effectively unchanged (<${UNCHANGED_BAND_PCT}% move).`
    );
    accountClient.push(
      `Of the ${deltas.length} ad${deltas.length === 1 ? "" : "s"} we can compare fairly across both periods, ${improvedAll.length} improved and ${declinedAll.length} declined.`
    );
  } else {
    accountBuyer.push(
      "No individual ad could be reliably matched and judged in both periods — the per-ad comparison is empty; account-level movement above is still valid."
    );
    accountClient.push(
      "No individual ad had enough qualifying data in both periods to compare one-to-one — the account-level movement above still holds."
    );
  }
  /* Composition honesty: when the judged sets differ, part of the
     benchmark movement is WHO qualified, not like-for-like performance. */
  const judgedSetsDiffer =
    currJudged.size !== prevJudged.size ||
    [...currJudged.keys()].some((k) => !prevJudged.has(k));
  if (prevMedian != null && currMedian != null && judgedSetsDiffer) {
    accountBuyer.push(
      "The set of ads with enough spend to judge changed between periods — part of the benchmark movement reflects that composition change, not like-for-like performance."
    );
    accountClient.push(
      "A different mix of ads had enough spend to compare this period, so some of the movement reflects that mix — not only performance."
    );
  }

  /* ---- persistence of last period's leaders ---- */
  const persistenceBuyer: string[] = [];
  const persistenceClient: string[] = [];
  for (const prevWinner of previous.analysis.winners.slice(0, 3)) {
    const k = usable(prevWinner);
    const label = `"${prevWinner.name}"`;
    if (k == null) continue; // ambiguous — already counted and disclosed
    const cj = currJudged.get(k);
    if (cj) {
      if (cj.deltaFromMedian > 0) {
        persistenceBuyer.push(
          `${label} — a top ad last period — is above the median again this period (${cj.deltaPct != null ? `${cj.deltaPct >= 0 ? "+" : ""}${Math.round(cj.deltaPct)}%` : "at the median"}).`
        );
        persistenceClient.push(
          `${label}, a leading ad last period, is ahead of the typical result again this period.`
        );
      } else if (cj.deltaFromMedian < 0) {
        persistenceBuyer.push(
          `${label} — a top ad last period — is below the median this period (${cj.deltaPct != null ? `${Math.round(cj.deltaPct)}%` : "under it"}).`
        );
        persistenceClient.push(
          `${label}, a leading ad last period, is behind the typical result this period.`
        );
      } else {
        persistenceBuyer.push(
          `${label} — a top ad last period — sits exactly at the median this period.`
        );
        persistenceClient.push(
          `${label}, a leading ad last period, is right at the typical result this period.`
        );
      }
    } else if (matchedKeys.has(k)) {
      persistenceBuyer.push(
        `${label} — a top ad last period — didn't clear the evidence gate this period, so it isn't judged.`
      );
      persistenceClient.push(
        `${label}, a leading ad last period, didn't have enough spend this period for a fair read.`
      );
    } else {
      persistenceBuyer.push(
        `${label} — a top ad last period — no longer appears in this export.`
      );
      persistenceClient.push(
        `${label}, a leading ad last period, isn't in this period's data.`
      );
    }
  }

  /* ---- limits (computed, not boilerplate) ---- */
  const limitsBuyer: string[] = [];
  const limitsClient: string[] = [];
  if (matchBasis === "ad_name") {
    limitsBuyer.push(
      "Ads are matched by exact ad name (no Ad ID in both exports) — a renamed ad appears as one removed and one new ad, not as a change."
    );
    limitsClient.push(
      "Ads are matched by their names across the two periods, so a renamed ad shows up as removed and new rather than as a change."
    );
  }
  if (currAmbiguous > 0) {
    limitsBuyer.push(
      `${currAmbiguous} current-period ad${currAmbiguous === 1 ? "" : "s"} couldn't be matched one-to-one (${matchBasis === "ad_id" ? "missing or duplicated Ad ID" : "the same ad name appears on multiple rows"}) — excluded from the per-ad comparison rather than guessed, along with any previous-period rows sharing those ${matchBasis === "ad_id" ? "IDs" : "names"}.`
    );
    limitsClient.push(
      `${currAmbiguous} ad${currAmbiguous === 1 ? "" : "s"} couldn't be matched confidently across the periods and ${currAmbiguous === 1 ? "was" : "were"} left out of the one-to-one comparison rather than guessed.`
    );
  }
  if (judgedOnePeriodOnly > 0) {
    limitsBuyer.push(
      `${judgedOnePeriodOnly} matched ad${judgedOnePeriodOnly === 1 ? "" : "s"} cleared the evidence gate in only one of the two periods — no movement is reported for ${judgedOnePeriodOnly === 1 ? "it" : "them"}.`
    );
    limitsClient.push(
      `${judgedOnePeriodOnly} ad${judgedOnePeriodOnly === 1 ? "" : "s"} had enough spend to judge in only one of the two periods, so no movement is reported for ${judgedOnePeriodOnly === 1 ? "it" : "them"}.`
    );
  }
  /* Period sanity: overlap / order / length, when dates exist. */
  const prevRange = previous.analysis.dateRange;
  const currRange = current.analysis.dateRange;
  if (prevRange && currRange) {
    const prevStart = parseDay(prevRange.start);
    const prevEnd = parseDay(prevRange.end);
    const currStart = parseDay(currRange.start);
    const currEnd = parseDay(currRange.end);
    if (prevStart != null && prevEnd != null && currStart != null && currEnd != null) {
      if (prevStart > currStart) {
        limitsBuyer.push(
          `The "previous period" file starts after the current one (${prevRange.start} vs ${currRange.start}) — check the files are in the right slots.`
        );
        limitsClient.push(
          "The earlier-period file appears to be more recent than the current one — worth double-checking the files are in the right order."
        );
      } else if (prevEnd >= currStart) {
        limitsBuyer.push(
          `The two periods overlap (previous ends ${prevRange.end}, current starts ${currRange.start}) — overlapping days compare an ad partly to itself.`
        );
        limitsClient.push(
          "The two periods overlap in time, so part of the comparison covers the same days twice."
        );
      }
      const prevDays = Math.round((prevEnd - prevStart) / DAY_MS) + 1;
      const currDays = Math.round((currEnd - currStart) / DAY_MS) + 1;
      const longer = Math.max(prevDays, currDays);
      if (
        longer > 0 &&
        (Math.abs(prevDays - currDays) / longer) * 100 > LENGTH_MISMATCH_PCT
      ) {
        limitsBuyer.push(
          `The periods differ in length (${prevDays} vs ${currDays} days) — totals like spend aren't directly comparable; rates are.`
        );
        limitsClient.push(
          `The two periods aren't the same length (${prevDays} vs ${currDays} days), so totals aren't directly comparable — rates still are.`
        );
      }
    }
  } else {
    limitsBuyer.push(
      "One or both exports have no reporting date range — the periods can't be verified as sequential or non-overlapping."
    );
    limitsClient.push(
      "The files don't both include dates, so we can't verify the two periods don't overlap."
    );
  }

  const matchNote =
    matchBasis === "ad_id"
      ? "Ads matched by Ad ID — stable across renames."
      : "Ads matched by exact ad name — Ad ID wasn't present in both exports. A renamed ad appears as one removed and one new ad.";

  return {
    matchBasis,
    matchNote,
    periodLabel: {
      previous: prevRange ? `${prevRange.start} – ${prevRange.end}` : null,
      current: currRange ? `${currRange.start} – ${currRange.end}` : null,
    },
    account: { buyer: accountBuyer, client: accountClient },
    improved: improvedAll.slice(0, MAX_DELTA_ROWS).map(toRow),
    declined: declinedAll.slice(0, MAX_DELTA_ROWS).map(toRow),
    matchedJudgedBoth: deltas.length,
    unmatched: {
      ambiguousOrMissingKey: currAmbiguous,
      judgedOnePeriodOnly,
    },
    persistence: { buyer: persistenceBuyer, client: persistenceClient },
    appeared: {
      names: appearedNames.slice(0, MAX_NAME_LIST),
      total: appearedNames.length,
    },
    disappeared: {
      names: disappearedNames.slice(0, MAX_NAME_LIST),
      total: disappearedNames.length,
    },
    caveat: COMPARISON_CAVEAT,
    limits: { buyer: limitsBuyer, client: limitsClient },
  };
}
