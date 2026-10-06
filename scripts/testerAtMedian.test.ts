/**
 * Tester Feedback Fix 1 — the median ad is visible.
 *
 * With an odd number of judged ads the median IS one ad
 * (deltaFromMedian === 0): it is in neither winners nor losers, and
 * before this fix no surface showed it — the tester read the #2 ad by
 * spend as "not evaluated". Proves: memo.atMedian names it in both
 * registers, the TXT export (and so Copy) carries it, Report.tsx renders
 * it, an even judged count with no tie leaves the memo key-for-key
 * unchanged, and the decision doesn't move.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, TESTER_CSV, clientStrings, loadEngine } from "./testerFeedbackEngine.ts";

const { run, buildSampleMemo, memoToText, cleanup } = loadEngine();
try {
  const t = run(TESTER_CSV, "cpa");
  const m = t.memo;

  // The 548.99 ad (Ad_H) is the median of 5 judged ads.
  assert.equal(t.analysis.adsJudged, 5);
  assert.ok(m.atMedian, "odd judged count → atMedian present");
  if (!m.atMedian) throw new Error("unreachable");
  assert.equal(m.atMedian.rows.length, 1);
  const row = m.atMedian.rows[0];
  assert.equal(row.name, "Ad_H");
  assert.equal(row.valueLabel, "18.93 EUR");
  assert.equal(row.spendLabel, "548.99 EUR");
  assert.equal(row.vsMedianLabel, "at median");
  assert.equal(row.deltaPct, 0);
  assert.equal(m.atMedian.buyerLabel, "At the median — this ad is the benchmark");
  assert.match(m.atMedian.clientLabel, /^Performed exactly at the account's typical result/);
  assert.ok(!m.winners.some((w) => w.name === "Ad_H") && !m.losers.rows.some((l) => l.name === "Ad_H"));

  // Text export (= Copy) in both registers.
  assert.match(t.buyerText, /At the median — this ad is the benchmark:\n- Ad_H \| 18\.93 EUR \(at median\) \| 548\.99 EUR \| 29 purchases/);
  assert.match(t.clientText, /Performed exactly at the account's typical result — this ad is the one that sets it:\n- Ad_H \| 18\.93 EUR \(at typical result\) \| 548\.99 EUR/);
  const clientAtLines = t.clientText.split("\n").filter((l) => /Ad_H|typical result — this ad/.test(l));
  for (const l of [...clientAtLines, ...clientStrings(m)])
    for (const w of ["benchmark", "median", "gate", "kill"]) assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(l), `client "${w}": ${l}`);

  // Order: its own block after the winners section, before the losers section.
  const iAt = t.buyerText.indexOf("AT THE MEDIAN\nAt the median — this ad");
  assert.ok(iAt > t.buyerText.indexOf("WINNERS") && iAt < t.buyerText.indexOf("LOSERS"));
  assert.match(t.buyerText, /\n\nAT THE MEDIAN\n/, "separate block, blank line before");
  assert.match(t.clientText, /\n\nAT THE TYPICAL RESULT\nPerformed exactly/);

  // Decision logic untouched: same call the tester saw on main.
  assert.equal(m.decision.action, "test");

  // Even judged count with no tie → no atMedian key at all.
  const even = TESTER_CSV.split("\n").filter((l) => !l.startsWith("Ad_E,")).join("\n");
  const e = run(even, "cpa");
  assert.equal(e.analysis.adsJudged, 4);
  assert.ok(!("atMedian" in e.memo), "even count → field absent");
  assert.ok(!/At the median/.test(e.buyerText));

  // Sample (11 judged — odd) now names its median ad (intended change).
  const s = buildSampleMemo();
  assert.ok(s.atMedian && s.atMedian.rows.length === 1);
  assert.match(memoToText(s, "buyer", 5, []), /At the median — this ad is the benchmark:/);

  // Report renders it in both views (PDF prints the same DOM).
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  // Follow-up: its own unnumbered block BETWEEN the Winners and Losers sections.
  assert.match(report, /\{memo\.atMedian && \(sections\.winners \|\| sections\.underperformers\) && \(\s*<section[^>]*>\s*<AtMedianRows atMedian=\{memo\.atMedian\} client=\{client\}/);
  const iWin = report.indexOf("---- Winners / What worked ----");
  const iAtSrc = report.indexOf("<AtMedianRows atMedian=");
  const iLose = report.indexOf("---- Losers / What underperformed ----");
  assert.ok(iWin < iAtSrc && iAtSrc < iLose, "rendered after the Winners section closes, before Losers");
  const winnersSection = report.slice(iWin, iAtSrc);
  assert.ok(/<\/section>\s*\)\}\s*[\s\S]*$/.test(winnersSection), "Winners section is closed before the at-median block");
  assert.match(report, /client \? atMedian\.clientLabel : atMedian\.buyerLabel/);

  // decision.ts never reads it.
  assert.ok(!/atMedian/.test(readFileSync(join(ROOT, "modules/debrief/decision.ts"), "utf8")));

  console.log("tester at-median: all assertions passed");
} finally {
  cleanup();
}
