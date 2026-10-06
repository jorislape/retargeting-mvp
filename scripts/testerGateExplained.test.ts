/**
 * Tester Feedback Fix 4 — the minimum spend to judge is explained.
 *
 * The tester saw €164.03 and found it arbitrary. The gate math is NOT
 * changed (max(10, 0.5 × mean spend), or 3× target CPA, or the user's
 * own bar); every place that shows it now says where it comes from:
 * Decision bars applied, Evidence limits, the header (short) + its
 * tooltip (full), and the tests' setup lines. Plus a buyer-only row
 * note when a ROAS/CPA value rests on fewer than
 * MIN_OUTCOMES_FOR_SUPPORTED conversions. Copy only.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_BANNED, ROOT, TESTER_CSV, clientStrings, loadEngine } from "./testerFeedbackEngine.ts";
import { MIN_OUTCOMES_FOR_SUPPORTED } from "../modules/debrief/decision.ts";

const FULL =
  "half the average spend per ad in this export (328.06 EUR avg) — a default, not a statistical guarantee. Set a target CPA to base it on 3× your CPA instead.";

const { run, cleanup } = loadEngine();
try {
  /* Tester export: default half-mean basis. */
  const t = run(TESTER_CSV, "cpa");
  const m = t.memo;
  assert.equal(t.analysis.spendGateBasis, "floor_or_mean");
  assert.ok(Math.abs(t.analysis.spendGate - 164.03) < 0.01, "gate math unchanged (≈164.03)");
  assert.equal(m.scope.spendGateSource?.short, "half this export's average spend per ad");
  assert.equal(m.scope.spendGateSource?.buyer, FULL);
  // Decision bars applied.
  assert.equal(m.decision.appliedCriteria[0].label, `Minimum spend to judge: 164.03 EUR per ad — Debrief default: ${FULL}`);
  // Evidence limits, both registers.
  assert.ok(m.decision.limits.buyer.includes(`The 164.03 EUR minimum spend per ad is ${FULL}`));
  assert.ok(m.decision.limits.client.includes(
    "The 164.03 EUR minimum spend used to include an ad is half the average spend per ad in this file (328.06 EUR) — a rule of thumb, not a guarantee."));
  for (const s of clientStrings(m))
    for (const w of CLIENT_BANNED) assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(s), `client "${w}": ${s}`);
  // Every setup line that names the minimum says where it comes from.
  const setups = m.nextTests.map((x) => x.setup).filter((s) => s.includes("164.03"));
  assert.ok(setups.length >= 2);
  for (const s of setups) assert.match(s, /164\.03 EUR \(half this export's average spend per ad\)/);
  // Text export header (short) — client header never shows it.
  assert.match(t.buyerText, /Minimum spend to judge \(evidence gate\): 164\.03 EUR per ad \(half this export's average spend per ad\)/);
  assert.ok(!/evidence gate/.test(t.clientText));

  /* Target CPA basis: explained as 3× the target; no half-mean line. */
  const tc = run(TESTER_CSV, "cpa", { targetCpa: 20 });
  assert.equal(tc.analysis.spendGate, 60, "3 × 20");
  assert.equal(tc.memo.scope.spendGateSource?.short, "3× your target CPA");
  assert.equal(tc.memo.scope.spendGateSource?.buyer, "3× your 20.00 EUR target CPA");
  assert.ok(!tc.memo.decision.limits.buyer.some((l) => l.includes("half the average spend")));

  /* Floor basis: tiny spends → the fixed floor wins, and it says so. */
  const tiny = "Ad name,Amount spent (EUR),Purchases,Cost per purchase (EUR)\n" +
    ["A,12,2,6", "B,11,1,11", "C,10,1,10", "D,14,2,7", "E,13,1,13", "F,2,0,"].join("\n") + "\n";
  const f = run(tiny, "cpa");
  assert.equal(f.analysis.spendGate, 10);
  assert.match(f.memo.scope.spendGateSource?.buyer ?? "", /^Debrief's fixed 10\.00 EUR floor, because half the average spend per ad in this export \(10\.33 EUR avg\) is lower — a default, not a statistical guarantee\./);

  /* Few-conversions note: buyer only, ratio KPIs only, copy only. */
  assert.ok(m.winners.every((w) => !w.fewOutcomesNote), "tester ads all have ≥12 purchases → no note");
  const few = "Ad name,Amount spent (EUR),Purchases,Cost per purchase (EUR)\n" +
    ["P1,300,3,100", "P2,300,20,15", "P3,300,12,25", "P4,300,15,20", "P5,300,4,75"].join("\n") + "\n";
  const r = run(few, "cpa");
  const rows = [...r.memo.winners, ...r.memo.losers.rows, ...(r.memo.atMedian?.rows ?? [])];
  const p1 = rows.find((x) => x.name === "P1");
  assert.equal(p1?.fewOutcomesNote, `Based on 3 purchases — under ${MIN_OUTCOMES_FOR_SUPPORTED}, so this CPA can move a lot with a few more.`);
  assert.ok(!rows.find((x) => x.name === "P2")?.fewOutcomesNote, "20 purchases → no note");
  assert.match(r.buyerText, /Based on 3 purchases — under 10/);
  assert.ok(!/Based on \d+ purchases/.test(r.clientText), "buyer register only");
  // Count KPIs don't get it (the count IS the result).
  const rp = run(few, "purchases");
  assert.ok([...rp.memo.winners, ...rp.memo.losers.rows].every((x) => !x.fewOutcomesNote));

  /* Copy only: decision.ts never reads the note; the gate is unchanged. */
  const decisionSrc = readFileSync(join(ROOT, "modules/debrief/decision.ts"), "utf8");
  assert.ok(!/fewOutcomesNote/.test(decisionSrc));
  const analysisSrc = readFileSync(join(ROOT, "modules/debrief/analysis.ts"), "utf8");
  assert.match(analysisSrc, /gate: Math\.max\(DEFAULT_SPEND_FLOOR, meanSpend \* 0\.5\)/);
  assert.match(analysisSrc, /return \{ gate: targetCpa \* 3, basis: "target_cpa" \}/);

  /* Report: header tooltip carries the full explanation; Judged tip too. */
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  assert.match(report, /<Term tip=\{`It's \$\{memo\.scope\.spendGateSource\.buyer\}`\}>/);
  assert.match(report, /at least \$\{memo\.scope\.spendGateLabel\}, \$\{memo\.scope\.spendGateSource\.short\}/);
  assert.match(report, /view !== "client" && ad\.fewOutcomesNote/);

  console.log("tester gate explained: all assertions passed");
} finally {
  cleanup();
}
