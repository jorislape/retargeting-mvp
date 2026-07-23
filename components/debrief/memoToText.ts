// Relative (not the "@/" alias) on purpose: scripts/decision.test.ts
// compiles this file alongside modules/debrief with plain `tsc` (no
// webpack path aliases) to test the serialized decision block against
// the real engine. Type-only, so it changes nothing at runtime.
import type { Memo } from "../../modules/debrief";

export type ReportView = "buyer" | "client";

/** The client view never says "median" or "spend gate" — swap the
 *  buyer terms for plain-English equivalents at render time, so the
 *  engine keeps one canonical string and the buyer view is untouched.
 *  Idempotent; applied only when rendering/serializing client view. */
export function clientizeText(text: string): string {
  return text
    .replace(/clears the spend gate/g, "has enough spend to judge fairly")
    .replace(/clear the spend gate/g, "have enough spend to judge fairly")
    .replace(/spend gate/g, "spend needed to judge fairly")
    .replace(/\bmedian (ROAS|CPA|CTR|CPC|Leads|Purchases)\b/g, "typical $1")
    .replace(/\bmedian\b/g, "typical result");
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
  if (client) {
    return flat
      ? "Strong — the current results consistently show that no ad is clearly ahead yet."
      : "Strong — the available results show a clear enough difference to support this direction.";
  }
  return flat
    ? `Strong support from this dataset — no ad separated meaningfully across ${adsJudged} judged ads.`
    : `Strong support from this dataset — one ad clearly pulled ahead across ${adsJudged} judged ads.`;
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
  briefIndices: number[] = []
): string {
  const lines: string[] = [];
  const { scope } = memo;
  /* Client view swaps buyer terms for plain English; buyer view is
     passed through untouched. */
  const c = (text: string) => (view === "client" ? clientizeText(text) : text);

  lines.push(`${scope.product} — ${scope.kpiLabel} ${view === "client" ? "PERFORMANCE REPORT" : "DEBRIEF"}`);
  if (view === "client") lines.push(`${scope.kpiLabel}: ${scope.kpiExplainer}`);
  if (scope.dateRangeLabel) lines.push(scope.dateRangeLabel);
  lines.push(
    `Ads analyzed: ${scope.adsAnalyzed} · Judged: ${scope.adsJudged} · Set aside: ${scope.adsSetAside}`
  );
  lines.push(`Total spend: ${scope.totalSpendLabel} · ${view === "client" ? "Typical" : "Median"} ${scope.kpiLabel}: ${scope.medianLabel}`);
  lines.push("");

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
  lines.push(view === "client" ? d.clientRationale : d.rationale);
  lines.push(
    `${view === "client" ? "How sure we are" : "Evidence"}: ${evidenceLine(d, scope.adsJudged, view)}`
  );
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

  // What this read cannot establish — collapsed on screen, always fully
  // expanded in text export (a plain-text file has no "collapsed").
  const limits = view === "client" ? d.limits.client : d.limits.buyer;
  if (limits.length > 0) {
    lines.push(view === "client" ? "WHAT WE STILL CAN'T CONCLUDE" : "EVIDENCE LIMITS");
    limits.forEach((l) => lines.push(`- ${l}`));
    lines.push("");
  }

  lines.push(view === "client" ? "SUMMARY" : "THE CALL");
  (view === "client" ? memo.clientSummary : memo.tldr).forEach((line) =>
    lines.push(`- ${line}`)
  );
  lines.push("");

  // Report Foundation V1: the same topAdsShown value the on-screen
  // report is using, in both views — no more view-specific hardcoding.
  const winnerRows = memo.winners.slice(0, topAdsShown);
  const loserRows = memo.losers.rows.slice(0, topAdsShown);

  lines.push(view === "client" ? "WHAT WORKED" : "WINNERS");
  // Evidence Inputs V1: the neutral leading-ad conversion line (or an
  // explicit "not in this export" line), active register.
  if (memo.leadingConversion) {
    lines.push(
      view === "client" ? memo.leadingConversion.client : memo.leadingConversion.buyer
    );
  }
  if (memo.winners.length === 0) {
    lines.push(
      view === "client"
        ? "No ad pulled clearly ahead this period."
        : "None cleared the benchmark this period."
    );
  } else {
    winnerRows.forEach((w) => {
      lines.push(
        `- ${w.name} | ${w.valueLabel} (${c(w.vsMedianLabel)}) | ${w.spendLabel}${w.conversionLabel ? ` | ${w.conversionLabel}` : ""} | ${w.reason}`
      );
    });
    if (memo.winners.length > winnerRows.length) {
      const more = memo.winners.length - winnerRows.length;
      lines.push(
        view === "client"
          ? `(${more} more performed above the typical result.)`
          : `(${more} more ad${more === 1 ? "" : "s"} cleared the benchmark — shown count set in Customize report.)`
      );
    }
  }
  lines.push("");

  lines.push(view === "client" ? "WHAT UNDERPERFORMED" : "LOSERS / KILL LIST");
  lines.push(view === "client" ? memo.losers.clientInstruction : memo.losers.killInstruction);
  loserRows.forEach((l) => {
    lines.push(
      `- ${l.name} | ${l.valueLabel} (${c(l.vsMedianLabel)}) | ${l.spendLabel}${l.conversionLabel ? ` | ${l.conversionLabel}` : ""} | ${l.reason}`
    );
  });
  if (memo.losers.rows.length > loserRows.length) {
    const more = memo.losers.rows.length - loserRows.length;
    lines.push(
      view === "client"
        ? `(${more} more ran below the typical result.)`
        : `(${more} more ad${more === 1 ? "" : "s"} ran below it — shown count set in Customize report.)`
    );
  }
  lines.push(
    view === "client"
      ? scope.adsSetAside > 0
        ? `${scope.adsSetAside} ad${scope.adsSetAside === 1 ? " did" : "s did"} not have enough spend to judge fairly — set aside rather than counted against.`
        : "Every ad had enough spend to be judged fairly."
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
  }

  lines.push(view === "client" ? "WHAT WE'LL TEST NEXT" : "NEXT 3 TESTS");
  memo.nextTests.forEach((t, i) => {
    lines.push(`${i + 1}. ${c(t.test)}`);
    lines.push(`   Why: ${c(t.why)}`);
    lines.push(`   ${view === "client" ? "How" : "Setup"}: ${c(t.setup)}`);
    lines.push(`   ${view === "client" ? "Success looks like" : "Winning looks like"}: ${c(t.winningLooksLike)}`);
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
    lines.push(`CONFIDENCE & DATA USED: ${memo.confidence.level.toUpperCase()}`);
    lines.push(memo.confidence.clientWhy);
    lines.push(
      `This result is based on ${scope.adsAnalyzed} ads and ${scope.totalSpendLabel} in ad spend${scope.dateRangeLabel ? ` between ${scope.dateRangeLabel}` : ""}. ${scope.adsJudged} ads had enough spend to judge fairly${scope.adsSetAside > 0 ? `; ${scope.adsSetAside} did not and were set aside` : ""}. Every number comes directly from the ad account — nothing is estimated.`
    );
  } else {
    lines.push(`CONFIDENCE: ${memo.confidence.level.toUpperCase()}`);
    lines.push(`Why ${memo.confidence.level}:`);
    memo.confidence.reasons.forEach((r) => lines.push(`- ${r}`));
    lines.push("Caveats:");
    memo.confidence.notes.forEach((n) => lines.push(`- ${n}`));
  }

  return lines.join("\n");
}
