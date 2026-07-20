// The ".ts" extension on this import is deliberate and load-bearing:
// types.ts imports nothing, so with an explicit extension this file's
// whole dependency chain resolves under plain Node's type-stripping
// test runner (scripts/decision.test.ts) — the same pattern
// modules/competitorDebrief uses. The rest of modules/debrief uses
// extensionless imports and is NOT directly Node-importable; that is
// why buildDecision takes a money formatter as an argument instead of
// importing format.ts (whose own internal import is extensionless).
import { KPI_LABELS } from "./types.ts";
import type { AnalysisResult, MemoDecision } from "./types.ts";

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

/** Injected money formatter: (value) => "$1,234.56"-style label.
 *  memo.ts binds fmtMoney with the account currency; tests pass a
 *  simple stub. */
export type MoneyFormatter = (value: number) => string;

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

export function buildDecision(
  analysis: AnalysisResult,
  firstTestTitle: string | null,
  money: MoneyFormatter
): MemoDecision {
  const kpiLabel = KPI_LABELS[analysis.kpi];
  const gateLabel = money(analysis.spendGate);
  const top = analysis.winners[0] ?? null;
  const worst = analysis.losers[0] ?? null;

  /* ---- shared eligibility facts (null-guarded: a zero median makes
     deltaPct null, which simply disqualifies the affected rule rather
     than guessing) ---- */
  const scaleEligible =
    top != null && top.deltaPct != null && top.deltaPct >= SCALE_TEST_MIN_DELTA_PCT;
  const belowShare =
    analysis.judgedSpend > 0
      ? (analysis.belowBenchmarkSpend / analysis.judgedSpend) * 100
      : 0;
  const cutEligible =
    worst != null &&
    worst.deltaPct != null &&
    worst.deltaPct <= -SCALE_TEST_MIN_DELTA_PCT &&
    belowShare >= CUT_MIN_SPEND_SHARE_PCT;
  const winnerShare =
    top != null && analysis.judgedSpend > 0
      ? (top.spend / analysis.judgedSpend) * 100
      : 0;

  const insufficientHold = (): MemoDecision => ({
    action: "hold",
    holdReason: "insufficient_data",
    headline: `Hold — ${analysis.adsJudged} of ${analysis.adsAnalyzed} ads cleared the ${gateLabel} spend gate; this call needs ${DECISION_MIN_JUDGED}.`,
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
      buyer: `Reassess when ≥${DECISION_MIN_JUDGED} ads clear the ${gateLabel} spend gate.`,
      client: `We'll revisit once at least ${DECISION_MIN_JUDGED} ads have spent about ${gateLabel} each.`,
    },
  });

  /* ---- H1: too few judged ads ---- */
  if (analysis.adsJudged < DECISION_MIN_JUDGED) {
    return insufficientHold();
  }

  /* ---- B1: budget move (shift / scale / cut copy variants) ---- */
  if (scaleEligible || cutEligible) {
    const avoidBuyer: string[] = [];
    const avoidClient: string[] = [];

    if (scaleEligible && winnerShare >= CONCENTRATION_GUARDRAIL_PCT) {
      // Copy-only guardrail — the action below is unchanged by this.
      avoidBuyer.push(
        `Don't consolidate further — "${top!.name}" already holds ${pct(winnerShare)}% of judged spend; scale in steps.`
      );
      avoidClient.push(
        `We're increasing the leader's budget in steps, not all at once — it already carries ${pct(winnerShare)}% of the working budget.`
      );
    }

    const reassess = {
      buyer: `Reassess once the new allocation has ≥${gateLabel} of fresh spend behind it.`,
      client: `We'll revisit after the new setup has about ${gateLabel} of new spend to show results.`,
    };

    if (scaleEligible && cutEligible) {
      avoidBuyer.push("Don't pair this with a new creative test — one variable at a time.");
      avoidClient.push("We're making this one change on its own so results stay readable.");
      return {
        action: "budget",
        headline: `Shift budget from ${loserNames(analysis)} into "${top!.name}".`,
        clientHeadline: `Move budget from the weakest ads into "${top!.name}", the clear leader.`,
        rationale: `"${top!.name}" is ${pct(top!.deltaPct!)}% past the median ${kpiLabel} on ${money(top!.spend)}; ${analysis.belowBenchmarkCount} below-benchmark ads hold ${pct(belowShare)}% of judged spend (${money(analysis.belowBenchmarkSpend)}).`,
        clientRationale: `"${top!.name}" is clearly ahead while several ads sit well behind — moving budget captures that gap now.`,
        avoidNow: { buyer: avoidBuyer.slice(0, 2), client: avoidClient.slice(0, 2) },
        reassess,
      };
    }

    if (scaleEligible) {
      avoidBuyer.push("No new creative test alongside the scale — one variable at a time.");
      avoidClient.push("We're making this one change on its own so results stay readable.");
      return {
        action: "budget",
        headline: `Scale "${top!.name}" — ${pct(top!.deltaPct!)}% past the median, over the ${SCALE_TEST_MIN_DELTA_PCT}% bar.`,
        clientHeadline: `Increase spend on "${top!.name}" — it's clearly outperforming.`,
        rationale: `"${top!.name}" leads the ${kpiLabel} median by ${pct(top!.deltaPct!)}% on ${money(top!.spend)} of spend — past the ${SCALE_TEST_MIN_DELTA_PCT}% bar this memo requires before any budget move. No loser group is large enough to cut (${pct(belowShare)}% of judged spend, under the ${CUT_MIN_SPEND_SHARE_PCT}% bar).`,
        clientRationale: `"${top!.name}" is delivering about ${pct(top!.deltaPct!)}% better ${kpiLabel} than this account's typical result, with real spend behind it — it has earned more budget.`,
        avoidNow: { buyer: avoidBuyer.slice(0, 2), client: avoidClient.slice(0, 2) },
        reassess,
      };
    }

    // cut-only
    avoidBuyer.push("Don't move the freed budget into a new test yet — park it behind current ads.");
    avoidClient.push("We're not starting anything new with the freed budget yet.");
    return {
      action: "budget",
      headline: `Cut ${loserNames(analysis)}; hold everything else steady.`,
      clientHeadline: "Pause the weakest ads; keep the rest running as is.",
      rationale: `${analysis.belowBenchmarkCount} ads sit ≥${SCALE_TEST_MIN_DELTA_PCT}% below the median ${kpiLabel} at the worst end, holding ${pct(belowShare)}% of judged spend (${money(analysis.belowBenchmarkSpend)}). No winner clears the ${SCALE_TEST_MIN_DELTA_PCT}% scale bar, so the move is stopping the leak — not scaling.`,
      clientRationale: `The weakest ads are far behind the rest and are using ${pct(belowShare)}% of the budget that's had a fair chance to perform — pausing them stops the leak without touching what works.`,
      avoidNow: { buyer: avoidBuyer.slice(0, 2), client: avoidClient.slice(0, 2) },
      reassess,
    };
  }

  /* ---- H2: flat field (checkable from the extremes: winners/losers
     are sorted best-/worst-first, so if BOTH extremes sit within the
     band, every judged ad does; an empty pool side is trivially
     within it, and a null deltaPct — zero median — disqualifies the
     rule rather than guessing) ---- */
  const topWithin =
    top == null || (top.deltaPct != null && top.deltaPct <= FLAT_FIELD_DELTA_PCT);
  const worstWithin =
    worst == null ||
    (worst.deltaPct != null && Math.abs(worst.deltaPct) <= FLAT_FIELD_DELTA_PCT);
  const flatField =
    topWithin && worstWithin && (top?.deltaPct != null || worst?.deltaPct != null || analysis.median != null);
  if (flatField) {
    return {
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
    return {
      action: "test",
      headline: `Run one test: ${testTitle}. Nothing has earned a budget move yet.`,
      clientHeadline: `Run one focused test next: ${testTitle}.`,
      rationale: `Top ad ${top?.deltaPct != null ? `+${pct(top.deltaPct)}%` : "±0%"} vs the ${SCALE_TEST_MIN_DELTA_PCT}% scale bar; below-benchmark spend ${pct(belowShare)}% vs the ${CUT_MIN_SPEND_SHARE_PCT}% cut bar. Neither clears, so the strongest evidence-backed move is a test, not a budget change.`,
      clientRationale:
        "No single ad is far enough ahead or behind to justify moving budget yet — the fastest path to a clear winner is one focused test.",
      avoidNow: {
        buyer: [`No budget moves yet — nothing has cleared the ${SCALE_TEST_MIN_DELTA_PCT}% bar.`],
        client: ["We're not moving budget yet — no ad has earned it."],
      },
      reassess: {
        buyer: `Reassess when the test clears the ${gateLabel} spend gate — then judge it against the median.`,
        client: `We'll revisit once the test has spent about ${gateLabel} — enough for a fair read.`,
      },
    };
  }

  // No test available either (e.g. no rankable ads) — the honest
  // fallback is the insufficient-data hold, per spec.
  return insufficientHold();
}
