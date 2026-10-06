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
export function isOutcomeVolumeBelowFloor(analysis: AnalysisResult): boolean {
  if (outcomeNounsFor(analysis) == null) return false;
  const top = analysis.winners[0] ?? null;
  if (top == null || top.conversions == null) return false;
  return top.conversions < MIN_OUTCOMES_FOR_SUPPORTED;
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
export function isScaleActionSupported(
  analysis: AnalysisResult,
  criteria?: DecisionCriteria
): boolean {
  if (analysis.adsJudged < DECISION_MIN_JUDGED) return false;
  const top = analysis.winners[0] ?? null;
  if (top == null || top.deltaPct == null || top.deltaPct < SCALE_TEST_MIN_DELTA_PCT) {
    return false;
  }
  const nouns = outcomeNounsFor(analysis);
  const minOutcome =
    criteria?.minOutcomeCount != null && criteria.minOutcomeCount > 0
      ? criteria.minOutcomeCount
      : null;
  const topOutcomes = top.conversions ?? null;
  if (minOutcome != null && nouns != null && topOutcomes != null && topOutcomes < minOutcome) {
    return false;
  }
  return true;
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
  flatField: boolean
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
  if (shapeSupported && !isOutcomeVolumeBelowFloor(analysis)) return "supported";
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
  const render = (register: "buyer" | "client") =>
    joinAnd(
      parts.map((p, i) =>
        i === 0 ? `${p.n} ad${p.n === 1 ? "" : "s"} ${p[register]}` : `${p.n} ${p[register]}`
      )
    );
  return { buyer: render("buyer"), client: render("client") };
}

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
      `No cost target was set, so ads are compared with this account's typical ${clientLabel}, not with what's profitable. A higher ${clientLabel} isn't automatically worse if ${differs}.${
        roas ? " This file also includes return on ad spend, which accounts for order value." : ""
      }`
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
    const one = analysis.kpiGaps.noValue + analysis.kpiGaps.belowGateWithValue === 1;
    buyer.push(`${parts.buyer} — set aside, so no conclusion is drawn about ${one ? "it" : "them"} either way.`);
    client.push(`${parts.client}, so ${one ? "it's" : "they're"} not part of this read.`);
  } else if (analysis.adsSetAside - (analysis.zeroOutcomeThin?.ads.length ?? 0) > 0) {
    /* Zero-conversion ads under their spend bar get their own named
       lines in buildDecision (they need the money formatter). */
    const n = analysis.adsSetAside - (analysis.zeroOutcomeThin?.ads.length ?? 0);
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
  /* Duplicate Identity fix: same-name rows are separate ads, labeled by
     row number — disclosed plainly, since the export doesn't establish
     whether they are the same creative. */
  if (analysis.duplicateAdNames.length > 0) {
    const quoted = analysis.duplicateAdNames.map((n) => `"${n}"`).join(", ");
    const plural = analysis.duplicateAdNames.length > 1;
    buyer.push(
      `${plural ? "Ad names" : "The ad name"} ${quoted} appear${plural ? "" : "s"} on multiple rows — each row is treated as a separate ad and labeled by its row number. The export doesn't establish whether same-name rows are the same creative.`
    );
    client.push(
      `Some ads in the file share the same name (${quoted}). Each row is shown separately with its row number, since the file doesn't say whether they're actually the same ad.`
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

export function buildDecision(
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
  const belowShare =
    analysis.judgedSpend > 0
      ? (analysis.belowBenchmarkSpend / analysis.judgedSpend) * 100
      : 0;
  /* Tester Feedback Fix 2: a judged zero-conversion CPA ad (no value,
     deltaPct null) is by definition further behind than any bar — it
     qualifies on the "worst ad" half; the spend-share half still holds. */
  const cutEligible =
    worst != null &&
    (worst.zeroConversions === true ||
      (worst.deltaPct != null && worst.deltaPct <= -SCALE_TEST_MIN_DELTA_PCT)) &&
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
  if (outcomeBlockedScale && minOutcome != null && nouns != null && top != null) {
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
  if (
    isOutcomeVolumeBelowFloor(analysis) &&
    minOutcome == null &&
    nouns != null &&
    top != null &&
    topOutcomes != null
  ) {
    criteriaBuyer.push(
      `The leading ad has ${topOutcomes} ${topOutcomes === 1 ? nouns.one : nouns.many} behind its lead — under the ${MIN_OUTCOMES_FOR_SUPPORTED}-${nouns.one} noise floor this read requires before labeling evidence strongly supported. That floor is deliberately minimal (many practitioners want 30–50 before acting); set your own minimum in the generator to enforce a stricter bar.`
    );
    criteriaClient.push(
      `The leading ad has ${topOutcomes} ${topOutcomes === 1 ? nouns.one : nouns.many} so far — too few results for a strong read, so the evidence is treated as limited while volume builds.`
    );
  }
  /* Evidence Confidence V2 — a structurally strong read whose outcome
     volume CANNOT be checked says so, instead of implying the volume
     was verified. Missing counts are never treated as zero. */
  if (
    evidenceState === "supported" &&
    nouns != null &&
    top != null &&
    topOutcomes == null
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
    for (const z of thin.ads) {
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
  const limits = {
    buyer: [...baseLimits.buyer, ...gateSourceBuyer, ...criteriaBuyer],
    client: [...baseLimits.client, ...gateSourceClient, ...criteriaClient],
  };

  /* ---- Decision Criteria V2: the bars that participated in this
     call, each with provenance. Always built — Debrief's defaults are
     labeled as Debrief's rules, never presented as universal truth. ---- */
  const appliedCriteria: AppliedCriterion[] = [
    {
      label: userGate
        ? `Minimum spend to judge: ${gateLabel} per ad — your criterion`
        : analysis.spendGateBasis === "target_cpa"
          ? `Minimum spend to judge: ${gateLabel} per ad (3× your target CPA) — Debrief default rule`
          : `Minimum spend to judge: ${gateLabel} per ad — Debrief default: ${spendGateSource(analysis, money).buyer}`,
      source: userGate ? "user" : "debrief_default",
    },
    {
      label: `Minimum sample: ≥${DECISION_MIN_JUDGED} judged ads before any call — Debrief default`,
      source: "debrief_default",
    },
    {
      label: `Budget-move bar: top ad ≥${SCALE_TEST_MIN_DELTA_PCT}% better than the median — Debrief default`,
      source: "debrief_default",
    },
    {
      label: `Cut bar: worst ad ≥${SCALE_TEST_MIN_DELTA_PCT}% behind and ≥${CUT_MIN_SPEND_SHARE_PCT}% of judged spend below the median — Debrief default`,
      source: "debrief_default",
    },
    {
      label: `Flat-field band: every judged ad within ±${FLAT_FIELD_DELTA_PCT}% of the median reads as noise, not signal — Debrief default`,
      source: "debrief_default",
    },
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
    ? { preserve: nextTestFacts.preserve, change: nextTestFacts.change, watch: kpiLabel }
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
      : {}),
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
        limits: withEfficiencyScaleCaveat(
          withMaterialActionVerificationGuardrail(evidence.limits),
          testQuality?.objective
        ),
        action: "budget",
        budgetVariant: "shift",
        headline: `Shift budget from ${loserNames(analysis)} into "${top!.name}".`,
        clientHeadline: `Move budget from the weakest ads into "${top!.name}", the clear leader.`,
        rationale: `"${top!.name}" is ${pct(top!.deltaPct!)}% better than the median ${kpiLabel} on ${money(top!.spend)}; ${analysis.belowBenchmarkCount} below-benchmark ads hold ${pct(belowShare)}% of judged spend (${money(analysis.belowBenchmarkSpend)}).`,
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
        limits: withEfficiencyScaleCaveat(
          withMaterialActionVerificationGuardrail(evidence.limits),
          testQuality?.objective
        ),
        action: "budget",
        budgetVariant: "scale",
        headline: `Scale "${top!.name}" — ${pct(top!.deltaPct!)}% better than the median, over the ${SCALE_TEST_MIN_DELTA_PCT}% bar.`,
        clientHeadline: `Increase spend on "${top!.name}" — it's clearly outperforming.`,
        rationale: `"${top!.name}" leads the ${kpiLabel} median by ${pct(top!.deltaPct!)}% on ${money(top!.spend)} of spend — past the ${SCALE_TEST_MIN_DELTA_PCT}% bar this memo requires before any budget move. No loser group is large enough to cut (${pct(belowShare)}% of judged spend, under the ${CUT_MIN_SPEND_SHARE_PCT}% bar).`,
        clientRationale: `"${top!.name}" is delivering about ${pct(top!.deltaPct!)}% better ${kpiClient} than this account's typical result, with real spend behind it — it has earned more budget.`,
        avoidNow: { buyer: avoidBuyer.slice(0, 2), client: avoidClient.slice(0, 2) },
        reassess,
      };
    }

    // cut-only
    avoidBuyer.push("Don't move the freed budget into a new test yet — park it behind current ads.");
    avoidClient.push("We're not starting anything new with the freed budget yet.");
    return {
      ...evidence,
      limits: withMaterialActionVerificationGuardrail(evidence.limits),
      action: "budget",
      budgetVariant: "cut",
      headline: `Cut ${loserNames(analysis)}; hold everything else steady.`,
      clientHeadline: "Pause the weakest ads; keep the rest running as is.",
      rationale: `${analysis.belowBenchmarkCount} ads sit ≥${SCALE_TEST_MIN_DELTA_PCT}% below the median ${kpiLabel} at the worst end, holding ${pct(belowShare)}% of judged spend (${money(analysis.belowBenchmarkSpend)}). ${
        outcomeBlockedScale && nouns != null
          ? `The top ad clears the ${SCALE_TEST_MIN_DELTA_PCT}% bar but sits below your ${minOutcome}-${nouns.one} scaling minimum, so the move is stopping the leak — not scaling.`
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
    return {
      ...evidence,
      action: "test",
      headline: `Run one test: ${testTitle}. Nothing has earned a budget move yet.`,
      clientHeadline: `Run one focused test next: ${testTitle}.`,
      rationale:
        outcomeBlockedScale && nouns != null && top != null
          ? `Top ad +${pct(top.deltaPct!)}% clears the ${SCALE_TEST_MIN_DELTA_PCT}% scale bar but has ${topOutcomes} ${topOutcomes === 1 ? nouns.one : nouns.many} — below your ${minOutcome}-${nouns.one} scaling minimum; below-benchmark spend ${pct(belowShare)}% vs the ${CUT_MIN_SPEND_SHARE_PCT}% cut bar. The strongest evidence-backed move is a test, not a budget change.`
          : `Top ad ${top?.deltaPct != null ? `+${pct(top.deltaPct)}%` : "±0%"} vs the ${SCALE_TEST_MIN_DELTA_PCT}% scale bar; below-benchmark spend ${pct(belowShare)}% vs the ${CUT_MIN_SPEND_SHARE_PCT}% cut bar. Neither clears, so the strongest evidence-backed move is a test, not a budget change.`,
      clientRationale:
        outcomeBlockedScale && nouns != null
          ? `No ad has both a clear enough lead and the ${minOutcome} ${nouns.many} you require before scaling — the fastest path to a confident move is one focused test.`
          : "No single ad is far enough ahead or behind to justify moving budget yet — the fastest path to a clear winner is one focused test.",
      avoidNow: {
        buyer: [
          outcomeBlockedScale && nouns != null
            ? `No budget moves yet — the leader hasn't reached your ${minOutcome}-${nouns.one} scaling minimum.`
            : `No budget moves yet — nothing has cleared the ${SCALE_TEST_MIN_DELTA_PCT}% bar.`,
        ],
        client: [
          outcomeBlockedScale && nouns != null
            ? `We're not moving budget yet — the leading ad hasn't reached the ${minOutcome} ${nouns.many} you require first.`
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
