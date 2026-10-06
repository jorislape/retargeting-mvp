/**
 * Tester Feedback Fix 2 — zero-conversion CPA ads above the spend gate
 * are judged, not set aside.
 *
 * Before: extract.ts only computed CPA when conversions > 0, so an ad
 * that spent well past the gate with 0 purchases got kpiValue null →
 * gate "no_kpi_value" → silently excluded. Now (CPA only, count column
 * present, cell a REAL 0 — not blank): judged as the worst performer,
 * excluded from the median, first in the worst-first loser list,
 * counted in belowBenchmarkSpend/Count, eligible for the cut bar.
 * Blank cells and below-gate zeros keep today's behaviour.
 */
import assert from "node:assert/strict";
import { CLIENT_BANNED, TESTER_CSV, clientStrings, loadEngine } from "./testerFeedbackEngine.ts";

const HEAD = "Ad name,Amount spent (EUR),Purchases,Cost per purchase (EUR)\n";
// Six valued ads (CPA 20..45) — mean spend drives the gate.
const BASE = [
  ["V1", 400, 20], ["V2", 380, 16], ["V3", 360, 12], ["V4", 340, 10], ["V5", 320, 8], ["V6", 300, 6],
] as const;
const csvOf = (rows: (readonly [string, number, number | ""])[]) =>
  HEAD + rows.map(([n, s, p]) => `${n},${s},${p},${typeof p === "number" && p > 0 ? (s / p).toFixed(2) : ""}`).join("\n") + "\n";

const { run, buildSampleMemo, cleanup } = loadEngine();
try {
  /* ---- Fixture A: zero-purchase ad ABOVE the gate → judged, worst ---- */
  {
    const t = run(csvOf([...BASE, ["ZeroBig", 500, 0]]), "cpa");
    const a = t.analysis;
    const zero = t.ads.find((x) => x.name === "ZeroBig");
    assert.equal(zero?.zeroConversions, true, "real 0 → flagged");
    assert.equal(zero?.kpiValue, null, "no CPA is invented");
    assert.ok(a.spendGate < 500);
    assert.equal(a.adsJudged, 7, "the zero ad is judged");
    assert.equal(a.adsSetAside, 0);
    // Median over the six VALUED ads only (20,23.75,30,34,40,50 → 32).
    assert.equal(a.median, 32);
    const worst = a.losers[0];
    assert.equal(worst.name, "ZeroBig", "worst-first loser list leads with it");
    assert.equal(worst.deltaPct, null, "no percentage invented");
    assert.ok(Number.isFinite(worst.deltaFromMedian), "finite sentinel, never Infinity");
    assert.ok(a.rankedAds.every((r) => r === worst || r.deltaFromMedian > worst.deltaFromMedian));
    const valuedLosers = a.rankedAds.filter((r) => r.deltaFromMedian < 0 && !r.zeroConversions);
    assert.equal(a.belowBenchmarkCount, valuedLosers.length + 1, "counted below benchmark");
    assert.equal(a.belowBenchmarkSpend, valuedLosers.reduce((s, r) => s + r.spend, 0) + 500, "its spend is counted");
    assert.equal(a.kpiGaps, undefined, "no 'no value' gap claimed for a judged ad");
    // Copy: the fact, in both registers, no NaN anywhere.
    const m = t.memo;
    const row = m.losers.rows[0];
    assert.equal(row.valueLabel, "0 purchases");
    assert.equal(row.vsMedianLabel, "no CPA — ranked last");
    assert.equal(row.deltaPct, null);
    assert.ok(m.nextTests.some((x) => x.signals.includes('"ZeroBig" spent 500.00 EUR with 0 purchases.')));
    assert.match(t.buyerText, /spent 500\.00 EUR with 0 purchases/);
    assert.match(t.clientText, /spent 500\.00 EUR with 0 purchases/);
    for (const txt of [t.buyerText, t.clientText, JSON.stringify(m)]) assert.ok(!/NaN|Infinity|undefined/.test(txt), "no NaN/Infinity leaks");
    for (const s of clientStrings(m))
      for (const w of CLIENT_BANNED) assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(s), `client "${w}": ${s}`);
    // Cut eligibility: the zero ad clears the "worst ad" half of the bar.
    const share = (a.belowBenchmarkSpend / a.judgedSpend) * 100;
    if (share >= 25) assert.equal(m.decision.action === "budget" && m.decision.budgetVariant !== "scale", true, "cut side committed");
  }

  /* Cut-eligibility in isolation: without the zero ad the field holds/tests;
     with it (worst deltaPct null but zero) the cut half becomes available. */
  {
    const flat = [["F1", 300, 10], ["F2", 300, 10], ["F3", 300, 10], ["F4", 300, 10], ["F5", 300, 10]] as const;
    const without = run(csvOf([...flat]), "cpa").memo.decision;
    assert.notEqual(without.action, "budget");
    const withZero = run(csvOf([...flat, ["Zero", 600, 0]]), "cpa"); // 600 of 2100 judged = 29% ≥ the 25% share bar
    assert.equal(withZero.analysis.losers[0].name, "Zero");
    assert.equal(withZero.memo.decision.action, "budget", "a judged zero ad can trigger the cut");
    assert.equal(withZero.memo.decision.budgetVariant, "cut");
  }

  /* ---- Fixture B: zero-purchase ad BELOW the gate → set aside for spend ---- */
  {
    const t = run(csvOf([...BASE, ["ZeroSmall", 20, 0]]), "cpa");
    const a = t.analysis;
    assert.ok(20 < a.spendGate);
    assert.equal(a.adsJudged, 6);
    assert.equal(a.adsSetAside, 1);
    assert.ok(!a.rankedAds.some((r) => r.name === "ZeroSmall"));
    assert.equal(a.kpiGaps, undefined, "set aside for spend, not for a missing value");
    assert.match(t.memo.losers.setAsideNote, /^1 ad had too little spend/);
  }

  /* ---- Fixture C: BLANK purchase cell above the gate → still no value ---- */
  {
    const t = run(csvOf([...BASE, ["Blank", 500, ""]]), "cpa");
    const a = t.analysis;
    const blank = t.ads.find((x) => x.name === "Blank");
    assert.equal(blank?.zeroConversions, undefined, "blank ≠ zero");
    assert.equal(a.adsJudged, 6);
    assert.ok(!a.rankedAds.some((r) => r.name === "Blank"));
    assert.ok(a.kpiGaps, "set aside as no value, exactly as before");
    assert.equal(a.kpiGaps?.noValue, 1);
    assert.equal(a.kpiGaps?.zeroOutcome, 0);
    assert.match(t.memo.losers.setAsideNote, /1 had no CPA value/);
  }

  /* ---- Non-CPA KPIs are untouched: ROAS with a 0-purchase row ---- */
  {
    const roas =
      "Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n" +
      "R1,400,10,900\nR2,380,8,700\nR3,360,6,500\nR4,340,5,300\nR5,320,4,200\nR6,300,0,\n";
    const t = run(roas, "roas");
    assert.ok(t.ads.every((x) => x.zeroConversions === undefined), "flag is CPA-only");
    assert.equal(t.analysis.kpiGaps?.zeroOutcome, 1, "ROAS zero-outcome wording path unchanged");
  }

  /* ---- Tester fixture: its below-gate zero (Ad_A) stays set aside ---- */
  {
    const t = run(TESTER_CSV, "cpa");
    assert.equal(t.analysis.adsJudged, 5);
    assert.equal(t.ads.find((x) => x.name === "Ad_A")?.zeroConversions, true);
    assert.ok(!t.analysis.rankedAds.some((r) => r.name === "Ad_A"));
  }

  /* ---- Sample has no zero-conversion CPA ads → no flag anywhere ---- */
  assert.ok(!JSON.stringify(buildSampleMemo()).includes("ranked last"));

  console.log("tester zero-conversions: all assertions passed");
} finally {
  cleanup();
}
