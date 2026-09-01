// Explicit ".ts" extension, same load-bearing reason as decision.ts and
// compare.ts: types.ts imports nothing, so this file's whole dependency
// chain resolves under plain Node's type-stripping test runner
// (scripts/briefReadiness.test.ts).
import { MIN_OUTCOMES_FOR_SUPPORTED } from "./decision.ts";
import { outcomeNounsForKpi } from "./types.ts";
import type {
  AnalysisResult,
  AppliedCriterion,
  DecisionCriteria,
  MemoBriefReadiness,
  RankedAd,
} from "./types.ts";

/**
 * Evidence Sufficiency + Brief Readiness V1.
 *
 * A SEPARATE question from decision.ts's evidenceState (whole-dataset
 * decision readiness) and memo.ts's confidence.level (whole-dataset
 * trust): "is THIS specific observed win/loss strong enough to
 * responsibly brief creative against?" Evidence sufficient to make a
 * performance decision is NOT necessarily evidence sufficient to claim
 * a durable creative pattern.
 *
 * Isolation contract (test-enforced, mirrors compare.ts/decision.ts):
 * decision.ts must NEVER import this file. This file MAY read
 * decision.ts's exported constants (one-directional — MIN_OUTCOMES_FOR_
 * SUPPORTED is reused below rather than duplicated), but nothing here
 * ever feeds back into the committed decision, evidenceState, or
 * confidence.level. Comparison presence/absence is never an input
 * either — brief readiness is a current-period read, same as the
 * decision it deliberately never touches.
 *
 * Winner-side and loser-side use genuinely different rules, because
 * they're answering genuinely different questions:
 *  - Winner (Signal Volume): a COUNT question — how many independent
 *    successes have been observed? Confidence in a pattern scales with
 *    the number of positive trials, regardless of spend.
 *  - Loser (Loss Confidence): a SPEND/OPPORTUNITY question — did the
 *    auction get a fair enough shot to prove itself? Zero conversions
 *    on trivial spend proves nothing; zero conversions on several
 *    multiples of a real cost target is a real signal.
 * Practitioner methodology feedback (Yogesh) is the basis for both
 * disclosed defaults below — never presented as universal truth,
 * always overridable, always labeled with provenance.
 */

/** Winner-side default: Debrief's own disclosed, practitioner-informed
 *  starting bar for treating an observed win as an established pattern
 *  worth briefing creative against. NOT a universal scientific
 *  threshold — many practitioners use their own bar; this is a
 *  starting point, always overridable via DecisionCriteria.
 *  minBriefOutcomeCount. Deliberately a DIFFERENT, higher number than
 *  decision.ts's MIN_OUTCOMES_FOR_SUPPORTED (10) — that one is a
 *  minimal noise floor for LABELING dataset-wide evidence; this one is
 *  a stricter, brief-specific bar for a much narrower claim ("brief
 *  real creative production against this"). */
export const BRIEF_READY_MIN_OUTCOMES = 50;

/** Loser-side default: Debrief's own disclosed, practitioner-informed
 *  starting multiple of the ad's cost target (or, absent one, this
 *  account's own evidence gate as a stand-in) the ad must have spent
 *  before its underperformance reads as confident rather than possibly
 *  under-tested. The conservative end of "roughly 2-3x" practitioner
 *  feedback — many practitioners prefer 3x or higher before fully
 *  writing an ad off; set your own bar via DecisionCriteria.
 *  minLossSpendMultiple. */
export const LOSS_CONFIDENT_SPEND_MULTIPLE = 2;

function criterionLabel(
  defaultLabel: string,
  userLabel: string,
  isUser: boolean
): AppliedCriterion {
  return { label: isUser ? userLabel : defaultLabel, source: isUser ? "user" : "debrief_default" };
}

/**
 * Winner-side "Signal Volume" readiness: is there enough observed
 * outcome volume behind this leading ad to confidently treat its win
 * as an established pattern? null when the selected KPI has no outcome
 * concept at all (CTR/CPC) — there is nothing to gate on this axis, so
 * no readiness claim is made either way (not "insufficient": simply
 * not applicable).
 *
 * Missing ≠ zero: an unverifiable count (no purchase/lead column in
 * the export) is never silently treated as 0 — it reads "directional"
 * with an explicit couldn't-verify line, the same honest middle state
 * isOutcomeVolumeBelowFloor already established for evidenceState.
 */
export function deriveSignalVolumeReadiness(
  analysis: AnalysisResult,
  criteria: DecisionCriteria | undefined,
  nounOne: string,
  nounMany: string
): MemoBriefReadiness | null {
  if (outcomeNounsForKpi(analysis.kpi) == null) return null;
  const top: RankedAd | null = analysis.winners[0] ?? null;
  if (top == null) return null;

  const userBar =
    criteria?.minBriefOutcomeCount != null && criteria.minBriefOutcomeCount > 0
      ? criteria.minBriefOutcomeCount
      : null;
  const bar = userBar ?? BRIEF_READY_MIN_OUTCOMES;
  const isUserBar = userBar != null;
  const criterion = criterionLabel(
    `Brief-ready signal volume: ≥${bar} ${nounMany} on the leading ad — Debrief default (practitioner-informed, not a universal threshold)`,
    `Brief-ready signal volume: ≥${bar} ${nounMany} on the leading ad — your criterion`,
    isUserBar
  );

  const n = top.conversions ?? null;

  if (n == null) {
    return {
      state: "directional",
      buyer: `Directional — this export has no ${nounOne} count for "${top.name}", so the volume behind its lead can't be verified either way. Treat it as an early signal, not a confirmed pattern, until you can check.`,
      client: `We can't verify how many results are behind "${top.name}"'s lead yet, so we're treating it as an early sign rather than a confirmed pattern.`,
      criterion,
    };
  }
  if (n < MIN_OUTCOMES_FOR_SUPPORTED) {
    return {
      state: "insufficient",
      buyer: `Not enough evidence — "${top.name}" has only ${n} ${n === 1 ? nounOne : nounMany}, under this read's minimal ${MIN_OUTCOMES_FOR_SUPPORTED}-${nounOne} noise floor. Treat this as a hypothesis to log, not yet a pattern to brief creative against.`,
      client: `We don't have enough results from "${top.name}" yet to treat this as a real pattern — it's an early idea worth watching, not something to build a campaign around yet.`,
      criterion,
    };
  }
  if (n < bar) {
    return {
      state: "directional",
      buyer: `Directional — "${top.name}" has ${n} ${nounMany}, past this read's minimal ${MIN_OUTCOMES_FOR_SUPPORTED}-${nounOne} floor but under the ${bar}-${nounOne} bar this read uses before calling the pattern established (${isUserBar ? "your criterion" : "Debrief default, practitioner-informed — set your own"}).`,
      client: `"${top.name}" is showing a real early sign, but we don't have enough results yet to call it a confirmed pattern.`,
      criterion,
    };
  }
  return {
    state: "ready",
    buyer: `Ready — "${top.name}" has ${n} ${nounMany}, at or past the ${bar}-${nounOne} bar this read uses before treating a win as an established creative pattern (${isUserBar ? "your criterion" : "Debrief default, practitioner-informed"}).`,
    client: `We've seen enough results from "${top.name}" to treat this as a real pattern, not just an early sign.`,
    criterion,
  };
}

/**
 * Loser-side "Loss Confidence" readiness: has this losing ad had enough
 * opportunity/spend to justify treating its underperformance as
 * meaningful, rather than simply under-tested?
 *
 * Two computation bases, never conflated:
 *  - A true target-CPA multiple (spend ÷ targetCpa) when the user
 *    supplied one — the literal practitioner framing. IMPORTANT: when
 *    targetCpa is set, analysis.ts's spend gate is already 3×targetCpa,
 *    so every judged ad automatically clears a 3x multiple by
 *    construction. This function does not hide that — the copy says so
 *    explicitly rather than presenting an already-guaranteed number as
 *    new evidence.
 *  - A disclosed PROXY multiple (spend ÷ this account's own evidence
 *    gate) when no target CPA exists — the only defensible basis
 *    available, honestly labeled as a stand-in. Capped at "directional"
 *    at best: without a true cost target, "ready" is never claimed.
 */
export function deriveLossConfidenceReadiness(
  analysis: AnalysisResult,
  targetCpa: number | null,
  criteria: DecisionCriteria | undefined,
  money: (value: number) => string
): MemoBriefReadiness | null {
  const worst: RankedAd | null = analysis.losers[0] ?? null;
  if (worst == null) return null;

  const userBar =
    criteria?.minLossSpendMultiple != null && criteria.minLossSpendMultiple > 0
      ? criteria.minLossSpendMultiple
      : null;
  const bar = userBar ?? LOSS_CONFIDENT_SPEND_MULTIPLE;
  const isUserBar = userBar != null;

  if (targetCpa != null && targetCpa > 0) {
    const multiple = worst.spend / targetCpa;
    const criterion = criterionLabel(
      `Loss confidence: ≥${bar}× target CPA spent on a losing ad — Debrief default (practitioner-informed, not a universal threshold)`,
      `Loss confidence: ≥${bar}× target CPA spent on a losing ad — your criterion`,
      isUserBar
    );
    const gateNote =
      analysis.spendGateBasis === "target_cpa"
        ? " This account's evidence gate already requires 3× target CPA before any ad is judged at all, so this bar is already assured for every judged ad here."
        : "";
    if (multiple >= bar) {
      return {
        state: "ready",
        buyer: `Ready — "${worst.name}" has spent ${multiple.toFixed(1)}× your ${money(targetCpa)} target CPA, past the ${bar}× bar this read uses before calling underperformance confident (${isUserBar ? "your criterion" : "Debrief default"}).${gateNote}`,
        client: `"${worst.name}" has had a fair amount of spend relative to your cost target without turning around — we're confident this is a real underperformance, not noise.`,
        criterion,
      };
    }
    return {
      state: "insufficient",
      buyer: `Not enough evidence — "${worst.name}" has spent only ${multiple.toFixed(1)}× your ${money(targetCpa)} target CPA, under the ${bar}× bar this read uses before calling a loss confident.`,
      client: `We haven't spent enough relative to your cost target yet to be confident this ad is truly underperforming — we're giving it more time before calling it a loss.`,
      criterion,
    };
  }

  // No target CPA: the only defensible basis is this account's own
  // evidence gate, honestly labeled as a stand-in — never presented as
  // equivalent to a real cost target, and never allowed to reach "ready".
  const proxyMultiple = analysis.spendGate > 0 ? worst.spend / analysis.spendGate : 0;
  const criterion = criterionLabel(
    `Loss confidence: ≥${bar}× this account's evidence gate spent on a losing ad (no target CPA set) — Debrief default (practitioner-informed, not a universal threshold)`,
    `Loss confidence: ≥${bar}× this account's evidence gate spent on a losing ad (no target CPA set) — your criterion`,
    isUserBar
  );
  if (proxyMultiple >= bar) {
    return {
      state: "directional",
      buyer: `Directional — no target CPA was set, so this uses this account's ${money(analysis.spendGate)} evidence gate as a stand-in: "${worst.name}" has spent ${proxyMultiple.toFixed(1)}× that gate, past the ${bar}× bar. Treat this as suggestive, not a confirmed loss, until a target CPA is set for a fully confident read.`,
      client: `We're treating "${worst.name}" as a likely underperformer based on how much it's spent relative to typical spend in this account — set a cost target for a more confident read.`,
      criterion,
    };
  }
  return {
    state: "insufficient",
    buyer: `Not enough evidence — "${worst.name}" has spent only ${proxyMultiple.toFixed(1)}× this account's ${money(analysis.spendGate)} evidence gate (no target CPA set), under the ${bar}× bar this read requires.`,
    client: `This ad hasn't spent enough yet, relative to typical spend in this account, for us to be confident it's truly underperforming.`,
    criterion,
  };
}
