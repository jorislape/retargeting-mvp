/**
 * First-Run Robustness 3 — trust-pass leftovers.
 *
 * (a) Proxy-KPI mode (CTR/CPC/Purchases/Leads with an outcome column):
 *     no next test is built on an ad below median on the outcome KPI —
 *     the first test moves to the outcome leader (and the card watches
 *     the outcome KPI); no "rebuild" of an ad above the outcome median.
 * (b) "benchmark" is gone from Spend allocation and the card's "What we
 *     know" rationale — "median" / "Above/Below median", matching tables.
 * (c) A committed SHIFT never sits beside a separate "scale by a single
 *     moderate step" test; a scale-only call keeps its scale test.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadEngine } from "./testerFeedbackEngine.ts";

const ECOM = readFileSync(join(ROOT, "scripts/fixtures/ecom-13ads.csv"), "utf8");
const quoted = (s: string) => [...s.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

const { run, buildSampleMemo, cleanup } = loadEngine();
try {
  /* ---- (a) ---- */
  for (const kpi of ["ctr", "cpc", "purchases"]) {
    const r = run(ECOM, kpi);
    const oc = r.analysis.proxyKpi?.outcome;
    assert.ok(oc, `${kpi}: outcome read present`);
    const below = new Set(oc!.belowMedian);
    const above = new Set(oc!.aboveMedian);
    for (const t of r.memo.nextTests) {
      const subject = quoted(t.test)[0];
      if (!subject) continue;
      if (/^Brief 2 new|variants of/.test(t.test)) assert.ok(!below.has(subject), `${kpi}: "${t.test}" builds on a below-median-${oc!.label} ad`);
      if (/^(Rebuild|Reshoot|Test one rebuilt)/.test(t.test)) assert.ok(!above.has(subject), `${kpi}: "${t.test}" rebuilds an above-median-${oc!.label} ad`);
    }
  }
  const ctr = run(ECOM, "ctr").memo;
  assert.match(ctr.nextTests[0].test, /^Brief 2 new variants of "Hero_UGC_A" — the leader on ROAS — varying only the opening\.$/);
  assert.match(ctr.nextTests[0].why, /^On CTR, the leading ads sit below the median on ROAS \(2\.50x\)/);
  assert.equal(ctr.nextTests[0].briefReadiness, undefined, "no readiness claim measured on the proxy");
  assert.equal(ctr.decision.nextControlledTest?.watch, "ROAS");
  assert.ok(!ctr.nextTests.some((t) => /Clickbait_M/.test(t.test)), "the 0.66x ROAS CTR-leader is never a test subject");
  // Outcome KPIs themselves are untouched.
  assert.equal(run(ECOM, "roas").analysis.proxyKpi, undefined);

  /* ---- (b) ---- */
  const sample = buildSampleMemo();
  const runs = [sample, run(ECOM, "roas").memo, run(ECOM, "roas", { minJudgeOutcomes: 10 }).memo, ctr];
  for (const m of runs) {
    assert.ok(!/benchmark/i.test(m.decision.rationale), `What we know: ${m.decision.rationale}`);
    if (m.spendAllocation) assert.ok(!/benchmark/i.test(m.spendAllocation.headline.buyer), m.spendAllocation.headline.buyer);
  }
  assert.match(sample.decision.rationale, /5 below-median ads hold 35% of judged spend/);
  assert.equal(sample.spendAllocation?.headline.buyer, "35% of judged spend sits behind below-median ads.");
  const chart = readFileSync(join(ROOT, "components/debrief/SpendAllocationChart.tsx"), "utf8");
  assert.match(chart, /below: \{ buyer: "Below median"/);
  assert.match(chart, /above: \{ buyer: "Above median"/);
  assert.ok(!/buyer: "(Below|Above) benchmark"/.test(chart));
  assert.match(readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8"), /phrase: "below-median", tip: TIP_BELOW_BENCHMARK/);

  /* ---- (c) ---- */
  const SCALE_TEST = /daily budget by a single moderate step/;
  for (const [label, m] of [["sample", sample], ["ecom roas", run(ECOM, "roas").memo]] as const) {
    assert.equal(m.decision.budgetVariant, "shift", label);
    assert.ok(!m.nextTests.some((t) => SCALE_TEST.test(t.test)), `${label}: no separate scale move beside the shift`);
  }
  const ecomShift = run(ECOM, "roas").memo;
  assert.ok(ecomShift.nextTests.some((t) => /The shift above is this debrief's one budget move/.test(t.why)), "challenger names the shift");
  const scaleOnly = run(ECOM, "roas", { minJudgeOutcomes: 10 }).memo;
  assert.equal(scaleOnly.decision.budgetVariant, "scale");
  assert.ok(scaleOnly.nextTests.some((t) => SCALE_TEST.test(t.test)), "scale-only call keeps its scale test");
  // The scale-only rationale no longer says "43% … under the 25% bar".
  assert.ok(!/under the 25% bar/.test(scaleOnly.decision.rationale), scaleOnly.decision.rationale);
  assert.match(scaleOnly.decision.rationale, /No cut: 43% of judged spend sits below the median, but the weakest ad isn't 30% behind it\./);

  console.log("trustLeftovers: all assertions passed");
} finally {
  cleanup();
}
