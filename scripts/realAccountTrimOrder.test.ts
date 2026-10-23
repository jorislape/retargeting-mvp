/**
 * Real-account review — trim candidates by money at stake.
 *
 * On a real export the below-median list (and the Pause / trim line)
 * opened with three ads of 47–71 EUR and 0 purchases, while a 1,017 EUR
 * ad 30% under the median sat far down the list. Proves: below-median
 * rows, the decision's Pause / trim list, the verdict's named ad and the
 * short-form headline all follow spend × gap to the median (a
 * zero-purchase ad stakes its whole spend); the ROAS column stays; the
 * cut bar still reads the worst ad by the KPI; the losers instruction
 * says how the list is ordered.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadEngine } from "./testerFeedbackEngine.ts";
import { moneyAtStake } from "../modules/debrief/decision.ts";
import type { RankedAd } from "../modules/debrief/types.ts";

const H = "Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n";
const ad = (spend: number, deltaPct: number | null, zeroConversions?: boolean) =>
  ({ spend, deltaPct, zeroConversions }) as unknown as RankedAd;

/* ---- The measure ---- */
assert.equal(moneyAtStake(ad(1000, -30)), 300, "spend × gap");
assert.equal(moneyAtStake(ad(70, -100)), 70, "0x ROAS: the whole spend");
assert.equal(moneyAtStake(ad(70, null, true)), 70, "a zero-conversion CPA ad (no value): the whole spend");
assert.equal(moneyAtStake(ad(500, null)), 500);
assert.equal(moneyAtStake(ad(500, 10)), 0, "never negative");

const { run, buildSampleMemo, cleanup } = loadEngine();
try {
  // Median 3.0x. Big_Mild: 1,000 EUR at 2.1x (−30% → 300 at stake);
  // Zero_Big: 400 EUR, 0 purchases (400); Tiny_Bad: 250 EUR at 0.6x
  // (−80% → 200); Zero_Small: 230 EUR, 0 purchases (230).
  const csv =
    H +
    [
      "Top_A,400,30,1600", "Top_B,400,28,1500", "Top_C,400,25,1400", "Mid_D,400,20,1200", "Mid_E,400,20,1200",
      "Big_Mild,1000,30,2100", "Zero_Big,400,0,0", "Tiny_Bad,250,2,150", "Zero_Small,230,0,0",
    ].join("\n") + "\n";
  const r = run(csv, "roas");
  const m = r.memo;
  const order = ["Zero_Big", "Big_Mild", "Zero_Small", "Tiny_Bad"];
  assert.deepEqual(m.losers.rows.map((x) => x.name), order, "below-median rows by money at stake");
  assert.deepEqual(m.decision.budgetMove?.from.map((x) => x.name), order, "Pause / trim in the same order");
  assert.ok(m.tldr[1].startsWith('Trim or pause "Zero_Big" and 3 other below-median ads'), "the verdict names the most at stake");
  assert.deepEqual(m.losers.rows.map((x) => x.valueLabel), ["0.00x", "2.10x", "0.00x", "0.60x"], "the ROAS column stays");
  assert.ok(m.losers.killInstruction.endsWith("Listed by money at stake — spend × gap to the median."));

  // The KPI order is untouched underneath: the cut bar reads the worst ad.
  const kpiOrder = r.analysis.losers.map((x) => x.kpiValue ?? 0);
  assert.deepEqual(kpiOrder, [...kpiOrder].sort((a, b) => a - b), "analysis.losers stays worst-first by ROAS");

  /* ---- Short-form headline (≤2 below-median ads) follows the same order ---- */
  // Tiny (0.2x) is worse by ROAS; Big (1.67x on 900 EUR) has more at stake.
  const two = run(H + ["A,400,30,1600", "B,400,20,1200", "C,400,20,1200", "D,400,20,1220", "Tiny,250,1,50", "Big,900,20,1500"].join("\n") + "\n", "roas").memo;
  assert.equal(two.decision.headline, 'Shift budget in steps from "Big" and "Tiny" into "A".', "most at stake first");

  /* ---- The real-account shape is reproduced by the fixture ---- */
  const f = run(readFileSync(join(ROOT, "scripts/fixtures/agency-naming-convention.csv"), "utf8"), "roas");
  const stakes = f.memo.losers.rows.map((row) => moneyAtStake(f.analysis.losers.find((x) => x.name === row.name)!));
  assert.deepEqual(stakes, [...stakes].sort((a, b) => b - a), "fixture rows descend by money at stake");

  /* ---- Sample: already in this order; only the instruction gains the note ---- */
  const s = buildSampleMemo();
  assert.deepEqual(s.losers.rows.map((x) => x.name), [
    "Static_StockPhoto_Generic_V1", "Static_MemeStyle_V1", "Comparison_CompetitorAngle_V1", "Discount_Generic_20Off", "ProductShot_Static_V1",
  ]);

  console.log("real-account trim order: all assertions passed");
} finally {
  cleanup();
}
