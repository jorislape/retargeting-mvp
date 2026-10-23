// The ".ts" extension on this import is deliberate and load-bearing:
// types.ts imports nothing, so with an explicit extension this file's
// whole dependency chain resolves under plain Node's type-stripping
// test runner (scripts/decision.test.ts) — the same pattern
// modules/competitorDebrief uses. The rest of modules/debrief uses
// extensionless imports and is NOT directly Node-importable; that is
// why buildDecision takes a money formatter as an argument instead of
// importing format.ts (whose own internal import is extensionless).
import { KPI_LABELS, kpiClientLabelFor, kpiLabelFor, outcomeNounsFor } from "./types.ts";
import type {
  AnalysisResult,
  AppliedCriterion,
  DecisionCriteria,
  DecisionInputContext,
  KpiColumnSource,
  KpiGaps,
  MemoDecision,
  Objective,
  RankedAd,
} from "./types.ts";

/**
 * Decision-First V1 — the "Next move" layer.
 *
 * PURE and deliberately thin: analysis.ts computes, this file CHOOSES.
 * Four rules, first match wins, every threshold a named constant, and
 * the rationale copy always cites the exact numbers and bars that
 * decided — transparency is the feature. This seam (a consumer of
 * AnalysisResult that returns one committed call) is also where a
 * future hypothesis-evaluation layer would plug in; keep it free of
 * memo.ts imports and creative inference.
 *
 * Honesty rules enforced here:
 *  - metrics-only claims: copy references names, spend, KPI deltas —
 *    never creative angles (this file never reads nameTags/notes);
 *  - weak evidence yields an explicit hold, never a forced call;
 *  - the client register bans buyer jargon (kill/gate/benchmark/
 *    median/judged) while describing the SAME recommendation;
 *  - reassess always ends in a numeric trigger;
 *  - the concentration guardrail is COPY ONLY — it can add an
 *    avoidNow line but can never change the chosen action.
 */

/** Minimum judged ads before this memo will commit to any call. */
export const DECISION_MIN_JUDGED = 5;

/** All judged ads within ±this % of the median ⇒ a flat field — more
 *  variable-changing won't separate it; the honest call is a hold. */
export const FLAT_FIELD_DELTA_PCT = 15;

/** Below-benchmark spend must be at least this share of judged spend
 *  (AND the worst ad must clear the scale bar in the wrong direction)
 *  before a cut is the recommended move. */
export const CUT_MIN_SPEND_SHARE_PCT = 25;

/** Copy-only guardrail: when the top winner already holds at least
 *  this share of judged spend, a scale/shift card warns against
 *  consolidating further. Never changes the action (the rule version
 *  of this — R2 — is deliberately postponed to V1.1). */
export const CONCENTRATION_GUARDRAIL_PCT = 50;

/** The single "big enough to act on" bar, shared with memo.ts's
 *  next-test wording (moved here from memo.ts so decision and memo can
 *  never disagree about what earns a budget move). */
export const SCALE_TEST_MIN_DELTA_PCT = 30;

/** Judged-ad count at or above which the evidenceState heuristic treats
 *  THIS dataset as a fuller sample. This is a DETERMINISTIC PRODUCT
 *  HEURISTIC, NOT a statistical-significance guarantee — it deliberately
 *  mirrors the existing confidence high/medium boundary in memo.ts
 *  (buildConfidence already treats < 10 judged ads as a reason to
 *  soften). Evidence-Explicit Decision V1. */
export const SUPPORTED_MIN_JUDGED = 10;

/* ------------------------------------------------------------------ */
/* Evidence Confidence V2                                              */
/* ------------------------------------------------------------------ */

/** Conservative NOISE FLOOR for the evidence label (Evidence
 *  Confidence V2): when the leading ad's outcome count is verifiable
 *  and below this, the dataset's evidence is never labeled strongly
 *  supported — it caps at "limited". DELIBERATELY minimal, far below
 *  the 30–50-outcome judgment bars practitioners describe: this is
 *  "too few results to call anything strong", not a scaling judgment.
 *  It never changes the action (contrast with the USER'S own
 *  minOutcomeCount, a decision criterion that may withhold a scale),
 *  and an unverifiable count never triggers it — missing counts are
 *  never treated as zero. */
export const MIN_OUTCOMES_FOR_SUPPORTED = 10;

/** Analysis windows shorter than this many days (inclusive) draw an
 *  explicit stability limit (Evidence Confidence V2): short periods
 *  are dominated by day-to-day swings. Copy only — never the action. */
export const SHORT_WINDOW_DAYS = 7;

/** True when the evidence noise floor binds: the selected KPI has an
 *  outcome concept, a top winner exists, its count is VERIFIABLE in
 *  the export, and that count is under MIN_OUTCOMES_FOR_SUPPORTED.
 *  Shared by deriveEvidenceState (label cap), buildConfidence's cap
 *  in memo.ts, and the limits copy — one rule, no drift. */
export function isOutcomeVolumeBelowFloor(analysis: AnalysisResult, criteria?: DecisionCriteria): boolean {
  if (outcomeNounsFor(analysis) == null) return false;
  /* Real-account follow-up: the WEAKEST receiver when the call moves
     budget into receivers (a read is only as strong as the thinnest ad
     taking money), else the ad the read stands on (evidenceLead). */
  const top = volumeSubject(analysis, criteria);
  if (top == null || top.conversions == null) return false;
  return top.conversions < MIN_OUTCOMES_FOR_SUPPORTED;
}

/** "High" confidence needs every receiver at this multiple of the
 *  purchase floor (receiverOutcomeMin: 10 by default ⇒ 30). */
export const HIGH_CONFIDENCE_OUTCOME_MULTIPLE = 3;

/** The receiver with the fewest VERIFIABLE outcomes when the committed
 *  call moves budget into receivers; null otherwise (or when no
 *  receiver's count is in the export — missing is never zero). */
export function weakestReceiver(analysis: AnalysisResult, criteria?: DecisionCriteria): RankedAd | null {
  if (!isScaleActionSupported(analysis, criteria)) return null;
  const counted = budgetReceivers(analysis, criteria).filter((r) => r.conversions != null);
  if (counted.length === 0) return null;
  return counted.reduce((min, r) => ((r.conversions as number) < (min.conversions as number) ? r : min));
}

/** The ad whose outcome volume qualifies the evidence: the weakest
 *  receiver of a budget move, else evidenceLead. */
export function volumeSubject(analysis: AnalysisResult, criteria?: DecisionCriteria): RankedAd | null {
  return weakestReceiver(analysis, criteria) ?? evidenceLead(analysis, criteria);
}

/** True when a budget move's weakest receiver has fewer than
 *  HIGH_CONFIDENCE_OUTCOME_MULTIPLE × the purchase floor — the evidence
 *  (and so confidence) caps at limited / medium. Never changes the
 *  action; an unverifiable count never caps. */
export function isReceiverVolumeBelowHighBar(analysis: AnalysisResult, criteria?: DecisionCriteria): boolean {
  if (outcomeNounsFor(analysis) == null) return false;
  const weakest = weakestReceiver(analysis, criteria);
  return (
    weakest != null &&
    (weakest.conversions as number) < HIGH_CONFIDENCE_OUTCOME_MULTIPLE * receiverOutcomeMin(criteria)
  );
}

/** Inclusive day count of the analysis window, or null when the range
 *  is missing or unparseable (never guessed). Exported for tests. */
export function analysisWindowDays(analysis: AnalysisResult): number | null {
  if (!analysis.dateRange) return null;
  const start = Date.parse(analysis.dateRange.start);
  const end = Date.parse(analysis.dateRange.end);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

/** Injected money formatter: (value) => "$1,234.56"-style label.
 *  memo.ts binds fmtMoney with the account currency; tests pass a
 *  simple stub. */
export type MoneyFormatter = (value: number) => string;

/**
 * The single source of truth for "may this dataset's committed call
 * include a scale/shift budget move?" — true exactly when buildDecision
 * lands on the shift or scale variant: enough judged ads (H1 wouldn't
 * fire), the top winner past the scale bar, and the move not withheld
 * by the user's own outcome minimum (Decision Criteria V2; an
 * unverifiable count never silently blocks, matching buildDecision).
 *
 * Exported for memo.ts (Criteria Coherence fix): the T3 scale test and
 * the "don't scale anything except the leader" avoid line must agree
 * with the committed decision, and buildNextTests runs BEFORE the
 * decision object exists (the decision embeds the first test's title)
 * — so the RULE is shared from here rather than re-derived in memo.ts.
 * buildDecision itself computes scaleEligible via this function, so
 * the two can never drift.
 */
/** Trust Pass 4 — the KPI is a proxy (CTR/CPC) or a raw count
 *  (Purchases/Leads) AND the export also carries an outcome KPI
 *  (ROAS/CPA). Budget moves are withheld then: a proxy ranks attention
 *  or volume, not results (a CTR-led move once shifted budget from a
 *  2.71x ROAS ad into a 0.66x one). */
export function isProxyWithOutcome(analysis: AnalysisResult): boolean {
  return (analysis.proxyKpi?.outcomeKpis.length ?? 0) > 0;
}

/** The cut rule's own facts (worst ad ≥ the bar behind — or a judged
 *  zero-conversion ad — and ≥ CUT_MIN_SPEND_SHARE_PCT of judged spend
 *  below the median). Shared so memo.ts can tell a SHIFT is committed
 *  without re-deriving the rule (First-Run Robustness 3c). */
function isRawCutEligible(analysis: AnalysisResult): boolean {
  const worst = analysis.losers[0] ?? null;
  const belowShare =
    analysis.judgedSpend > 0 ? (analysis.belowBenchmarkSpend / analysis.judgedSpend) * 100 : 0;
  return (
    worst != null &&
    (worst.zeroConversions === true ||
      (worst.deltaPct != null && worst.deltaPct <= -SCALE_TEST_MIN_DELTA_PCT)) &&
    belowShare >= CUT_MIN_SPEND_SHARE_PCT
  );
}

/** True when the committed call can contain a cut (cut or shift). With
 *  isScaleActionSupported, memo.ts knows a shift is committed. */
export function isCutActionSupported(analysis: AnalysisResult): boolean {
  return (
    analysis.adsJudged >= DECISION_MIN_JUDGED &&
    isRawCutEligible(analysis) &&
    !isProxyWithOutcome(analysis)
  );
}

/** First-Run Robustness 3a — in a proxy run with an outcome column,
 *  the proxy's top ad sits BELOW median on the outcome KPI (e.g. the
 *  CTR leader is a 0.66x-ROAS ad). Then no test may be built on it:
 *  the first test moves to the outcome leader (memo.ts), and the card
 *  watches the outcome KPI. Shared so both read one rule. */
export function isProxyOutcomeConflict(analysis: AnalysisResult): boolean {
  const oc = analysis.proxyKpi?.outcome;
  const top = analysis.winners[0];
  return oc != null && top != null && oc.belowMedian.includes(top.name);
}

/** What each proxy/count KPI actually measures — the honest reason it
 *  can't carry a budget move on its own. */
const PROXY_MEASURES: Record<string, { buyer: string; client: string }> = {
  ctr: { buyer: "CTR ranks attention, not results", client: "click-through rate, which shows attention rather than sales" },
  cpc: { buyer: "CPC ranks click cost, not results", client: "cost per click, which shows what clicks cost rather than what they earned" },
  purchases: { buyer: "Purchases counts results, not what each one cost", client: "the number of purchases, which doesn't show what each one cost" },
  leads: { buyer: "Leads counts results, not what each one cost", client: "the number of leads, which doesn't show what each one cost" },
};

export function isScaleActionSupported(
  analysis: AnalysisResult,
  criteria?: DecisionCriteria
): boolean {
  if (analysis.adsJudged < DECISION_MIN_JUDGED) return false;
  /* Trust Pass 4: never scale on a proxy/count KPI when the export can
     judge results (ROAS/CPA) instead. Shared, so memo.ts's budget-test
     slot can never disagree with the decision. */
  if (isProxyWithOutcome(analysis)) return false;
  /* Real-account fix 2: a budget move needs an ad that can RECEIVE it. */
  return budgetReceivers(analysis, criteria).length > 0;
}

/* ------------------------------------------------------------------ */
/* Real-account fix 2 — budget receiver evidence floor                 */
/* ------------------------------------------------------------------ */

/** An ad that receives budget must have spent at least this multiple of
 *  the minimum spend to judge. 1× — every judged ad clears it, so the
 *  floor that binds in practice is the outcome count (a real export
 *  shifted 7,889 EUR from 43 ads into one ad with 68 EUR / 8 purchases);
 *  2× proved too strict for evenly-spent accounts, where it equals the
 *  average spend per ad. Kept explicit so the bar stays visible. */
export const RECEIVER_MIN_GATE_MULTIPLE = 1;

/** "the minimum spend" / "2× the minimum spend" — copy for the bar. */
const RECEIVER_SPEND_WORDS =
  RECEIVER_MIN_GATE_MULTIPLE === 1 ? "the minimum spend" : `${RECEIVER_MIN_GATE_MULTIPLE}× the minimum spend`;

/** At most this many ads share a shift/scale. */
export const MAX_BUDGET_RECEIVERS = 3;

/** The outcome count a receiver needs: the user's own scaling minimum
 *  when set, else the MIN_OUTCOMES_FOR_SUPPORTED noise floor. */
export function receiverOutcomeMin(criteria?: DecisionCriteria): number {
  return criteria?.minOutcomeCount != null && criteria.minOutcomeCount > 0
    ? criteria.minOutcomeCount
    : MIN_OUTCOMES_FOR_SUPPORTED;
}

/** True when the ad clears the receiver evidence floor: spend ≥
 *  RECEIVER_MIN_GATE_MULTIPLE × the minimum spend, and — when the KPI has
 *  an outcome count AND the export carries it — ≥ receiverOutcomeMin
 *  outcomes. An unverifiable count never blocks (missing ≠ zero); it is
 *  disclosed in the limits instead. */
export function passesReceiverFloor(
  ad: Pick<RankedAd, "spend" | "conversions">,
  analysis: AnalysisResult,
  criteria?: DecisionCriteria
): boolean {
  if (ad.spend < RECEIVER_MIN_GATE_MULTIPLE * analysis.spendGate) return false;
  if (outcomeNounsFor(analysis) == null || ad.conversions == null) return true;
  return ad.conversions >= receiverOutcomeMin(criteria);
}

/**
 * The ads a shift/scale moves budget INTO: the best above-median ads that
 * clear the scale bar (≥ SCALE_TEST_MIN_DELTA_PCT better than the median)
 * AND the receiver evidence floor, best first, at most
 * MAX_BUDGET_RECEIVERS. When the leader fails the floor, the next ad that
 * passes takes its place; empty ⇒ no budget move (the call is a test).
 * The single source for decision.ts, memo.ts's budget-test slot and the
 * brief-readiness badge.
 */
export function budgetReceivers(analysis: AnalysisResult, criteria?: DecisionCriteria): RankedAd[] {
  return analysis.winners
    .filter(
      (a) =>
        a.deltaPct != null &&
        a.deltaPct >= SCALE_TEST_MIN_DELTA_PCT &&
        passesReceiverFloor(a, analysis, criteria)
    )
    .slice(0, MAX_BUDGET_RECEIVERS);
}

/**
 * The ad the memo builds on: the PRIMARY RECEIVER (highest-ranked ad
 * that clears the receiver floor) when the committed call moves budget
 * into receivers, else the top winner. When the raw leader is passed
 * over by the floor, T1, its brief, the Next controlled test and brief
 * readiness all anchor here — never on an ad too thin to receive budget.
 */
export function evidenceLead(analysis: AnalysisResult, criteria?: DecisionCriteria): RankedAd | null {
  const primary = isScaleActionSupported(analysis, criteria) ? budgetReceivers(analysis, criteria)[0] : null;
  return primary ?? analysis.winners[0] ?? null;
}

/** The raw leader when evidenceLead passed it over, else null. */
export function passedOverLeader(analysis: AnalysisResult, criteria?: DecisionCriteria): RankedAd | null {
  const top = analysis.winners[0] ?? null;
  return top != null && evidenceLead(analysis, criteria) !== top ? top : null;
}

/** Quoted receiver names: "A", "A" and "B", or "A", "B" and "C". */
function receiverNames(receivers: readonly RankedAd[]): string {
  return joinPlain(receivers.map((a) => `"${a.name}"`));
}

function joinPlain(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function pct(value: number): number {
  return Math.round(value);
}

/** Up to two quoted loser names, honest about any remainder — the
 *  remainder counts ALL below-median ads (belowBenchmarkCount), not
 *  just the display slice, matching the kill-list spend rule. */
function loserNames(analysis: AnalysisResult): string {
  const shown = analysis.losers.slice(0, 2).map((a) => `"${a.name}"`);
  const more = analysis.belowBenchmarkCount - shown.length;
  if (more > 0) return `${shown.join(", ")} and ${more} more`;
  return shown.join(" and ");
}

/** Test titles arrive with their own punctuation — normalize so the
 *  composed sentence never ends up with a double period. */
function stripTrailingPeriod(text: string): string {
  return text.trim().replace(/\.+$/, "");
}

/**
 * Evidence-Explicit Decision V1 — how strongly THIS dataset supports its
 * own conclusion, derived ONLY from evidence facts (median presence,
 * judged count, group sizes, completeness, field flatness) and NEVER
 * from the recommended action. Two "supported" shapes: a materially
 * separated field with populated groups (supported separation), or a
 * clearly flat field over a sufficient, complete sample (supported
 * flatness). "No meaningful difference found" is a supported conclusion,
 * NOT missing evidence — so flatness never requires winner/loser groups.
 * Insufficient is reserved for the genuine inability to evaluate: no
 * median, or fewer than DECISION_MIN_JUDGED judged ads. Group absence
 * alone (every ad equal to the median) is a flat result, not
 * insufficient data.
 */
export function deriveEvidenceState(
  analysis: AnalysisResult,
  flatField: boolean,
  criteria?: DecisionCriteria
): "insufficient" | "limited" | "supported" {
  const { median, adsJudged, winners, losers, missingColumns } = analysis;

  if (median == null || adsJudged < DECISION_MIN_JUDGED) return "insufficient";

  const enoughSample = adsJudged >= SUPPORTED_MIN_JUDGED;
  const complete = missingColumns.length === 0;
  const shapeSupported =
    enoughSample &&
    complete &&
    (flatField || (winners.length >= 3 && losers.length >= 3));
  /* Evidence Confidence V2: a structurally supported read still caps at
     "limited" when the leading ad's VERIFIABLE outcome count sits under
     the conservative noise floor — separation built on a handful of
     results is not "strongly supported". Unverifiable counts never cap
     (missing is never treated as zero), and the action is untouched
     (evidenceState is a label, not a rule input). */
  if (
    shapeSupported &&
    !isOutcomeVolumeBelowFloor(analysis, criteria) &&
    !isReceiverVolumeBelowHighBar(analysis, criteria)
  ) {
    return "supported";
  }
  return "limited";
}

/** The evidence shape, independent of the action. Set whenever the field
 *  could be evaluated (a median exists); undefined otherwise. */
export function deriveEvidenceShape(
  analysis: AnalysisResult,
  flatField: boolean
): "separation" | "flatness" | undefined {
  if (analysis.median == null) return undefined;
  return flatField ? "flatness" : "separation";
}

/* ------------------------------------------------------------------ */
/* KPI Source Column Disclosure                                        */
/* ------------------------------------------------------------------ */

const SOURCE_NOUN: Record<KpiColumnSource["field"], { noun: string; plural: boolean }> = {
  purchases: { noun: "purchases", plural: true },
  leads: { noun: "leads", plural: true },
  purchaseValue: { noun: "purchase value", plural: false },
  purchaseRoas: { noun: "ROAS", plural: false },
  costPerPurchase: { noun: "cost per purchase", plural: false },
  costPerLead: { noun: "cost per lead", plural: false },
};

function quotedList(headers: string[]): string {
  const q = headers.map((h) => `'${h}'`);
  if (q.length <= 1) return q.join("");
  return `${q.slice(0, -1).join(", ")} and ${q[q.length - 1]}`;
}

/**
 * One limits line (per register) naming the CSV column(s) a KPI's
 * conversion data was read from — ONLY for partial matches ("Qualified
 * leads" read as leads) and Meta's "Results"/"Cost per result"
 * optimisation-event columns. Empty input ⇒ null ⇒ nothing appended,
 * so standard exports stay byte-identical. Copy only.
 */
export function kpiSourceLimitLines(
  sources: readonly KpiColumnSource[] | undefined
): { buyer: string; client: string } | null {
  if (!sources || sources.length === 0) return null;

  const sentences: string[] = [];
  const partial = sources.filter((s) => s.match === "partial");
  if (partial.length > 0) {
    const [first, ...rest] = partial;
    const f = SOURCE_NOUN[first.field];
    let sentence = `${f.noun.charAt(0).toUpperCase()}${f.noun.slice(1)} ${f.plural ? "were" : "was"} read from the column '${first.header}'`;
    if (rest.length > 0) {
      sentence += `, and ${rest.map((r) => `${SOURCE_NOUN[r.field].noun} from '${r.header}'`).join(", ")}`;
    }
    sentences.push(`${sentence}.`);
  }
  const results = sources.filter((s) => s.match === "results");
  const countResult = results.find((r) => r.field === "purchases");
  const costResult = results.find((r) => r.field === "costPerPurchase");
  if (countResult) {
    sentences.push(
      `'${countResult.header}' is Meta's optimisation event for each campaign, read here as purchases.`
    );
  }
  if (costResult) {
    sentences.push(
      countResult
        ? `'${costResult.header}' is the cost of that event, read here as cost per purchase.`
        : `'${costResult.header}' is the cost of Meta's optimisation event for each campaign, read here as cost per purchase.`
    );
  }
  sentences.push("Confirm it's the conversion you want judged.");

  const headers = [...new Set(sources.map((s) => s.header))];
  const client = `The results counted here come from the column${headers.length > 1 ? "s" : ""} ${quotedList(headers)} in the export — worth checking ${headers.length > 1 ? "they're" : "it's"} the result you mean to measure.`;

  return { buyer: sentences.join(" "), client };
}

/* ------------------------------------------------------------------ */
/* First-Run Fixes: honest set-aside wording                           */
/* ------------------------------------------------------------------ */

/** Oxford-comma join — the parts themselves contain commas ("had no
 *  purchases, so CPA couldn't be computed"), so a bare "and" misreads. */
function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

/** The set-aside partition behind KpiGaps, as (count, buyer phrase,
 *  client phrase) parts. The first part carries the "ad/ads" noun. */
function gapParts(gaps: KpiGaps, kpiLabel: string, kpiClient: string, outcomeMany: string | null) {
  const missing = gaps.noValue - gaps.zeroOutcome;
  const parts: { n: number; buyer: string; client: string }[] = [];
  if (missing > 0) {
    parts.push({
      n: missing,
      buyer: `had no ${kpiLabel} value in the export`,
      client: `had no ${kpiClient} figure in the file`,
    });
  }
  if (gaps.zeroOutcome > 0 && outcomeMany) {
    parts.push({
      n: gaps.zeroOutcome,
      buyer: `had no ${outcomeMany}, so ${kpiLabel} couldn't be computed`,
      client: `had no ${outcomeMany} yet`,
    });
  }
  if (gaps.belowGateWithValue > 0) {
    parts.push({
      n: gaps.belowGateWithValue,
      buyer: "had too little spend to judge",
      client: "didn't have enough spend to include yet",
    });
  }
  if (gaps.zeroLowSpend && outcomeMany) {
    parts.push({
      n: gaps.zeroLowSpend,
      buyer: `had no ${outcomeMany} yet on low spend`,
      client: `haven't made a sale yet on little spend`,
    });
  }
  if (gaps.belowOutcomeFloor && outcomeMany) {
    parts.push({
      n: gaps.belowOutcomeFloor,
      buyer: `had fewer ${outcomeMany} than your minimum`,
      client: `had fewer ${outcomeMany} than the minimum you set`,
    });
  }
  const render = (register: "buyer" | "client") =>
    joinAnd(
      parts.map((p, i) =>
        i === 0 ? `${p.n} ad${p.n === 1 ? "" : "s"} ${p[register]}` : `${p.n} ${p[register]}`
      )
    );
  return { buyer: render("buyer"), client: render("client") };
}

/** Most zero-outcome ads named in full before the rest are counted. */
export const ZERO_THIN_NAMED = 3;

/** Real-account fix 1 — ROAS zero-purchase ads set aside under the
 *  account-cost bar ("no purchases yet, low spend"), or any zero-outcome
 *  list too long to name one line per ad: ONE line per register naming
 *  the first ZERO_THIN_NAMED and counting the rest. null ⇒ the original
 *  per-ad CPA lines (a short CPA list stays byte-identical). */
export function zeroThinCopy(
  thin: NonNullable<AnalysisResult["zeroOutcomeThin"]>,
  analysis: AnalysisResult,
  money: MoneyFormatter
): { buyer: string; client: string } | null {
  const roas = analysis.kpi === "roas";
  if (!roas && thin.ads.length <= ZERO_THIN_NAMED) return null;
  const nouns = outcomeNounsFor(analysis) ?? { one: "conversion", many: "conversions" };
  const n = thin.ads.length;
  const named = thin.ads.slice(0, ZERO_THIN_NAMED).map((z) => `"${z.name}" (${money(z.spend)})`);
  const list = n > ZERO_THIN_NAMED ? `${named.join(", ")} and ${n - ZERO_THIN_NAMED} more` : joinAnd(named);
  const fromUnitCost =
    thin.needs != null && thin.unitCost != null && Math.abs(thin.needs - 2 * thin.unitCost) < 1e-9;
  const bar =
    thin.needs == null
      ? `no ad in this export has a ${nouns.one} yet to measure them against`
      : fromUnitCost
        ? `each needs ≥ ${money(thin.needs)} — ${ZERO_CONVERSION_MULTIPLE_LABEL} the account's ${money(thin.unitCost as number)} cost per ${nouns.one} — before 0 ${nouns.many} counts as a result`
        : `each needs ≥ ${money(thin.needs)} before 0 ${nouns.many} counts as a result`;
  return {
    buyer: `${n} ad${n === 1 ? "" : "s"} with 0 ${nouns.many} set aside — no ${nouns.many} yet, low spend: ${list}; ${bar}.`,
    client: `${n} ad${n === 1 ? " hasn't" : "s haven't"} made a ${nouns.one} yet but also ${n === 1 ? "hasn't" : "haven't"} spent enough to call — ${list}.`,
  };
}

/** Mirrors analysis.ts's ZERO_CONVERSION_SPEND_MULTIPLE (2×) for copy —
 *  decision.ts can't import analysis.ts under the plain-Node runner. */
const ZERO_CONVERSION_MULTIPLE_LABEL = "2×";

/** Hold copy when ads cleared the spend gate but have no KPI value — so
 *  the hold names that cause instead of blaming the gate. Wording only;
 *  the hold itself is decided exactly as before. */
function kpiGapHold(
  analysis: AnalysisResult,
  gaps: KpiGaps,
  gatePhrase: string
): Pick<MemoDecision, "headline" | "clientHeadline" | "clientRationale" | "reassess"> {
  const kpiLabel = kpiLabelFor(analysis);
  const kpiClient = kpiClientLabelFor(analysis);
  const outcomeMany = outcomeNounsFor(analysis)?.many ?? null;
  const missing = gaps.noValue - gaps.zeroOutcome;
  /* CPA Leads Label: a suggested CPA that reads as cost per lead is
     named so the user still finds it (the selector button says CPA). */
  const suggestCpl = gaps.suggestedKpi === "cpa" && gaps.suggestedCpaBasis === "leads";
  const suggest = gaps.suggestedKpi
    ? suggestCpl
      ? "CPA (cost per lead)"
      : KPI_LABELS[gaps.suggestedKpi]
    : null;
  const suggestClient = gaps.suggestedKpi
    ? suggestCpl
      ? "cost per lead"
      : KPI_LABELS[gaps.suggestedKpi]
    : null;
  const zeroPart = gaps.zeroOutcome > 0 && outcomeMany != null;

  /* Buyer headline. Pure missing-column case reads as one fact; any
     mix of causes lists each with its count. */
  let headline: string;
  if (missing > 0 && !zeroPart && gaps.belowGateWithValue === 0) {
    headline =
      missing === analysis.adsAnalyzed
        ? `Hold — none of the ${analysis.adsAnalyzed} ads has a ${kpiLabel} value in this export.`
        : `Hold — ${missing} of ${analysis.adsAnalyzed} ads have no ${kpiLabel} value in this export.`;
  } else {
    const buyerParts: string[] = [];
    if (missing > 0) buyerParts.push(`${missing} ${missing === 1 ? "has" : "have"} no ${kpiLabel} value in this export`);
    if (zeroPart) {
      buyerParts.push(
        `${gaps.zeroOutcome} had no ${outcomeMany}, so ${kpiLabel} can't be computed for ${gaps.zeroOutcome === 1 ? "it" : "them"}`
      );
    }
    if (gaps.belowGateWithValue > 0) {
      buyerParts.push(
        `${gaps.belowGateWithValue}${buyerParts.length > 0 ? " more" : ""} didn't reach the ${gatePhrase}`
      );
    }
    if (gaps.belowOutcomeFloor && outcomeMany) {
      buyerParts.push(`${gaps.belowOutcomeFloor} had fewer ${outcomeMany} than your minimum`);
    }
    headline = `Hold — only ${analysis.adsJudged} of ${analysis.adsAnalyzed} ads could be judged: ${joinAnd(buyerParts)}. This call needs ${DECISION_MIN_JUDGED}.`;
  }
  if (suggest) headline += ` Try ${suggest}.`;

  const clientParts: string[] = [];
  if (missing > 0) {
    clientParts.push(
      missing === analysis.adsAnalyzed
        ? `none of the ${analysis.adsAnalyzed} ads has a ${kpiClient} figure in this file`
        : `${missing} of ${analysis.adsAnalyzed} ads have no ${kpiClient} figure in this file`
    );
  }
  if (zeroPart) {
    clientParts.push(
      `${gaps.zeroOutcome} ad${gaps.zeroOutcome === 1 ? "" : "s"} had no ${outcomeMany} yet, so ${gaps.zeroOutcome === 1 ? "its" : "their"} ${kpiClient} can't be worked out`
    );
  }
  if (gaps.belowGateWithValue > 0) {
    clientParts.push(
      `${gaps.belowGateWithValue}${clientParts.length > 0 ? " more" : ""} ${gaps.belowGateWithValue === 1 ? "hasn't" : "haven't"} had enough spend to compare fairly`
    );
  }
  if (gaps.belowOutcomeFloor && outcomeMany) {
    clientParts.push(`${gaps.belowOutcomeFloor} had fewer ${outcomeMany} than the minimum you set`);
  }
  let clientHeadline = `Hold — ${joinAnd(clientParts)}, so there isn't enough to compare yet.`;
  if (suggestClient) clientHeadline += ` Switching the report to ${suggestClient} would use the results this file does have.`;

  return {
    headline,
    clientHeadline,
    clientRationale:
      "With this few ads that can be compared, an apparent winner is as likely luck as a real pattern — a call needs more ads with a result to compare.",
    reassess: {
      buyer: `Reassess with an export where ≥${DECISION_MIN_JUDGED} ads have a ${kpiLabel} value and reach the ${gatePhrase}.`,
      client: `We'll revisit once at least ${DECISION_MIN_JUDGED} ads have a ${kpiClient} figure and enough spend to compare.`,
    },
  };
}

/**
 * What this read CANNOT establish. One permanent dataset-only caveat (no
 * causation, no future-performance guarantee, no control for unobserved
 * differences) plus conditional lines drawn ONLY from facts already
 * tracked in AnalysisResult. Two registers; the client register carries
 * no buyer jargon (kill/gate/benchmark/median/judged).
 */
/**
 * Tester Feedback Fix 4 — where the minimum spend to judge comes from,
 * in plain words. The number itself is computed in analysis.ts and is
 * NOT changed here; this only explains it (a tester found €164.03
 * arbitrary). `short` fits a parenthetical, `buyer` is the full
 * sentence tail, `client` is jargon-free (never "gate").
 */
export function spendGateSource(
  analysis: AnalysisResult,
  money: MoneyFormatter
): { short: string; buyer: string; client: string } {
  const notGuarantee = "a default, not a statistical guarantee";
  const setTarget = "Set a target CPA to base it on 3× your CPA instead.";
  switch (analysis.spendGateBasis) {
    case "user_gate":
      return { short: "the minimum you set", buyer: "the minimum you set", client: "the minimum you set" };
    case "target_cpa": {
      const target = money(analysis.spendGate / 3);
      return {
        short: "3× your target CPA",
        buyer: `3× your ${target} target CPA`,
        client: `three times your ${target} cost target`,
      };
    }
    default: {
      const mean = analysis.adsAnalyzed > 0 ? analysis.totalSpend / analysis.adsAnalyzed : 0;
      const avg = money(mean);
      // The fixed floor won: half the mean is lower than the gate.
      if (mean * 0.5 < analysis.spendGate - 1e-9) {
        return {
          short: "Debrief's fixed floor",
          buyer: `Debrief's fixed ${money(analysis.spendGate)} floor, because half the average spend per ad in this export (${avg} avg) is lower — ${notGuarantee}. ${setTarget}`,
          client: `a fixed minimum Debrief uses for small accounts — a rule of thumb, not a guarantee`,
        };
      }
      return {
        short: "half this export's average spend per ad",
        buyer: `half the average spend per ad in this export (${avg} avg) — ${notGuarantee}. ${setTarget}`,
        client: `half the average spend per ad in this file (${avg}) — a rule of thumb, not a guarantee`,
      };
    }
  }
}

export function buildLimits(
  analysis: AnalysisResult,
  flatField: boolean,
  /** Evidence Inputs V1 + Input Honesty V1 — optional self-reported
   *  test-quality answers AND the optional structured objective.
   *  Undefined or unanswered/unrecognized fields append NOTHING (the
   *  output is byte-identical to before either feature). These ONLY
   *  append caveat lines; they never touch action, evidenceState, or
   *  any number. */
  testQuality?: DecisionInputContext
): { buyer: string[]; client: string[] } {
  const buyer: string[] = [];
  const client: string[] = [];

  // Permanent — true of every CSV read, by construction.
  buyer.push(
    "This reads one uploaded dataset: it shows what happened, not why. It can't establish that an ad's creative caused its result, doesn't guarantee future performance, and doesn't control for differences in audience, timing, budget, objective, or other conditions the export doesn't capture."
  );
  client.push(
    "This is based only on the data in this file. It shows what happened, not why — and it can't account for differences in audience, timing, budget, or goals the export doesn't include, or promise the same result going forward."
  );

  /* KPI Source Column Disclosure — right after the permanent line so
     it never displaces any existing trailing caveat. */
  const sourceLines = kpiSourceLimitLines(analysis.kpiColumnSources);
  if (sourceLines) {
    buyer.push(sourceLines.buyer);
    client.push(sourceLines.client);
  }
  /* Attribution & Intent 2: ranked on click-only — said in both
     registers. Otherwise (Item 1) split columns are only disclosed. */
  if (analysis.attributionBasis) {
    const b = analysis.attributionBasis;
    const many = outcomeNounsFor(analysis)?.many ?? "conversions";
    const days = b.windowLabel === "7-day click" ? "7 days" : "1 day";
    buyer.push(
      `Ranked on ${b.windowLabel} conversions only; view-through excluded (${b.headers.map((h) => `'${h}'`).join(", ")}).`
    );
    client.push(
      `Ads are compared only on ${many} made within ${days} of someone clicking the ad — ${many} credited just because someone saw it aren't counted.`
    );
  } else if (analysis.attributionColumns) {
    buyer.push(
      `This export also splits conversions by attribution window (${analysis.attributionColumns.map((h) => `'${h}'`).join(", ")}); the ranking uses the blended column.`
    );
    client.push("The file also shows results split by whether people clicked the ad or only saw it.");
  }

  /* Tester Feedback Fix 5: CPA with no target ranks ads against each
     other, not against profitability — say so, and point at ROAS when
     the export has it. Copy only. */
  if (analysis.cpaWithoutTarget) {
    const label = kpiLabelFor(analysis);
    const clientLabel = kpiClientLabelFor(analysis);
    const lead = analysis.cpaBasis === "leads";
    const differs = lead ? "lead quality or value differs" : "order value or margin differs";
    const roas = analysis.cpaWithoutTarget.roasAvailable;
    buyer.push(
      `No target CPA set — ads are ranked against this account's median ${label}, not against what's profitable. A higher ${label} isn't automatically worse if ${differs}.${
        roas ? " ROAS is available in this export and accounts for order value." : ""
      }`
    );
    client.push(
      `No cost target was set, so ads are compared with each other — against the middle ad's ${clientLabel} — not with what's profitable. A higher ${clientLabel} isn't automatically worse if ${differs}.${
        roas ? " This file also includes return on ad spend, which accounts for order value." : ""
      }`
    );
  }

  /* Mixed Segment Warning: one line when the export mixes ad sets (or
     campaigns) far apart — copy only, never the action. */
  if (analysis.mixedSegments) {
    const m = analysis.mixedSegments;
    const plural = m.dimension === "ad set" ? "ad sets" : "campaigns";
    const apart = `${m.ratio.toFixed(1)}× apart`;
    buyer.push(
      `This export mixes ${m.segments} ${plural} whose typical ${kpiLabelFor(analysis)} ranges from ${m.lowLabel} to ${m.highLabel} (${apart}) — ranking them against one account median may compare unlike products. For a fairer read, export one ad set or campaign at a time.`
    );
    client.push(
      `This file mixes ${m.segments} ${plural} whose middle-ad ${kpiClientLabelFor(analysis)} ranges from ${m.lowLabel} to ${m.highLabel} (${apart}), so comparing every ad against one middle ad for the whole account may compare unlike products. A fairer read looks at one ad set or campaign at a time.`
    );
  }

  /* Real-account fix 4: judged ads span funnel stages — one median
     compares cold prospecting with warm retargeting. Copy only. */
  if (analysis.funnelMix) {
    const f = analysis.funnelMix;
    const label = kpiLabelFor(analysis);
    const parts = f.stages.map(
      (s) => `${s.stage} (${s.judged} ad${s.judged === 1 ? "" : "s"}${s.medianLabel ? `, median ${s.medianLabel}` : ""})`
    );
    const unknown = f.unknown > 0 ? `, plus ${f.unknown} with no stage in the name` : "";
    buyer.push(
      `Judged ads mix funnel stages — ${joinPlain(parts)}${unknown}. Prospecting and retargeting ads aren't comparable on one ${label} median; for a fairer read, run the debrief once per stage (filter the export by stage).`
    );
    client.push(
      `This file mixes ads aimed at new audiences with ads aimed at people who already know the brand (${f.stages.map((s) => s.stage).join(", ")}). Those usually perform very differently, so a fairer read looks at each group separately.`
    );
  }

  if (analysis.kpiGaps) {
    /* First-Run Fixes: some set-aside ads spent enough but have no KPI
       value — name each cause with its count instead of "too little
       spend" for all of them. */
    const parts = gapParts(
      analysis.kpiGaps,
      kpiLabelFor(analysis),
      kpiClientLabelFor(analysis),
      outcomeNounsFor(analysis)?.many ?? null
    );
    const one =
      analysis.kpiGaps.noValue + analysis.kpiGaps.belowGateWithValue + (analysis.kpiGaps.zeroLowSpend ?? 0) === 1;
    buyer.push(`${parts.buyer} — set aside, so no conclusion is drawn about ${one ? "it" : "them"} either way.`);
    client.push(`${parts.client}, so ${one ? "it's" : "they're"} not part of this read.`);
  } else if (
    analysis.adsSetAside - (analysis.zeroOutcomeThin?.ads.length ?? 0) - (analysis.outcomeFloor?.setAside.length ?? 0) >
    0
  ) {
    /* Zero-conversion ads under their spend bar get their own named
       lines in buildDecision (they need the money formatter); ads under
       the user's outcome minimum get theirs just below. */
    const n =
      analysis.adsSetAside - (analysis.zeroOutcomeThin?.ads.length ?? 0) - (analysis.outcomeFloor?.setAside.length ?? 0);
    buyer.push(
      n === 1
        ? "1 ad had too little spend to judge and was set aside — no conclusion is drawn about it either way."
        : `${n} ads had too little spend to judge and were set aside — no conclusion is drawn about them either way.`
    );
    client.push(
      n === 1
        ? "1 ad didn't have enough spend to include yet, so it's not part of this read."
        : `${n} ads didn't have enough spend to include yet, so they're not part of this read.`
    );
  }
  /* First-Run Robustness 2: the user's own outcome minimum — every ad
     it set aside, named; and the ads it couldn't be checked against. */
  const floor = analysis.outcomeFloor;
  if (floor) {
    const noun = (n: number) => (n === 1 ? floor.nouns.one : floor.nouns.many);
    if (floor.setAside.length > 0) {
      buyer.push(
        floor.setAside
          .map((a) => `"${a.name}" set aside — ${a.count} ${noun(a.count)}, below your ${floor.min} minimum`)
          .join("; ") + "."
      );
      client.push(
        floor.setAside
          .map((a) => `"${a.name}" isn't included yet — ${a.count} ${noun(a.count)} so far, below the ${floor.min} you set`)
          .join("; ") + "."
      );
    }
    if (floor.unverifiable > 0) {
      const u = floor.unverifiable;
      buyer.push(
        `Your ${floor.min}-${floor.nouns.one} minimum couldn't be checked for ${u} ad${u === 1 ? "" : "s"} — the export has no ${floor.nouns.one} count for ${u === 1 ? "it" : "them"}, so ${u === 1 ? "it was" : "they were"} judged as usual.`
      );
      client.push(
        `The minimum of ${floor.min} ${floor.nouns.many} you set couldn't be checked for ${u} ad${u === 1 ? "" : "s"}, so ${u === 1 ? "it was" : "they were"} compared as usual.`
      );
    }
  }

  if (!analysis.hasCreativeNotes && !analysis.hasNameSignal && analysis.namingPatterns) {
    /* Real-account fix 8: the names DO carry a convention — say what it
       is worth (a description by token, never a cause). */
    buyer.push(
      "No creative notes, but the ad names follow a naming convention — Patterns by naming shows results per token value. Those are associations in this export; this read still can't say which creative attribute is behind any difference."
    );
    client.push(
      "Without notes on the creative, this read is based on the numbers and the ad names — it can't say which part of an ad made the difference."
    );
  } else if (!analysis.hasCreativeNotes && !analysis.hasNameSignal) {
    buyer.push(
      "No creative notes or clear ad-name pattern — this is a metrics-only read, so it can't say which creative attribute is behind any difference."
    );
    client.push(
      "Without notes on the creative, this read is based on the numbers alone — it can't say which part of an ad made the difference."
    );
  }
  if (analysis.missingColumns.includes("Ad name")) {
    buyer.push(
      "No ad-name column was found, so ads are labeled generically and name-based patterns can't be read."
    );
    client.push("The file didn't include ad names, so ads are shown generically.");
  }
  /* Real-account fix 3: same-name rows were merged into one creative
     each — disclosed with how, so a reader can reconstruct the numbers. */
  if (analysis.duplicateAdNames.length > 0) {
    const names = analysis.duplicateAdNames;
    const shown = names.slice(0, 2).map((n) => `"${n}"`);
    const list = names.length > 2 ? `${shown.join(", ")} and ${names.length - 2} more` : shown.join(" and ");
    const breakdowns = analysis.mergedRows?.breakdowns ?? [];
    const why =
      breakdowns.length > 0
        ? `the export is broken down by ${breakdowns.join(", ")}`
        : analysis.mergedRows?.adSetColumn
          ? "the same creative ran in several ad sets"
          : "the same name appears more than once in this export";
    buyer.push(
      `${names.length} ad name${names.length === 1 ? "" : "s"} appeared on several rows (${why}) and ${names.length === 1 ? "was" : "were"} combined into one creative each — spend, ${outcomeNounsFor(analysis)?.many ?? "results"} and value summed, ${kpiLabelFor(analysis)} recomputed from the totals: ${list}. Near-identical names ("- Copy") are kept separate.`
    );
    client.push(
      `${names.length} ad${names.length === 1 ? "" : "s"} ran on several rows of the file and ${names.length === 1 ? "is" : "are"} shown as one creative each, with ${names.length === 1 ? "its" : "their"} results added together.`
    );
  }
  if (analysis.missingColumns.includes("Reporting date range")) {
    buyer.push(
      "No reporting date range in the export — all rows are treated as one period, so time-based shifts are invisible."
    );
    client.push("The file didn't include dates, so everything is treated as one period.");
  }
  if (flatField) {
    buyer.push(
      `No ad separated beyond the ±${FLAT_FIELD_DELTA_PCT}% band around the median — the field is effectively flat, so no ad can be called a clear winner or loser yet.`
    );
    client.push("The ads performed at a similar level — none pulled clearly ahead or behind yet.");
  } else if (analysis.winners.length < 3 || analysis.losers.length < 3) {
    buyer.push(
      `Small comparison groups (${analysis.winners.length} clearly ahead, ${analysis.losers.length} clearly behind) — one ad can swing the read.`
    );
    client.push(
      "Only a few ads landed clearly ahead or behind, so one ad can move the picture."
    );
  }
  if (analysis.adsJudged < SUPPORTED_MIN_JUDGED) {
    buyer.push(
      `Only ${analysis.adsJudged} ad${analysis.adsJudged === 1 ? "" : "s"} reached the minimum spend — under the ${SUPPORTED_MIN_JUDGED}-ad bar this read treats as a fuller sample, so more spend could still shift the pattern.`
    );
    client.push(
      `Fewer than ${SUPPORTED_MIN_JUDGED} ads had enough spend to compare, so more spend could still change the picture.`
    );
  }

  /* Evidence Confidence V2 — short-window stability. Uses the export's
     own parsed range; a missing or unparseable range adds nothing here
     (the missing-range line above already covers absence). Copy only —
     never the action. */
  const windowDays = analysisWindowDays(analysis);
  if (windowDays != null && windowDays < SHORT_WINDOW_DAYS) {
    buyer.push(
      `This export covers ${windowDays} day${windowDays === 1 ? "" : "s"} — short windows are dominated by day-to-day swings, so treat movements in this read as less stable than a longer period would show.`
    );
    client.push(
      `This report covers ${windowDays} day${windowDays === 1 ? "" : "s"} of data — short periods swing more from day to day, so the picture is less settled than a longer one would be.`
    );
  }

  /* ---- Evidence Inputs V1: user-reported test-quality caveats. These
     ONLY append lines to the existing limits — they never change the
     action, evidenceState, or any number. An unanswered field (or
     controlledTest "yes") appends nothing, so an all-unanswered set
     leaves the limits byte-identical to before the feature. A "yes"
     never adds a positive claim; it simply withholds the caveat. ---- */
  if (testQuality) {
    if (testQuality.controlledTest === "no" || testQuality.controlledTest === "unsure") {
      buyer.push(
        "You indicated these ads weren't run as a controlled test, so differences may reflect setup — audience, budget, or timing — as much as the creative."
      );
      client.push(
        "These ads weren't set up as a controlled test, so the difference between them may come partly from how they were run, not just the ads themselves."
      );
    }
    if (testQuality.trackingChanged) {
      buyer.push(
        "You noted tracking changed during this period, so conversion figures may not be comparable across the range."
      );
      client.push(
        "You mentioned tracking changed during this period, so the conversion numbers may not be directly comparable across the whole range."
      );
    }
    if (testQuality.setupChanged) {
      buyer.push(
        "You noted the offer, landing page, audience, or budget changed mid-period, so results may partly reflect that change rather than the ads."
      );
      client.push(
        "You mentioned the offer, page, audience, or budget changed partway through, so some of the results may reflect that change rather than the ads."
      );
    }
  }

  /* ---- Input Honesty V1: objective framing/mismatch caveats. Uses
     ONLY the structured objective enum + the KPI already selected for
     THIS debrief — never parses product/offer/notes/marketContext, and
     never adds a keyword-based mismatch check. Two of these three rules
     depend only on objective+KPI, so they're valid regardless of which
     action fires and belong here; the "efficiency + scale/shift action"
     rule depends on the ACTUAL chosen action and is appended separately
     in buildDecision's scaleEligible branches — see
     withEfficiencyScaleCaveat below. ---- */
  const objective = testQuality?.objective;
  const kpiLabel = kpiLabelFor(analysis);
  const kpiClient = kpiClientLabelFor(analysis);
  if (objective === "growth" && (analysis.kpi === "ctr" || analysis.kpi === "cpc")) {
    buyer.push(
      `You flagged "scale profitable volume" as the objective, but ${kpiLabel} measures traffic efficiency, not profitable growth or purchase outcomes — this read can't confirm the extra traffic is profitable.`
    );
    client.push(
      `Your goal is more profitable volume, but this report is based on ${kpiClient}, which measures clicks — not whether that traffic turns into profitable sales.`
    );
  }
  if (objective === "efficiency" && analysis.kpi === "ctr") {
    buyer.push(
      `You flagged "improve efficiency" as the objective, but CTR doesn't verify CPA or ROAS efficiency — pair this read with a CPA or ROAS export before acting on efficiency grounds.`
    );
    client.push(
      "Your goal is efficiency, but this report is based on CTR (clicks), which doesn't confirm your cost or return efficiency."
    );
  }
  if (objective === "learning") {
    buyer.push(
      "You flagged this as a learning phase — treat this call as one data point for ongoing testing, not a final decision."
    );
    client.push(
      "You told us this is a learning phase — treat this as one useful data point, not a final call."
    );
  }

  return { buyer, client };
}

/** Input Honesty V1 — the one objective caveat that depends on WHICH
 *  action actually fires, so it can't live inside buildLimits (which
 *  runs before the action is chosen). Appended only to the two
 *  scaleEligible branches of buildDecision (shift and scale-only);
 *  never the cut-only branch, since cutting REDUCES spend and carries
 *  no "verify profitability before increasing spend" concern. Copy
 *  only — never changes the action. */
function withEfficiencyScaleCaveat(
  limits: { buyer: string[]; client: string[] },
  objective: Objective | undefined
): { buyer: string[]; client: string[] } {
  if (objective !== "efficiency") return limits;
  return {
    buyer: [
      ...limits.buyer,
      `You flagged "improve efficiency" as the objective — this recommendation identifies the strongest relative result in this dataset, not a verified profitable one. Verify profitability before increasing spend.`,
    ],
    client: [
      ...limits.client,
      "Your goal is efficiency — this points to the strongest performer here relative to the rest. Check it against your margins before increasing its budget.",
    ],
  };
}

/** Material-Action Verification Guardrail V1 — appended to every
 *  budget decision (shift, scale, and cut alike), unconditionally: a
 *  larger account or budget doesn't make this recommendation more
 *  authoritative, so the same reminder applies at any size — no
 *  spend-based gating, by design. Copy only — never changes the
 *  action, evidenceState, or any other field.
 *
 *  Applied BEFORE withEfficiencyScaleCaveat at each call site so that
 *  caveat, when it fires, remains the TRAILING element of `limits` —
 *  several existing tests assert on the last array element
 *  specifically (scripts/decision.test.ts). */
function withMaterialActionVerificationGuardrail(limits: {
  buyer: string[];
  client: string[];
}): { buyer: string[]; client: string[] } {
  return {
    buyer: [
      ...limits.buyer,
      "Confirm the underlying figures in Meta Ads Manager before making a material budget change.",
    ],
    client: [
      ...limits.client,
      "Check the underlying numbers in Meta Ads Manager before making a meaningful budget change.",
    ],
  };
}

/* Real-account review — which of Debrief's default bars CHANGED the
   call (the print card shows only these plus the user's own bars; the
   rest go to the appendix). Read from the committed decision, never a
   second eligibility rule:
     insufficient-data hold → minimum spend + minimum sample;
     flat hold              → flat-field band;
     budget move            → budget-move bar (receivers) / cut bar
                              (trim side) / receiver floor when it
                              passed over an ad that cleared the bar;
     test                   → the bar that withheld the budget move
                              (receiver floor, else budget-move bar) and
                              the cut bar when ads sit below the median. */
type BarKey = "gate" | "sample" | "move" | "floor" | "cut" | "flat";
const BAR_KEYS = new WeakMap<AppliedCriterion, BarKey>();
const bar = (key: BarKey, c: AppliedCriterion): AppliedCriterion => {
  BAR_KEYS.set(c, key);
  return c;
};

function decisiveBars(d: MemoDecision, analysis: AnalysisResult, criteria?: DecisionCriteria): Set<BarKey> {
  const floorExcluded = analysis.winners.some(
    (w) => w.deltaPct != null && w.deltaPct >= SCALE_TEST_MIN_DELTA_PCT && !passesReceiverFloor(w, analysis, criteria)
  );
  if (d.action === "hold") {
    if (d.holdReason === "insufficient_data") return new Set(["gate", "sample"]);
    if (d.holdReason === "flat_performance") return new Set(["flat"]);
    return new Set();
  }
  if (d.action === "budget") {
    const keys = new Set<BarKey>();
    if ((d.budgetMove?.to.length ?? 0) > 0) keys.add("move");
    if ((d.budgetMove?.from.length ?? 0) > 0) keys.add("cut");
    if (floorExcluded && !isProxyWithOutcome(analysis)) keys.add("floor");
    return keys;
  }
  const keys = new Set<BarKey>([floorExcluded ? "floor" : "move"]);
  if (analysis.belowBenchmarkCount > 0) keys.add("cut");
  return keys;
}

export function buildDecision(...args: Parameters<typeof decide>): MemoDecision {
  const d = decide(...args);
  const keys = decisiveBars(d, args[0], args[5]);
  return {
    ...d,
    appliedCriteria: d.appliedCriteria.map((c) => {
      const key = BAR_KEYS.get(c);
      return key != null && keys.has(key) ? { ...c, decisive: true as const } : c;
    }),
  };
}

function decide(
  analysis: AnalysisResult,
  firstTestTitle: string | null,
  money: MoneyFormatter,
  /** Facts from the first next test (nextTests[0].brief), used only to
   *  surface nextControlledTest on the card. Optional so the pure rule
   *  tests can call buildDecision without threading a test through. */
  nextTestFacts?: { preserve: string; change: string } | null,
  /** Evidence Inputs V1 + Input Honesty V1 — optional test-quality
   *  answers and objective, forwarded to buildLimits (and, for
   *  objective="efficiency", to the scaleEligible branches below).
   *  Never affects the action or evidenceState. */
  testQuality?: DecisionInputContext,
  /** Decision Criteria V2 — the user's own decision bars (see the
   *  DecisionCriteria doc in types.ts). Unlike testQuality, these MAY
   *  legitimately participate in the action: a user-set outcome
   *  minimum can withhold a scale/shift recommendation. It can only
   *  ever WITHHOLD — it never fabricates an action the data didn't
   *  earn. Absent/null is a complete no-op on the action. */
  criteria?: DecisionCriteria
): MemoDecision {
  const kpiLabel = kpiLabelFor(analysis);
  const kpiClient = kpiClientLabelFor(analysis);
  const gateLabel = money(analysis.spendGate);
  /* Decision Criteria V2 — gate provenance, woven into the exact
     strings that cite the gate so a user-set bar is always labeled as
     the user's own. Buyer register carries the explicit provenance;
     client register gets a short "the threshold you set" suffix only
     where the gate amount is already being explained. */
  const userGate = analysis.spendGateBasis === "user_gate";
  const gatePhrase = userGate
    ? `${gateLabel} minimum spend you set`
    : `${gateLabel} minimum spend`;
  const clientGateSuffix = userGate ? " — the threshold you set" : "";
  const top = analysis.winners[0] ?? null;
  const worst = analysis.losers[0] ?? null;

  /* ---- shared eligibility facts (null-guarded: a zero median makes
     deltaPct null, which simply disqualifies the affected rule rather
     than guessing) ---- */
  const rawScaleEligible =
    top != null && top.deltaPct != null && top.deltaPct >= SCALE_TEST_MIN_DELTA_PCT;

  /* ---- Decision Criteria V2: the user's outcome minimum. Applies
     ONLY to spend-increasing moves (scale/shift — the discovery
     evidence is about when practitioners scale), only when the
     selected KPI actually has an outcome count (purchases/leads —
     never CTR/CPC), and only when that count is verifiable in the
     export. An absent count column never silently enforces OR ignores
     the bar: it produces an explicit "couldn't be checked" limits
     line and no gating. ---- */
  const nouns = outcomeNounsFor(analysis);
  const minOutcome =
    criteria?.minOutcomeCount != null && criteria.minOutcomeCount > 0
      ? criteria.minOutcomeCount
      : null;
  const topOutcomes = top?.conversions ?? null;
  const outcomeInapplicable = minOutcome != null && nouns == null;
  const outcomeUnverifiable =
    minOutcome != null && nouns != null && top != null && topOutcomes == null;
  const outcomeBlockedScale =
    minOutcome != null &&
    nouns != null &&
    rawScaleEligible &&
    topOutcomes != null &&
    topOutcomes < minOutcome;
  /* Computed via the shared, exported rule so memo.ts's T3/avoid gating
     can never drift from the decision (its adsJudged clause is
     redundant here — H1 already returned before B1 reads this). */
  const scaleEligible = isScaleActionSupported(analysis, criteria);
  /* Real-account fix 2: the ads a move goes INTO, and whether the leader
     itself was passed over for failing the receiver floor. A lead past
     the bar with NO ad able to receive budget is a test, not a move. */
  const receivers = budgetReceivers(analysis, criteria);
  const lead = receivers[0] ?? null;
  const receiverMin = receiverOutcomeMin(criteria);
  const receiverSpendLabel = money(RECEIVER_MIN_GATE_MULTIPLE * analysis.spendGate);
  const topBelowFloor = top != null && !passesReceiverFloor(top, analysis, criteria);
  const belowShare =
    analysis.judgedSpend > 0
      ? (analysis.belowBenchmarkSpend / analysis.judgedSpend) * 100
      : 0;
  /* Tester Feedback Fix 2: a judged zero-conversion CPA ad (no value,
     deltaPct null) is by definition further behind than any bar — it
     qualifies on the "worst ad" half; the spend-share half still holds. */
  const proxyHeld = isProxyWithOutcome(analysis);
  const rawCutEligible = isRawCutEligible(analysis);
  const cutEligible = rawCutEligible && !proxyHeld;
  /* Trust Pass 4: true only when the proxy rule is what stopped a move
     the rules would otherwise have made. */
  const proxyDowngraded = proxyHeld && (rawScaleEligible || rawCutEligible);
  const proxyCopy = PROXY_MEASURES[analysis.kpi];
  const outcomeKpis = analysis.proxyKpi?.outcomeKpis ?? [];
  const outcomeNames = outcomeKpis.map((o) => o.label).join("/");
  const outcomeClientNames = outcomeKpis.map((o) => o.clientLabel).join(" or ");
  const receiverBlocked = rawScaleEligible && !proxyHeld && receivers.length === 0;
  const winnerShare =
    lead != null && analysis.judgedSpend > 0
      ? (lead.spend / analysis.judgedSpend) * 100
      : 0;
  /* What the passed-over leader lacks, in the receiver floor's terms. */
  const floorGaps = (ad: RankedAd): string => {
    const gaps: string[] = [];
    if (nouns != null && ad.conversions != null && ad.conversions < receiverMin) {
      gaps.push(`${ad.conversions} ${ad.conversions === 1 ? nouns.one : nouns.many}`);
    }
    if (ad.spend < RECEIVER_MIN_GATE_MULTIPLE * analysis.spendGate) gaps.push(`${money(ad.spend)} of spend`);
    return gaps.join(" on ");
  };
  const floorPhrase = `${nouns != null ? `≥${receiverMin} ${nouns.many}${minOutcome != null ? " (your minimum)" : ""} and ` : ""}≥ ${receiverSpendLabel} spent (${RECEIVER_SPEND_WORDS})`;

  /* ---- flat-field fact (hoisted above the rule branches so every
     return path can label the evidence; B1 and H2 are mutually
     exclusive — a ±15% extreme can never clear the 30%/25% budget bars
     — so hoisting does not change which branch returns). Checkable from
     the extremes: winners/losers are sorted best-/worst-first, so if
     BOTH extremes sit within the band, every judged ad does; an empty
     pool side is trivially within it, and a null deltaPct (zero median)
     disqualifies the rule rather than guessing. ---- */
  const topWithin =
    top == null || (top.deltaPct != null && top.deltaPct <= FLAT_FIELD_DELTA_PCT);
  const worstWithin =
    worst == null ||
    (worst.deltaPct != null && Math.abs(worst.deltaPct) <= FLAT_FIELD_DELTA_PCT);
  const flatField =
    topWithin && worstWithin && (top?.deltaPct != null || worst?.deltaPct != null || analysis.median != null);

  /* ---- Evidence-Explicit Decision V1: evidence strength, shape, and
     limits — a SEPARATE dimension from the action below. Computed once
     and spread into every return, so the action rules are untouched. ---- */
  const evidenceState = deriveEvidenceState(analysis, flatField, criteria);
  const evidenceShape = deriveEvidenceShape(analysis, flatField);
  const baseLimits = buildLimits(analysis, flatField, testQuality);

  /* ---- Decision Criteria V2: criterion-status lines, appended to the
     limits so every return path carries them. Only states of the
     user's OWN bar — never a new claim about the data. ---- */
  const criteriaBuyer: string[] = [];
  const criteriaClient: string[] = [];
  if (outcomeInapplicable && minOutcome != null) {
    criteriaBuyer.push(
      `Your minimum-outcome criterion (${minOutcome}) doesn't apply to ${kpiLabel} — it has no purchase or lead count, so the criterion was not used.`
    );
    criteriaClient.push(
      `The minimum result count you set doesn't apply to ${kpiClient} reports, so it wasn't used here.`
    );
  }
  if (outcomeUnverifiable && minOutcome != null && nouns != null) {
    criteriaBuyer.push(
      `Your ${minOutcome}-${nouns.one} minimum couldn't be checked — this export has no ${nouns.one} count column, so the criterion was not applied.`
    );
    criteriaClient.push(
      `The minimum of ${minOutcome} ${nouns.many} you set couldn't be checked — this export doesn't include ${nouns.one} counts — so it wasn't applied.`
    );
  }
  if (rawScaleEligible && !proxyHeld && topBelowFloor && lead != null && top != null) {
    criteriaBuyer.push(
      `"${top.name}" leads by ${pct(top.deltaPct!)}% but has ${floorGaps(top)} — under the receiver floor (${floorPhrase}), so budget goes to ${receiverNames(receivers)} instead.`
    );
    criteriaClient.push(
      `"${top.name}" is ahead, but on too little spend and too few results to put more budget behind it yet — the extra budget goes to ads with a longer track record.`
    );
  }
  if (outcomeBlockedScale && receiverBlocked && minOutcome != null && nouns != null && top != null) {
    criteriaBuyer.push(
      `"${top.name}" is ${pct(top.deltaPct!)}% better than the median — over the ${SCALE_TEST_MIN_DELTA_PCT}% bar — but recorded ${topOutcomes} ${topOutcomes === 1 ? nouns.one : nouns.many}, below your ${minOutcome}-${nouns.one} minimum for a scaling decision, so no scale move is recommended.`
    );
    criteriaClient.push(
      `"${top.name}" is ahead, but with ${topOutcomes} ${topOutcomes === 1 ? nouns.one : nouns.many} so far it hasn't reached the ${minOutcome} you require before scaling — so we're not increasing its budget yet.`
    );
  }
  /* Evidence Confidence V2 — outcome-volume visibility. When the noise
     floor binds and the user set no bar of their own, say plainly why
     the evidence label stays limited and hand the judgment back to the
     user's own criterion (the floor is Debrief's minimal bar, never a
     practitioner judgment threshold). When the user DID set a bar,
     their criterion's own line above already carries the volume story. */
  /* Real-account follow-up: these volume lines describe the ad the read
     stands on — the primary receiver when the leader was passed over. */
  const subject = volumeSubject(analysis, criteria);
  const subjectOutcomes = subject?.conversions ?? null;
  const subjectRole =
    weakestReceiver(analysis, criteria) != null
      ? "The weakest ad receiving budget"
      : subject != null && subject !== top
        ? "The primary receiving ad"
        : "The leading ad";
  if (
    isOutcomeVolumeBelowFloor(analysis, criteria) &&
    minOutcome == null &&
    nouns != null &&
    subject != null &&
    subjectOutcomes != null
  ) {
    criteriaBuyer.push(
      `${subjectRole} has ${subjectOutcomes} ${subjectOutcomes === 1 ? nouns.one : nouns.many} behind its lead — under the ${MIN_OUTCOMES_FOR_SUPPORTED}-${nouns.one} noise floor this read requires before labeling evidence strongly supported. That floor is deliberately minimal (many practitioners want 30–50 before acting); set your own minimum in the generator to enforce a stricter bar.`
    );
    criteriaClient.push(
      `${subjectRole} has ${subjectOutcomes} ${subjectOutcomes === 1 ? nouns.one : nouns.many} so far — too few results for a strong read, so the evidence is treated as limited while volume builds.`
    );
  }
  /* Confidence follow-up: a budget move whose weakest receiver sits
     under 3× the purchase floor reads "limited" — say why, once. */
  const weakest = weakestReceiver(analysis, criteria);
  if (
    nouns != null &&
    weakest != null &&
    isReceiverVolumeBelowHighBar(analysis, criteria) &&
    !isOutcomeVolumeBelowFloor(analysis, criteria)
  ) {
    const n = weakest.conversions as number;
    const bar = HIGH_CONFIDENCE_OUTCOME_MULTIPLE * receiverOutcomeMin(criteria);
    criteriaBuyer.push(
      `The weakest ad receiving budget has ${n} ${n === 1 ? nouns.one : nouns.many} — under the ${bar} (${HIGH_CONFIDENCE_OUTCOME_MULTIPLE}× the ${receiverOutcomeMin(criteria)}-${nouns.one} floor) this read wants on every receiver before labeling evidence strongly supported. The move stands; the label stays limited until volume builds.`
    );
    criteriaClient.push(
      `The ads getting more budget have a moderate number of ${nouns.many} so far (the fewest is ${n}), so we're treating this as a solid but not yet strong read.`
    );
  }
  /* Evidence Confidence V2 — a structurally strong read whose outcome
     volume CANNOT be checked says so, instead of implying the volume
     was verified. Missing counts are never treated as zero. */
  if (
    evidenceState === "supported" &&
    nouns != null &&
    subject != null &&
    subjectOutcomes == null
  ) {
    criteriaBuyer.push(
      `Evidence here is based on relative separation — this export carries no ${nouns.one} counts, so the outcome volume behind the lead couldn't be checked.`
    );
    criteriaClient.push(
      `This export doesn't include ${nouns.one} counts, so the number of results behind the leading ad couldn't be checked.`
    );
  }

  /* Outcome-Consistency warning (QA C3): a positive outcome-based KPI
     on the leading ad alongside a verifiable outcome count of ZERO is
     internally inconsistent source data (the KPI and count columns can
     use different attribution or reporting settings). Disclosed as a
     verify-before-acting caveat — never a claim the export is wrong,
     and never a change to the action. Purchases/Leads KPIs can't
     trigger this (their KPI value IS the count). */
  const outcomeInconsistent =
    nouns != null &&
    top != null &&
    topOutcomes != null &&
    topOutcomes === 0 &&
    typeof top.kpiValue === "number" &&
    top.kpiValue > 0 &&
    analysis.kpi !== "purchases" &&
    analysis.kpi !== "leads";
  if (outcomeInconsistent && nouns != null && top != null) {
    criteriaBuyer.push(
      `"${top.name}" shows a positive ${kpiLabel} but a recorded ${nouns.one} count of 0 — the ${kpiLabel} and ${nouns.one}-count columns may use different attribution or reporting settings. Verify the numbers before acting on this ad.`
    );
    criteriaClient.push(
      `"${top.name}" shows results but a recorded count of 0 ${nouns.many} — the file's columns may be measuring differently, so it's worth double-checking this ad's numbers before acting.`
    );
  }
  /* Tester Feedback Fix 4: the default spend-floor/half-mean minimum
     is the one bar a reader can't reconstruct — say where it comes
     from. Target-CPA and user bars explain themselves (criteria list). */
  const gateSourceBuyer: string[] = [];
  const gateSourceClient: string[] = [];
  if (analysis.spendGateBasis === "floor_or_mean") {
    const src = spendGateSource(analysis, money);
    gateSourceBuyer.push(`The ${gateLabel} minimum spend per ad is ${src.buyer}`);
    gateSourceClient.push(`The ${gateLabel} minimum spend used to include an ad is ${src.client}.`);
  }
  /* Tester Feedback follow-up: each zero-conversion CPA ad set aside
     under the zero-conversion spend bar, named with the spend it needs. */
  const thin = analysis.zeroOutcomeThin;
  if (thin) {
    const nouns = outcomeNounsFor(analysis);
    const many = nouns?.many ?? "conversions";
    const one = nouns?.one ?? "conversion";
    const lines = zeroThinCopy(thin, analysis, money);
    if (lines) {
      gateSourceBuyer.push(lines.buyer);
      gateSourceClient.push(lines.client);
    }
    for (const z of lines ? [] : thin.ads) {
      gateSourceBuyer.push(
        `"${z.name}" spent ${money(z.spend)} with 0 ${many} — not enough spend yet to call it (${
          thin.needs != null
            ? `needs ≥ ${money(thin.needs)}`
            : `no other ad has a ${kpiLabel} to measure it against yet`
        }).`
      );
      gateSourceClient.push(
        `"${z.name}" has spent ${money(z.spend)} without a ${one} so far — too early to call${
          thin.needs != null ? ` (it needs about ${money(thin.needs)} of spend)` : " until other ads have results to compare it with"
        }.`
      );
    }
  }
  /* Trust Pass 4: proxy-KPI caveats. With an outcome KPI available, say
     why budget moves are held; without one, the move stands but its
     basis is named. (The latter is appended in B1 below — it applies
     only to a budget move.) */
  if (proxyHeld && proxyCopy) {
    gateSourceBuyer.push(
      `${proxyCopy.buyer} — budget moves are held until the ads are read on ${outcomeNames}, which this export also supports.`
    );
    gateSourceClient.push(
      `This report ranks ads by ${proxyCopy.client}, so we're not moving budget on it — the file also has ${outcomeClientNames}, which show actual results.`
    );
  }
  const limits = {
    buyer: [...baseLimits.buyer, ...gateSourceBuyer, ...criteriaBuyer],
    client: [...baseLimits.client, ...gateSourceClient, ...criteriaClient],
  };

  /* ---- Decision Criteria V2: the bars that participated in this
     call, each with provenance. Always built — Debrief's defaults are
     labeled as Debrief's rules, never presented as universal truth. ---- */
  const appliedCriteria: AppliedCriterion[] = [
    bar("gate", {
      label: userGate
        ? `Minimum spend to judge: ${gateLabel} per ad — your criterion`
        : analysis.spendGateBasis === "target_cpa"
          ? `Minimum spend to judge: ${gateLabel} per ad (3× your target CPA) — Debrief default rule`
          : `Minimum spend to judge: ${gateLabel} per ad — Debrief default: ${spendGateSource(analysis, money).buyer}`,
      source: userGate ? "user" : "debrief_default",
    }),
    ...(analysis.outcomeFloor
      ? [
          {
            label: `Minimum ${analysis.outcomeFloor.nouns.many} to judge an ad: ${analysis.outcomeFloor.min} — your criterion`,
            source: "user" as const,
          },
        ]
      : []),
    bar("sample", {
      label: `Minimum sample: ≥${DECISION_MIN_JUDGED} judged ads before any call — Debrief default`,
      source: "debrief_default",
    }),
    bar("move", {
      label: `Budget-move bar: an ad receiving budget is ≥${SCALE_TEST_MIN_DELTA_PCT}% better than the median — Debrief default`,
      source: "debrief_default",
    }),
    bar("floor", {
      label: `Receiver floor: ${nouns != null && minOutcome == null ? `≥${receiverMin} ${nouns.many} and ` : ""}≥ ${receiverSpendLabel} spent (${RECEIVER_SPEND_WORDS}) before an ad receives budget; up to ${MAX_BUDGET_RECEIVERS} receivers — Debrief default`,
      source: "debrief_default",
    }),
    bar("cut", {
      label: `Cut bar: worst ad ≥${SCALE_TEST_MIN_DELTA_PCT}% behind and ≥${CUT_MIN_SPEND_SHARE_PCT}% of judged spend below the median — Debrief default`,
      source: "debrief_default",
    }),
    bar("flat", {
      label: `Flat-field band: every judged ad within ±${FLAT_FIELD_DELTA_PCT}% of the median reads as noise, not signal — Debrief default`,
      source: "debrief_default",
    }),
    ...(minOutcome != null && nouns != null
      ? [
          {
            label: `Scaling minimum: ≥${minOutcome} ${nouns.many} on the ad being scaled — your criterion`,
            source: "user" as const,
          },
        ]
      : []),
  ];

  const nextControlledTest = nextTestFacts
    ? {
        preserve: nextTestFacts.preserve,
        change: nextTestFacts.change,
        /* 3a: an outcome-led test watches the outcome KPI. */
        watch: isProxyOutcomeConflict(analysis) ? analysis.proxyKpi!.outcome!.label : kpiLabel,
      }
    : undefined;
  const evidence: Pick<MemoDecision, "evidenceState" | "limits" | "appliedCriteria"> &
    Partial<Pick<MemoDecision, "evidenceShape" | "nextControlledTest">> = {
    evidenceState,
    limits,
    appliedCriteria,
  };
  if (evidenceShape) evidence.evidenceShape = evidenceShape;
  if (nextControlledTest) evidence.nextControlledTest = nextControlledTest;

  const insufficientHold = (): MemoDecision => ({
    ...evidence,
    action: "hold",
    holdReason: "insufficient_data",
    headline: `Hold — ${analysis.adsJudged} of ${analysis.adsAnalyzed} ads reached the ${gatePhrase}; this call needs ${DECISION_MIN_JUDGED}.`,
    clientHeadline:
      "Hold — most ads haven't had enough spend to judge fairly yet.",
    rationale: `Fewer than ${DECISION_MIN_JUDGED} judged ads is too thin a base for a budget or test call — any pattern at this size is as likely noise as signal.`,
    clientRationale:
      "With this little qualifying spend, an apparent winner is as likely luck as a real pattern. Letting the data build is the fastest route to a call you can trust.",
    avoidNow: {
      buyer: ["Don't launch another test into this account yet."],
      client: ["We're not adding anything new while the data builds."],
    },
    reassess: {
      buyer: `Reassess when ≥${DECISION_MIN_JUDGED} ads reach the ${gatePhrase}.`,
      client: `We'll revisit once at least ${DECISION_MIN_JUDGED} ads have spent about ${gateLabel} each${clientGateSuffix}.`,
    },
    /* First-Run Fixes: when the hold is caused (at least partly) by ads
       with no KPI value, say so — only on the H1 path, where "too few
       judged ads" is actually the reason. */
    ...(analysis.kpiGaps && analysis.adsJudged < DECISION_MIN_JUDGED
      ? kpiGapHold(analysis, analysis.kpiGaps, gatePhrase)
      : !analysis.kpiGaps && analysis.outcomeFloor && analysis.outcomeFloor.setAside.length > 0 && analysis.adsJudged < DECISION_MIN_JUDGED
        ? floorHold(analysis.outcomeFloor)
        : {}),
  });
  /* First-Run Robustness 2: when the user's outcome minimum is what
     leaves too few ads, say so — not "too little spend". */
  function floorHold(
    floor: NonNullable<AnalysisResult["outcomeFloor"]>
  ): Pick<MemoDecision, "headline" | "clientHeadline" | "reassess"> {
    const k = floor.setAside.length;
    const spendOnly =
      analysis.adsSetAside - k - (analysis.zeroOutcomeThin?.ads.length ?? 0);
    return {
      headline: `Hold — only ${analysis.adsJudged} of ${analysis.adsAnalyzed} ads could be judged: ${k} ${k === 1 ? "has" : "have"} fewer than your ${floor.min}-${floor.nouns.one} minimum${
        spendOnly > 0 ? `, and ${spendOnly} more didn't reach the ${gatePhrase}` : ""
      }. This call needs ${DECISION_MIN_JUDGED}.`,
      clientHeadline: `Hold — ${k} ad${k === 1 ? "" : "s"} ${k === 1 ? "has" : "have"} fewer ${floor.nouns.many} than the minimum you set, so there isn't enough to compare yet.`,
      reassess: {
        buyer: `Reassess when ≥${DECISION_MIN_JUDGED} ads have ≥${floor.min} ${floor.nouns.many} and reach the ${gatePhrase} — or lower your minimum.`,
        client: `We'll revisit once at least ${DECISION_MIN_JUDGED} ads have ${floor.min}+ ${floor.nouns.many} each.`,
      },
    };
  }

  /* ---- H1: too few judged ads ---- */
  if (analysis.adsJudged < DECISION_MIN_JUDGED) {
    return insufficientHold();
  }

  /* ---- B1: budget move (shift / scale / cut copy variants) ---- */
  /* Real-account fix 2 follow-up: no receiver + a cut that clears is a
     Trim (cut-only) — a test only when neither bar clears. */
  if (scaleEligible || cutEligible) {
    /* Trust Pass 4: a proxy KPI with NO outcome column in the export —
       the move stands (nothing better to read), but its basis is named. */
    if (analysis.proxyKpi && proxyCopy && !proxyHeld) {
      evidence.limits = {
        buyer: [
          ...evidence.limits.buyer,
          `This budget move is based on ${kpiLabel}, a proxy metric — ${proxyCopy.buyer.replace(/^\w+ /, "it ")}. The export has no ROAS or CPA column to check it against; confirm against purchases or revenue in Ads Manager before moving much budget.`,
        ],
        client: [
          ...evidence.limits.client,
          `This budget change is based on ${proxyCopy.client}. The file doesn't include sales figures, so check it against actual results before moving much budget.`,
        ],
      };
    }
    /* Trust Pass: the full from/to lists behind the headline's names. */
    const fromAds = analysis.losers.map((a) => ({ name: a.name, spendLabel: money(a.spend) }));
    const toAds = receivers.map((a) => ({ name: a.name, spendLabel: money(a.spend) }));
    /* Trust Pass 3d: the already-computed below-median spend, so the move
       is concrete — no new percentage or amount is invented. */
    const belowSpendLabel = money(analysis.belowBenchmarkSpend);
    /* Trust Pass 3a: the card surfaces a "Next controlled test" whenever
       nextTestFacts exist — so "don't pair this with a test" would
       contradict it. The avoid line sequences the test instead. */
    const testOnCard = nextTestFacts != null;
    const sequenceTest = {
      buyer: `Run the test below only after the budget move has ~${gateLabel} of fresh spend — one variable at a time.`,
      client: `We'll start the test below only after the budget change has had about ${gateLabel} of new spend, so each result stays readable.`,
    };
    const avoidBuyer: string[] = [];
    const avoidClient: string[] = [];

    if (scaleEligible && winnerShare >= CONCENTRATION_GUARDRAIL_PCT) {
      // Copy-only guardrail — the action below is unchanged by this.
      avoidBuyer.push(
        `Don't consolidate further — "${lead!.name}" already holds ${pct(winnerShare)}% of judged spend; scale in steps.`
      );
      avoidClient.push(
        `We're increasing the leader's budget in steps, not all at once — it already carries ${pct(winnerShare)}% of the working budget.`
      );
    }

    /* Real-account fix 2: each receiver's own evidence, so the move is
       visibly earned — and the below-median total is described as where
       money sits, never as the amount to move. */
    const many = receivers.length > 1;
    const receiverFacts = receivers
      .map(
        (r) =>
          `"${r.name}" is ${pct(r.deltaPct!)}% better than the median ${kpiLabel} on ${money(r.spend)}${
            nouns != null && r.conversions != null ? ` with ${r.conversions} ${r.conversions === 1 ? nouns.one : nouns.many}` : ""
          }`
      )
      .join("; ");
    /* Real-account follow-up: >2 trimmed ads or >1 receiver ⇒ the
       headline counts; the names stay in the Pause / Receives lines. */
    const countForm = analysis.belowBenchmarkCount > 2 || receivers.length > 1;
    const minReceiverOutcomes =
      nouns != null && receivers.length > 0 && receivers.every((r) => r.conversions != null)
        ? Math.min(...receivers.map((r) => r.conversions as number))
        : null;
    const receiversCounted =
      receivers.length > 1
        ? `${receivers.length} ads${minReceiverOutcomes != null ? ` with ${minReceiverOutcomes}+ ${nouns!.many} each` : ""}`
        : receiverNames(receivers);
    const losersCounted = `${analysis.belowBenchmarkCount} below-median ad${analysis.belowBenchmarkCount === 1 ? "" : "s"}`;
    const passedOver = topBelowFloor && top != null && lead != null && top !== lead
      ? ` "${top.name}" leads but sits under the receiver floor, so it isn't scaled.`
      : "";
    const reassess = {
      buyer: `Reassess once the new allocation has ≥${gateLabel} of fresh spend behind it.`,
      client: `We'll revisit after the new setup has about ${gateLabel} of new spend to show results.`,
    };

    if (scaleEligible && cutEligible) {
      avoidBuyer.push(testOnCard ? sequenceTest.buyer : "Don't pair this with a new creative test — one variable at a time.");
      avoidClient.push(testOnCard ? sequenceTest.client : "We're making this one change on its own so results stay readable.");
      return {
        ...evidence,
        limits: withEfficiencyScaleCaveat(
          withMaterialActionVerificationGuardrail(evidence.limits),
          testQuality?.objective
        ),
        action: "budget",
        budgetVariant: "shift",
        budgetMove: { from: fromAds, to: toAds, belowSpendLabel },
        headline: countForm
          ? `Shift budget in steps from ${losersCounted} into ${receiversCounted}.`
          : `Shift budget in steps from ${loserNames(analysis)} into ${receiverNames(receivers)}.`,
        clientHeadline: many
          ? `Trim the weakest ads and step up budget on the ${receivers.length} clear leaders.`
          : `Trim the weakest ads and step up budget on "${lead!.name}", the clear leader.`,
        rationale: `${receiverFacts}.${passedOver} ${analysis.belowBenchmarkCount} below-median ads hold ${pct(belowShare)}% of judged spend (${money(analysis.belowBenchmarkSpend)}) — where the money sits, not the amount to move: trim the weakest first and raise ${many ? "the receivers" : "the receiver"} in steps, re-reading after each.`,
        clientRationale: `${many ? "These ads are" : `"${lead!.name}" is`} clearly ahead with real results behind ${many ? "them" : "it"} while several ads sit well behind — trimming the weakest and stepping up the leader${many ? "s" : ""} captures that gap without betting everything at once.`,
        avoidNow: { buyer: avoidBuyer.slice(0, 2), client: avoidClient.slice(0, 2) },
        reassess,
      };
    }

    if (scaleEligible) {
      avoidBuyer.push(testOnCard ? sequenceTest.buyer : "No new creative test alongside the scale — one variable at a time.");
      avoidClient.push(testOnCard ? sequenceTest.client : "We're making this one change on its own so results stay readable.");
      return {
        ...evidence,
        limits: withEfficiencyScaleCaveat(
          withMaterialActionVerificationGuardrail(evidence.limits),
          testQuality?.objective
        ),
        action: "budget",
        budgetVariant: "scale",
        budgetMove: { from: [], to: toAds },
        headline: many
          ? `Scale ${receiversCounted} in steps — each over the ${SCALE_TEST_MIN_DELTA_PCT}% bar.`
          : `Scale "${lead!.name}" in steps — ${pct(lead!.deltaPct!)}% better than the median, over the ${SCALE_TEST_MIN_DELTA_PCT}% bar.`,
        clientHeadline: `Increase spend on ${receiverNames(receivers)} in steps — ${many ? "they're" : "it's"} clearly outperforming.`,
        rationale: `${receiverFacts} — past the ${SCALE_TEST_MIN_DELTA_PCT}% bar this memo requires before any budget move.${passedOver} ${belowShare >= CUT_MIN_SPEND_SHARE_PCT ? `No cut: ${pct(belowShare)}% of judged spend sits below the median, but the weakest ad isn't ${SCALE_TEST_MIN_DELTA_PCT}% behind it.` : `No loser group is large enough to cut (${pct(belowShare)}% of judged spend, under the ${CUT_MIN_SPEND_SHARE_PCT}% bar).`}`,
        clientRationale: many
          ? `These ads are delivering clearly better ${kpiClient} than the middle ad in this account, with real spend and results behind them — they've earned more budget, added in steps.`
          : `"${lead!.name}" is delivering about ${pct(lead!.deltaPct!)}% better ${kpiClient} than the middle ad in this account, with real spend behind it — it has earned more budget, added in steps.`,
        avoidNow: { buyer: avoidBuyer.slice(0, 2), client: avoidClient.slice(0, 2) },
        reassess,
      };
    }

    // cut-only
    avoidBuyer.push(
      testOnCard
        ? `Park the freed budget behind current ads; start the test below only after the cut has ~${gateLabel} of fresh spend.`
        : "Don't move the freed budget into a new test yet — park it behind current ads."
    );
    avoidClient.push(
      testOnCard
        ? `The freed budget stays with the current ads; the test below starts once that change has had about ${gateLabel} of new spend.`
        : "We're not starting anything new with the freed budget yet."
    );
    return {
      ...evidence,
      limits: withMaterialActionVerificationGuardrail(evidence.limits),
      action: "budget",
      budgetVariant: "cut",
      budgetMove: { from: fromAds, to: [], belowSpendLabel },
      headline:
        analysis.belowBenchmarkCount > 2
          ? `Trim ${analysis.belowBenchmarkCount} below-median ads; hold everything else steady.`
          : `Trim ${loserNames(analysis)}; hold everything else steady.`,
      clientHeadline: "Pause the weakest ads; keep the rest running as is.",
      rationale: `${analysis.belowBenchmarkCount} ads sit ≥${SCALE_TEST_MIN_DELTA_PCT}% below the median ${kpiLabel} at the worst end, holding ${pct(belowShare)}% of judged spend (${money(analysis.belowBenchmarkSpend)}). ${
        receiverBlocked && top != null
          ? `No ad qualifies to receive budget — "${top.name}" leads by ${pct(top.deltaPct!)}% but has ${floorGaps(top)}, under the receiver floor (${floorPhrase}) — so the move is trimming the leak, not scaling.`
          : `No winner clears the ${SCALE_TEST_MIN_DELTA_PCT}% scale bar, so the move is stopping the leak — not scaling.`
      }`,
      clientRationale: `The weakest ads are far behind the rest and are using ${pct(belowShare)}% of the budget that's had a fair chance to perform — pausing them stops the leak without touching what works.`,
      avoidNow: { buyer: avoidBuyer.slice(0, 2), client: avoidClient.slice(0, 2) },
      reassess,
    };
  }

  /* ---- H2: flat field (flatField computed above, once, for both this
     rule and the evidence label) ---- */
  if (flatField) {
    return {
      ...evidence,
      action: "hold",
      holdReason: "flat_performance",
      headline: `Hold — every judged ad is within ${FLAT_FIELD_DELTA_PCT}% of the median. Another change won't separate a flat field.`,
      clientHeadline:
        "Performance is even across ads. The best move is patience, not more changes.",
      rationale: `Top ad ${top?.deltaPct != null ? `+${pct(top.deltaPct)}%` : "±0%"}, worst ${worst?.deltaPct != null ? `${pct(worst.deltaPct)}%` : "±0%"} vs the median ${kpiLabel} — inside the ±${FLAT_FIELD_DELTA_PCT}% band where differences are as likely noise as signal.`,
      clientRationale:
        "All ads are performing at a similar level right now, so changing things would be reacting to noise. Letting them run builds the evidence for a confident next step.",
      avoidNow: {
        buyer: ["Don't add new variables — let the current set accrue spend."],
        client: ["We're leaving the current ads to run as they are."],
      },
      reassess: {
        buyer: `Reassess when any judged ad moves ≥${FLAT_FIELD_DELTA_PCT}% from the median.`,
        client: `We'll revisit when any ad pulls at least ${FLAT_FIELD_DELTA_PCT}% ahead of — or behind — the pack.`,
      },
    };
  }

  /* ---- T1: run the top test ---- */
  if (firstTestTitle != null && firstTestTitle.trim() !== "") {
    const testTitle = stripTrailingPeriod(firstTestTitle);
    /* Trust Pass 4: the proxy rule withheld a move the rules would
       otherwise have made — say exactly that, and offer the switch. */
    if (proxyDowngraded && proxyCopy) {
      const switchTo = outcomeKpis[0];
      return {
        ...evidence,
        action: "test",
        kpiSwitch: { kpi: switchTo.kpi, label: switchTo.label },
        headline: `Run one test: ${testTitle}. No budget move on ${kpiLabel} — switch to ${outcomeNames} first.`,
        clientHeadline: `Run one focused test next: ${testTitle}.`,
        rationale: `${proxyCopy.buyer} — switch to ${outcomeNames} before moving budget. On ${kpiLabel} alone this would be a budget move (top ad ${top?.deltaPct != null ? `+${pct(top.deltaPct)}%` : "±0%"} vs the median, ${pct(belowShare)}% of judged spend below it), but this export also has ${outcomeNames}, which measure results.`,
        clientRationale: `This report ranks ads by ${proxyCopy.client}. The file also has ${outcomeClientNames}, which show actual results — we'll read the ads on that before moving any budget.`,
        avoidNow: {
          buyer: [`No budget moves on ${kpiLabel} — re-run on ${outcomeNames} before shifting spend.`],
          client: ["We're not moving budget until the ads are compared on actual results."],
        },
        reassess: {
          buyer: `Re-run this debrief on ${switchTo.label} before any budget decision; reassess the test at the ${gatePhrase}.`,
          client: `We'll re-check the ads on ${switchTo.clientLabel} before any budget change, and revisit the test once it has spent about ${gateLabel}${clientGateSuffix}.`,
        },
      };
    }
    return {
      ...evidence,
      action: "test",
      /* Real-account fix 2: a lead past the bar that no ad can receive
         says exactly why in one line — the floor and what the leader has. */
      headline: receiverBlocked
        ? `Run one test: ${testTitle}. No ad has enough evidence to receive budget yet.`
        : `Run one test: ${testTitle}. Nothing has earned a budget move yet.`,
      clientHeadline: `Run one focused test next: ${testTitle}.`,
      rationale:
        receiverBlocked && top != null
          ? `No budget move: "${top.name}" leads by ${pct(top.deltaPct!)}% but has ${floorGaps(top)}, and no ad past the ${SCALE_TEST_MIN_DELTA_PCT}% bar clears the receiver floor (${floorPhrase}). The strongest evidence-backed move is a test, not a budget change.`
          : `Top ad ${top?.deltaPct != null ? `+${pct(top.deltaPct)}%` : "±0%"} vs the ${SCALE_TEST_MIN_DELTA_PCT}% scale bar; below-median spend ${pct(belowShare)}% vs the ${CUT_MIN_SPEND_SHARE_PCT}% cut bar. Neither clears, so the strongest evidence-backed move is a test, not a budget change.`,
      clientRationale: receiverBlocked
        ? `The leading ad is ahead, but on too little spend and too few results to safely put more budget behind it — the fastest path to a confident move is one focused test.`
        : "No single ad is far enough ahead or behind to justify moving budget yet — the fastest path to a clear winner is one focused test.",
      avoidNow: {
        buyer: [
          receiverBlocked
            ? `No budget moves yet — no ad clears the receiver floor (${floorPhrase}).`
            : `No budget moves yet — nothing has cleared the ${SCALE_TEST_MIN_DELTA_PCT}% bar.`,
        ],
        client: [
          receiverBlocked
            ? "We're not moving budget yet — no ad has enough spend and results behind it to receive more."
            : "We're not moving budget yet — no ad has separated enough yet.",
        ],
      },
      reassess: {
        buyer: `Reassess when the test reaches the ${gatePhrase} — then judge it against the median.`,
        client: `We'll revisit once the test has spent about ${gateLabel}${clientGateSuffix} — enough for a fair read.`,
      },
    };
  }

  // No test available either (e.g. no rankable ads) — the honest
  // fallback is the insufficient-data hold, per spec.
  return insufficientHold();
}
