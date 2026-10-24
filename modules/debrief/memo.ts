import {
  analysisWindowDays,
  budgetReceivers,
  buildDecision,
  evidenceLead,
  HIGH_CONFIDENCE_OUTCOME_MULTIPLE,
  isReceiverVolumeBelowHighBar,
  receiverOutcomeMin,
  volumeSubject,
  weakestReceiver,
  passedOverLeader,
  isOutcomeVolumeBelowFloor,
  isScaleActionSupported,
  isProxyOutcomeConflict,
  isCutActionSupported,
  MIN_OUTCOMES_FOR_SUPPORTED,
  SCALE_TEST_MIN_DELTA_PCT,
  SHORT_WINDOW_DAYS,
  spendGateSource,
  trimOrder,
  trimCandidates,
  isNearMedian,
  byEvidence,
  evidenceAdjustedKpi,
  passedOverReason,
  passesReceiverFloor,
  FLAT_FIELD_DELTA_PCT,
  zeroThinCopy,
} from "./decision";
import {
  fmtCount,
  fmtDeltaVsMedian,
  fmtKpiValue,
  fmtMoney,
} from "./format";
import { assessMarketNotes, extractMarketSignals, MARKET_SIGNALS_DISCLOSURE } from "./marketSignals";
import { deriveLossConfidenceReadiness, deriveSignalVolumeReadiness } from "./briefReadiness";
import { deriveEvidenceDiagnostic } from "./evidenceDiagnostic";
import {
  AnalysisResult,
  CREATIVE_FORMAT_LABELS,
  DebriefContext,
  HIGHER_IS_BETTER,
  DecisionCriteria,
  Memo,
  MemoDecision,
  MemoMarketSignal,
  MemoNamingPatterns,
  MemoSpendAllocation,
  MemoSpendAllocationSegment,
  MemoSpendAllocationSetAside,
  MemoTest,
  MemoWinnerLoserRow,
  kpiClientLabelFor,
  kpiExplainerFor,
  kpiLabelFor,
  outcomeNounsFor,
  RankedAd,
} from "./types";

/**
 * Assembles the memo from the deterministic analysis + user context.
 * Every sentence is templated from real numbers — no free-form
 * generation. This is the seam to swap in an LLM later: replace the
 * body of `generateMemo` with a call that takes the same
 * (AnalysisResult, DebriefContext) fact sheet and returns a Memo of the
 * same shape, so the UI never has to change. Until then, this keeps
 * the product honest, fast, and free to run.
 */

/** Display label for a format tag ("ugc" → "UGC"); name-derived tags
 *  not in the confirmable list pass through as-is. */
const formatLabel = (tag: string): string => CREATIVE_FORMAT_LABELS[tag] ?? tag;

/** First-Run Fixes: ads set aside for SPEND only. Equals adsSetAside
 *  unless some ads cleared the gate but have no KPI value (KpiGaps) —
 *  those are explained by the decision's own limits line, so spend
 *  wording never claims them. */
function spendSetAside(analysis: AnalysisResult): number {
  /* Zero-conversion ads under the zero-conversion bar cleared the
     minimum spend — they're named separately (zeroThinLines), never
     counted as "below the minimum". */
  const thin = analysis.zeroOutcomeThin?.ads.length ?? 0;
  /* Ads under the user's outcome minimum are named separately too
     (KpiGaps already counts them in their own bucket). */
  const floor = analysis.kpiGaps ? 0 : analysis.outcomeFloor?.setAside.length ?? 0;
  return (
    (analysis.kpiGaps
      ? analysis.kpiGaps.belowGateWithValue + (analysis.kpiGaps.zeroLowSpend ?? 0)
      : analysis.adsSetAside) -
    thin -
    floor
  );
}

/** Tester Feedback follow-up: one buyer line per zero-conversion CPA ad
 *  set aside under the zero-conversion spend bar. */
function zeroThinLines(analysis: AnalysisResult): string[] {
  const z = analysis.zeroOutcomeThin;
  if (!z) return [];
  const money = (v: number) => fmtMoney(v, analysis.currency);
  const summary = zeroThinCopy(z, analysis, money);
  if (summary) return [summary.buyer];
  const many = outcomeNounsFor(analysis)?.many ?? "conversions";
  const need =
    z.needs != null
      ? `needs ≥ ${money(z.needs)}`
      : `no other ad has a ${kpiLabelFor(analysis)} to measure it against yet`;
  return z.ads.map(
    (a) => `"${a.name}" spent ${money(a.spend)} with 0 ${many} — not enough spend yet to call it (${need}).`
  );
}

function describeAdReason(
  ad: RankedAd,
  hasCreativeNotes: boolean,
  creativeNotes: string
): string {
  /* User-confirmed format: state it as confirmed — but it's still user
     context about WHAT the ad is, never proof of WHY it performed. */
  if (ad.formatConfirmed && ad.nameTags.length > 0) {
    return `Format confirmed as ${ad.nameTags.map(formatLabel).join("/")} — user-provided context, not proof of why it performed.`;
  }
  if (ad.nameTags.length > 0) {
    return `Ad name suggests ${ad.nameTags.join("/")} creative — confirm against the actual asset.`;
  }
  if (hasCreativeNotes) {
    const snippet =
      creativeNotes.length > 60 ? `${creativeNotes.slice(0, 57)}...` : creativeNotes;
    return `No format signal in the name — cross-check against your notes ("${snippet}").`;
  }
  return "Metrics only — angle unknown.";
}

/* ---- Evidence Inputs V1: conversion visibility (display only) ----
   The KPI→noun mapping (purchases for roas/cpa/purchases, leads for
   leads, none for ctr/cpc) now lives in types.ts as outcomeNounsForKpi
   — shared with decision.ts's user-set scaling minimum (Decision
   Criteria V2) so display and criterion can never disagree about which
   count a KPI carries. None of this reads or changes spend, the gate,
   median, ranking, KPI values, action, or evidenceState. */
const conversionNouns = outcomeNounsFor;

/** Neutral per-row conversion label ("34 purchases" / "1 lead"), or
 *  undefined when not applicable (non-purchase KPI or no count for this
 *  ad). Never estimated. */
function conversionLabelFor(ad: RankedAd, analysis: AnalysisResult): string | undefined {
  const nouns = conversionNouns(analysis);
  if (nouns == null || ad.conversions == null) return undefined;
  const n = Math.round(ad.conversions);
  return `${fmtCount(n)} ${n === 1 ? nouns.one : nouns.many}`;
}

/** The neutral leading-ad conversion line, both registers. null when
 *  there is no leading ad (no winner) or the KPI isn't purchase-based.
 *  When the count column is absent, states that plainly — never a
 *  fabricated number. */
function buildLeadingConversion(
  analysis: AnalysisResult,
  criteria?: DecisionCriteria
): { buyer: string; client: string } | null {
  const nouns = conversionNouns(analysis);
  /* Real-account review: the table's first row (evidence-adjusted
     order — the primary receiver under a budget move), never a raw
     leader the table no longer shows first. */
  const top = byEvidence(analysis.winners, analysis, criteria)[0] ?? null;
  if (nouns == null || top == null) return null;
  if (top.conversions == null) {
    const line = `This export does not include ${nouns.one} counts, so the number of ${nouns.many} behind this result cannot be verified.`;
    return { buyer: line, client: line };
  }
  const n = Math.round(top.conversions);
  const label = `${fmtCount(n)} ${n === 1 ? nouns.one : nouns.many}`;
  return {
    buyer: `The leading ad recorded ${label} during this period.`,
    client: `This ad generated ${label} during the selected period.`,
  };
}

/** Real-account fix 3: where a merged creative ran. Ad sets are named
 *  only when the export has an ad set column to prove them; otherwise
 *  the row count is stated as a fact about the file. */
function runsInFor(ad: RankedAd): { runsInLabel?: string } {
  const n = ad.rowsMerged ?? 1;
  if (n <= 1) return {};
  if (ad.adSetCount != null) {
    return { runsInLabel: `runs in ${ad.adSetCount} ad set${ad.adSetCount === 1 ? "" : "s"}` };
  }
  return { runsInLabel: `appears ${n} times in this export` };
}

function buildRow(
  ad: RankedAd,
  analysis: AnalysisResult,
  context: DebriefContext
): MemoWinnerLoserRow {
  /* Tester Feedback Fix 2: a judged zero-conversion CPA ad has no KPI
     value to print — the row states the fact (0 purchases/leads) and
     carries no percentage (deltaPct null → no ranking-chart geometry). */
  if (ad.zeroConversions) {
    const many = outcomeNounsFor(analysis)?.many ?? "conversions";
    return {
      name: ad.name,
      /* Real-account fix 1: a zero-purchase ROAS ad IS 0x. */
      valueLabel: analysis.kpi === "roas" ? fmtKpiValue(0, "roas", analysis.currency) : `0 ${many}`,
      vsMedianLabel:
        analysis.kpi === "roas" ? `0 ${many} — ranked last` : `no ${kpiLabelFor(analysis)} — ranked last`,
      deltaPct: null,
      spendLabel: fmtMoney(ad.spend, analysis.currency),
      ...runsInFor(ad),
      reason: describeAdReason(ad, analysis.hasCreativeNotes, context.creativeNotes),
      ...frequencyFieldsFor(ad),
      ...vsTargetFor(ad, analysis, context),
      ...viewThroughNoteFor(ad, analysis),
      ...lowIntentNoteFor(ad, analysis),
    };
  }
  return {
    name: ad.name,
    valueLabel: fmtKpiValue(ad.kpiValue as number, analysis.kpi, analysis.currency),
    vsMedianLabel: fmtDeltaVsMedian(ad.deltaFromMedian, ad.deltaPct),
    deltaPct: ad.deltaPct,
    spendLabel: fmtMoney(ad.spend, analysis.currency),
    ...runsInFor(ad),
    reason: describeAdReason(ad, analysis.hasCreativeNotes, context.creativeNotes),
    conversionLabel: conversionLabelFor(ad, analysis),
    ...fewOutcomesNoteFor(ad, analysis),
    ...frequencyFieldsFor(ad),
    ...vsTargetFor(ad, analysis, context),
    ...viewThroughNoteFor(ad, analysis),
    ...lowIntentNoteFor(ad, analysis),
  };
}

/** Attribution & Intent 3: an ad whose conversions are MORE than this
 *  share view-through gets a "likely passive credit" note. 25% is a
 *  practitioner rule of thumb from CAPI/tracking work (1-day view credit
 *  inflates statics/retargeting), not a measured threshold — a prompt to
 *  check the ad, never an input to ranking or the decision. Strictly
 *  greater: exactly 25% is not flagged. */
export const VIEW_THROUGH_FLAG_SHARE = 0.25;

function viewThroughNoteFor(ad: RankedAd, analysis: AnalysisResult): { viewThroughNote?: { buyer: string; client: string } } {
  const vt = ad.viewThrough;
  if (!vt || vt.click + vt.view <= 0) return {};
  const share = vt.view / (vt.click + vt.view);
  if (!(share > VIEW_THROUGH_FLAG_SHARE)) return {};
  const pctLabel = `${Math.round(share * 100)}%`;
  const many = outcomeNounsFor(analysis)?.many ?? "conversions";
  return {
    viewThroughNote: {
      buyer: `${pctLabel} of conversions are view-through — likely passive credit (retargeting/branded demand).`,
      client: `${pctLabel} of this ad's ${many} came from people who saw it without clicking — some of that credit may be for ${many} that would have happened anyway.`,
    },
  };
}

function lowIntentNoteFor(ad: RankedAd, analysis: AnalysisResult): { lowIntentNote?: { buyer: string; client: string } } {
  if (!analysis.lowIntent?.includes(ad.name)) return {};
  return {
    lowIntentNote: {
      buyer: "Stops the scroll but doesn't drive clicks — high engagement, low purchase intent.",
      client: "Grabs attention, but few viewers go on to click through — interest isn't turning into buying intent yet.",
    },
  };
}

/* Trust Pass 2: an ad's position vs the user's own target — ROAS vs
   target ROAS, CPA vs target CPA. Display only; the action rules never
   read it. A zero-conversion CPA ad misses by definition. */
function targetFor(analysis: AnalysisResult, context: DebriefContext): number | null {
  if (analysis.kpi === "roas" && context.targetRoas != null && context.targetRoas > 0) return context.targetRoas;
  if (analysis.kpi === "cpa" && context.targetCpa != null && context.targetCpa > 0) return context.targetCpa;
  return null;
}
function beatsTarget(ad: RankedAd, analysis: AnalysisResult, target: number): boolean {
  if (ad.kpiValue == null) return false;
  return analysis.kpi === "roas" ? ad.kpiValue >= target : ad.kpiValue <= target;
}
function vsTargetFor(ad: RankedAd, analysis: AnalysisResult, context: DebriefContext): { vsTarget?: "beats" | "misses" } {
  const target = targetFor(analysis, context);
  if (target == null) return {};
  return { vsTarget: beatsTarget(ad, analysis, target) ? "beats" : "misses" };
}

/** Real-account review — a below-median ROAS at or above
 *  min(PROFITABLE_ROAS_FLOOR, PROFITABLE_MEDIAN_SHARE × median) may still
 *  be profitable: without a target its trim row says so. Rules of thumb
 *  for a caution note, never a ranking or decision input. */
export const PROFITABLE_ROAS_FLOOR = 1.5;
export const PROFITABLE_MEDIAN_SHARE = 0.5;

function trimNoteFor(
  ad: RankedAd,
  analysis: AnalysisResult,
  context: DebriefContext
): { trimNote?: NonNullable<MemoWinnerLoserRow["trimNote"]> } {
  const target = targetFor(analysis, context);
  if (target != null) {
    if (!beatsTarget(ad, analysis, target)) return {};
    const label = analysis.kpi === "roas" ? "above target" : "beats your target CPA";
    return {
      trimNote: {
        buyer: `${label.charAt(0).toUpperCase()}${label.slice(1)} — reduce, don't pause.`,
        client: "Still beats your target — we'll reduce its budget rather than pause it.",
        short: { buyer: `${label} — reduce, don't pause`, client: "beats your target — reducing, not pausing" },
      },
    };
  }
  if (analysis.kpi !== "roas" || analysis.median == null || ad.kpiValue == null || ad.zeroConversions) return {};
  if (ad.kpiValue < Math.min(PROFITABLE_ROAS_FLOOR, PROFITABLE_MEDIAN_SHARE * analysis.median)) return {};
  return {
    trimNote: {
      buyer: "Below median, not necessarily unprofitable — check against your breakeven ROAS before cutting.",
      client: "Below the middle ad, but not necessarily losing money — worth checking against your break-even point before pausing.",
      short: { buyer: "below median, not necessarily unprofitable", client: "below average, not necessarily losing money" },
    },
  };
}

/** Real-account review — the trim list and the near-median holds it
 *  leaves out (decision.ts trimCandidates), with the trims' spend. */
function trimSplit(analysis: AnalysisResult): { trims: RankedAd[]; held: number; trimSpend: number } {
  const trims = trimCandidates(analysis);
  return { trims, held: analysis.losers.length - trims.length, trimSpend: trims.reduce((s, a) => s + a.spend, 0) };
}
const heldCount = (n: number) => `${fmtCount(n)} near-median hold${n === 1 ? "" : "s"}`;
const clientHeldClause = (n: number) =>
  n === 1
    ? "1 more sits close to the middle ad and stays as it is."
    : `${fmtCount(n)} more sit close to the middle ad and stay as they are.`;

/** Real-account review — a below-median ad within the flat band. */
const NEAR_MEDIAN_HOLD = {
  buyer: `Near median — hold (within ${FLAT_FIELD_DELTA_PCT}% of the median; not a trim).`,
  client: "Close to the middle ad — keeping it as is.",
};

/** The buyer view's "adj." value: ROAS shrunk toward the median by
 *  purchase volume (decision.ts evidenceAdjustedKpi). ROAS only. */
function adjFor(ad: RankedAd, analysis: AnalysisResult, criteria: DecisionCriteria): { adjValueLabel?: string } {
  const v = evidenceAdjustedKpi(ad, analysis, criteria);
  return v == null ? {} : { adjValueLabel: fmtKpiValue(v, analysis.kpi, analysis.currency) };
}

/** Copies each Pause / trim ad's trimNote (short form) onto the card's
 *  list and, with no target set, adds the target hint when one of the
 *  first three may still be profitable. The decision itself is untouched
 *  — same action, same ads, same order. */
function withTrimNotes(d: MemoDecision, analysis: AnalysisResult, context: DebriefContext): MemoDecision {
  if (!d.budgetMove || d.budgetMove.from.length === 0) return d;
  const byName = new Map(analysis.losers.map((a) => [a.name, a]));
  const from = d.budgetMove.from.map((f) => {
    const ad = byName.get(f.name);
    const note = ad ? trimNoteFor(ad, analysis, context).trimNote : undefined;
    return note ? { ...f, note: note.short } : f;
  });
  const hint =
    targetFor(analysis, context) == null && from.slice(0, 3).some((f) => f.note)
      ? {
          trimTargetHint: {
            buyer: "Set a target ROAS (your breakeven) for a profit-based trim list.",
            client: "Telling us your break-even return would let us separate ads that lose money from ones that are just below average.",
          },
        }
      : {};
  return { ...d, budgetMove: { ...d.budgetMove, from }, ...hint };
}

/** Tester Feedback Fix 6: frequency at or above this gets a buyer-only
 *  "possible fatigue" note. A practitioner rule of thumb, NOT a
 *  measured threshold — one export can't show a fatigue trend, which
 *  is why the note sends the reader to Ads Manager rather than
 *  concluding anything. Never read by the gate, ranking or decision. */
export const FREQUENCY_FATIGUE_NOTE_AT = 4;

function frequencyFieldsFor(ad: RankedAd): { frequencyLabel?: string; fatigueNote?: string } {
  if (ad.frequency == null) return {};
  const f = ad.frequency.toFixed(1);
  /* At/above the threshold the note already carries the number — no
     separate plain "Frequency N.N" line for that row. */
  return ad.frequency >= FREQUENCY_FATIGUE_NOTE_AT
    ? { fatigueNote: `Frequency ${f} — possible fatigue; check the trend in Ads Manager.` }
    : { frequencyLabel: `Frequency ${f}` };
}

/* Tester Feedback Fix 4: a ROAS/CPA value divides by the conversion
   count, so a handful of conversions makes it jumpy. Buyer-register
   note only; ratio KPIs only (for Purchases/Leads the count IS the
   result); only when the count is in the export (missing ≠ few). */
function fewOutcomesNoteFor(
  ad: RankedAd,
  analysis: AnalysisResult
): { fewOutcomesNote?: string } {
  if (analysis.kpi !== "roas" && analysis.kpi !== "cpa") return {};
  const n = ad.conversions;
  const nouns = outcomeNounsFor(analysis);
  if (n == null || nouns == null || n <= 0 || n >= MIN_OUTCOMES_FOR_SUPPORTED) return {};
  return {
    fewOutcomesNote: `Based on ${n} ${n === 1 ? nouns.one : nouns.many} — under ${MIN_OUTCOMES_FOR_SUPPORTED}, so this ${kpiLabelFor(analysis)} can move a lot with a few more.`,
  };
}

/* Tester Feedback Fixes: the ad(s) that ARE the median. Same row shape
   as winners/losers; the delta label says "at median" rather than
   "0% worse than median". Spread into the memo only when non-empty. */
export const AT_MEDIAN_BUYER_LABEL = "At the median — this ad is the benchmark";
export const AT_MEDIAN_CLIENT_LABEL =
  "The middle ad — the one every other ad is compared against";

function buildAtMedian(
  analysis: AnalysisResult,
  context: DebriefContext
): { atMedian?: NonNullable<Memo["atMedian"]> } {
  const ads = analysis.rankedAds.filter((a) => a.deltaFromMedian === 0);
  if (ads.length === 0) return {};
  return {
    atMedian: {
      rows: ads.map((ad) => ({ ...buildRow(ad, analysis, context), vsMedianLabel: "at median" })),
      buyerLabel:
        ads.length === 1 ? AT_MEDIAN_BUYER_LABEL : "At the median — these ads set the benchmark",
      clientLabel:
        ads.length === 1
          ? AT_MEDIAN_CLIENT_LABEL
          : "The middle ads — the ones every other ad is compared against",
    },
  };
}

/** Appended to the losers instruction: why the list isn't in KPI order. */
export const TRIM_ORDER_NOTE = "Listed by money at stake — spend × gap to the median.";

/** The decision's receivers as ranked ads, in the card's order. */
function moveReceivers(analysis: AnalysisResult, decision: MemoDecision): RankedAd[] {
  return (decision.budgetMove?.to ?? [])
    .map((t) => analysis.winners.find((w) => w.name === t.name))
    .filter((a): a is RankedAd => a != null);
}

/* TLDR Coherence fix: the verdict lines take the ALREADY-BUILT decision
   and voice an imperative ("move budget toward it", "Kill or shrink")
   ONLY when the committed call actually is that move — otherwise they
   state the same facts without the instruction. The decision stays the
   single source of truth for eligibility; this function never
   re-derives a bar, it only reads action/budgetVariant/holdReason. */
function buildTldr(analysis: AnalysisResult, decision: MemoDecision): string[] {
  const { winners, losers, median, kpi, currency, belowBenchmarkSpend, belowBenchmarkCount } =
    analysis;
  const kpiLabel = kpiLabelFor(analysis);
  const medianLabel = median != null ? fmtKpiValue(median, kpi, currency) : null;
  const lines: string[] = [];
  /* Winner imperative only under shift/scale; kill imperative only
     under shift/cut — mirrors which halves of the budget move the
     decision actually committed to. */
  const scaleSide = decision.action === "budget" && decision.budgetVariant !== "cut";
  const cutSide = decision.action === "budget" && decision.budgetVariant !== "scale";

  /* Real-account fix: under a budget move the verdict names the
     decision's OWN receivers — never winners[0], which the receiver
     floor may have passed over. */
  const receivers = scaleSide ? moveReceivers(analysis, decision) : [];
  if (receivers.length > 0) {
    const top = receivers[0];
    const topStats = `${fmtKpiValue(top.kpiValue as number, kpi, currency)} ${kpiLabel} (${fmtDeltaVsMedian(top.deltaFromMedian, top.deltaPct)}) on ${fmtMoney(top.spend, currency)} spend`;
    lines.push(
      receivers.length === 1
        ? top === winners[0]
          ? `"${top.name}" is the clear winner at ${topStats} — move budget toward it.`
          : `"${top.name}" earns the budget move at ${topStats} — move budget toward it (see Next move).`
        : `${receivers.length} ads earn the budget move, led by "${top.name}" at ${topStats} — move budget toward them in steps (see Next move).`
    );
  } else if (winners.length > 0) {
    const top = winners[0];
    const topStats = `${fmtKpiValue(top.kpiValue as number, kpi, currency)} ${kpiLabel} (${fmtDeltaVsMedian(top.deltaFromMedian, top.deltaPct)}) on ${fmtMoney(top.spend, currency)} spend`;
    lines.push(
      `"${top.name}" leads at ${topStats} — the strongest observed result, though it hasn't earned a budget move (see Next move).`
    );
  } else if (medianLabel) {
    lines.push(
      `No ad meaningfully beat the ${medianLabel} ${kpiLabel} benchmark this period — treat results as flat, not a breakout.`
    );
  } else {
    lines.push(
      `Not enough ads reached the minimum spend to call a winner this period — treat this debrief as directional only.`
    );
  }

  if (losers.length > 0) {
    /* Trust Pass: losers is the full pool, so "others" are every other
       below-median ad — all listed in the Losers section below. The one
       named is the most money at stake (the list's own first row). */
    const firstTrim = trimOrder(analysis)[0];
    const extra = belowBenchmarkCount - 1;
    const alsoBelow = extra > 0
      ? cutSide
        ? ` and ${extra} other below-median ad${extra === 1 ? "" : "s"}`
        : ` and ${extra} other ad${extra === 1 ? "" : "s"}`
      : "";
    /* Real-account review: near-median ads (within the flat band) are
       holds, not trims — a cut names only the trim list. */
    const trims = trimCandidates(analysis);
    const held = losers.length - trims.length;
    if (cutSide && held > 0) {
      const more = trims.length - 1;
      lines.push(
        `Trim or pause "${trims[0].name}"${more > 0 ? ` and ${more} other ad${more === 1 ? "" : "s"} well below the median` : ""} — combined ${fmtMoney(trims.reduce((s, a) => s + a.spend, 0), currency)}, plus ${heldCount(held)}.`
      );
    } else lines.push(
      cutSide
        ? `Trim or pause "${firstTrim.name}"${alsoBelow} — combined ${fmtMoney(belowBenchmarkSpend, currency)} spent below the median.`
        : `"${firstTrim.name}"${alsoBelow} sit${extra > 0 ? "" : "s"} below the median — combined ${fmtMoney(belowBenchmarkSpend, currency)}, though no cut clears this memo's bars yet (see Next move).`
    );
  } else {
    lines.push(`No ad is clearly underperforming enough to kill outright.`);
  }

  if (decision.action === "hold" && decision.holdReason === "insufficient_data") {
    lines.push(
      `Next: let the current ads accrue spend until enough reach the minimum spend — no new tests yet; rerun this debrief once they do.`
    );
  } else if (decision.action === "hold" && decision.holdReason === "flat_performance") {
    lines.push(
      `Next: no new variables yet — let the current set run; the tests below are queued for when the field separates.`
    );
  } else {
    lines.push(
      analysis.hasNameSignal
        ? `Next: brief new creative in the format your winners share (see Patterns and Next tests below).`
        : `Next: run the creative tests below, and start tagging ad names or creative notes so future debriefs can spot format patterns.`
    );
  }

  return lines;
}

function buildPatterns(analysis: AnalysisResult): { winners: string[]; losers: string[] } {
  const { winners, losers, currency, hasNameSignal, hasCreativeNotes } = analysis;
  const winnerNotes: string[] = [];
  const loserNotes: string[] = [];

  if (winners.length > 0 && losers.length > 0) {
    const avgWinnerSpend = winners.reduce((s, a) => s + a.spend, 0) / winners.length;
    const avgLoserSpend = losers.reduce((s, a) => s + a.spend, 0) / losers.length;
    if (avgWinnerSpend > avgLoserSpend * 1.2) {
      winnerNotes.push(
        `Winners ran higher average spend (${fmtMoney(avgWinnerSpend, currency)} vs ${fmtMoney(avgLoserSpend, currency)}) — an observed association in this dataset, not a proven cause.`
      );
    } else if (avgLoserSpend > avgWinnerSpend * 1.2) {
      loserNotes.push(
        `Losers ran higher average spend (${fmtMoney(avgLoserSpend, currency)} vs ${fmtMoney(avgWinnerSpend, currency)} for winners) — added budget did not coincide with better results here.`
      );
    }
  }

  /* Format-share bullets. Gating matches how the tags are used
     downstream (Next Tests signals, What-not-to-do): a name-derived
     GUESS still needs group-level support (hasNameSignal) before
     Patterns asserts it, but a user-CONFIRMED format is direct context
     and shows on its own — if the Next Tests signals can say "ugc ads
     hold 2/5 winner slots (2 formats user-confirmed)", Patterns must
     show the same share. Runs without confirmations are byte-identical
     to the legacy wording and gate. */
  const tagNote = (
    best: { tag: string; count: number; confirmed: number },
    group: RankedAd[],
    groupLabel: "winners" | "underperformers"
  ): string =>
    best.confirmed > 0
      ? `${formatLabel(best.tag)} ads make up ${best.count}/${group.length} ${groupLabel} (${best.confirmed} format${best.confirmed === 1 ? "" : "s"} user-confirmed).`
      : `"${best.tag}"-tagged ads make up ${best.count}/${group.length} ${groupLabel === "winners" ? "winners" : "losers"}.`;
  const winnerTag = dominantTag(winners);
  if (winnerTag && (hasNameSignal || winnerTag.confirmed > 0)) {
    winnerNotes.push(tagNote(winnerTag, winners, "winners"));
  }
  const loserTag = dominantTag(losers);
  if (loserTag && (hasNameSignal || loserTag.confirmed > 0)) {
    loserNotes.push(tagNote(loserTag, losers, "underperformers"));
  }

  /* Real-account fix 8: a naming convention replaces "metrics only". */
  const namingNote = "Ad names follow a naming convention — see Patterns by naming for results per token value.";
  if (winnerNotes.length === 0 && analysis.namingPatterns && !hasCreativeNotes && !hasNameSignal) {
    winnerNotes.push(namingNote);
  }
  if (loserNotes.length === 0 && analysis.namingPatterns && !hasCreativeNotes && !hasNameSignal) {
    loserNotes.push(namingNote);
  }
  if (winnerNotes.length === 0) {
    winnerNotes.push(
      hasCreativeNotes || hasNameSignal
        ? "No consistent structural pattern found among winners beyond the numbers themselves."
        : "Angle analysis is limited — no creative descriptions were provided, so this is metrics only."
    );
  }
  if (loserNotes.length === 0) {
    loserNotes.push(
      hasCreativeNotes || hasNameSignal
        ? "No consistent structural pattern found among losers beyond the numbers themselves."
        : "Angle analysis is limited — no creative descriptions were provided, so this is metrics only."
    );
  }

  return { winners: winnerNotes, losers: loserNotes };
}

/** Real-account review — one insight line when most ads never got a
 *  fair read. Restates analysis.spreadThin; never a decision input. */
function buildSpreadThin(analysis: AnalysisResult): { spreadThin?: string } {
  const t = analysis.spreadThin;
  if (!t) return {};
  const nouns = outcomeNounsFor(analysis);
  const avg = `avg ${fmtMoney(t.avgSpend, analysis.currency)} per ad`;
  const vs = t.costPerOutcome != null && nouns != null ? ` vs ${fmtMoney(t.costPerOutcome, analysis.currency)} cost per ${nouns.one}` : "";
  return {
    spreadThin: `Spend is spread thin: ${fmtCount(t.thin)} of ${fmtCount(t.total)} ads never reached the minimum spend (${avg}${vs}). Fewer ads per ad set would give each a fair read.`,
  };
}

/** Real-account fix 8 — formats analysis.namingPatterns for the report
 *  and TXT. Absent key when there's no convention (byte-identical). */
function buildNamingPatterns(analysis: AnalysisResult): { namingPatterns?: MemoNamingPatterns } {
  const n = analysis.namingPatterns;
  if (!n) return {};
  const money = (v: number) => fmtMoney(v, analysis.currency);
  const nouns = outcomeNounsFor(analysis);
  const kpiLabel = kpiLabelFor(analysis);
  return {
    namingPatterns: {
      intro: `${n.coverage.matched} of ${n.coverage.total} ${n.basis === "tokens" ? "ads" : "judged ads"} use ${
        n.basis === "tokens" ? "[KEY]VALUE name tokens" : "one \"_\"-separated name layout"
      }. Per value: every ad carrying it (set-aside ads included), blended ${kpiLabel}; values with under ${money(n.minSpend)} of spend (2× the minimum spend) or on a single ad are left out.`,
      coverageLine: `Covers ${Math.round(n.coverage.judgedSpendShare * 100)}% of judged spend.`,
      caveat: "Descriptive only — a value's blended result is an association in this export, not proof the token caused it.",
      kpiLabel,
      outcomeLabel: nouns ? nouns.many.charAt(0).toUpperCase() + nouns.many.slice(1) : null,
      keys: n.keys.map((k) => ({
        key: n.basis === "tokens" ? `[${k.key}]` : k.key,
        rows: k.rows.map((r) => ({
          value: r.value,
          ads: r.ads,
          spendLabel: money(r.spend),
          outcomesLabel: nouns && r.outcomes != null ? fmtCount(r.outcomes) : nouns ? "—" : null,
          kpiValueLabel: r.kpiValue != null ? fmtKpiValue(r.kpiValue, analysis.kpi, analysis.currency) : "—",
        })),
      })),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Market / competitor context (manually pasted text only).            */
/*                                                                     */
/* The text is scanned for known creative-strategy terms — formats,    */
/* hooks, offers — via the shared keyword map in marketSignals.ts      */
/* (the same table the generator's "Structure notes" button uses),     */
/* with the same keyword-matching honesty as ad-name tags: we only     */
/* restate what the user wrote, grouped. No scraping, no inference     */
/* about competitor spend or performance, ever. Own account data       */
/* stays the primary signal; market context can only REFRAME a test,   */
/* not create a claim.                                                 */
/* ------------------------------------------------------------------ */

const MARKET_CAVEAT =
  `Market context is directional — it does not confirm competitor spend or performance. ${MARKET_SIGNALS_DISCLOSURE}`;

/** 2–4 bullets restating the user's own market notes, plus the fixed
 *  directional caveat. Null when no context was pasted — the memo is
 *  then identical to a run without this feature. */
function buildMarketSignal(
  analysis: AnalysisResult,
  context: DebriefContext
): MemoMarketSignal | null {
  const text = context.marketContext.trim();
  if (text === "") return null;

  const signals = extractMarketSignals(text);
  const top = analysis.winners[0] ?? null;
  const bullets: string[] = [];

  if (signals.formats.length > 0) {
    bullets.push(
      `Formats observed in the market: ${signals.formats.join(", ")}.`
    );
  }
  if (signals.hooks.length > 0) {
    bullets.push(
      `Hooks repeating across the notes: ${signals.hooks.join(", ")} — an observed pattern, not verified performance.`
    );
  }
  if (signals.offers.length > 0) {
    bullets.push(`Offers in circulation: ${signals.offers.join(", ")}.`);
  }

  if (bullets.length === 0) {
    const snippet = text.length > 120 ? `${text.slice(0, 117)}…` : text;
    bullets.push(
      `Notes captured: "${snippet}" — carried into the next tests as directional context.`
    );
  }

  /* What seems worth adapting — always tied back to own data. */
  if (top && signals.has("founder-led") && !isFounderLed(top)) {
    bullets.push(
      `Worth testing: a founder-led take on "${top.name}"'s leading angle — adapt, don't copy.`
    );
  } else if (top && signals.has("bundle")) {
    bullets.push(
      `Worth testing: "${top.name}"'s leading angle with a bundle offer variant.`
    );
  } else if (top && signals.formats.length > 0) {
    bullets.push(
      `Worth testing: the ${signals.formats[0]} pattern applied to "${top.name}"'s angle — your own numbers stay the primary signal.`
    );
  } else {
    bullets.push(
      `These notes shape the angle tests below — your own account data stays the primary signal.`
    );
  }

  return {
    bullets: bullets.slice(0, 4),
    caveat: MARKET_CAVEAT,
    /* assessMarketNotes never returns null for non-empty text. */
    quality: assessMarketNotes(text)!,
  };
}

/** The most common format tag in a group, or null. `confirmed` counts
 *  how many of those ads carry a user-confirmed format (Creative Format
 *  Confirmation) rather than a name guess — 0 on any run without
 *  confirmations, keeping legacy wording untouched. */
function dominantTag(
  group: RankedAd[]
): { tag: string; count: number; confirmed: number } | null {
  const counts = new Map<string, { count: number; confirmed: number }>();
  for (const ad of group) {
    for (const tag of ad.nameTags) {
      const entry = counts.get(tag) ?? { count: 0, confirmed: 0 };
      entry.count += 1;
      if (ad.formatConfirmed) entry.confirmed += 1;
      counts.set(tag, entry);
    }
  }
  let best: { tag: string; count: number; confirmed: number } | null = null;
  for (const [tag, entry] of counts.entries()) {
    if (!best || entry.count > best.count) best = { tag, ...entry };
  }
  return best;
}

/** True when the ad is already founder-fronted — via a confirmed
 *  "founder-led" format or a founder-ish name tag. */
const isFounderLed = (ad: RankedAd): boolean =>
  ad.nameTags.some((t) => t.startsWith("founder"));

/** For the third test slot when no scale move is justified: pick a
 *  structured challenger to the winning format, so the test creates
 *  new pattern data instead of iterating in place. Deterministic. */
const FORMAT_CHALLENGERS: Record<string, string> = {
  testimonial: "the same testimonial format with a different customer segment",
  video: "a static distilled from the video's strongest claim",
  static: "a 15-second video cut of the top static",
  "before/after": "the same transformation told by the customer on camera (UGC)",
  carousel: "the carousel's first card as a standalone static",
  "discount/promo": "a value-led version where the discount is the closer, not the hook",
  urgency: "the same offer without the urgency framing",
  /* Reachable only via user-confirmed formats — ad names never
     produce these tags. */
  "founder-led": "a customer-voiced (UGC) version of the founder story",
  "product shot": "the product shown in real use instead of the studio shot",
  comparison: "the winning claim stated on its own, without the comparison frame",
};

/** Real-account fix 7 — the creative formats a challenger is drawn from,
 *  in tie-break order, and how a challenger built in each is phrased. */
const CHALLENGER_FORMATS = ["ugc", "video", "static", "carousel"] as const;
type ChallengerFormat = (typeof CHALLENGER_FORMATS)[number];
/** Static and motion are the two families a challenger switches between. */
const FORMAT_FAMILY: Record<string, "static" | "motion"> = { static: "static", ugc: "motion", video: "motion" };
const OPPOSITE_FORMATS: Record<"static" | "motion", readonly ChallengerFormat[]> = {
  static: ["ugc", "video"],
  motion: ["static"],
};
const CHALLENGER_PHRASE: Record<ChallengerFormat, string> = {
  ugc: "a creator-shot UGC version of the control's message",
  video: "a video version of the control's message",
  static: "a static-image version of the control's message",
  carousel: "a carousel version of the control's message",
};

/**
 * Real-account fix 7 — the format challenger is grounded in THIS
 * account, never a stock suggestion (a real export with UGC winners was
 * told to test "a founder/expert explainer video" it had never run):
 *  1. a format that already places among the winners, other than the
 *     control's (most winner slots first) — "worth more budget?"; else
 *  2. a format clearly missing — no judged ad carries it, while the
 *     names do carry format tags — "never tested"; else
 *  3. the control tag's structural challenger (FORMAT_CHALLENGERS), or
 *     a plain "different creative format".
 * `basis` (1 and 2 only) says which, in one clause, for the why/signals.
 *
 * Real-account review: never the control's own format FAMILY — a static
 * control gets a UGC or video challenger, a UGC/video control a static
 * one (a real export's static control was challenged with "a
 * static-image version"). With a known family, step 3 is the first
 * opposite format.
 */
function chooseChallenger(
  winners: readonly RankedAd[],
  judged: readonly RankedAd[],
  controlTag: string | null,
  fallback: string
): { text: string; format: string | null; basis: string | null } {
  const count = (ads: readonly RankedAd[], f: string) => ads.filter((a) => a.nameTags.includes(f)).length;
  const family = controlTag != null ? FORMAT_FAMILY[controlTag] : undefined;
  const allowed: readonly ChallengerFormat[] = family
    ? OPPOSITE_FORMATS[family]
    : CHALLENGER_FORMATS.filter((f) => f !== controlTag);
  const inWinners = allowed.filter((f) => count(winners, f) > 0).sort(
    (a, b) => count(winners, b) - count(winners, a)
  );
  if (inWinners.length > 0) {
    const f = inWinners[0];
    return {
      text: CHALLENGER_PHRASE[f],
      format: f,
      basis: `${formatLabel(f)} already places among your winners (${count(winners, f)}/${winners.length})`,
    };
  }
  const tagged = judged.some((a) => a.nameTags.some((t) => (CHALLENGER_FORMATS as readonly string[]).includes(t)));
  const missing = tagged ? allowed.filter((f) => count(judged, f) === 0) : [];
  if (missing.length > 0) {
    const f = missing[0];
    return {
      text: CHALLENGER_PHRASE[f],
      format: f,
      basis: `the account has no ${formatLabel(f)} ads among the judged ones yet`,
    };
  }
  if (family) {
    const f = allowed[0];
    return { text: CHALLENGER_PHRASE[f], format: f, basis: `the control is ${formatLabel(controlTag!)}, so the challenger is a different format` };
  }
  return { text: (controlTag && FORMAT_CHALLENGERS[controlTag]) ?? fallback, format: null, basis: null };
}

/** The control's format, for the challenger: the format tag of the ad
 *  the memo builds on, else the winners' dominant tag. */
function controlFormatOf(lead: RankedAd | null, winnerTag: string | null): { tag: string | null; fromLead: boolean } {
  const own = lead?.nameTags.find((t) => (CHALLENGER_FORMATS as readonly string[]).includes(t)) ?? null;
  return own != null ? { tag: own, fromLead: true } : { tag: winnerTag, fromLead: false };
}

/** Shot / asset direction per creative format — structural direction
 *  only (what to show, how to open), never invented claims, quotes,
 *  offers, or competitor facts. Reused across brief kinds. */
const ASSET_DIRECTION: Record<string, string[]> = {
  "founder-led": [
    "Founder on camera, speaking straight to lens — phone-grade is fine, authenticity beats polish.",
    "Natural setting (workspace, home) — no studio look.",
    "Burned-in captions; assume sound-off viewing.",
    "Cut or reframe every 2–3 seconds to hold attention.",
    "End card: product + the offer exactly as it exists today.",
  ],
  ugc: [
    "Creator-shot, handheld phone footage — native to feed, not produced.",
    "Product in real use within the first 3 seconds.",
    "Voiceover or captions carrying the angle's core line.",
    "Imperfect lighting is acceptable — polish reads as an ad.",
    "End card: the offer as it exists today.",
  ],
  testimonial: [
    "Use existing customer review language verbatim — never invented quotes.",
    "Attribute only with permission; initials are enough.",
    "Open on the review's strongest line, not the product.",
    "Simple treatment — the words are the creative.",
    "Close with product shot + current offer.",
  ],
  static: [
    "One message per image — the angle's core claim, nothing else.",
    "Visual hierarchy: hook line first, product second, offer last.",
    "First read must land in under 2 seconds.",
    "No more than ~10 words of copy on the image.",
  ],
  carousel: [
    "Card 1 must work standalone — hook + visual, no setup required.",
    "One idea per card; the sequence tells the angle start to finish.",
    "Design cards to be read out of order — most viewers won't swipe in sequence.",
    "Repeat the offer only on the final card.",
  ],
  "problem-first": [
    "First frame states the problem plainly — no brand, no product yet.",
    "Agitate briefly (1–2 beats), then introduce the product as the turn.",
    "Keep the problem in the customer's words, not marketing language.",
    "The offer appears only after the solution beat — closer, not hook.",
    "Burned-in captions; assume sound-off viewing.",
  ],
  video: [
    "Open mid-action — no logo or title card in the first 3 seconds.",
    "Burned-in captions; assume sound-off viewing.",
    "One idea per cut; re-hook visually every 3–5 seconds.",
    "End card: product + the offer exactly as it exists today.",
  ],
  /* Reachable only via user-confirmed formats (Creative Format
     Confirmation) — name tags never produce these. */
  "product shot": [
    "One hero frame: the product sharp, large, and unobstructed.",
    "Show scale and texture — context props only if they clarify use.",
    "Hook line as short overlay text; the product stays the visual.",
    "First read must land in under 2 seconds.",
    "Offer stated plainly, once — never stacked on the hero frame.",
  ],
  comparison: [
    "Split-frame or sequential A/B — make the two sides instantly readable.",
    "Compare only on claims that already exist — never invented competitor facts.",
    "Lead with the dimension the viewer cares about, not the product name.",
    "Keep labels plain; the contrast does the talking.",
    "End card: product + the offer exactly as it exists today.",
  ],
};

const directionFor = (tag: string | null | undefined): string[] =>
  (tag && ASSET_DIRECTION[tag]) || ASSET_DIRECTION.video;

/**
 * Next tests are CREATIVE tests. Budget movement lives in the verdict
 * and the losers section; at most one scaling action appears here, and
 * only when the data strongly supports it (top winner ≥30% past the
 * median). The other slots are always angle/format iterations tied to
 * named ads and their numbers. The 30% bar itself now lives in
 * decision.ts (SCALE_TEST_MIN_DELTA_PCT, imported above) so the memo
 * and the Next-move decision can never disagree about what earns a
 * budget move.
 */

function buildNextTests(
  analysis: AnalysisResult,
  context: DebriefContext,
  /** Criteria Coherence fix: the user's decision criteria, forwarded so
   *  the T3 slot's budget action is gated by the SAME shared rule the
   *  committed decision uses (isScaleActionSupported) — the memo can
   *  never propose a scale the decision withholds. */
  criteria: DecisionCriteria
): MemoTest[] {
  const {
    winners,
    losers,
    median,
    kpi,
    currency,
    spendGate,
    hasNameSignal,
    belowBenchmarkSpend,
    belowBenchmarkCount,
  } = analysis;
  const adsSetAside = spendSetAside(analysis);
  const kpiLabel = kpiLabelFor(analysis);
  const medianLabel = median != null ? fmtKpiValue(median, kpi, currency) : "the benchmark";
  const gateLabel = fmtMoney(spendGate, currency);
  /* Tester Feedback Fix 4: setup lines say where the minimum comes from. */
  const gateSetupLabel = `${gateLabel} (${spendGateSource(analysis, (v) => fmtMoney(v, currency)).short})`;
  const tests: MemoTest[] = [];

  /* First-Run Robustness 3a: in a proxy run (CTR/CPC/Purchases/Leads)
     with an outcome column, never build a test on an ad that's below
     median on the outcome KPI, nor "rebuild" an ad that's above it. The
     first test then moves to the outcome leader (see T1 below); the
     rebuild test is dropped rather than retargeted — its copy calls the
     ad "the account's weakest judged ad", which only losers[0] is. */
  const outcome = analysis.proxyKpi?.outcome ?? null;
  const proxyConflict = isProxyOutcomeConflict(analysis);
  /* Real-account follow-up: T1 builds on the PRIMARY RECEIVER when the
     receiver floor passed the raw leader over — that ad appears only as
     a watch note on T1. */
  const top = proxyConflict ? null : evidenceLead(analysis, criteria);
  const passedOver = proxyConflict ? null : passedOverLeader(analysis, criteria);
  /* Real-account review: the leader is passed over either for failing
     the receiver floor or for ranking lower once purchases are weighed. */
  const rawFirstReceiver = analysis.winners.find(
    (w) => w.deltaPct != null && w.deltaPct >= SCALE_TEST_MIN_DELTA_PCT && passesReceiverFloor(w, analysis, criteria)
  );
  /* True also when the leader failed the floor but the evidence
     adjustment (not raw ROAS) then picked the base among the rest. */
  const overByEvidence =
    passedOver != null && (passedOverReason(analysis, criteria) === "evidence" || (rawFirstReceiver != null && rawFirstReceiver !== top));
  const leadBasis = overByEvidence ? "the strongest evidence-adjusted result" : "the strongest result that clears the receiver floor";
  const worstCandidate = losers[0] ?? null; // losers arrive sorted worst-first
  const worst =
    worstCandidate && outcome && outcome.aboveMedian.includes(worstCandidate.name) ? null : worstCandidate;
  const skipRebuild = worstCandidate != null && worst == null;
  /* Real-account fix 7: a static ad has no "opening 3 seconds" — its
     opening is the headline and first visual. */
  const openingUnit = (name: string) =>
    analysis.rankedAds.find((a) => a.name === name)?.nameTags.includes("static")
      ? "headline / first visual"
      : "opening 3 seconds / first frame";
  const winnerTag = dominantTag(winners);

  /* Evidence Sufficiency V1 — Brief Readiness. Computed once (per test
     slot, not per branch) and attached only to T1 (winner-iteration)
     and T2 (loser-rebuild) below — the two slots that actually claim
     an observed win/loss pattern is worth briefing creative against.
     T3 never carries this: its scale branch is a budget-elasticity
     test (no new creative claimed), and its fallback branches propose
     a fresh, not-yet-observed format/offer — neither makes the kind of
     claim brief readiness qualifies. Decision-blind and comparison-
     blind by construction — briefReadiness.ts reads only AnalysisResult
     facts, never memo.comparison. */
  const outcomeNouns = outcomeNounsFor(analysis);
  const winnerReadiness = deriveSignalVolumeReadiness(
    analysis,
    criteria,
    outcomeNouns?.one ?? "result",
    outcomeNouns?.many ?? "results"
  );
  const loserReadiness = deriveLossConfidenceReadiness(
    analysis,
    context.targetCpa,
    criteria,
    (v) => fmtMoney(v, currency)
  );
  /* Hypothesis Framing Coherence V1 — reads ONLY the already-computed
     Brief Readiness state above; no new evidence calculation, no
     duplicated threshold. "ready" (or no readiness attached at all —
     T3's budget-elasticity test and the fresh-challenger fallbacks
     never claim an observed creative pattern, so there's nothing to
     soften) keeps every hypothesis's confident "we expect X" phrasing
     unchanged. "directional"/"insufficient" swap the expectation
     clause to explicitly provisional "we want to test whether X"
     phrasing on T1/T2's hypotheses ONLY — the sentence's own epistemic
     claim then matches the evidence already computed for it, instead
     of reading identically strong regardless. Structurally, whenever
     Evidence Diagnostic fires for the winner, winnerThin is already
     true by construction (deriveSignalVolumeReadiness's own floor/
     null-count rules never return "ready" under either of Evidence
     Diagnostic's activation conditions) — so this alone already keeps
     the hypothesis coherent with Evidence Diagnostic's presence too,
     without a second, redundant check. Never touches the committed
     decision, the underlying facts, or the "because" clause that
     follows each expectation — that clause states an observed fact
     either way, not a confidence claim. */
  const winnerThin = winnerReadiness != null && winnerReadiness.state !== "ready";
  const loserThin = loserReadiness != null && loserReadiness.state !== "ready";

  /* Evidence Diagnostic V1 — bounded to T1 only (analysis.winners[0],
     the same ad T1 anchors). A third, decision-blind question distinct
     from Brief Readiness above: not "is this observed win strong
     enough to brief against" but "the primary KPI's own evidence on
     this ad is too thin to trust — what upstream signal, already in
     this export, is worth inspecting?" Buyer-only by design; see
     evidenceDiagnostic.ts for the full contract. */
  const evidenceDiagnostic = deriveEvidenceDiagnostic(analysis, (v) => fmtMoney(v, currency), top);

  /* Market context (when pasted) may REFRAME a test — own performance
     data stays the primary signal, and every market-informed line says
     so. Null when the field was left empty, in which case every branch
     below is byte-identical to the pre-market-context engine. */
  const market =
    context.marketContext.trim() === ""
      ? null
      : extractMarketSignals(context.marketContext);

  /* Compact signal bullets — the receipts behind each recommendation.
     Built only from what the data actually shows: own numbers first,
     market notes always marked directional, guardrails last. */
  const topConversions =
    top && outcomeNouns && top.conversions != null
      ? ` with ${fmtCount(top.conversions)} ${top.conversions === 1 ? outcomeNouns.one : outcomeNouns.many}`
      : "";
  const topSignal = top
    ? passedOver
      ? `"${top.name}" runs at ${fmtKpiValue(top.kpiValue as number, kpi, currency)} ${kpiLabel} (${fmtDeltaVsMedian(top.deltaFromMedian, top.deltaPct)}) on ${fmtMoney(top.spend, currency)} spend${topConversions} — ${overByEvidence ? "the strongest evidence-adjusted result" : "the strongest ad that clears the receiver floor"}.`
      : `"${top.name}" leads at ${fmtKpiValue(top.kpiValue as number, kpi, currency)} ${kpiLabel} (${fmtDeltaVsMedian(top.deltaFromMedian, top.deltaPct)}) on ${fmtMoney(top.spend, currency)} spend.`
    : null;
  /* The passed-over leader: a watch note on T1 only, never its base. */
  const watchNote = passedOver
    ? ` Watch: "${passedOver.name}" leads at ${fmtKpiValue(passedOver.kpiValue as number, kpi, currency)} ${kpiLabel} but on ${fmtMoney(passedOver.spend, currency)}${
        outcomeNouns && passedOver.conversions != null ? ` and ${fmtCount(passedOver.conversions)} ${passedOver.conversions === 1 ? outcomeNouns.one : outcomeNouns.many}` : ""
      } — ${passedOverReason(analysis, criteria) === "evidence" ? "fewer purchases pull it below the receivers once results are evidence-adjusted" : "under the receiver floor"}, so it isn't the base for this test.`
    : "";
  const zeroMany = outcomeNouns?.many ?? "conversions";
  const worstSignal = worst
    ? worst.zeroConversions
      ? `"${worst.name}" spent ${fmtMoney(worst.spend, currency)} with 0 ${zeroMany}.`
      : `"${worst.name}" spent ${fmtMoney(worst.spend, currency)} and ran ${fmtDeltaVsMedian(worst.deltaFromMedian, worst.deltaPct)}.`
    : null;
  const tagSignal = winnerTag
    ? `${winnerTag.tag} ads hold ${winnerTag.count}/${winners.length} winner slots${
        winnerTag.confirmed > 0
          ? ` (${winnerTag.confirmed} format${winnerTag.confirmed === 1 ? "" : "s"} user-confirmed)`
          : ""
      }.`
    : null;
  const belowSignal =
    belowBenchmarkCount > 0
      ? `Combined ${fmtMoney(belowBenchmarkSpend, currency)} spent below the median across ${fmtCount(belowBenchmarkCount)} ad${belowBenchmarkCount === 1 ? "" : "s"}.`
      : null;
  const gateSignal =
    adsSetAside > 0
      ? `${adsSetAside} thin-spend ad${adsSetAside === 1 ? " was" : "s were"} set aside, not judged.`
      : null;
  /* Tester Feedback Fix 3: Debrief never sees creative content, so an
     "opening" test is a hypothesis, not a diagnosis. Without a hook-
     level metric in the export the copy says the export can't show
     whether the opening is the issue; with one, it names the column(s)
     so each variant's opening can be compared directly. */
  const hookCols = analysis.hookMetricColumns ?? [];
  const hookColsLabel = hookCols.map((h) => `"${h}"`).join(" / ");
  const openingEvidence =
    hookCols.length > 0
      ? `This export includes ${hookColsLabel}, so compare each version's opening on that as well as on ${kpiLabel}.`
      : "This export has no hook-level metric (3-second video plays, ThruPlays), so it can't show whether the opening is what's holding the result back or pushing it forward.";
  const sig = (...items: (string | null | false | undefined)[]) =>
    items
      .filter((s): s is string => typeof s === "string" && s !== "")
      .slice(0, 4);

  /* ---- Creative-brief scaffolding (deterministic, shared) ---- */
  const product = context.product || "the product";
  const offerLabel = context.offer ? `"${context.offer}"` : "the current offer";
  const typicalLabel =
    median != null
      ? `the ${medianLabel} typical result`
      : "the account benchmark (once enough ads reach the minimum spend to set one)";
  const successMetric =
    kpi === "cpa" && context.targetCpa != null
      ? `CPA below your ${fmtMoney(context.targetCpa, currency)} target once the ~${gateLabel} minimum spend is reached.`
      : kpi === "roas" && context.targetRoas != null
        ? `ROAS above your ${context.targetRoas.toFixed(2)}x target once the ~${gateLabel} minimum spend is reached.`
        : kpi === "ctr"
          ? `CTR above ${typicalLabel} once the ~${gateLabel} minimum spend is reached, without cost per click worsening materially.`
          : `${kpiLabel} ${HIGHER_IS_BETTER[kpi] ? "above" : "below"} ${typicalLabel} once the ~${gateLabel} minimum spend is reached.`;
  /* Creative / brand constraints the user typed (tone, geo, claims to
     avoid, required offer language). Surfaced as a brief guardrail so
     the hand-off respects them — never touches scoring, ranking, or the
     gate. Empty field → empty array → briefs byte-identical to before. */
  const creativeConstraints = context.creativeNotes.trim();
  const constraintSnippet =
    creativeConstraints.length > 140
      ? `${creativeConstraints.slice(0, 137)}…`
      : creativeConstraints.replace(/\.+$/, ""); // avoid a double period before the close-quote
  const constraintGuardrail: string[] = creativeConstraints
    ? [
        `Honor the creative / brand constraints you provided: "${constraintSnippet}".`,
      ]
    : [];
  const briefGuardrails = (marketInformed: boolean): string[] => [
    `Do not judge before ~${gateLabel} of spend — below the minimum spend the ad is set aside, not failed.`,
    `Do not scale until the test beats ${typicalLabel} by ${SCALE_TEST_MIN_DELTA_PCT}%+.`,
    ...(marketInformed
      ? [
          "Do not copy competitor ads directly — adapt the observed pattern to your own claim.",
        ]
      : []),
    ...constraintGuardrail,
  ];
  const basisNote = (marketInformed: boolean): string =>
    marketInformed
      ? "Own performance data leads this brief; market notes shaped it directionally only."
      : market
        ? "Based mostly on your own performance data — the market notes didn't change this test."
        : "Based on your own performance data — no market notes were provided.";

  /* T1 — iterate the proven winner (creative). */
  const outcomeLeader =
    proxyConflict && outcome?.leader
      ? analysis.rankedAds.find((a) => a.name === outcome.leader!.name) ?? null
      : null;
  if (proxyConflict && outcome && outcome.leader && outcomeLeader) {
    /* 3a: the proxy leaders sit below median on results — build the
       first test on the OUTCOME leader instead, and say why. No brief
       readiness: its volume/lead read was measured on the proxy. */
    const L = outcome.leader;
    const signals = sig(
      `"${L.name}" leads on ${outcome.label} at ${L.valueLabel}; the ${outcome.label} median is ${outcome.medianLabel}.`,
      `On ${kpiLabel}, the leading ads sit below the median on ${outcome.label}.`,
      gateSignal
    );
    const outcomeMetric = `${outcome.label} ${outcome.kpi === "roas" ? "above" : "below"} ${outcome.medianLabel} once the ~${gateLabel} minimum spend is reached.`;
    tests.push({
      test: `Brief 2 new variants of "${L.name}" — the leader on ${outcome.label} — varying only the opening.`,
      why: `On ${kpiLabel}, the leading ads sit below the median on ${outcome.label} (${outcome.medianLabel}), so a test built on them would chase ${kpiLabel} rather than results. "${L.name}" leads on ${outcome.label} at ${L.valueLabel} — one way to test whether that angle has more headroom: vary only the opening. ${openingEvidence}`,
      setup: `Same audience, placement, and offer as the original. ~${gateSetupLabel} per variant so each reaches the minimum spend. Change only the ${openingUnit(L.name)} between variants.`,
      winningLooksLike: `At least one variant beats ${outcome.medianLabel} ${outcome.label} within 7 days — read it on ${outcome.label}, not ${kpiLabel}.`,
      signals,
      hypothesis: `If we change only the opening while holding "${L.name}"'s angle, ${offerLabel}, and audience constant, we want to test whether at least one variant beats ${outcome.medianLabel} ${outcome.label} — because "${L.name}" leads this export on ${outcome.label} at ${L.valueLabel}.`,
      brief: {
        title: `Opening variants of "${L.name}"`,
        objective: `Learn whether the leading ${outcome.label} angle has more headroom by varying only the opening.`,
        basedOn: signals,
        concept: `Two variants of the ${outcome.label} leader: identical angle, offer, and audience — only the opening changes.`,
        hooks: [
          `Cold-open on the angle's payoff moment — the outcome "${L.name}" sells, before any context.`,
          `Question open: turn the angle's core promise for ${product} into a direct question in the first line.`,
          "Text-led open: the angle's strongest existing line as bold on-screen text before any footage.",
        ],
        assetDirection: directionFor(outcomeLeader.nameTags[0]),
        keepConstant: `The angle, ${offerLabel}, audience, and placements of "${L.name}" — the configuration it ran while it led on ${outcome.label}.`,
        change: `Only the ${openingUnit(L.name)} — nothing else.`,
        successMetric: outcomeMetric,
        guardrails: briefGuardrails(false),
        basisNote: basisNote(false),
      },
    });
  } else if (top) {
    const format = winnerTag && top.nameTags.includes(winnerTag.tag) ? `${winnerTag.tag} ` : "";
    const founderLed =
      (market?.has("founder-led") ?? false) && !isFounderLed(top);
    const signals = sig(
      topSignal,
      tagSignal,
      founderLed && "Market notes mention founder-led video — directional.",
      gateSignal
    );
    tests.push({
      test: founderLed
        ? `Brief 2 new ${format}variants of "${top.name}" — make one a founder-led version (market signal); vary only the opening on the other.`
        : `Brief 2 new ${format}variants of "${top.name}" — vary only the opening to test whether the angle has more headroom.`,
      why: `${
        passedOver
          ? `It's the strongest ad with the evidence to build on: ${fmtKpiValue(top.kpiValue as number, kpi, currency)} ${kpiLabel} (${fmtDeltaVsMedian(top.deltaFromMedian, top.deltaPct)}) on ${fmtMoney(top.spend, currency)} spend${topConversions}.`
          : `It leads the account at ${fmtKpiValue(top.kpiValue as number, kpi, currency)} ${kpiLabel} (${fmtDeltaVsMedian(top.deltaFromMedian, top.deltaPct)}) on ${fmtMoney(top.spend, currency)} spend — the strongest observed result in the current dataset.`
      } One way to test whether the angle has more headroom: vary only the opening. ${openingEvidence}${
        founderLed
          ? " Your market notes flag founder-led video as an observed pattern — worth testing as an adaptation of this leading angle. Adapt, don't copy."
          : ""
      }${watchNote}`,
      setup: `Same audience, placement, and offer as the original. ~${gateSetupLabel} per variant so each reaches the minimum spend. Change only the ${openingUnit(top.name)} between variants.`,
      winningLooksLike: `At least one variant beats the ${medianLabel} median ${kpiLabel} within 7 days.`,
      signals,
      hypothesis: `If we change only the opening while holding "${top.name}"'s angle, ${offerLabel}, and audience constant, ${winnerThin ? "we want to test whether at least one variant beats" : "we expect at least one variant to beat"} ${medianLabel} — because "${top.name}" ${passedOver ? "already runs at" : "already leads this dataset at"} ${fmtKpiValue(top.kpiValue as number, kpi, currency)} ${kpiLabel} on ${fmtMoney(top.spend, currency)} spend${passedOver ? `${topConversions}, ${leadBasis}` : ""}.`,
      briefReadiness: winnerReadiness ?? undefined,
      evidenceDiagnostic: evidenceDiagnostic ?? undefined,
      brief: {
        title: founderLed
          ? `Founder-led variant of the "${top.name}" angle`
          : `Hook variants of "${top.name}"`,
        objective:
          "Learn whether the account's leading angle has more headroom by varying only the opening.",
        basedOn: signals,
        concept: `Two variants of the winning ad: identical angle, offer, and audience — only the opening changes.${
          founderLed
            ? " One variant is fronted by the founder, adapting an observed market pattern onto this leading angle."
            : ""
        }`,
        hooks: [
          `Cold-open on the angle's payoff moment — the outcome "${top.name}" sells, before any context.`,
          `Question open: turn the angle's core promise for ${product} into a direct question in the first line.`,
          founderLed
            ? `Founder to camera: a one-sentence "why we built this" open, then cut into this leading angle (market signal — adapt, don't copy).`
            : "Text-led open: the angle's strongest existing line as bold on-screen text before any footage.",
        ],
        assetDirection: directionFor(
          founderLed
            ? "founder-led"
            : winnerTag && top.nameTags.includes(winnerTag.tag)
              ? winnerTag.tag
              : top.nameTags[0]
        ),
        keepConstant: `The angle, ${offerLabel}, audience, and placements of "${top.name}" — the configuration it ran while it out-performed; the test isolates whether the angle is the reason.`,
        change: founderLed
          ? "Only the opening: one variant gets a new hook, the other gets the founder-led front."
          : `Only the ${openingUnit(top.name)} — nothing else.`,
        successMetric,
        guardrails: briefGuardrails(founderLed),
        basisNote: basisNote(founderLed),
      },
    });
  } else {
    const marketAngles = (market && market.hooks.length > 0) ?? false;
    const signals = sig(
      `No ad beat the ${medianLabel} median ${kpiLabel} this period.`,
      marketAngles &&
        market != null &&
        `Market notes mention ${market.hooks.join(", ")} — directional.`,
      gateSignal
    );
    tests.push({
      test: `Brief 3 deliberately distinct angles${context.product ? ` for ${context.product}` : ""}: problem-led, social-proof-led, and offer-led.`,
      why: `No ad beat the ${medianLabel} median this period — flat results mean the account needs new angles, not more budget behind existing ones.${
        marketAngles && market != null
          ? ` Your market notes point the same way (${market.hooks.join(", ")}) — directional support for the problem-led slot.`
          : ""
      }`,
      setup: `Matched budget (~${gateSetupLabel} per ad), same audience and placement across all three, so the angle is the only variable.`,
      winningLooksLike: `At least one angle clears ${gateLabel} spend and beats ${medianLabel}.`,
      signals,
      hypothesis: `If we run three deliberately different angles at matched budget while holding audience, placement, and offer constant, we expect at least one to clear ${gateLabel} spend and beat ${medianLabel} — because no ad in the current dataset has separated from the median yet, so the next signal has to come from a new angle, not more spend behind an existing one.`,
      brief: {
        title: "Angle exploration: problem-led vs social-proof vs offer-led",
        objective: `Find a first winning angle — nothing beat ${typicalLabel} this period, so the account needs new direction, not iteration.`,
        basedOn: signals,
        concept: `Three deliberately different ads for ${product}: one leads with the problem, one with social proof, one with the offer. Same audience and budget, so the angle is the only variable.`,
        hooks: [
          `Problem-led: open on the problem in the customer's own words — no product in the first beat.${marketAngles ? " (Problem-first opens repeat in your market notes — directional.)" : ""}`,
          "Social-proof-led: open on evidence you already have — real review language or real usage numbers, never invented.",
          `Offer-led: state ${offerLabel} plainly in the first line — no build-up.`,
        ],
        assetDirection: [
          "Same format across all three ads (whichever ships fastest) — the angle stays the only variable.",
          "Open each ad inside its angle within 2 seconds — no shared intro.",
          "Use only claims, reviews, and offer terms that already exist.",
          "Burned-in captions; assume sound-off viewing.",
          "Identical end card across all three: product + current offer.",
        ],
        keepConstant: `Audience, placement, budget (~${gateLabel} each), and the live offer.`,
        change: "The angle — problem-led vs social-proof-led vs offer-led. Nothing else.",
        successMetric,
        guardrails: briefGuardrails(marketAngles),
        basisNote: basisNote(marketAngles),
      },
    });
  }

  /* T2 — rebuild the worst judged ad (creative), before killing the
     angle outright. */
  if (worst) {
    const worstStats = `${fmtKpiValue(worst.kpiValue as number, kpi, currency)} ${kpiLabel} (${fmtDeltaVsMedian(worst.deltaFromMedian, worst.deltaPct)}) on ${fmtMoney(worst.spend, currency)} spend`;
    const problemFirst = market?.has("problem-first") ?? false;
    if (worst.zeroConversions) {
      /* Tester Feedback Fix 2: the weakest judged ad recorded nothing —
         there is no value to "beat", so the test is whether a rebuilt
         version converts at all. States the fact only; never why. */
      const spent = fmtMoney(worst.spend, currency);
      const signals = sig(worstSignal, belowSignal);
      tests.push({
        test: `Test one rebuilt version of "${worst.name}" before it gets more budget — it spent ${spent} with 0 ${zeroMany}.`,
        why: `It spent ${spent}, past the ~${gateLabel} minimum spend, with 0 ${zeroMany} — the weakest result among ads past the minimum spend. The data shows that it didn't convert, not why, so one controlled rebuild is the cheapest way to learn whether anything in it is worth keeping.`,
        setup: `Pause or reduce the original. One rebuild at ~${gateSetupLabel}, same audience, placement, and offer — change one element of the creative so the result is readable.`,
        winningLooksLike: `The rebuild records ${zeroMany} and reaches ${medianLabel} or better; if it records none again by ~${gateLabel}, retire the angle.`,
        signals,
        hypothesis: `If we rebuild "${worst.name}" while holding audience, offer, and placement constant, we want to test whether it records ${zeroMany} at all — because the original spent ${spent} with 0 ${zeroMany}.`,
        briefReadiness: loserReadiness ?? undefined,
        brief: {
          title: `Rebuild of "${worst.name}"`,
          objective: `Learn whether a rebuilt version of this ad records any ${zeroMany} — one controlled rebuild before the angle is retired.`,
          basedOn: signals,
          concept: `The same offer and audience with one creative element changed — the original spent ${spent} with 0 ${zeroMany}.`,
          hooks: [
            "Payoff-first open: move the ad's strongest moment into second one.",
            `Question open: the angle's promise for ${product} as a direct question.`,
            "Text-led open: the core existing line as bold on-screen text before any footage.",
          ],
          assetDirection: directionFor(worst.nameTags[0]),
          keepConstant: `Audience, placement, and ${offerLabel}.`,
          change: "One creative element — so the result can be attributed to it.",
          successMetric,
          guardrails: briefGuardrails(false),
          basisNote: basisNote(false),
        },
      });
    } else if (worst.nameTags.includes("discount/promo")) {
      const signals = sig(
        worstSignal,
        belowSignal,
        problemFirst && "Market notes flag problem-first hooks — directional."
      );
      tests.push({
        test: `Rebuild "${worst.name}" so the hook leads with the problem and the discount becomes the closer.`,
        why: `An offer-led ad running ${worstStats} suggests the discount alone isn't earning attention — worth testing whether leading with the problem lets the price close instead.${
          problemFirst
            ? " Problem-first hooks also repeat in your market notes — an observed pattern worth adapting to your own claim, not copying."
            : ""
        }`,
        setup: `Reduce the original's spend (it's in the losers list). Launch the rebuild at ~${gateSetupLabel} with the same audience, placement, and offer — creative is the only change.`,
        winningLooksLike: `The rebuild beats the original's ${fmtKpiValue(worst.kpiValue as number, kpi, currency)} and closes to within 20% of ${medianLabel}.`,
        signals,
        hypothesis: `If we rebuild "${worst.name}" leading with the problem instead of the discount, while holding the offer, audience, and placement constant, ${loserThin ? "we want to test whether it closes toward" : "we expect it to close toward"} ${medianLabel} — because the current version ran ${worstStats}, and an offer-led opening on a discount ad is a common reason a discount alone isn't earning attention.`,
        briefReadiness: loserReadiness ?? undefined,
        brief: {
          title: `Problem-first rebuild of "${worst.name}"`,
          objective:
            "Learn whether changing the hook improves performance while keeping the discount comparable — one rebuild before the angle is retired.",
          basedOn: signals,
          concept:
            "Rebuild of the discount ad: the opening sells the problem, the discount moves to the end as the closer. Same offer, same audience.",
          hooks: [
            `Open on the problem the product solves — plainly, no price in the first beat.${problemFirst ? " (Problem-first opens repeat in your market notes — directional.)" : ""}`,
            "Product-first open: show it in real use before any offer language.",
            "Cost-of-inaction open: what staying with the status quo costs — the discount arrives only as the resolution.",
          ],
          assetDirection: [
            ...ASSET_DIRECTION["problem-first"].slice(0, 4),
            `Keep the discount exactly as it exists (${offerLabel}) — never a new or bigger offer.`,
          ],
          keepConstant: "The offer itself, audience, and placement — only the creative changes.",
          change: "The order of information: problem first, discount last.",
          successMetric,
          guardrails: briefGuardrails(problemFirst),
          basisNote: basisNote(problemFirst),
        },
      });
    } else if (winnerTag && !worst.nameTags.includes(winnerTag.tag)) {
      const signals = sig(
        worstSignal,
        tagSignal,
        problemFirst && "Market notes flag problem-first hooks — directional."
      );
      tests.push({
        test: `Reshoot "${worst.name}"'s message in the ${winnerTag.tag} format carrying your winners.`,
        why: `The message got ${fmtMoney(worst.spend, currency)} of spend but ran ${fmtDeltaVsMedian(worst.deltaFromMedian, worst.deltaPct)}, while ${winnerTag.tag} ads hold ${winnerTag.count}/${winners.length} winner slots — test whether changing the format improves performance while keeping the message comparable.${
          problemFirst
            ? " Give the reshoot a problem-first opening — a repeating pattern in your market notes (directional)."
            : ""
        }`,
        setup: `Reduce the original's spend. Launch the ${winnerTag.tag} version at ~${gateSetupLabel}, same audience and offer.`,
        winningLooksLike: `The reshoot beats the original's ${fmtKpiValue(worst.kpiValue as number, kpi, currency)} ${kpiLabel} and approaches ${medianLabel}.`,
        signals,
        hypothesis: `If we reshoot "${worst.name}"'s message as ${winnerTag.tag} while holding the message, audience, and offer constant, ${loserThin ? "we want to test whether it approaches" : "we expect it to approach"} ${medianLabel} — because ${winnerTag.tag} ads already hold ${winnerTag.count}/${winners.length} winner slots in this dataset, while the loser ran ${fmtDeltaVsMedian(worst.deltaFromMedian, worst.deltaPct)} on ${fmtMoney(worst.spend, currency)} spend.`,
        briefReadiness: loserReadiness ?? undefined,
        brief: {
          title: `${winnerTag.tag} reshoot of "${worst.name}"`,
          objective:
            "Learn whether changing the format improves performance while keeping the message comparable — the same message rebuilt in the format carrying your winners.",
          basedOn: signals,
          concept: `The loser's message reshot as ${winnerTag.tag} — the format holding ${winnerTag.count}/${winners.length} winner slots. Message, audience, and offer stay identical.`,
          hooks: [
            `Restate the original ad's core message in the first 2 seconds of the ${winnerTag.tag} treatment.`,
            "Open on the strongest single claim the original buried — earn attention before detail.",
            problemFirst
              ? "Problem-first open on the pain point behind the message (observed market pattern — directional)."
              : "Contrast open: show the before-state the message speaks to, then turn.",
          ],
          assetDirection: directionFor(winnerTag.tag),
          keepConstant: `The message, audience, and offer of "${worst.name}".`,
          change: `The format only — rebuilt as ${winnerTag.tag}, matching your winners.`,
          successMetric,
          guardrails: briefGuardrails(problemFirst),
          basisNote: basisNote(problemFirst),
        },
      });
    } else {
      const signals = sig(
        worstSignal,
        belowSignal,
        problemFirst && "Market notes flag problem-first hooks — directional."
      );
      tests.push({
        test: problemFirst
          ? `Rebuild "${worst.name}" with a problem-first opening hook (observed market pattern) before writing the angle off.`
          : `Rebuild "${worst.name}" with a new opening hook before writing the angle off.`,
        why: `At ${worstStats} it's the account's weakest judged ad. One way to test whether the angle is worth keeping: rebuild only the opening and see whether the result moves. ${openingEvidence}${
          problemFirst
            ? " Your market notes flag problem-first hooks as a repeating pattern — directional, and the cheapest place to test it."
            : ""
        }`,
        setup: `Reduce the original's spend. One rebuild at ~${gateSetupLabel}, changing only the hook — same body, audience, and offer.`,
        winningLooksLike: `The rebuild beats ${fmtKpiValue(worst.kpiValue as number, kpi, currency)} ${kpiLabel} clearly; if it doesn't, retire the angle.`,
        signals,
        hypothesis: `If we change only the opening hook while holding "${worst.name}"'s body, audience, offer, and placement constant, ${loserThin ? "we want to test whether it clearly beats" : "we expect it to clearly beat"} ${fmtKpiValue(worst.kpiValue as number, kpi, currency)} ${kpiLabel} — because at ${worstStats} it's the account's weakest judged ad, and changing only the opening is the cheapest controlled way to learn whether the result moves with it.`,
        briefReadiness: loserReadiness ?? undefined,
        brief: {
          title: `Hook rebuild of "${worst.name}"`,
          objective:
            "Learn whether changing only the opening moves the result — one rebuild before retiring the angle.",
          basedOn: signals,
          concept: `The same ad with a new opening${problemFirst ? ", built problem-first (observed market pattern)" : ""} — body, audience, and offer untouched.`,
          hooks: [
            problemFirst
              ? "Problem-first open: state the pain point plainly before the product appears (market notes — directional)."
              : "Payoff-first open: move the ad's strongest moment into second one.",
            `Question open: the angle's promise for ${product} as a direct question.`,
            "Text-led open: the core existing line as bold on-screen text before any footage.",
          ],
          assetDirection: directionFor(worst.nameTags[0]),
          keepConstant: `Everything after the opening — body, audience, placement, and ${offerLabel}.`,
          change: "Only the opening hook.",
          successMetric,
          guardrails: briefGuardrails(problemFirst),
          basisNote: basisNote(problemFirst),
        },
      });
    }
  } else if (!skipRebuild) {
    const pick = chooseChallenger(winners, analysis.rankedAds, controlFormatOf(top, winnerTag?.tag ?? null).tag, "a new creative format");
    const challenger = pick.text;
    const signals = sig(
      "No judged ad is failing clearly this period.",
      tagSignal,
      pick.basis && `Challenger: ${pick.basis}.`,
      gateSignal
    );
    tests.push({
      test: `Test ${challenger} against your current best ad as control.`,
      why: hasNameSignal
        ? `Nothing is clearly failing, so the next signal comes from challenging the dominant format rather than fixing losers.`
        : `Nothing is clearly failing and no format pattern is visible yet — a controlled format test creates the pattern data future debriefs need.`,
      setup: `One challenger, one control, matched budget (~${gateSetupLabel} each), same audience and offer.`,
      winningLooksLike: `The challenger clears ${gateLabel} spend and beats ${medianLabel}.`,
      signals,
      hypothesis: `If we test ${challenger} against the current best ad at matched budget while holding message, audience, and offer constant, we expect the challenger to clear ${gateLabel} spend and beat ${medianLabel} — because no ad is clearly failing this period, so the next signal has to come from a controlled format comparison rather than fixing a loser.`,
      brief: {
        title: `Format challenger: ${challenger}`,
        objective:
          "Learn whether the format or the message is doing the work — one controlled format-vs-format test against the current best ad.",
        basedOn: signals,
        concept: `${challenger.charAt(0).toUpperCase()}${challenger.slice(1)} carrying the control ad's exact message, tested head-to-head at matched budget.`,
        hooks: [
          "Translate the control ad's core message into the challenger format's native opening.",
          "Keep the first line of copy identical to the control — the format stays the only variable.",
          "Open inside the new format's strength (motion for video, one bold claim for static) with the same message.",
        ],
        assetDirection: [
          `Build: ${challenger}.`,
          ...(ASSET_DIRECTION[pick.format ?? "video"] ?? ASSET_DIRECTION.video).slice(0, 4),
        ],
        keepConstant: "Message, audience, offer, and budget parity with the control.",
        change: "The format only.",
        successMetric,
        guardrails: briefGuardrails(false),
        basisNote: basisNote(false),
      },
    });
  }

  /* T3 — the ONLY slot a budget action may occupy, and only when the
     winner's lead is emphatic. Otherwise: a structured format
     challenger (creative again). */
  /* Criteria Coherence fix: the ONE budget action this section may
     contain is gated by the shared decision rule — not by the raw %
     bar alone. A lead past the bar whose move the committed call
     withholds (too few judged ads, or below the user's own outcome
     minimum) falls through to the creative challenger instead. */
  const scaleJustified = isScaleActionSupported(analysis, criteria);
  /* First-Run Robustness 3c: scale + cut ⇒ the committed call is a
     SHIFT that already moves budget into the leader — a separate "scale
     by a single moderate step" test would be a second, conflicting
     budget move. The slot goes to the creative challenger instead. */
  const shiftCommitted = scaleJustified && isCutActionSupported(analysis);
  const leadPastBar =
    top != null && top.deltaPct != null && top.deltaPct >= SCALE_TEST_MIN_DELTA_PCT;
  /* Real-account fix 2: budget goes to the receivers — the best ads past
     the bar AND the receiver evidence floor — which may not be the raw
     leader. Every budget sentence below names them, never `top`. */
  const receivers = budgetReceivers(analysis, criteria);
  const quoted = receivers.map((r) => `"${r.name}"`);
  const receiverList =
    quoted.length <= 1 ? quoted.join("") : `${quoted.slice(0, -1).join(", ")} and ${quoted[quoted.length - 1]}`;
  const scaleTarget = receivers[0] ?? null;
  if (scaleJustified && scaleTarget && !shiftCommitted) {
    const top = scaleTarget;
    const topSignal = `"${top.name}" ${top === winners[0] ? "leads" : "runs"} at ${fmtKpiValue(top.kpiValue as number, kpi, currency)} ${kpiLabel} (${fmtDeltaVsMedian(top.deltaFromMedian, top.deltaPct)}) on ${fmtMoney(top.spend, currency)} spend.`;
    const signals = sig(
      topSignal,
      `The lead clears the ${SCALE_TEST_MIN_DELTA_PCT}% bar this memo requires before any budget move.`
    );
    tests.push({
      test: `Scale "${top.name}" daily budget by a single moderate step.`,
      why: `The one budget move this data strongly supports: ${fmtDeltaVsMedian(top.deltaFromMedian, top.deltaPct)} on ${fmtMoney(top.spend, currency)} already spent. The clearest budget signal is concentrated in the leading ad; investigate the remaining gaps through controlled creative tests before making broader budget moves.`,
      setup: `Raise the budget in a single step, then hold for 5–7 days. No creative or audience edits while measuring, so scaling is the only variable.`,
      winningLooksLike: `${kpiLabel} stays within 15% of ${fmtKpiValue(top.kpiValue as number, kpi, currency)} at the higher spend.`,
      signals,
      hypothesis: `If we raise "${top.name}"'s daily budget by a single moderate step while holding its creative, audience, and placements constant, we expect ${kpiLabel} to stay within 15% of ${fmtKpiValue(top.kpiValue as number, kpi, currency)} — because it already leads this dataset ${fmtDeltaVsMedian(top.deltaFromMedian, top.deltaPct)} on ${fmtMoney(top.spend, currency)} of real spend, past the ${SCALE_TEST_MIN_DELTA_PCT}% bar this memo requires before any budget move.`,
      brief: {
        title: `Scale readiness: "${top.name}"`,
        objective: `Learn whether the winner holds its ${fmtKpiValue(top.kpiValue as number, kpi, currency)} ${kpiLabel} at a moderately higher spend level.`,
        basedOn: signals,
        concept:
          "No new creative launches — this is a budget-elasticity test. Prepare (don't launch) two refresh openings so a fatigue dip can be answered fast once the window closes.",
        hooks: [
          "Refresh A (prepare only): same angle, new opening scene — ready to swap if frequency climbs.",
          "Refresh B (prepare only): same angle, text-led open — held in reserve.",
          "Launch neither refresh during the measurement window — the live ad stays untouched.",
        ],
        assetDirection: [
          `No edits to "${top.name}" while measuring — creative, audience, and placements stay frozen.`,
          "Raise the budget in a single moderate step, then hold 5–7 days.",
          "Watch frequency and early-drop-off for fatigue signals.",
          "Produce both refresh openings now; launch only after the window closes.",
        ],
        keepConstant: "Everything about the live ad — this is a budget test, not a creative one.",
        change: "Daily budget only, one step up.",
        successMetric: `${kpiLabel} stays within 15% of ${fmtKpiValue(top.kpiValue as number, kpi, currency)} at the higher spend.`,
        guardrails: [
          "Do not change creative or audience during the 5–7 day window — scaling must stay the only variable.",
          `If ${kpiLabel} drifts more than 15%, step the budget back — no chasing with edits mid-window.`,
          ...constraintGuardrail,
        ],
        basisNote: basisNote(false),
      },
    });
  } else if (top && market?.has("bundle")) {
    /* Market-informed offer variant on the proven angle — still a
       creative/offer test, never a budget action. */
    const signals = sig(
      topSignal,
      "Market notes mention bundle offers — directional."
    );
    tests.push({
      test: `Test "${top.name}"'s leading angle with a bundle offer variant (market signal).`,
      why: `Bundle offers repeat in your market notes while the account runs ${context.offer ? `"${context.offer}"` : "a single offer"} — an offer variant on the angle already leading at ${fmtKpiValue(top.kpiValue as number, kpi, currency)} ${kpiLabel} is the cheapest adaptation to test. Directional only: the notes don't show how competitors' ads performed.`,
      setup: `Same creative and audience as "${top.name}"; only the offer changes to a bundle. ~${gateSetupLabel} until it reaches the minimum spend.`,
      winningLooksLike: `The bundle variant clears ${gateLabel} spend and beats the ${medianLabel} median ${kpiLabel}.`,
      signals,
      hypothesis: `If we swap only the offer to a bundle while holding "${top.name}"'s creative and audience constant, we expect it to clear ${gateLabel} spend and beat ${medianLabel} — because bundle offers repeat in your market notes (directional) and the angle already leads at ${fmtKpiValue(top.kpiValue as number, kpi, currency)} ${kpiLabel}, making an offer swap the cheapest adaptation to test.`,
      brief: {
        title: `Bundle offer variant of "${top.name}"`,
        objective:
          "Learn whether a bundle offer lifts the leading angle — the offer is the only variable.",
        basedOn: signals,
        concept:
          "The winning creative and audience with the offer switched to a bundle — adapting an offer pattern observed in your market notes (directional).",
        hooks: [
          `Keep the winning ad's opening untouched — the bundle appears at the offer beat, not the hook.`,
          "Value-stack open: show the bundle contents together before any price framing.",
          `Same-hook A/B: an opening identical to "${top.name}" so the offer is the only difference.`,
        ],
        assetDirection: [
          "Show every bundle component together in one frame — clarity beats cleverness.",
          "Use only bundle terms that actually exist — never imply extra discounts.",
          `Match the creative structure of "${top.name}" shot-for-shot where possible.`,
          "End card: the bundle offer stated plainly.",
          "Burned-in captions; assume sound-off viewing.",
        ],
        keepConstant: `The creative, audience, and opening of "${top.name}".`,
        change: `The offer only — from ${offerLabel} to a bundle variant.`,
        successMetric,
        guardrails: briefGuardrails(true),
        basisNote: basisNote(true),
      },
    });
  } else {
    const control = controlFormatOf(top, winnerTag?.tag ?? null);
    const pick = chooseChallenger(winners, analysis.rankedAds, control.tag, "a deliberately different creative format");
    const challenger = pick.text;
    /* The control is the ad T1 builds on whenever its format is known —
       so T3 never challenges a static control with another static. */
    const controlLabel =
      control.fromLead && top != null
        ? `"${top.name}" (${formatLabel(control.tag!)}) as the control`
        : `your ${winnerTag ? `${winnerTag.tag} ads` : "current best ad"} as the control`;
    const signals = sig(
      tagSignal ?? "No format is clearly winning yet.",
      topSignal,
      pick.basis && `Challenger: ${pick.basis}.`,
      gateSignal
    );
    tests.push({
      test: `Test ${challenger} against ${controlLabel}.`,
      why: shiftCommitted
        ? `The shift above is this debrief's one budget move — it already moves budget into ${receiverList}. Alongside it, a structured challenger against it as the control builds the next comparison; launch it once the shift has ~${gateLabel} of fresh spend.`
        : leadPastBar
        ? `"${top!.name}" leads past the ${SCALE_TEST_MIN_DELTA_PCT}% bar, but this debrief doesn't commit a budget move yet (see Next move) — a structured challenger builds comparison data while that evidence firms up.`
        : winnerTag
          ? `${winnerTag.tag} ads hold ${winnerTag.count}/${winners.length} winner slots but the lead isn't decisive — a structured challenger shows whether the format or the message is doing the work.`
          : `No format is clearly winning${hasNameSignal ? "" : " and names carry no format signal"} — the fastest way to a pattern is one controlled format-vs-format test.${context.creativeNotes ? ` Use your notes ("${context.creativeNotes.slice(0, 60)}…") to pick the challenger.` : ""}`,
      setup: `Launch the challenger at ~${gateSetupLabel} alongside the control, same audience and offer, until both reach the minimum spend.`,
      winningLooksLike: `The challenger clears ${gateLabel} spend and beats ${medianLabel}.`,
      signals,
      hypothesis: `If we launch ${challenger} at matched budget alongside the current control while holding audience and offer constant, we expect it to clear ${gateLabel} spend and beat ${medianLabel} — because ${shiftCommitted ? `the shift above is already the budget move, so the next signal has to come from a controlled creative comparison` : leadPastBar ? `"${top!.name}" leads past the ${SCALE_TEST_MIN_DELTA_PCT}% bar but this debrief isn't committing a budget move on it yet, so a structured challenger builds comparison data while that evidence firms up` : winnerTag ? `${winnerTag.tag} ads hold ${winnerTag.count}/${winners.length} winner slots but the lead isn't decisive enough to say the format itself is the reason` : "no format is clearly winning yet, so a controlled comparison is the fastest way to a real pattern"}.`,
      brief: {
        title: `Format challenger: ${challenger}`,
        objective:
          "Learn whether the format or the message is doing the work — one controlled format-vs-format test against the current control.",
        basedOn: signals,
        concept: `${challenger.charAt(0).toUpperCase()}${challenger.slice(1)} carrying the control ad's exact message, tested head-to-head at matched budget.`,
        hooks: [
          "Translate the control ad's core message into the challenger format's native opening.",
          "Keep the first line of copy identical to the control — the format stays the only variable.",
          "Open inside the new format's strength (motion for video, one bold claim for static) with the same message.",
        ],
        assetDirection: [
          `Build: ${challenger}.`,
          ...(ASSET_DIRECTION[pick.format ?? "video"] ?? ASSET_DIRECTION.video).slice(0, 4),
        ],
        keepConstant: "Message, audience, offer, and budget parity with the control.",
        change: "The format only.",
        successMetric,
        guardrails: briefGuardrails(false),
        basisNote: basisNote(false),
      },
    });
  }

  return tests;
}

/**
 * "What not to do" — anti-recommendations from the same deterministic
 * facts the tests use. Each bullet exists only when its condition holds
 * in the data (or market notes were actually provided); nothing generic
 * ever appears. Buyer register keeps the shorthand; client register
 * stays jargon-free ("typical result", no "kill"/"spend gate").
 */
function buildAvoid(
  analysis: AnalysisResult,
  context: DebriefContext,
  /** Criteria Coherence fix: the committed decision — the budget-
   *  discipline lines follow it instead of re-deriving eligibility
   *  from the raw % bar (which implied a scale was sanctioned even
   *  when the decision withheld it). */
  decision: MemoDecision
): { buyer: string[]; client: string[] } {
  const { winners, losers, median, kpi, currency, spendGate } = analysis;
  const adsSetAside = spendSetAside(analysis);
  const kpiLabel = kpiLabelFor(analysis);
  const medianLabel = median != null ? fmtKpiValue(median, kpi, currency) : null;
  const top = winners[0] ?? null;
  const worst = losers[0] ?? null;
  const hasMarket = context.marketContext.trim() !== "";
  const buyer: string[] = [];
  const client: string[] = [];

  /* Loser-side: don't feed what's failing. */
  if (worst && worst.nameTags.includes("discount/promo")) {
    buyer.push(
      `Do not launch more discount-led ads until a rebuilt version has been tested — "${worst.name}" ${
        worst.zeroConversions
          ? `spent ${fmtMoney(worst.spend, currency)} with 0 ${outcomeNounsFor(analysis)?.many ?? "conversions"}`
          : `ran ${fmtDeltaVsMedian(worst.deltaFromMedian, worst.deltaPct)}`
      }.`
    );
    client.push(
      `We're not creating more discount-first ads until the message is rebuilt — the current one runs below the middle ad.`
    );
  } else {
    const loserTag = dominantTag(losers);
    /* Real-account fix 7: only when NO ad of that format sits in the top
       half of the judged ranking — a format that also places near the
       top isn't failing as a format (a real export warned off UGC while
       UGC ads led it). */
    const ranked = [...analysis.rankedAds].sort((a, b) => b.deltaFromMedian - a.deltaFromMedian);
    const topHalf = ranked.slice(0, Math.ceil(ranked.length / 2));
    if (loserTag && loserTag.count >= 2 && !topHalf.some((a) => a.nameTags.includes(loserTag.tag))) {
      buyer.push(
        `Do not move budget into ${loserTag.tag} ads while they hold ${loserTag.count}/${losers.length} loser slots.`
      );
      client.push(
        `We're not adding budget to ${loserTag.tag}-style ads while they run below the middle ad.`
      );
    }
  }

  /* Budget discipline — voiced from the committed decision, never the
     raw % bar alone. "Scale only the leader" appears iff the decision
     actually contains a scale/shift; a lead past the bar whose move
     was withheld (hold, or the user's outcome minimum) gets an
     explicit don't-scale-yet line instead of implied permission. */
  const scaleSide = decision.action === "budget" && decision.budgetVariant !== "cut";
  if (top && top.deltaPct != null) {
    if (scaleSide) {
      /* Real-account fix 2: the ads the move goes INTO — the receivers,
         which may not be the raw leader and may be up to three. */
      const to = decision.budgetMove?.to.map((t) => t.name) ?? [top.name];
      const quoted = to.map((n) => `"${n}"`);
      const list = quoted.length <= 1 ? quoted.join("") : `${quoted.slice(0, -1).join(", ")} and ${quoted[quoted.length - 1]}`;
      const where = to.length === 1 && to[0] === top.name ? "the leading ad" : to.length === 1 ? "that ad" : "those ads";
      buyer.push(
        `Do not scale anything except ${list} yet — the clearest budget signal is concentrated in ${where}; investigate the remaining gaps through controlled creative tests before broader budget moves.`
      );
      client.push(
        `We're only increasing budget behind ${list} for now — the clearest case for more budget is ${where}. For the remaining ads, controlled creative tests are safer than broader budget changes.`
      );
    } else if (top.deltaPct >= SCALE_TEST_MIN_DELTA_PCT) {
      buyer.push(
        `Do not scale "${top.name}" yet — its lead clears the ${SCALE_TEST_MIN_DELTA_PCT}% bar, but the committed call is not a scale move (see Next move).`
      );
      client.push(
        `We're not increasing any budgets yet — including the current leader's; the decision above explains why.`
      );
    } else {
      buyer.push(
        `Do not scale budgets on this lead — "${top.name}" is ${Math.round(top.deltaPct)}% better than the median, under the ${SCALE_TEST_MIN_DELTA_PCT}% bar a scale move needs.`
      );
      client.push(
        `We're not increasing budgets yet — the current lead isn't decisive enough to scale safely.`
      );
    }
  } else if (!top && medianLabel) {
    buyer.push(
      `Do not add budget to existing ads — nothing beat the ${medianLabel} median ${kpiLabel} this period.`
    );
    client.push(
      `We're not adding budget to current ads — none pulled clearly ahead this period.`
    );
  }

  /* Guardrail: thin-spend ads stay unjudged. */
  if (adsSetAside > 0) {
    buyer.push(
      `Do not judge the ${adsSetAside} low-spend ad${adsSetAside === 1 ? "" : "s"} yet — below the ${fmtMoney(spendGate, currency)} minimum spend they're set aside, not failed.`
    );
    client.push(
      `We're not judging the ${adsSetAside} ad${adsSetAside === 1 ? "" : "s"} that ${adsSetAside === 1 ? "hasn't" : "haven't"} spent enough yet — they get a fair read once the data is there.`
    );
  }

  /* Market honesty. */
  if (hasMarket) {
    buyer.push(
      `Do not treat market context as confirmed competitor performance — it's directional only.`
    );
    client.push(
      `We're not treating market observations as proof of what works — they steer tests only.`
    );
  }

  return { buyer: buyer.slice(0, 4), client: client.slice(0, 4) };
}

/** The verdict in client language: what happened, what it means, what
 *  we'll do — same facts as tldr, no buyer shorthand ("kill",
 *  "benchmark", "spend gate"). TLDR Coherence fix: like buildTldr, the
 *  action sentences follow the committed decision — never a budget
 *  promise the Next-move card didn't make. */
function buildClientSummary(analysis: AnalysisResult, decision: MemoDecision): string[] {
  const { winners, losers, median, kpi, currency, belowBenchmarkSpend, belowBenchmarkCount } =
    analysis;
  const kpiLabel = kpiClientLabelFor(analysis);
  const lines: string[] = [];
  const scaleSide = decision.action === "budget" && decision.budgetVariant !== "cut";
  const cutSide = decision.action === "budget" && decision.budgetVariant !== "scale";

  const receivers = scaleSide ? moveReceivers(analysis, decision) : [];
  const middle = median != null ? fmtKpiValue(median, kpi, currency) : "n/a";
  if (receivers.length > 0) {
    const top = receivers[0];
    lines.push(
      receivers.length === 1 && top === winners[0]
        ? `Your strongest ad this period was "${top.name}" at ${fmtKpiValue(top.kpiValue as number, kpi, currency)} ${kpiLabel} — clearly ahead of the middle ad (${middle}). It earns a larger share of the budget.`
        : receivers.length === 1
        ? `"${top.name}" was clearly ahead of the middle ad (${middle}) at ${fmtKpiValue(top.kpiValue as number, kpi, currency)} ${kpiLabel}, with real results behind it. It earns a larger share of the budget.`
        : `${receivers.length} ads were clearly ahead of the middle ad (${middle}) with real results behind them, led by "${top.name}" at ${fmtKpiValue(top.kpiValue as number, kpi, currency)} ${kpiLabel}. They earn a larger share of the budget.`
    );
  } else if (winners.length > 0) {
    const top = winners[0];
    lines.push(
      `Your strongest ad this period was "${top.name}" at ${fmtKpiValue(top.kpiValue as number, kpi, currency)} ${kpiLabel} — ahead of the middle ad (${middle}). It hasn't pulled far enough ahead to earn more budget yet — the next step is set out above.`
    );
  } else if (median != null) {
    lines.push(
      `No single ad pulled clearly ahead this period — performance was flat across the account, so the focus shifts to finding a new winning idea rather than shuffling budget.`
    );
  } else {
    lines.push(
      analysis.kpiGaps
        ? `Most ads don't have a ${kpiClientLabelFor(analysis)} figure to compare yet, so this report is directional rather than conclusive.`
        : `Most ads hadn't spent enough yet to judge fairly, so this report is directional rather than conclusive.`
    );
  }

  const split = trimSplit(analysis);
  if (losers.length > 0 && cutSide && split.held > 0) {
    /* Real-account review: the trim count, never the whole below-median
       pool, with the near-median holds named as staying put. */
    lines.push(
      `${fmtCount(split.trims.length)} ad${split.trims.length === 1 ? "" : "s"} performed well below the middle ad, together accounting for ${fmtMoney(split.trimSpend, currency)} of spend — we're reducing or pausing their budgets so that money works harder. ${clientHeldClause(split.held)}`
    );
  } else if (losers.length > 0) {
    const facts = `${fmtCount(belowBenchmarkCount)} ad${belowBenchmarkCount === 1 ? "" : "s"} performed below the middle ad, together accounting for ${fmtMoney(belowBenchmarkSpend, currency)} of spend.`;
    lines.push(
      cutSide
        ? `${facts} We're reducing or pausing their budgets so that money works harder.`
        : `${facts} We're keeping their budgets steady for now — the decision above explains the next step.`
    );
  } else {
    lines.push(
      `No ad underperformed badly enough to pause — budgets stay where they are while the next tests run.`
    );
  }

  if (decision.action === "hold" && decision.holdReason === "insufficient_data") {
    lines.push(
      `Next, we're letting the data build before making changes — this report gets rerun once enough ads have had a fair read.`
    );
  } else if (decision.action === "hold" && decision.holdReason === "flat_performance") {
    lines.push(
      `Next, we're letting the current ads keep running — changing things now would be reacting to noise.`
    );
  } else {
    lines.push(
      `Next, we're testing new creative built on what this data shows works — the specific tests are listed below.`
    );
  }

  return lines;
}

/* Input Honesty V1: confidence is derived ONLY from structural facts
   (sample size, group sizes, column completeness, name-tag pattern) —
   never from the mere presence of arbitrary free text. hasCreativeNotes
   and marketContext presence are deliberately NOT read here; providing
   notes (of any content, including nonsense) must never raise, lower,
   or otherwise alter confidence.level, .reasons, or .notes. hasNameSignal
   is kept because it's a structural fact derived from ad NAMES across a
   group, not user prose. */
/** Trust Pass 3b — ONE confidence scale. The card shows evidenceState;
 *  the confidence section's level is that same read on a three-word
 *  scale, never a second, independently-computed verdict:
 *    supported → high · limited → medium · insufficient → low.
 *  Reasons are drawn from the exact conditions behind evidenceState
 *  (deriveEvidenceState in decision.ts). */
export const CONFIDENCE_FROM_EVIDENCE = {
  supported: "high",
  limited: "medium",
  insufficient: "low",
} as const;

function buildConfidence(
  analysis: AnalysisResult,
  decision: MemoDecision,
  criteria?: DecisionCriteria
): Memo["confidence"] {
  const { adsJudged, adsAnalyzed, winners, losers, median, hasNameSignal, missingColumns, spendGate, currency, belowBenchmarkSpend } =
    analysis;
  const flat = decision.evidenceShape === "flatness";
  const adsSetAside = spendSetAside(analysis);
  const notes: string[] = [];
  /* Evidence Confidence V2 (hoisted — also drives the level cap below):
     when the volume floor or short-window qualifier binds, that fact IS
     a caveat, so it joins the notes and the "no caveats apply" fallback
     below structurally cannot fire alongside it. */
  const volumeBelowFloor = isOutcomeVolumeBelowFloor(analysis, criteria);
  const windowDays = analysisWindowDays(analysis);
  /* Real-account follow-up: the volume story is about the ad the read
     stands on — the primary receiver when the leader was passed over —
     and a Shift/Scale cites every receiver's own count. */
  const subject = volumeSubject(analysis, criteria);
  const weakest = weakestReceiver(analysis, criteria);
  const subjectRole =
    weakest != null
      ? "The weakest ad receiving budget"
      : subject != null && subject !== winners[0]
        ? "The primary receiving ad"
        : "The leading ad";
  /* Confidence follow-up: "high" only when every receiver has ≥3× the
     purchase floor; otherwise medium, and this says why. */
  const belowHighBar = isReceiverVolumeBelowHighBar(analysis, criteria);
  const receiverAds =
    decision.action === "budget"
      ? (decision.budgetMove?.to ?? [])
          .map((t) => analysis.rankedAds.find((a) => a.name === t.name))
          .filter((a): a is RankedAd => a != null)
      : [];

  if (adsSetAside > 0) {
    notes.push(
      `${adsSetAside} of ${adsAnalyzed} ads ${adsSetAside === 1 ? "was" : "were"} set aside for insufficient spend (below ${fmtMoney(spendGate, currency)}) — excluded from winners/losers, not penalized.`
    );
  }
  if (analysis.outcomeFloor && analysis.outcomeFloor.setAside.length > 0) {
    const f = analysis.outcomeFloor;
    const k = f.setAside.length;
    notes.push(
      `${k} of ${adsAnalyzed} ads ${k === 1 ? "was" : "were"} set aside by your minimum of ${f.min} ${f.nouns.many} — excluded from winners/losers, not penalized.`
    );
  }
  if (analysis.kpiGaps) {
    const { noValue } = analysis.kpiGaps;
    notes.push(
      `${noValue} of ${adsAnalyzed} ads had no ${kpiLabelFor(analysis)} value to compare — excluded from winners/losers, not penalized.`
    );
  }
  if (missingColumns.includes("Ad name")) {
    notes.push("Ad name column wasn't found — ads are labeled generically (Ad 1, Ad 2, …).");
  }
  if (missingColumns.includes("Reporting date range")) {
    notes.push("CSV didn't include a reporting date range — treating all rows as one period.");
  }
  if (median == null) {
    notes.push("Not enough ads reached the minimum spend to compute a reliable benchmark.");
  }
  if (volumeBelowFloor && subject?.conversions != null) {
    const n = Math.round(subject.conversions);
    notes.push(
      `${subjectRole} has ${n} recorded result${n === 1 ? "" : "s"} — under the ${MIN_OUTCOMES_FOR_SUPPORTED}-result noise floor, so thin outcome volume is the main caveat on this read.`
    );
  }
  if (windowDays != null && windowDays < SHORT_WINDOW_DAYS) {
    notes.push(
      `This export covers ${windowDays} day${windowDays === 1 ? "" : "s"} — short windows weigh day-to-day swings more heavily.`
    );
  }

  /* Evidence Confidence V2: the SAME noise floor that caps the evidence
     label also caps confidence at medium — one consistent story; "high
     confidence" can never sit beside a thin-outcome-volume limit
     (volumeBelowFloor hoisted above, where it also feeds the notes). */
  const level: "high" | "medium" | "low" = CONFIDENCE_FROM_EVIDENCE[decision.evidenceState];

  if (notes.length === 0) {
    notes.push("Data was complete enough that no caveats apply beyond the usual: more days of spend always sharpens the read.");
  }

  /* Why the level landed where it did — derived from the exact same
     conditions that set it, so the explanation can never contradict
     the verdict. Buyer register as bullets; one plain sentence for the
     client view. */
  const reasons: string[] = [];
  let clientWhy: string;
  const leadAd = evidenceLead(analysis, criteria);
  const leadRole = leadAd != null && leadAd !== winners[0] ? "The primary receiving ad" : "The top winner";
  const topPct = leadAd?.deltaPct ?? null;
  /* Real-account review: "most ads had enough spend" only when it's
     true — at least half the analyzed ads were judged. */
  const mostJudged = adsAnalyzed > 0 && adsJudged / adsAnalyzed >= 0.5;
  const highBar = HIGH_CONFIDENCE_OUTCOME_MULTIPLE * receiverOutcomeMin(criteria);
  const receiverCount = decision.budgetMove?.to.length ?? 0;
  /* The "N+ sales" claim needs every receiver's count in the export. */
  const receiversVerified =
    receiverCount > 0 &&
    budgetReceivers(analysis, criteria).every((r) => r.conversions != null && r.conversions >= highBar);
  const salesWord = outcomeNounsFor(analysis)?.many === "leads" ? "leads" : "sales";

  if (level === "high" && flat) {
    reasons.push(
      `${adsJudged} of ${adsAnalyzed} ads reached the minimum spend — a fair sample to judge.`
    );
    reasons.push(
      "Every judged ad sits close to the median — a consistent flat read, not a missing signal."
    );
    clientWhy = mostJudged
      ? "Confidence is high because most ads had enough spend to compare, and they performed consistently close to one another."
      : "Confidence is high because the ads with enough spend to compare performed consistently close to one another.";
  } else if (level === "high") {
    reasons.push(
      `${adsJudged} of ${adsAnalyzed} ads reached the minimum spend — a fair sample to judge.`
    );
    if (topPct != null && topPct >= 30) {
      reasons.push(
        `${leadRole} is ${Math.round(topPct)}% better than the median — a clear observed lead within this dataset.`
      );
    }
    if (losers.length > 0 && belowBenchmarkSpend > 0) {
      reasons.push(
        `${fmtMoney(belowBenchmarkSpend, currency)} sat below the median — the cut side is material.`
      );
    }
    clientWhy = mostJudged
      ? "Confidence is high because most ads had enough spend to judge fairly and the gap between what worked and what didn't is clear."
      : receiversVerified
        ? `Confidence is high because the ${receiverCount === 1 ? "ad getting more budget has" : "ads getting more budget each have"} ${highBar}+ ${salesWord} behind ${receiverCount === 1 ? "it" : "them"} and the gap to the rest is clear.`
        : "Confidence is high because the ads with enough spend to compare show a clear gap between what worked and what didn't.";
  } else if (level === "medium") {
    if (adsJudged < 10) {
      reasons.push(
        `Only ${adsJudged} ads reached the minimum spend — patterns can still shift as more spend lands.`
      );
    }
    if (!flat && (winners.length < 3 || losers.length < 3)) {
      reasons.push(
        `The winner/loser groups are small (${winners.length} vs ${losers.length}) — one ad can swing the read.`
      );
    }
    if (missingColumns.length > 0) {
      reasons.push(
        `The export was missing ${missingColumns.length} column${missingColumns.length === 1 ? "" : "s"} — parts of the read are less precise.`
      );
    }
    if (!hasNameSignal) {
      // Context, not a cause of the level (evidenceState ignores names).
      reasons.push(
        analysis.namingPatterns
          ? "Ad names follow a naming convention — per-value results are in Patterns by naming (descriptive, not a cause); the judgement itself leans on numbers alone."
          : "No clear ad-name pattern — the judgement leans on numbers alone."
      );
    }
    if (volumeBelowFloor && subject?.conversions != null) {
      reasons.push(
        `${subjectRole} has ${Math.round(subject.conversions)} recorded result${Math.round(subject.conversions) === 1 ? "" : "s"} — under the ${MIN_OUTCOMES_FOR_SUPPORTED}-result noise floor, so confidence stays at medium while volume builds.`
      );
    }
    if (topPct != null && topPct < 30) {
      reasons.push(
        `${leadRole} is ${Math.round(topPct)}% better than the median — an observed lead, though the gap is moderate.`
      );
    }
    if (belowHighBar && weakest?.conversions != null && !volumeBelowFloor) {
      const n = Math.round(weakest.conversions);
      const nouns = outcomeNounsFor(analysis);
      reasons.push(
        `The weakest ad receiving budget has ${fmtCount(n)} ${n === 1 ? nouns?.one ?? "result" : nouns?.many ?? "results"}. High confidence needs at least ${HIGH_CONFIDENCE_OUTCOME_MULTIPLE * receiverOutcomeMin(criteria)} on every ad receiving budget.`
      );
    }
    clientWhy =
      belowHighBar && weakest?.conversions != null && !volumeBelowFloor
        ? "Confidence is medium because the ads getting more budget have a moderate number of sales behind them so far — more results would firm the call up."
        : "Confidence is medium because the results point one way, but the sample is small enough that the next round of spend could still shift it.";
  } else {
    if (median == null) {
      reasons.push(
        "Not enough ads reached the minimum spend to set a reliable benchmark."
      );
    }
    if (adsJudged < 5) {
      reasons.push(
        `Only ${adsJudged} ad${adsJudged === 1 ? "" : "s"} could be judged — too few to separate signal from noise.`
      );
    }
    if (median != null && adsJudged >= 5 && winners.length === 0 && losers.length === 0) {
      reasons.push("Nothing clearly won or lost this period.");
    }
    reasons.push(
      "Treat the tests below as ideas to validate, not firm decisions."
    );
    clientWhy = analysis.kpiGaps
      ? `Confidence is low because too few ads have a ${kpiClientLabelFor(analysis)} figure with enough spend to compare — treat the next steps as ideas to test rather than firm decisions.`
      : "Confidence is low because too few ads had enough spend to judge — treat the next steps as ideas to test rather than firm decisions.";
  }

  /* Real-account follow-up: a Shift/Scale states the outcome volume
     behind every ad it puts money into. */
  const nouns = outcomeNounsFor(analysis);
  if (nouns && receiverAds.length > 0 && receiverAds.every((a) => a.conversions != null)) {
    const counts = receiverAds.map((a) => fmtCount(a.conversions as number));
    const list = counts.length === 1 ? counts[0] : `${counts.slice(0, -1).join(", ")} and ${counts[counts.length - 1]}`;
    reasons.push(
      receiverAds.length === 1
        ? `The ad receiving budget has ${list} ${receiverAds[0].conversions === 1 ? nouns.one : nouns.many}.`
        : `The ${receiverAds.length} ads receiving budget have ${list} ${nouns.many}.`
    );
  }
  return { level, notes, reasons: reasons.slice(0, 4), clientWhy };
}

/**
 * Spend Allocation V1 — "where is judged spend sitting relative to the
 * benchmark?" Purely presentational templating over facts analysis.ts
 * already computed (aboveBenchmarkSpend/Count, atBenchmarkSpend/Count,
 * belowBenchmarkSpend/Count, judgedSpend, totalSpend) — no new
 * classification, no decision logic, and this function is never read
 * by decision.ts. null when there's no judged spend to show, mirroring
 * PerformanceRankingChart's "nothing to render" discipline for an empty
 * row set.
 */
function buildSpendAllocation(analysis: AnalysisResult): MemoSpendAllocation | null {
  const {
    judgedSpend,
    totalSpend,
    currency,
    adsSetAside,
    aboveBenchmarkSpend,
    aboveBenchmarkCount,
    atBenchmarkSpend,
    atBenchmarkCount,
    belowBenchmarkSpend,
    belowBenchmarkCount,
  } = analysis;

  if (judgedSpend <= 0) return null;

  const roundPct = (value: number) => Math.round(value);
  /* Raw share, only ever used to build the rounded DISPLAY label here —
     SpendAllocationChart recomputes the true, unrounded proportional
     bar geometry itself from spend/judgedSpend, so a rounded label can
     never become the source of the chart's width. */
  const shareOf = (spend: number, base: number) => (base > 0 ? (spend / base) * 100 : 0);

  /* Canonical order: below -> at -> above. Independently duplicated in
     components/debrief/spendAllocationMath.ts (memo.ts cannot import
     from components/) — see that file's own doc comment. */
  const segmentDefs: { id: "below" | "at" | "above"; count: number; spend: number }[] = [
    { id: "below", count: belowBenchmarkCount, spend: belowBenchmarkSpend },
    { id: "at", count: atBenchmarkCount, spend: atBenchmarkSpend },
    { id: "above", count: aboveBenchmarkCount, spend: aboveBenchmarkSpend },
  ];
  const segments: MemoSpendAllocationSegment[] = segmentDefs
    .filter((s) => s.count > 0)
    .map((s) => ({
      id: s.id,
      count: s.count,
      spend: s.spend,
      spendLabel: fmtMoney(s.spend, currency),
      shareLabel: `${roundPct(shareOf(s.spend, judgedSpend))}%`,
    }));

  const setAsideSpend = totalSpend - judgedSpend;
  const setAside: MemoSpendAllocationSetAside | null =
    adsSetAside > 0
      ? {
          count: adsSetAside,
          spend: setAsideSpend,
          spendLabel: fmtMoney(setAsideSpend, currency),
          shareOfTotalLabel: `${roundPct(shareOf(setAsideSpend, totalSpend))}%`,
          note: analysis.kpiGaps
            ? {
                /* First-Run Fixes: this bucket also holds ads with no KPI
                   value, so the note names both causes, not just spend. */
                buyer: `${fmtMoney(setAsideSpend, currency)} (${adsSetAside} ad${adsSetAside === 1 ? "" : "s"}, ${roundPct(shareOf(setAsideSpend, totalSpend))}% of total spend) not judged — too little spend or no ${kpiLabelFor(analysis)} value to draw a conclusion either way.`,
                client: `${fmtMoney(setAsideSpend, currency)} isn't part of this read — those ads either haven't spent enough yet or have no ${kpiClientLabelFor(analysis)} figure in the file.`,
              }
            : {
                buyer: `${fmtMoney(setAsideSpend, currency)} (${adsSetAside} ad${adsSetAside === 1 ? "" : "s"}, ${roundPct(shareOf(setAsideSpend, totalSpend))}% of total spend) not yet judged — too little spend to draw a conclusion either way.`,
                client: `${fmtMoney(setAsideSpend, currency)} hasn't spent enough yet to include in this read.`,
              },
        }
      : null;

  /* Headline: ONE short sentence — the single most decision-relevant
     descriptive tension, never a repeat of what the segment labels
     already show in full detail (exact %, $, and count). Below-
     benchmark spend leads when it exists (the same figure decision.ts's
     own rationale already leads with for a cut-eligible read); when
     there are no losers, the above side is the only story left to
     tell; an entirely flat/neutral field gets its own short sentence.
     Every branch states at most one share — never both, never a dollar
     amount, never a count — so nothing here duplicates the segment
     labels or the "Judged spend: $X" figure already shown above it. */
  const aboveShare = shareOf(aboveBenchmarkSpend, judgedSpend);
  const belowShare = shareOf(belowBenchmarkSpend, judgedSpend);
  let headlineBuyer: string;
  let headlineClient: string;
  if (belowBenchmarkCount > 0) {
    headlineBuyer = `${roundPct(belowShare)}% of judged spend sits behind below-median ads.`;
    headlineClient = `${roundPct(belowShare)}% of this period's working budget went to ads below the middle ad.`;
  } else if (aboveBenchmarkCount > 0) {
    headlineBuyer = `${roundPct(aboveShare)}% of judged spend sits behind above-median ads.`;
    headlineClient = `${roundPct(aboveShare)}% of this period's working budget went to ads beating the middle ad.`;
  } else {
    headlineBuyer = "All judged spend sits at the median this period.";
    headlineClient = "All of this period's working budget sits on ads level with the middle ad.";
  }

  return {
    judgedSpend,
    judgedSpendLabel: fmtMoney(judgedSpend, currency),
    totalSpend,
    totalSpendLabel: fmtMoney(totalSpend, currency),
    segments,
    setAside,
    headline: { buyer: headlineBuyer, client: headlineClient },
    caveat: {
      buyer: "Allocation is descriptive and does not determine the recommended action on its own.",
      client: "This shows where the budget landed; it does not decide what happens next on its own.",
    },
  };
}

export function generateMemo(analysis: AnalysisResult, context: DebriefContext): Memo {
  const { kpi, currency, median } = analysis;

  // Decision Criteria V2 — built once and shared by the decision, the
  // T3 gate, and the avoid lines, so all three read the same bars.
  const criteria: DecisionCriteria = {
    minOutcomeCount: context.minOutcomeCount,
    minBriefOutcomeCount: context.minBriefOutcomeCount,
    minLossSpendMultiple: context.minLossSpendMultiple,
  };

  // Built once: the list feeds both the memo's tests section and the
  // Next-move decision (T1 recommends exactly nextTests[0]).
  const nextTests = buildNextTests(analysis, context, criteria);

  // Built BEFORE the verdict lines (TLDR Coherence fix): buildTldr and
  // buildClientSummary read the committed decision so their imperatives
  // can never contradict the Next-move card.
  const decision = withTrimNotes(buildDecision(
      analysis,
      nextTests[0]?.test ?? null,
      (v) => fmtMoney(v, currency),
      // Evidence-Explicit Decision V1: surface the first test's
      // preserve/change on the card. Sourced from the already-built
      // brief — no new computation. null when there is no next test.
      nextTests[0]
        ? { preserve: nextTests[0].brief.keepConstant, change: nextTests[0].brief.change }
        : null,
      // Evidence Inputs V1 + Input Honesty V1: forward the optional
      // test-quality answers and objective. DebriefContext extends
      // DecisionInputContext, so `context` already carries
      // controlledTest/trackingChanged/setupChanged/objective. Feeds
      // buildLimits copy only — never the action or evidenceState.
      context,
      // Decision Criteria V2: the user's own scaling minimum. Unlike
      // the framing context above, this MAY withhold a scale/shift
      // move — see DecisionCriteria in types.ts.
      criteria
  ), analysis, context);

  return {
    decision,
    /* Period Comparison V2: always null here — the comparison is built
       by the route from a second, independently-analyzed export and
       attached to the memo afterward. generateMemo stays a one-period
       function, which is also what keeps the decision above provably
       comparison-blind. */
    comparison: null,
    /* Creative Grouping V1: same pattern as comparison directly above —
       always null here. The route computes it from analysis.rankedAds
       + the request's optional creativeGroups field and attaches it
       after generateMemo returns, so the decision is committed with
       zero awareness this field exists. */
    creativeGroups: null,
    spendAllocation: buildSpendAllocation(analysis),
    scope: {
      /* Real-account fix 7: the user's product, else the export's account
         name, else the file name ("Hanzo Ads Apr 2025"), never a blank. */
      product: context.product || analysis.accountName || context.sourceName || "Your account",
      kpiLabel: kpiLabelFor(analysis),
      spendGateLabel: fmtMoney(analysis.spendGate, currency),
      spendGateSource: spendGateSource(analysis, (v) => fmtMoney(v, currency)),
      ...(analysis.accountKpi
        ? {
            accountKpiLabel: fmtKpiValue(analysis.accountKpi.value, kpi, currency),
            accountKpiBasis: ({
              roas: analysis.attributionBasis
                ? `${analysis.attributionBasis.windowLabel} purchase value ÷ total spend`
                : "total purchase value ÷ total spend",
              cpa: analysis.attributionBasis
                ? `total spend ÷ ${analysis.attributionBasis.windowLabel} ${outcomeNounsFor(analysis)?.many ?? "purchases"}`
                : `total spend ÷ total ${outcomeNounsFor(analysis)?.many ?? "purchases"}`,
              ctr: "total link clicks ÷ total impressions",
              cpc: "total spend ÷ total link clicks",
              purchases: "total purchases across all ads",
              leads: "total leads across all ads",
            } as const)[kpi],
            ...(analysis.accountKpi.adsCovered < analysis.accountKpi.adsTotal
              ? { accountKpiCoverage: `from ${analysis.accountKpi.adsCovered} of ${analysis.accountKpi.adsTotal} ads` }
              : {}),
          }
        : {}),
      ...((): { targetSummary?: NonNullable<Memo["scope"]["targetSummary"]> } => {
        const target = targetFor(analysis, context);
        if (target == null) return {};
        return {
          targetSummary: {
            targetLabel: `${kpi === "roas" ? "≥" : "≤"} ${fmtKpiValue(target, kpi, currency)}`,
            beat: analysis.rankedAds.filter((a) => beatsTarget(a, analysis, target)).length,
            judged: analysis.rankedAds.length,
          },
        };
      })(),
      kpiExplainer: kpiExplainerFor(analysis),
      /* CPA Leads Label: the client register's plain label, present only
         when it differs (lead-based CPA) — standard memos are unchanged. */
      ...(analysis.cpaBasis === "leads" ? { kpiLabelClient: kpiClientLabelFor(analysis) } : {}),
      dateRangeLabel: analysis.dateRange
        ? `${analysis.dateRange.start} – ${analysis.dateRange.end}`
        : null,
      adsAnalyzed: analysis.adsAnalyzed,
      adsJudged: analysis.adsJudged,
      adsSetAside: analysis.adsSetAside,
      /* First-Run Fixes: only when some set-aside ads have no KPI value
         (absent otherwise, so standard memos are key-for-key unchanged). */
      ...(analysis.kpiGaps
        ? {
            setAsideBreakdown: {
              spend: analysis.kpiGaps.belowGateWithValue + (analysis.kpiGaps.zeroLowSpend ?? 0),
              noValue: analysis.kpiGaps.noValue,
            },
          }
        : {}),
      ...(analysis.zeroOutcomeThin && analysis.zeroOutcomeThin.ads.length > 0
        ? {
            zeroOutcomeAside: {
              count: analysis.zeroOutcomeThin.ads.length,
              many: outcomeNounsFor(analysis)?.many ?? "conversions",
            },
          }
        : {}),
      ...(analysis.outcomeFloor && analysis.outcomeFloor.setAside.length > 0
        ? {
            outcomeFloorAside: {
              count: analysis.outcomeFloor.setAside.length,
              many: analysis.outcomeFloor.nouns.many,
              min: analysis.outcomeFloor.min,
            },
          }
        : {}),
      totalSpendLabel: fmtMoney(analysis.totalSpend, currency),
      medianLabel: median != null ? fmtKpiValue(median, kpi, currency) : "Not enough data",
    },
    tldr: buildTldr(analysis, decision),
    clientSummary: buildClientSummary(analysis, decision),
    /* Real-account review: ranked by evidence-adjusted ROAS (raw ROAS
       stays the row's value; "adj." beside it in the buyer view). */
    winners: byEvidence(analysis.winners, analysis, criteria).map((ad) => ({
      ...buildRow(ad, analysis, context),
      ...adjFor(ad, analysis, criteria),
    })),
    ...buildAtMedian(analysis, context),
    leadingConversion: buildLeadingConversion(analysis, criteria),
    losers: {
      /* Real-account review: listed by money at stake, not by KPI. */
      rows: trimOrder(analysis).map((ad) => ({
        ...buildRow(ad, analysis, context),
        ...(isNearMedian(ad) ? { holdNote: NEAR_MEDIAN_HOLD } : trimNoteFor(ad, analysis, context)),
      })),
      /* Losers Coherence fix (same contract as buildTldr): the cut
         imperative is voiced ONLY when the committed decision actually
         contains a cut (budgetVariant "cut" or "shift"). Scale-only,
         test, and hold decisions get the same facts descriptively —
         the section never instructs a budget reduction the Next-move
         card didn't commit to. */
      killInstruction:
        analysis.losers.length > 0
          ? decision.action === "budget" && decision.budgetVariant !== "scale"
            ? `${decision.budgetVariant === "cut" ? "Trim the weakest ads below; the freed budget stays with the current ads" : "Trim the weakest ads below and raise the receivers in steps"}. ${
                trimSplit(analysis).held > 0
                  ? `Combined ${fmtMoney(trimSplit(analysis).trimSpend, currency)} sits on ${fmtCount(trimSplit(analysis).trims.length)} ad${trimSplit(analysis).trims.length === 1 ? "" : "s"} well below the median, plus ${heldCount(trimSplit(analysis).held)}`
                  : `Combined ${fmtMoney(analysis.belowBenchmarkSpend, currency)} sits on ${fmtCount(analysis.belowBenchmarkCount)} below-median ad${analysis.belowBenchmarkCount === 1 ? "" : "s"}`
              } — context, not the amount to move.${analysis.losers.length > 1 ? ` ${TRIM_ORDER_NOTE}` : ""}`
            : `The ads below ran under the median — combined ${fmtMoney(analysis.belowBenchmarkSpend, currency)} across ${fmtCount(analysis.belowBenchmarkCount)} ad${analysis.belowBenchmarkCount === 1 ? "" : "s"} total. No cut clears this memo's bars yet (see Next move).${analysis.losers.length > 1 ? ` ${TRIM_ORDER_NOTE}` : ""}`
          : "No ad fell clearly below the median this period.",
      clientInstruction:
        analysis.losers.length > 0
          ? decision.action === "budget" && decision.budgetVariant !== "scale"
            ? trimSplit(analysis).held > 0
              ? `We're reducing or pausing spend on ${fmtCount(trimSplit(analysis).trims.length)} of the ads below — together they spent ${fmtMoney(trimSplit(analysis).trimSpend, currency)} while performing well below the middle ad${decision.budgetVariant === "cut" ? ". The freed budget stays with the current ads for now." : ", and we add budget to the ads that are working in steps."} ${clientHeldClause(trimSplit(analysis).held)}`
              : `We're reducing or pausing spend on the ads below — together they spent ${fmtMoney(analysis.belowBenchmarkSpend, currency)} while performing below the middle ad${decision.budgetVariant === "cut" ? ". The freed budget stays with the current ads for now." : ", and we add budget to the ads that are working in steps."}`
            : `The ads below performed below the middle ad — together ${fmtMoney(analysis.belowBenchmarkSpend, currency)} of spend. We're not reducing their budgets yet; the decision above explains the next step.`
          : "No ad underperformed badly enough to pause this period.",
      belowBenchmarkSpendLabel: fmtMoney(analysis.belowBenchmarkSpend, currency),
      setAsideNote: (() => {
        const spendCount = spendSetAside(analysis);
        const thinLines = zeroThinLines(analysis);
        const spendLine =
          spendCount > 0
            ? `${spendCount} ad${spendCount === 1 ? "" : "s"} had too little spend (below ${fmtMoney(analysis.spendGate, currency)}) to judge fairly — set aside, not penalized.`
            : thinLines.length > 0 || (analysis.outcomeFloor?.setAside.length ?? 0) > 0
              ? ""
              : "No ads were set aside for low spend.";
        const base = analysis.kpiGaps
          ? `${spendLine} ${analysis.kpiGaps.noValue} had no ${kpiLabelFor(analysis)} value — also set aside, not penalized.`
          : spendLine;
        /* First-Run Robustness 2: each ad under the user's outcome minimum. */
        const floor = analysis.outcomeFloor;
        const floorLines = floor
          ? floor.setAside.map(
              (a) =>
                `"${a.name}" set aside — ${a.count} ${a.count === 1 ? floor.nouns.one : floor.nouns.many}, below your ${floor.min} minimum.`
            )
          : [];
        return [base, ...thinLines, ...floorLines].filter((s) => s.trim() !== "").join(" ").trim();
      })(),
    },
    patterns: buildPatterns(analysis),
    ...buildNamingPatterns(analysis),
    ...buildSpreadThin(analysis),
    marketSignal: buildMarketSignal(analysis, context),
    nextTests,
    avoid: buildAvoid(analysis, context, decision),
    confidence: buildConfidence(analysis, decision, criteria),
  };
}
