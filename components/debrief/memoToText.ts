// Relative (not the "@/" alias) on purpose: scripts/decision.test.ts
// compiles this file alongside modules/debrief with plain `tsc` (no
// webpack path aliases) to test the serialized decision block against
// the real engine. Type-only, so it changes nothing at runtime.
import type { Memo } from "../../modules/debrief";

export type ReportView = "buyer" | "client";

/** The client view never says "median" or "spend gate" — swap the
 *  buyer terms for plain-English equivalents at render time, so the
 *  engine keeps one canonical string and the buyer view is untouched.
 *  Idempotent; applied only when rendering/serializing client view.
 *
 *  Report Density & Sequencing Coherence V1: "judged ad(s)" — the bare
 *  internal category noun-phrase (an ad's own status: cleared the
 *  spend gate or not) — is added narrowly, word-boundary-anchored to
 *  the exact two-word sequence, never the verb phrase "judge fairly"
 *  the rules above already produce, which stays untouched and correct
 *  as plain English on its own. Reuses that same "enough spend to
 *  judge fairly" vocabulary rather than inventing a new phrase, so a
 *  reader encounters one consistent way of saying this across the
 *  whole client report. This is a narrow, fixed addition to an
 *  existing small rule table — not a general jargon-rewriting system. */
/** Report Clarity Pass — shared with Report.tsx's client view. */
export const CLIENT_BRIEF_LEGEND =
  "Ready means the winning idea has enough results behind it to build new creative on; Early signal means it looks promising but needs more results; Not enough evidence means it's too early to brief on.";

/** Real-account fix 2 — the below-median total under a budget move,
 *  shared by the report and TXT. Descriptive only: it says where money
 *  sits, never that the whole amount moves. */
export function belowSpendLine(label: string, client: boolean, trimOnly = false): string {
  if (trimOnly) {
    return client
      ? `About ${label} is currently going to ads below the middle ad — we trim the weakest; the freed budget stays with the current ads for now.`
      : `About ${label} currently sits on below-median ads — context, not the amount to cut: trim the weakest; no ad qualifies to receive budget yet.`;
  }
  return client
    ? `About ${label} is currently going to ads below the middle ad.`
    : `About ${label} currently sits on below-median ads — context, not the amount to move.`;
}

export function clientizeText(text: string): string {
  return text
    .replace(/clears the spend gate/g, "has enough spend to judge fairly")
    .replace(/clear the spend gate/g, "have enough spend to judge fairly")
    /* Report Clarity Pass: the client register never says "gate". The
       buyer register now says "minimum spend" (defined once as "Minimum
       spend to judge (evidence gate)"); these rules catch the defining
       parenthetical and any legacy phrasing. */
    .replace(/\s*\(evidence gate\)/gi, "")
    .replace(/\b(?:spend|evidence) gate\b/gi, "minimum spend to judge")
    .replace(/\bgate\b/gi, "minimum spend")
    /* Trust Pass 2: the client register calls the median "the middle
       ad" — never "typical ROAS/CPA", which read as the account's own
       result (a 2.31x median can sit beside a 1.32x account ROAS). */
    .replace(/\bthe ([^\s()]+(?: [A-Z]{3})?) median (ROAS|CPA|CPL|CTR|CPC|Leads|Purchases)\b/g, "the middle ad's $2 ($1)")
    .replace(/\b[Mm]edian (ROAS|CPA|CPL|CTR|CPC|Leads|Purchases)\b/g, "middle ad's $1")
    /* CPA Leads Label: buyer-register "CPL" reads as plain cost per lead. */
    .replace(/\bCPL\b/g, "cost per lead")
    .replace(/\bthe median\b/g, "the middle ad")
    .replace(/\bmedian\b/g, "the middle ad")
    /* Tester Feedback follow-up: the signal "N thin-spend ads were set
       aside, not judged" reaches the client through here. */
    .replace(/\bwere set aside, not judged\b/g, "aren't included yet — too little spend")
    .replace(/\bwas set aside, not judged\b/g, "isn't included yet — too little spend")
    .replace(/\bset aside, not judged\b/g, "not included yet — too little spend")
    .replace(/\bjudged ads\b/g, "ads with enough spend to judge fairly")
    .replace(/\bjudged ad\b/g, "ad with enough spend to judge fairly");
}

/** The client set-aside line under the underperformers list — shared
 *  by the report and TXT (First-Run Robustness 2). Without a KPI gap or
 *  an outcome minimum it is word-for-word the line it always was. */
export function clientSetAsideLine(scope: Memo["scope"], kpiLabel: string): string {
  const f = scope.outcomeFloorAside;
  const floorPart = (first: boolean) =>
    f ? `${f.count}${first ? ` ad${f.count === 1 ? "" : "s"}` : ""} ${f.count === 1 ? "has" : "have"} fewer ${f.many} than the ${f.min} you set` : "";
  const b = scope.setAsideBreakdown;
  if (b) {
    const parts = [
      ...(b.spend > 0 ? [`${b.spend} ad${b.spend === 1 ? " did" : "s did"} not have enough spend to compare fairly`] : []),
      `${b.noValue} had no ${kpiLabel} figure in the file`,
      ...(f ? [floorPart(false)] : []),
    ];
    return `${parts.join("; ")} — set aside rather than counted against.`;
  }
  const spendN = scope.adsSetAside - (f?.count ?? 0);
  const parts = [
    ...(spendN > 0 ? [`${spendN} ad${spendN === 1 ? " did" : "s did"} not have enough spend to judge fairly`] : []),
    ...(f ? [floorPart(spendN <= 0)] : []),
  ];
  return parts.length > 0
    ? `${parts.join("; ")} — set aside rather than counted against.`
    : "Every ad had enough spend to compare fairly.";
}

/** Tester Feedback follow-up — the client register's "data used"
 *  sentence, shared by the report and TXT so they can't drift; never
 *  says "judged", and singular/plural agree ("1 ad … it isn't"). */
export function clientDataUsedSentence(
  scope: Memo["scope"],
  kpiLabel: string
): string {
  const n = scope.adsJudged;
  const enough = `${n} ad${n === 1 ? "" : "s"} had enough spend to compare fairly`;
  const b = scope.setAsideBreakdown;
  if (b) {
    const parts = [`${b.noValue} had no ${kpiLabel} figure`];
    if (b.spend > 0) parts.push(`${b.spend} didn't have enough spend`);
    const total = b.noValue + b.spend;
    return `${enough}; ${parts.join(" and ")}, so ${total === 1 ? "it isn't" : "they aren't"} included yet.`;
  }
  const s = scope.adsSetAside;
  return s > 0
    ? `${enough}; ${s} did not, so ${s === 1 ? "it isn't" : "they aren't"} included yet.`
    : `${enough}.`;
}

/**
 * Evidence-Explicit Decision V1 — the single strength sentence shown on
 * the Next-move card and in text export (both surfaces import this, so
 * the wording can't drift between them). evidenceShape selects between
 * two "supported" phrasings (a materially separated field vs a clearly
 * flat one) and is used ONLY as an internal template selector — the raw
 * "separation"/"flatness" terms are never rendered anywhere. Wording is
 * deliberately dataset-scoped throughout: never implies statistical
 * significance, causal proof, external validation, or a guarantee of
 * future performance.
 */
/** Bulletproof pass A2 — the DECISION confidence label, active register:
 *  its level and every cap that holds it down, e.g. "Medium — profitability
 *  unknown — no breakeven set". */
export function decisionLine(confidence: Memo["confidence"], view: ReportView): string {
  const { level, caps } = confidence.decision;
  const name = `${level.charAt(0).toUpperCase()}${level.slice(1)}`;
  const list = view === "client" ? caps.client : caps.buyer;
  return list.length > 0 ? `${name} — ${list.join(view === "client" ? " and " : "; ")}` : name;
}

/** The two confidence labels' names, per register. */
export const CONFIDENCE_LABELS = {
  evidence: { buyer: "Evidence", client: "How clear the results are" },
  decision: { buyer: "Decision", client: "How safe the next step is" },
} as const;

export function evidenceLine(
  decision: Memo["decision"],
  adsJudged: number,
  view: ReportView
): string {
  const client = view === "client";
  if (decision.evidenceState === "insufficient") {
    return client
      ? "Not enough information yet."
      : "Not enough data yet — more results are needed before making a reliable comparison.";
  }
  if (decision.evidenceState === "limited") {
    return client
      ? "Moderate — the results point in this direction, but the difference is not strong enough for a firm conclusion."
      : "Directional — the available data supports a next step, but the conclusion remains limited.";
  }
  // supported
  const flat = decision.evidenceShape === "flatness";
  /* Evidence-Wording Coherence (QA C1): "pulled ahead" language is only
     voiced when the committed decision actually contains a scale/shift.
     A supported-but-modest separation (leader under the budget bar, or
     a cut-only move) states the separation without implying a decisive
     leader — the same card's rationale says the opposite, and the two
     must agree. Wording only; evidenceState itself is unchanged. */
  const scaleSide =
    decision.action === "budget" && decision.budgetVariant !== "cut";
  if (client) {
    if (flat) {
      return "Strong — the current results consistently show that no ad is clearly ahead yet.";
    }
    return scaleSide
      ? "Strong — the available results show a clear enough difference to support this direction."
      : "Strong — the results separate clearly, though no single ad is far enough ahead to earn more budget yet.";
  }
  if (flat) {
    return `Strong support from this dataset — no ad separated meaningfully across ${adsJudged} judged ads.`;
  }
  if (scaleSide) {
    /* Real-account review: several receivers ⇒ never "one ad". */
    const n = decision.budgetMove?.to.length ?? 1;
    return `Strong support from this dataset — ${n > 1 ? `${n} ads clearly pulled ahead` : "one ad clearly pulled ahead"} across ${adsJudged} judged ads.`;
  }
  return decision.action === "budget"
    ? `Strong support from this dataset — the field separates clearly at the weak end across ${adsJudged} judged ads, though no ad has pulled far enough ahead to scale.`
    : `Strong support from this dataset — the field separates clearly across ${adsJudged} judged ads, though no ad has pulled far enough ahead for a budget move.`;
}

/** Plain-text serialization for the copy/share button — same content
 *  as the on-screen report in the active view, no markup, safe to
 *  paste into Slack, email, or a doc. `topAdsShown` (Report Foundation
 *  V1) must be the SAME value the on-screen report is currently using,
 *  so Buyer UI, Client UI, and this export always agree on row count.
 *  `briefIndices` lists the tests whose creative briefs are currently
 *  generated/visible (buyer view); pass none and the output is
 *  identical to a report without briefs. */
export function memoToText(
  memo: Memo,
  view: ReportView = "buyer",
  topAdsShown: 3 | 5 = 5,
  briefIndices: number[] = [],
  /** Expert Commentary V2 — the report author's attributed take (from
   *  report customization, not the memo). Serialized under an explicit
   *  commentary label so plain-text output preserves the separation
   *  between judgment and engine-derived claims. Empty = omitted. */
  expertTake: string = ""
): string {
  const lines: string[] = [];
  const { scope } = memo;
  /* Client view swaps buyer terms for plain English; buyer view is
     passed through untouched. */
  const c = (text: string) => (view === "client" ? clientizeText(text) : text);

  const viewKpiLabel = view === "client" ? scope.kpiLabelClient ?? scope.kpiLabel : scope.kpiLabel;
  lines.push(`${scope.product} — ${viewKpiLabel} ${view === "client" ? "PERFORMANCE REPORT" : "DEBRIEF"}`);
  if (view === "client") lines.push(`${viewKpiLabel}: ${scope.kpiExplainer}`);
  if (scope.dateRangeLabel) lines.push(scope.dateRangeLabel);
  lines.push(
    view === "client"
      ? `Ads analyzed: ${scope.adsAnalyzed} · Ads with enough spend to compare: ${scope.adsJudged} · Not included yet: ${scope.adsSetAside}`
      : `Ads analyzed: ${scope.adsAnalyzed} · Judged: ${scope.adsJudged} · Set aside: ${scope.adsSetAside}`
  );
  if (view !== "client" && scope.spendGateLabel) {
    lines.push(
      `Minimum spend to judge (evidence gate): ${scope.spendGateLabel} per ad${
        scope.spendGateSource ? ` (${scope.spendGateSource.short})` : ""
      }`
    );
  }
  /* Trust Pass 2: the account's real result first, then the median —
     which the client register calls "the middle ad". */
  const account = scope.accountKpiLabel
    ? ` · Account ${viewKpiLabel}: ${scope.accountKpiLabel}${scope.accountKpiCoverage ? ` (${scope.accountKpiCoverage})` : ""}`
    : "";
  lines.push(
    view === "client"
      ? `Total spend: ${scope.totalSpendLabel}${account} · Middle ad's ${viewKpiLabel}: ${scope.medianLabel}`
      : `Total spend: ${scope.totalSpendLabel}${account} · Median ${viewKpiLabel}: ${scope.medianLabel}`
  );
  if (scope.targetSummary) {
    const ts = scope.targetSummary;
    lines.push(
      view === "client"
        ? `Your target (${viewKpiLabel} ${ts.targetLabel}): ${ts.beat} of ${ts.judged} ads with enough spend to compare beat it.`
        : `Target ${viewKpiLabel} ${ts.targetLabel}: ${ts.beat} of ${ts.judged} judged ads beat your target.`
    );
  }
  /* Real-account review: buyer only, near the top. */
  if (view !== "client" && memo.spreadThin) lines.push(memo.spreadThin);
  /* Bulletproof pass A3: stage medians / the mixed-stage warning. */
  if (scope.stageNote) lines.push(view === "client" ? scope.stageNote.client : scope.stageNote.buyer);
  if (view !== "client" && scope.stageWarning) lines.push(scope.stageWarning);
  lines.push("");

  /* Period Comparison V2 — mirrors the on-screen order: what changed
     first, then the decision it contextualizes. Match provenance leads
     the block (visible, never buried in the limits). Descriptive only;
     the caveat closing the block states it never feeds the Next move. */
  if (memo.comparison) {
    const cmp = memo.comparison;
    lines.push("WHAT CHANGED VS PREVIOUS PERIOD");
    if (cmp.periodLabel.previous || cmp.periodLabel.current) {
      lines.push(
        `${cmp.periodLabel.previous ?? "previous period"} → ${cmp.periodLabel.current ?? "current period"}`
      );
    }
    lines.push(
      `${cmp.matchBasis === "ad_id" ? "Matched by Ad ID" : "Matched by ad name"}: ${cmp.matchNote}`
    );
    (view === "client" ? cmp.account.client : cmp.account.buyer).forEach((l) =>
      lines.push(`- ${l}`)
    );
    const cmpImproved = cmp.improved.slice(0, topAdsShown);
    const cmpDeclined = cmp.declined.slice(0, topAdsShown);
    if (cmpImproved.length > 0) {
      lines.push(view === "client" ? "Moved ahead:" : "Improved:");
      cmpImproved.forEach((r) =>
        lines.push(
          `- ${r.name} | ${r.previousLabel} → ${r.currentLabel} | ${r.changeLabel}${r.conversionChangeLabel ? ` | ${r.conversionChangeLabel}` : ""}`
        )
      );
    }
    if (cmpDeclined.length > 0) {
      lines.push(view === "client" ? "Fell behind:" : "Declined:");
      cmpDeclined.forEach((r) =>
        lines.push(
          `- ${r.name} | ${r.previousLabel} → ${r.currentLabel} | ${r.changeLabel}${r.conversionChangeLabel ? ` | ${r.conversionChangeLabel}` : ""}`
        )
      );
    }
    const persistence =
      view === "client" ? cmp.persistence.client : cmp.persistence.buyer;
    if (persistence.length > 0) {
      lines.push(view === "client" ? "Last period's leaders:" : "Winner persistence:");
      persistence.forEach((l) => lines.push(`- ${l}`));
    }
    if (cmp.appeared.total > 0) {
      lines.push(
        `New this period: ${cmp.appeared.names.join(", ")}${cmp.appeared.total > cmp.appeared.names.length ? ` and ${cmp.appeared.total - cmp.appeared.names.length} more` : ""}.`
      );
    }
    if (cmp.disappeared.total > 0) {
      lines.push(
        `No longer present: ${cmp.disappeared.names.join(", ")}${cmp.disappeared.total > cmp.disappeared.names.length ? ` and ${cmp.disappeared.total - cmp.disappeared.names.length} more` : ""}.`
      );
    }
    const cmpLimits = view === "client" ? cmp.limits.client : cmp.limits.buyer;
    if (cmpLimits.length > 0) {
      lines.push(view === "client" ? "Worth knowing about this comparison:" : "Comparison limits:");
      cmpLimits.forEach((l) => lines.push(`- ${l}`));
    }
    lines.push(cmp.caveat);
    lines.push("");
  }

  /* Decision-First V1: the committed call leads the text exactly as it
     leads the rendered report — one block, active register only, and
     never a duplicate of the winners/losers evidence below. */
  const d = memo.decision;
  lines.push("NEXT MOVE");
  // Order: decision → numeric rationale → evidence strength → not yet →
  // preserve/change/watch → reassess. No standalone Confidence line here
  // — the full confidence read has its own section further down
  // (CONFIDENCE:); this block shows evidenceState only, never the raw
  // evidenceShape enum.
  lines.push(view === "client" ? d.clientHeadline : d.headline);
  /* Trust Pass: every ad the budget move names, in full. */
  if (d.budgetMove) {
    const list = (ads: { name: string; spendLabel: string; note?: { buyer: string; client: string } }[]) =>
      ads
        .map((a) => `"${a.name}" (${a.spendLabel}${a.note ? ` — ${view === "client" ? a.note.client : a.note.buyer}` : ""})`)
        .join(", ");
    if (d.budgetMove.from.length > 0)
      lines.push(`${view === "client" ? "Pausing or reducing" : "Pause or trim"}: ${list(d.budgetMove.from)}`);
    if (d.budgetMove.to.length > 0)
      lines.push(
        `${view === "client" ? "Getting more budget" : d.budgetVariant === "scale" ? "Gets more budget" : "Receives the budget"}: ${list(d.budgetMove.to)}`
      );
    if (d.execution) lines.push(`${view === "client" ? "How we'll do it" : "How to execute"}: ${view === "client" ? d.execution.client : d.execution.buyer}`);
    if (d.profitBasisNote) lines.push(view === "client" ? d.profitBasisNote.client : d.profitBasisNote.buyer);
    if (d.budgetMove.belowSpendLabel)
      lines.push(
        view === "client"
          ? belowSpendLine(d.budgetMove.belowSpendLabel, true, d.budgetMove.to.length === 0)
          : belowSpendLine(d.budgetMove.belowSpendLabel, false, d.budgetMove.to.length === 0)
      );
  }
  lines.push(view === "client" ? d.clientRationale : d.rationale);
  lines.push(
    `${CONFIDENCE_LABELS.evidence[view === "client" ? "client" : "buyer"]}: ${evidenceLine(d, scope.adsJudged, view)}`
  );
  lines.push(`${CONFIDENCE_LABELS.decision[view === "client" ? "client" : "buyer"]}: ${decisionLine(memo.confidence, view)}`);
  /* Evidence Confidence V2 — cross-period consistency context, same
     position as the on-screen card (comparison-sourced; decision and
     evidenceState stay comparison-blind). */
  if (memo.comparison?.leaderConsistency) {
    lines.push(
      `${view === "client" ? "Across periods" : "Consistency"}: ${
        view === "client"
          ? memo.comparison.leaderConsistency.client
          : memo.comparison.leaderConsistency.buyer
      }`
    );
  }
  /* Decision Criteria V2 — whose bars decided (buyer view only; labels
     carry buyer vocabulary). [yours] vs [default] mirrors the card. */
  if (view === "buyer" && d.appliedCriteria.length > 0) {
    lines.push("Decision bars applied:");
    d.appliedCriteria.forEach((criterion) =>
      lines.push(`- [${criterion.source === "user" ? "yours" : "default"}] ${criterion.label}`)
    );
  }
  const decisionAvoid = view === "client" ? d.avoidNow.client : d.avoidNow.buyer;
  if (decisionAvoid.length > 0) {
    lines.push(view === "client" ? "What we're deliberately not doing yet:" : "Not yet:");
    decisionAvoid.forEach((b) => lines.push(`- ${b}`));
  }
  // The single controlled next test (preserve / change / watch); the
  // numeric reassessment trigger stays on its own line below. Unlike the
  // on-screen card, text export always carries the FULL preserve wording
  // — no space constraint, and a copy-pasted handoff benefits from the
  // complete reasoning.
  if (d.nextControlledTest) {
    lines.push("Next controlled test:");
    lines.push(`- ${view === "client" ? "Keep the same" : "Preserve"}: ${c(d.nextControlledTest.preserve)}`);
    lines.push(`- Change: ${c(d.nextControlledTest.change)}`);
    lines.push(`- Watch: ${c(d.nextControlledTest.watch)}`);
  }
  lines.push(view === "client" ? d.reassess.client : d.reassess.buyer);
  lines.push("");

  /* Expert Commentary V2 — attributed judgment, explicitly labeled so
     the plain-text export preserves the engine/commentary separation. */
  if (expertTake.trim() !== "") {
    lines.push("EXPERT COMMENTARY (professional judgment — not derived from the data in this report)");
    lines.push(expertTake.trim());
    lines.push("");
  }

  // What this read cannot establish — collapsed on screen, always fully
  // expanded in text export (a plain-text file has no "collapsed").
  const limits = view === "client" ? d.limits.client : d.limits.buyer;
  if (limits.length > 0) {
    lines.push(view === "client" ? "WHAT WE STILL CAN'T CONCLUDE" : "EVIDENCE LIMITS");
    limits.forEach((l) => lines.push(`- ${l}`));
    lines.push("");
  }

  /* Creative Grouping V1 — same "always fully expanded in text export"
     rule as Evidence limits directly above: member executions are
     screen-progressive-disclosed in the report, but Copy/TXT has no
     concept of "collapsed," so every judged execution is listed. Only
     present when memo.creativeGroups has repeated-group evidence. */
  if (memo.creativeGroups && memo.creativeGroups.groups.length > 0) {
    lines.push("CREATIVE GROUPS");
    memo.creativeGroups.groups.forEach((group) => {
      lines.push(group.label);
      lines.push(
        view === "client"
          ? `${group.judgedCount} execution${group.judgedCount === 1 ? "" : "s"} with enough spend to compare`
          : `${group.judgedCount} judged execution${group.judgedCount === 1 ? "" : "s"}`
      );
      const tally: string[] = [];
      if (group.aboveCount > 0) {
        tally.push(`${group.aboveCount} ${view === "client" ? "above the middle ad" : "above median"}`);
      }
      if (group.atCount > 0) {
        tally.push(`${group.atCount} ${view === "client" ? "at the middle ad" : "at median"}`);
      }
      if (group.belowCount > 0) {
        tally.push(`${group.belowCount} ${view === "client" ? "below the middle ad" : "below median"}`);
      }
      lines.push(tally.join(" · "));
      group.members.forEach((m) => {
        const categoryLabel =
          m.category === "above"
            ? view === "client"
              ? "above typical"
              : "above median"
            : m.category === "below"
              ? view === "client"
                ? "below typical"
                : "below median"
              : view === "client"
                ? "at typical"
                : "at median";
        lines.push(`  - ${m.name} — ${categoryLabel}`);
      });
      lines.push("");
    });
    lines.push(view === "client" ? memo.creativeGroups.limits.client : memo.creativeGroups.limits.buyer);
    lines.push("");
  }

  lines.push(view === "client" ? "SUMMARY" : "THE CALL");
  (view === "client" ? memo.clientSummary : memo.tldr).forEach((line) =>
    lines.push(`- ${line}`)
  );
  lines.push("");

  /* Spend Allocation V1 — one additive, factual line: where judged
     spend sits relative to the benchmark, plus set-aside as a separate
     clause (never folded into the same percentage base — the same rule
     the on-screen chart follows). Uses "median" and runs it through
     clientizeText via c() for the client view, matching how the rest
     of this file derives client wording rather than hand-duplicating a
     second copy of "median" -> "typical result". Omitted entirely when
     there's no judged spend (memo.spendAllocation is null). */
  if (memo.spendAllocation) {
    const sa = memo.spendAllocation;
    const findSeg = (id: "above" | "at" | "below") => sa.segments.find((s) => s.id === id);
    const above = findSeg("above");
    const at = findSeg("at");
    const below = findSeg("below");
    const parts: string[] = [];
    if (above) parts.push(`${above.shareLabel} above median`);
    if (at) parts.push(`${at.shareLabel} at median`);
    if (below) parts.push(`${below.shareLabel} below median`);
    if (parts.length > 0) {
      const setAsidePart = sa.setAside ? `; ${sa.setAside.spendLabel} set aside` : "";
      lines.push(c(`Spend allocation: ${parts.join(", ")}${setAsidePart}.`));
      lines.push("");
    }
  }

  // Report Foundation V1: the same topAdsShown value the on-screen
  // report is using, in both views — no more view-specific hardcoding.
  /* One row format for winners / at-median / losers. Buyer-only
     extras (Tester Feedback Fixes 4 & 6): frequency after the counts,
     then the few-conversions and possible-fatigue notes. */
  const adRow = (r: Memo["winners"][number]) => {
    const buyer = view !== "client";
    const freq = buyer && r.frequencyLabel ? ` | ${r.frequencyLabel}` : "";
    const notes = buyer
      ? [r.fewOutcomesNote, r.fatigueNote, r.viewThroughNote?.buyer, r.lowIntentNote?.buyer, r.status?.key !== "maintain" ? r.trimNote?.buyer : undefined].filter(Boolean).map((n) => ` ${n}`).join("")
      : [r.viewThroughNote?.client, r.lowIntentNote?.client, r.status?.key !== "maintain" ? r.trimNote?.client : undefined].filter(Boolean).map((n) => ` ${n}`).join("");
    /* Bulletproof pass A1: the business status, active register. */
    const status = r.status ? ` | ${buyer ? r.status.buyer : r.status.client}` : "";
    const target = r.vsTarget
      ? ` | ${r.vsTarget === "beats" ? (buyer ? "✓ beats target" : "✓ beats your target") : buyer ? "✗ misses target" : "✗ below your target"}`
      : "";
    const adj = buyer && r.adjValueLabel ? ` · adj. ${r.adjValueLabel}` : "";
    return `- ${r.name}${r.runsInLabel ? ` (${r.runsInLabel})` : ""} | ${r.valueLabel}${adj} (${c(r.vsMedianLabel)})${target} | ${r.spendLabel}${r.conversionLabel ? ` | ${r.conversionLabel}` : ""}${freq} | ${r.reason}${notes}${status}`;
  };
  /* Trust Pass: TXT/Copy lists EVERY row. The first topAdsShown match
     the on-screen table; a "+N more:" line marks where the screen
     collapses the rest behind "Show all", and the rest follow in full. */
  const pushRows = (rows: Memo["winners"]) => {
    rows.forEach((r, i) => {
      if (i === topAdsShown && rows.length > topAdsShown) lines.push(`+${rows.length - topAdsShown} more:`);
      lines.push(adRow(r));
    });
  };

  /* Trust Pass 2: without a target, "winner/loser" overstates a
     relative ranking — the sections say where the ads sit instead. */
  const hasTarget = scope.targetSummary != null;
  lines.push(
    view === "client"
      ? hasTarget ? "WHAT WORKED" : "ABOVE THE MIDDLE AD"
      : hasTarget ? "WINNERS" : "ABOVE MEDIAN"
  );
  // Evidence Inputs V1: the neutral leading-ad conversion line (or an
  // explicit "not in this export" line), active register.
  if (memo.leadingConversion) {
    lines.push(
      view === "client" ? memo.leadingConversion.client : memo.leadingConversion.buyer
    );
  }
  if (view === "client" && memo.namingClientLine) lines.push(memo.namingClientLine);
  if (memo.winners.length === 0) {
    lines.push(
      view === "client"
        ? "No ad pulled clearly ahead this period."
        : "None cleared the benchmark this period."
    );
  } else {
    pushRows(memo.winners);
  }
  lines.push("");

  // Tester Feedback Fixes: the ad(s) that ARE the median — neither a
  // winner nor a loser, so their own block between the two sections.
  if (memo.atMedian) {
    lines.push(view === "client" ? "THE MIDDLE AD" : "AT THE MEDIAN");
    lines.push(`${view === "client" ? memo.atMedian.clientLabel : memo.atMedian.buyerLabel}:`);
    memo.atMedian.rows.forEach((r) => lines.push(adRow(r)));
    lines.push("");
  }

  lines.push(
    view === "client"
      ? hasTarget ? "WHAT UNDERPERFORMED" : "BELOW THE MIDDLE AD"
      : hasTarget ? "LOSERS" : "BELOW MEDIAN"
  );
  lines.push(view === "client" ? memo.losers.clientInstruction : memo.losers.killInstruction);
  pushRows(memo.losers.rows);
  lines.push(
    view === "client"
      ? clientSetAsideLine(scope, scope.kpiLabelClient ?? scope.kpiLabel)
      : memo.losers.setAsideNote
  );
  lines.push("");

  if (memo.marketSignal) {
    lines.push(view === "client" ? "MARKET CONTEXT" : "MARKET SIGNAL");
    memo.marketSignal.bullets.forEach((b) => lines.push(`- ${b}`));
    lines.push(memo.marketSignal.quality.summary);
    lines.push(memo.marketSignal.caveat);
    lines.push("");
  }

  if (view === "buyer") {
    lines.push("PATTERNS");
    lines.push("What winners share:");
    memo.patterns.winners.forEach((p) => lines.push(`- ${p}`));
    lines.push("What losers share:");
    memo.patterns.losers.forEach((p) => lines.push(`- ${p}`));
    lines.push("");
    /* Real-account fix 8 — buyer only, like Patterns. */
    const np = memo.namingPatterns;
    if (np) {
      lines.push("PATTERNS BY NAMING");
      lines.push(np.intro);
      lines.push(np.coverageLine);
      for (const k of np.keys) {
        lines.push(`${k.key}:`);
        for (const r of k.rows) {
          lines.push(
            `- ${r.value} | ${r.ads} ad${r.ads === 1 ? "" : "s"} | ${r.spendLabel}${r.outcomesLabel != null ? ` | ${r.outcomesLabel} ${np.outcomeLabel?.toLowerCase()}` : ""} | ${r.kpiValueLabel} ${np.kpiLabel}`
          );
        }
      }
      lines.push(np.caveat);
      lines.push("");
    }
  }

  lines.push(view === "client" ? "WHAT WE'LL TEST NEXT" : "NEXT 3 TESTS");
  /* Report Clarity Pass: the client register explains the readiness
     states once, in plain words (same sentence as the report). */
  if (view === "client" && memo.nextTests.some((t) => t.briefReadiness)) {
    lines.push(`Ready for a creative brief? ${CLIENT_BRIEF_LEGEND}`);
  }
  memo.nextTests.forEach((t, i) => {
    lines.push(`${i + 1}. ${c(t.test)}`);
    if (t.briefReadiness) {
      // "Early signal" (not "Directional") is the rendered label for
      // state "directional" — matches Report.tsx's TestRow badge;
      // avoids colliding in the exported text with the Decision Card's
      // dataset-level "Evidence: Directional — ..." line.
      const label =
        t.briefReadiness.state === "ready"
          ? "Ready"
          : t.briefReadiness.state === "directional"
            ? "Early signal"
            : "Not enough evidence";
      lines.push(view === "client" ? `   Ready for a creative brief? ${label}` : `   Brief readiness: ${label}`);
      if (t.briefReadiness.state !== "ready") {
        lines.push(`   ${view === "client" ? "Worth knowing" : "Evidence check"}: ${c(view === "client" ? t.briefReadiness.client : t.briefReadiness.buyer)}`);
      } else if (view !== "client" && t.briefReadiness.disclosureNote) {
        lines.push(`   Evidence check: ${c(t.briefReadiness.disclosureNote)}`);
      }
    }
    lines.push(`   Why: ${c(t.why)}`);
    // Evidence Diagnostic V1 — buyer-only, never rendered in client TXT.
    if (view !== "client" && t.evidenceDiagnostic) {
      lines.push(`   Evidence diagnostic: ${c(t.evidenceDiagnostic.buyer)}`);
    }
    lines.push(`   Hypothesis: ${c(t.hypothesis)}`);
    if (view !== "client" && t.variable) lines.push(`   Variable: ${t.variable}`);
    lines.push(`   ${view === "client" ? "How" : "Setup"}: ${c(t.setup)}`);
    lines.push(
      view === "client"
        ? `   Success looks like: ${t.clientSuccess ?? c(t.winningLooksLike)}`
        : `   Success: ${t.winningLooksLike}`
    );
    if (t.decisionRule) lines.push(`   ${view === "client" ? "What happens next" : "Decision rule"}: ${view === "client" ? t.clientDecisionRule ?? t.decisionRule : t.decisionRule}`);
    if (t.signals.length > 0) {
      lines.push(`   ${view === "client" ? "Why it's worth testing" : "Signals used"}:`);
      t.signals.forEach((s) => lines.push(`   - ${c(s)}`));
    }
  });
  lines.push("");

  if (view === "buyer" && briefIndices.length > 0) {
    lines.push("CREATIVE BRIEFS");
    briefIndices.forEach((i) => {
      const brief = memo.nextTests[i]?.brief;
      if (!brief) return;
      lines.push(`T${i + 1} — ${brief.title}`);
      lines.push(`Objective: ${brief.objective}`);
      lines.push("Based on:");
      brief.basedOn.forEach((s) => lines.push(`- ${s}`));
      lines.push(`Concept: ${brief.concept}`);
      lines.push("Hook options:");
      brief.hooks.forEach((h, j) => lines.push(`${j + 1}. ${h}`));
      lines.push("Shot / asset direction:");
      brief.assetDirection.forEach((s) => lines.push(`- ${s}`));
      lines.push(`Keep constant: ${brief.keepConstant}`);
      lines.push(`Change: ${brief.change}`);
      lines.push(`Success metric: ${brief.successMetric}`);
      lines.push("Guardrails:");
      brief.guardrails.forEach((g) => lines.push(`- ${g}`));
      lines.push(brief.basisNote);
      lines.push("");
    });
  }

  const avoidBullets = view === "client" ? memo.avoid.client : memo.avoid.buyer;
  if (avoidBullets.length > 0) {
    lines.push(view === "client" ? "WHAT WE'RE AVOIDING" : "WHAT NOT TO DO");
    avoidBullets.forEach((b) => lines.push(`- ${b}`));
    lines.push("");
  }

  if (view === "client") {
    lines.push("CONFIDENCE & DATA USED");
    lines.push(`How clear the results are: ${memo.confidence.level.toUpperCase()}. ${memo.confidence.clientWhy}`);
    lines.push(`How safe the next step is: ${decisionLine(memo.confidence, "client")}`);
    lines.push(
      `This result is based on ${scope.adsAnalyzed} ads and ${scope.totalSpendLabel} in ad spend${scope.dateRangeLabel ? ` between ${scope.dateRangeLabel}` : ""}. ${clientDataUsedSentence(scope, scope.kpiLabelClient ?? scope.kpiLabel)} Every number comes from the exported ad data.`
    );
  } else {
    lines.push(`CONFIDENCE — EVIDENCE: ${memo.confidence.level.toUpperCase()} · DECISION: ${memo.confidence.decision.level.toUpperCase()}`);
    lines.push(`Decision: ${decisionLine(memo.confidence, "buyer")}`);
    lines.push(`Why evidence is ${memo.confidence.level}:`);
    memo.confidence.reasons.forEach((r) => lines.push(`- ${r}`));
    lines.push("Caveats:");
    memo.confidence.notes.forEach((n) => lines.push(`- ${n}`));
  }

  return lines.join("\n");
}
