// The ".ts" extension on this import is deliberate and load-bearing:
// types.ts imports nothing, so with an explicit extension this file's
// whole dependency chain resolves under plain Node's type-stripping
// test runner (scripts/decision.test.ts) — the same pattern
// modules/competitorDebrief uses. The rest of modules/debrief uses
// extensionless imports and is NOT directly Node-importable; that is
// why buildDecision takes a money formatter as an argument instead of
// importing format.ts (whose own internal import is extensionless).
import { KPI_LABELS } from "./types.ts";
import type { AnalysisResult, MemoDecision, TestQualityContext } from "./types.ts";

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
  flatField: boolean
): "insufficient" | "limited" | "supported" {
  const { median, adsJudged, winners, losers, missingColumns } = analysis;

  if (median == null || adsJudged < DECISION_MIN_JUDGED) return "insufficient";

  const enoughSample = adsJudged >= SUPPORTED_MIN_JUDGED;
  const complete = missingColumns.length === 0;
  if (enoughSample && complete) {
    if (flatField) return "supported"; // supported flatness — no group requirement
    if (winners.length >= 3 && losers.length >= 3) return "supported"; // supported separation
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

/**
 * What this read CANNOT establish. One permanent dataset-only caveat (no
 * causation, no future-performance guarantee, no control for unobserved
 * differences) plus conditional lines drawn ONLY from facts already
 * tracked in AnalysisResult. Two registers; the client register carries
 * no buyer jargon (kill/gate/benchmark/median/judged).
 */
export function buildLimits(
  analysis: AnalysisResult,
  flatField: boolean,
  /** Evidence Inputs V1 — optional self-reported test-quality answers.
   *  Undefined or unanswered fields append NOTHING (the output is
   *  byte-identical to before the feature). These ONLY append caveat
   *  lines; they never touch action, evidenceState, or any number. */
  testQuality?: TestQualityContext
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

  if (analysis.adsSetAside > 0) {
    buyer.push(
      `${analysis.adsSetAside} ad${analysis.adsSetAside === 1 ? "" : "s"} had too little spend to judge and were set aside — no conclusion is drawn about them either way.`
    );
    client.push(
      `${analysis.adsSetAside} ad${analysis.adsSetAside === 1 ? "" : "s"} didn't have enough spend to include yet, so they're not part of this read.`
    );
  }
  if (!analysis.hasCreativeNotes && !analysis.hasNameSignal) {
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
      `Only ${analysis.adsJudged} ad${analysis.adsJudged === 1 ? "" : "s"} cleared the spend gate — under the ${SUPPORTED_MIN_JUDGED}-ad bar this read treats as a fuller sample, so more spend could still shift the pattern.`
    );
    client.push(
      `Fewer than ${SUPPORTED_MIN_JUDGED} ads had enough spend to compare, so more spend could still change the picture.`
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

  return { buyer, client };
}

export function buildDecision(
  analysis: AnalysisResult,
  firstTestTitle: string | null,
  money: MoneyFormatter,
  /** Facts from the first next test (nextTests[0].brief), used only to
   *  surface nextControlledTest on the card. Optional so the pure rule
   *  tests can call buildDecision without threading a test through. */
  nextTestFacts?: { preserve: string; change: string } | null,
  /** Evidence Inputs V1 — optional test-quality answers, forwarded to
   *  buildLimits only. Never affects the action or evidenceState. */
  testQuality?: TestQualityContext
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
  const evidenceState = deriveEvidenceState(analysis, flatField);
  const evidenceShape = deriveEvidenceShape(analysis, flatField);
  const limits = buildLimits(analysis, flatField, testQuality);
  const nextControlledTest = nextTestFacts
    ? { preserve: nextTestFacts.preserve, change: nextTestFacts.change, watch: kpiLabel }
    : undefined;
  const evidence: Pick<MemoDecision, "evidenceState" | "limits"> &
    Partial<Pick<MemoDecision, "evidenceShape" | "nextControlledTest">> = {
    evidenceState,
    limits,
  };
  if (evidenceShape) evidence.evidenceShape = evidenceShape;
  if (nextControlledTest) evidence.nextControlledTest = nextControlledTest;

  const insufficientHold = (): MemoDecision => ({
    ...evidence,
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
        ...evidence,
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
        ...evidence,
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
      ...evidence,
      action: "budget",
      headline: `Cut ${loserNames(analysis)}; hold everything else steady.`,
      clientHeadline: "Pause the weakest ads; keep the rest running as is.",
      rationale: `${analysis.belowBenchmarkCount} ads sit ≥${SCALE_TEST_MIN_DELTA_PCT}% below the median ${kpiLabel} at the worst end, holding ${pct(belowShare)}% of judged spend (${money(analysis.belowBenchmarkSpend)}). No winner clears the ${SCALE_TEST_MIN_DELTA_PCT}% scale bar, so the move is stopping the leak — not scaling.`,
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
    return {
      ...evidence,
      action: "test",
      headline: `Run one test: ${testTitle}. Nothing has earned a budget move yet.`,
      clientHeadline: `Run one focused test next: ${testTitle}.`,
      rationale: `Top ad ${top?.deltaPct != null ? `+${pct(top.deltaPct)}%` : "±0%"} vs the ${SCALE_TEST_MIN_DELTA_PCT}% scale bar; below-benchmark spend ${pct(belowShare)}% vs the ${CUT_MIN_SPEND_SHARE_PCT}% cut bar. Neither clears, so the strongest evidence-backed move is a test, not a budget change.`,
      clientRationale:
        "No single ad is far enough ahead or behind to justify moving budget yet — the fastest path to a clear winner is one focused test.",
      avoidNow: {
        buyer: [`No budget moves yet — nothing has cleared the ${SCALE_TEST_MIN_DELTA_PCT}% bar.`],
        client: ["We're not moving budget yet — no ad has separated enough yet."],
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
