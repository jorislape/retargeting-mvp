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

  lines.push(view === "client" ? "WHAT WORKED" : "WINNERS");
  if (memo.winners.length === 0) {
    lines.push(
      view === "client"
        ? "No ad pulled clearly ahead this period."
        : "None cleared the benchmark this period."
    );
  } else {
    memo.winners.forEach((w) => {
      lines.push(`- ${w.name} | ${w.valueLabel} (${w.vsMedianLabel}) | ${w.spendLabel} | ${w.reason}`);
    });
  }
  lines.push("");

  lines.push(view === "client" ? "WHAT UNDERPERFORMED" : "LOSERS / KILL LIST");
  lines.push(view === "client" ? memo.losers.clientInstruction : memo.losers.killInstruction);
  memo.losers.rows.forEach((l) => {
    lines.push(`- ${l.name} | ${l.valueLabel} (${l.vsMedianLabel}) | ${l.spendLabel} | ${l.reason}`);
  });
  lines.push(memo.losers.setAsideNote);
  lines.push("");

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
  });
  lines.push("");

  lines.push(
    view === "client"
      ? `CONFIDENCE & DATA USED: ${memo.confidence.level.toUpperCase()}`
      : `CONFIDENCE: ${memo.confidence.level.toUpperCase()}`
  );
  memo.confidence.notes.forEach((n) => lines.push(`- ${n}`));

  return lines.join("\n");
}
