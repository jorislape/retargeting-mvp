import { Memo } from "@/modules/debrief";

/** Plain-text serialization for the copy/share button — same content,
 *  no markup, safe to paste into Slack, email, or a doc. */
export function memoToText(memo: Memo): string {
  const lines: string[] = [];
  const { scope } = memo;

  lines.push(`${scope.product} — ${scope.kpiLabel} DEBRIEF`);
  if (scope.dateRangeLabel) lines.push(scope.dateRangeLabel);
  lines.push(
    `Ads analyzed: ${scope.adsAnalyzed} · Judged: ${scope.adsJudged} · Set aside: ${scope.adsSetAside}`
  );
  lines.push(`Total spend: ${scope.totalSpendLabel} · Median ${scope.kpiLabel}: ${scope.medianLabel}`);
  lines.push("");

  lines.push("THE CALL");
  memo.tldr.forEach((line) => lines.push(`- ${line}`));
  lines.push("");

  lines.push("WINNERS");
  if (memo.winners.length === 0) {
    lines.push("None cleared the benchmark this period.");
  } else {
    memo.winners.forEach((w) => {
      lines.push(`- ${w.name} | ${w.valueLabel} (${w.vsMedianLabel}) | ${w.spendLabel} | ${w.reason}`);
    });
  }
  lines.push("");

  lines.push("LOSERS / KILL LIST");
  lines.push(memo.losers.killInstruction);
  memo.losers.rows.forEach((l) => {
    lines.push(`- ${l.name} | ${l.valueLabel} (${l.vsMedianLabel}) | ${l.spendLabel} | ${l.reason}`);
  });
  lines.push(memo.losers.setAsideNote);
  lines.push("");

  lines.push("PATTERNS");
  lines.push("What winners share:");
  memo.patterns.winners.forEach((p) => lines.push(`- ${p}`));
  lines.push("What losers share:");
  memo.patterns.losers.forEach((p) => lines.push(`- ${p}`));
  lines.push("");

  lines.push("NEXT 3 TESTS");
  memo.nextTests.forEach((t, i) => {
    lines.push(`${i + 1}. ${t.test}`);
    lines.push(`   Why: ${t.why}`);
    lines.push(`   Setup: ${t.setup}`);
    lines.push(`   Winning looks like: ${t.winningLooksLike}`);
  });
  lines.push("");

  lines.push(`CONFIDENCE: ${memo.confidence.level.toUpperCase()}`);
  memo.confidence.notes.forEach((n) => lines.push(`- ${n}`));

  return lines.join("\n");
}
