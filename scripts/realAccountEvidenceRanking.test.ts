/**
 * Real-account review — evidence-weighted receivers.
 *
 * Ranking receivers by raw ROAS chose 18–31-purchase ads over a
 * 110-purchase ad at 4.83x and a 59-purchase ad at 5.26x. Proves: the
 * adjusted ROAS is (purchases × ROAS + k × median) ÷ (purchases + k),
 * k = 2× the purchase floor (20 by default; 2× the user's scaling
 * minimum); qualifying receivers and the above-median table are ordered
 * by it while eligibility (the 30% bar) stays on raw ROAS; the raw value
 * stays the row's value with "adj." beside it in the buyer view only;
 * one limits line explains it when it changed the receivers; a leader
 * that clears the floor but is outranked gets evidence wording, never
 * "under the receiver floor"; CPA runs and the sample's receivers are
 * unaffected.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_BANNED, ROOT, clientStrings, loadEngine } from "./testerFeedbackEngine.ts";
import { EVIDENCE_ADJUST_FLOOR_MULTIPLE, evidenceAdjustedKpi } from "../modules/debrief/decision.ts";
import type { AnalysisResult } from "../modules/debrief/types.ts";

/* ---- The formula ---- */
const a = { kpi: "roas", median: 3.03 } as unknown as AnalysisResult;
assert.equal(EVIDENCE_ADJUST_FLOOR_MULTIPLE, 2);
assert.ok(Math.abs(evidenceAdjustedKpi({ conversions: 110, kpiValue: 4.83 }, a)! - (110 * 4.83 + 20 * 3.03) / 130) < 1e-12);
assert.ok(Math.abs(evidenceAdjustedKpi({ conversions: 18, kpiValue: 7.02 }, a, { minOutcomeCount: 15 })! - (18 * 7.02 + 30 * 3.03) / 48) < 1e-12, "k = 2× the user's minimum");
assert.equal(evidenceAdjustedKpi({ conversions: null, kpiValue: 5 }, a), null, "no count ⇒ no adjustment");
assert.equal(evidenceAdjustedKpi({ conversions: 50, kpiValue: 20 }, { kpi: "cpa", median: 20 } as unknown as AnalysisResult), null, "ROAS only");

const H = "Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n";
const mids = ["M1,400,15,1200", "M2,400,15,1200", "M3,400,15,1200", "M4,400,15,1200", "M5,400,15,1200"];
const lows = ["L1,400,10,600", "L2,400,10,600", "L3,400,10,600", "L4,400,10,600"];
// Median 3.0x. Raw order: Thin 7.0 (18), Mid 5.3 (59), Ok 5.0 (20), Big 4.8 (110).
// Adjusted (k = 20): Thin 4.89, Mid 4.72, Big 4.52, Ok 4.00.
const base = ["Thin,300,18,2100", "Mid,600,59,3180", "Ok,400,20,2000", "Big,1300,110,6240", ...mids, ...lows];

const { run, cleanup } = loadEngine();
try {
  const r = run(H + base.join("\n") + "\n", "roas");
  const m = r.memo;
  assert.deepEqual(m.decision.budgetMove!.to.map((x) => x.name), ["Thin", "Mid", "Big"], "Big (110 purchases) replaces Ok (20)");
  for (const name of ["Thin", "Mid", "Big"]) {
    const w = r.analysis.winners.find((x) => x.name === name)!;
    assert.ok(w.deltaPct! >= 30, `${name} still clears the 30% bar on raw ROAS`);
  }
  assert.deepEqual(m.winners.map((x) => x.name), ["Thin", "Mid", "Big", "Ok"], "the above-median table follows the adjusted order");
  assert.deepEqual(m.winners.map((x) => x.valueLabel), ["7.00x", "5.30x", "4.80x", "5.00x"], "raw ROAS stays the value");
  assert.deepEqual(m.winners.map((x) => x.adjValueLabel), ["4.89x", "4.72x", "4.52x", "4.00x"]);
  assert.equal(r.analysis.winners[0].name, "Thin", "analysis order (eligibility) untouched");
  const line = m.decision.limits.buyer.filter((l) => l.startsWith("Receivers are ranked by evidence-adjusted ROAS"));
  assert.deepEqual(line, ["Receivers are ranked by evidence-adjusted ROAS — ads with few purchases are pulled toward the median: (purchases × ROAS + 20 × median) ÷ (purchases + 20). Each still clears the 30% bar on raw ROAS."]);
  assert.ok(r.buyerText.includes("- Big | 4.80x · adj. 4.52x ("), "buyer TXT carries adj.");
  assert.ok(!r.clientText.includes("adj."), "client TXT never does");
  for (const s of clientStrings(m)) for (const w of CLIENT_BANNED) assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(s), `client "${w}": ${s}`);

  /* ---- The leading-ad sentence describes the table's first row ---- */
  {
    // Lead (7.5x on 10 purchases) tops raw ROAS; the table's first row
    // is Thin (evidence-adjusted) — the sentence follows the table.
    const memo = run(H + ["Lead,300,10,2250", ...base].join("\n") + "\n", "roas").memo;
    assert.equal(memo.winners[0].name, "Thin");
    assert.equal(memo.leadingConversion?.buyer, "The leading ad recorded 18 purchases during this period.");
    assert.equal(memo.leadingConversion?.client, '"Thin" led with 18 purchases during the selected period.');
  }
  /* ---- Several receivers ⇒ the evidence line never says "one ad" ---- */
  {
    // Dated, so nothing but the evidence decides the label.
    const dated = (rows: string[]) =>
      "Ad name,Amount spent (EUR),Purchases,Purchases conversion value,Reporting starts,Reporting ends\n" +
      rows.map((r) => `${r},2026-06-01,2026-06-30`).join("\n") + "\n";
    const s = run(dated(["R1,600,40,3000", "R2,600,36,2700", "R3,600,34,2520", ...mids, ...lows]), "roas");
    assert.equal(s.memo.decision.evidenceState, "supported");
    assert.equal(s.memo.decision.budgetMove?.to.length, 3);
    assert.ok(s.buyerText.includes("Evidence: Strong support from this dataset — 3 ads clearly pulled ahead across "));
  }

  /* ---- No reordering ⇒ no limits line ---- */
  const same = run(H + ["Big,1300,110,6240", "Mid,600,59,3180", ...mids, ...lows].join("\n") + "\n", "roas").memo;
  assert.ok(!same.decision.limits.buyer.some((l) => l.startsWith("Receivers are ranked")));

  /* ---- A leader that clears the floor but is outranked: evidence wording ---- */
  {
    const memo = run(H + ["Lead,300,10,2250", ...base].join("\n") + "\n", "roas").memo; // 7.5x on 10 ⇒ adj 4.50
    assert.ok(!memo.decision.budgetMove!.to.some((x) => x.name === "Lead"));
    const t1 = memo.nextTests[0];
    assert.match(t1.test, /"Thin"/, "T1 builds on the primary receiver");
    assert.ok(t1.signals.some((s) => s.includes("— the strongest evidence-adjusted result.")));
    assert.ok(JSON.stringify(t1).includes("fewer purchases pull it below the receivers once results are evidence-adjusted"));
    assert.ok(!JSON.stringify(t1).includes("under the receiver floor"), "never the floor reason for an ad that clears it");
  }

  /* ---- CPA: unchanged ---- */
  const cpa = run("Ad name,Amount spent (EUR),Purchases,Cost per purchase (EUR)\n" + ["A,400,40,10", "B,400,36,11.11", "C,400,33,12.12", "D,400,30,13.33", "E,400,28,14.29", "F,400,20,20", "G,400,10,40"].join("\n") + "\n", "cpa").memo;
  assert.ok(cpa.winners.every((x) => x.adjValueLabel === undefined));

  /* ---- Report: "adj." column, buyer only, with the tooltip ---- */
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  assert.match(report, /const hasAdj = view !== "client" && rows\.some\(\(r\) => r\.adjValueLabel != null\);/);
  assert.match(report, /<Term tip=\{TIP_ADJ\}>adj\.<\/Term>/);
  assert.match(report, /const TIP_ADJ =\s*"Evidence-adjusted ROAS — ads with few purchases are pulled toward the median/);

  console.log("real-account evidence ranking: all assertions passed");
} finally {
  cleanup();
}
