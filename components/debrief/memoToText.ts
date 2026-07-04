import { Memo } from "@/modules/debrief";

export type ReportView = "buyer" | "client";

/** Plain-text serialization for the copy/share button — same content
 *  as the on-screen report in the active view, no markup, safe to
 *  paste into Slack, email, or a doc. */
export function memoToText(memo: Memo, view: ReportView = "buyer"): string {
  const lines: string[] = [];
  const { scope } = memo;

  lines.push(`${scope.product} — ${scope.kpiLabel} ${view === "client" ? "PERFORMANCE REPORT" : "DEBRIEF"}`);
  if (view === "client") lines.push(`${scope.kpiLabel}: ${scope.kpiExplainer}`);
  if (scope.dateRangeLabel) lines.push(scope.dateRangeLabel);
  lines.push(
    `Ads analyzed: ${scope.adsAnalyzed} · Judged: ${scope.adsJudged} · Set aside: ${scope.adsSetAside}`
  );
  lines.push(`Total spend: ${scope.totalSpendLabel} · ${view === "client" ? "Typical" : "Median"} ${scope.kpiLabel}: ${scope.medianLabel}`);
  lines.push("");

  lines.push(view === "client" ? "SUMMARY" : "THE CALL");
  (view === "client" ? memo.clientSummary : memo.tldr).forEach((line) =>
    lines.push(`- ${line}`)
  );
  lines.push("");

  // Client view shows the top 3 each way (summary, not a data dump);
  // buyer view keeps the full detail.
  const winnerRows = view === "client" ? memo.winners.slice(0, 3) : memo.winners;
  const loserRows =
    view === "client" ? memo.losers.rows.slice(0, 3) : memo.losers.rows;

  lines.push(view === "client" ? "WHAT WORKED" : "WINNERS");
  if (memo.winners.length === 0) {
    lines.push(
      view === "client"
        ? "No ad pulled clearly ahead this period."
        : "None cleared the benchmark this period."
    );
  } else {
    winnerRows.forEach((w) => {
      lines.push(`- ${w.name} | ${w.valueLabel} (${w.vsMedianLabel}) | ${w.spendLabel} | ${w.reason}`);
    });
    if (view === "client" && memo.winners.length > winnerRows.length) {
      lines.push(
        `(${memo.winners.length - winnerRows.length} more performed above the typical result.)`
      );
    }
  }
  lines.push("");

  lines.push(view === "client" ? "WHAT UNDERPERFORMED" : "LOSERS / KILL LIST");
  lines.push(view === "client" ? memo.losers.clientInstruction : memo.losers.killInstruction);
  loserRows.forEach((l) => {
    lines.push(`- ${l.name} | ${l.valueLabel} (${l.vsMedianLabel}) | ${l.spendLabel} | ${l.reason}`);
  });
  if (view === "client" && memo.losers.rows.length > loserRows.length) {
    lines.push(
      `(${memo.losers.rows.length - loserRows.length} more ran below the typical result.)`
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
    lines.push(`Context quality: ${memo.marketSignal.quality.summary}`);
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
    lines.push(`${i + 1}. ${t.test}`);
    lines.push(`   Why: ${t.why}`);
    lines.push(`   ${view === "client" ? "How" : "Setup"}: ${t.setup}`);
    lines.push(`   ${view === "client" ? "Success looks like" : "Winning looks like"}: ${t.winningLooksLike}`);
    if (t.signals.length > 0) {
      lines.push(`   ${view === "client" ? "Why this test" : "Signals used"}:`);
      t.signals.forEach((s) => lines.push(`   - ${s}`));
    }
  });
  lines.push("");

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
