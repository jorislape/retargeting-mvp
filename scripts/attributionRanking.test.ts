/**
 * Attribution & Intent 2 — rank on click-only when available.
 *
 * With click-only columns for the selected KPI (ROAS / CPA / CPL),
 * every KPI value and conversion count is computed from them (7-day
 * click preferred over 1-day), so the outcome floor and the zero-
 * conversion rule use the same counts; the report says so in both
 * registers. A view-heavy static that wins on blended loses on click.
 * No click-only columns ⇒ blended, exactly as before.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadEngine } from "./testerFeedbackEngine.ts";

const SPLIT = readFileSync(join(ROOT, "scripts/fixtures/attribution-split.csv"), "utf8");
const BRACKETS = SPLIT.replace(/\((7-day click|1-day click|1-day view)\)/g, "[$1]");
/** Drop columns whose header matches. */
const dropCols = (csv: string, re: RegExp) => {
  const rows = csv.trim().split("\n").map((l) => l.split(","));
  const keep = rows[0].map((h, i) => (re.test(h) ? -1 : i)).filter((i) => i >= 0);
  return rows.map((r) => keep.map((i) => r[i]).join(",")).join("\n") + "\n";
};

const { run, cleanup } = loadEngine();
try {
  /* ---- The false banger: wins on blended, loses on click-only ---- */
  const blended = run(dropCols(SPLIT, /\((7-day|1-day) (click|view)\)/), "roas");
  assert.equal(blended.analysis.winners[0].name, "Static_Retarget", "blended crowns the view-heavy static");
  assert.equal(blended.memo.decision.budgetMove?.to[0].name, "Static_Retarget");
  for (const [label, csv] of [["parentheses", SPLIT], ["brackets", BRACKETS]] as const) {
    const r = run(csv, "roas");
    const a = r.analysis;
    assert.equal(a.attributionBasis?.windowLabel, "7-day click", label);
    assert.equal(a.winners[0].name, "UGC_A", `${label}: click-only leader`);
    const sr = a.rankedAds.find((x) => x.name === "Static_Retarget")!;
    assert.equal(sr.kpiValue, 1, `${label}: 300 click value ÷ 300 spend`);
    assert.ok(sr.deltaFromMedian < 0, `${label}: the static now ranks below median`);
    assert.equal(sr.conversions, 5, `${label}: click-only count`);
    assert.ok(r.memo.decision.budgetMove?.from.some((x) => x.name === "Static_Retarget"), `${label}: budget moves AWAY from it`);
    assert.ok(r.memo.decision.limits.buyer.some((l) => l.startsWith("Ranked on 7-day click conversions only; view-through excluded")));
    assert.ok(r.memo.decision.limits.client.some((l) => l.startsWith("Ads are compared only on purchases made within 7 days of someone clicking the ad")));
    assert.equal(r.memo.scope.accountKpiBasis, "7-day click purchase value ÷ total spend");
  }
  /* ---- 7-day preferred; 1-day used when it's the only click window ---- */
  const r7 = run(SPLIT, "roas");
  assert.equal(r7.analysis.rankedAds.find((x) => x.name === "UGC_A")!.kpiValue, 4, "7-day: 1200 ÷ 300, not the 1-day 960");
  const only1 = run(dropCols(SPLIT, /\(7-day click\)/), "roas");
  assert.equal(only1.analysis.attributionBasis?.windowLabel, "1-day click");
  assert.equal(only1.analysis.rankedAds.find((x) => x.name === "UGC_A")!.kpiValue, 3.2);

  /* ---- CPA (and CPL) on click-only counts ---- */
  const cpa = run(SPLIT, "cpa");
  assert.equal(cpa.analysis.rankedAds.find((x) => x.name === "Static_Retarget")!.kpiValue, 60, "300 ÷ 5 click purchases");
  const cplCsv = "Ad name,Amount spent (USD),Leads,Leads (7-day click),Leads (1-day view)\n" +
    ["A,300,40,30,10", "B,300,30,25,5", "C,300,60,10,50", "D,300,20,18,2", "E,300,24,20,4", "F,300,22,21,1"].join("\n") + "\n";
  const cpl = run(cplCsv, "cpa");
  assert.equal(cpl.analysis.cpaBasis, "leads");
  assert.equal(cpl.analysis.rankedAds.find((x) => x.name === "C")!.kpiValue, 30, "300 ÷ 10 click leads (not ÷ 60 blended)");
  assert.ok(cpl.memo.decision.limits.client.some((l) => l.includes("leads made within 7 days")));

  /* ---- The outcome floor uses the click-only counts ---- */
  const floored = run(SPLIT, "roas", { minJudgeOutcomes: 10 });
  const aside = floored.analysis.outcomeFloor?.setAside ?? [];
  assert.deepEqual(aside.find((x) => x.name === "Static_Retarget"), { name: "Static_Retarget", count: 5 }, "5 click purchases < 10 (blended would be 30)");
  assert.ok(floored.memo.decision.limits.buyer.some((l) => l.includes('"Static_Retarget" set aside — 5 purchases, below your 10 minimum')));

  /* ---- The zero-conversion rule uses the click-only count ---- */
  const zeroCsv = "Ad name,Amount spent (USD),Purchases,Purchases (7-day click),Purchases (1-day view)\n" +
    ["Z,900,12,0,12", "A,300,10,10,0", "B,300,8,8,0", "C,300,6,6,0", "D,300,12,12,0", "E,300,9,9,0"].join("\n") + "\n";
  const z = run(zeroCsv, "cpa");
  const zad = z.ads.find((x) => x.name === "Z")!;
  assert.equal(zad.zeroConversions, true, "0 click purchases (12 view-only) ⇒ zero-conversion on click");
  assert.equal(z.analysis.losers[0].name, "Z", "judged as the worst");

  /* ---- No click-only columns ⇒ blended (byte-identity is checked
         against main in test:attribution-columns) ---- */
  assert.equal(run(readFileSync(join(ROOT, "scripts/fixtures/ecom-13ads.csv"), "utf8"), "roas").analysis.attributionBasis, undefined);
  const viewOnly = run(dropCols(SPLIT, /click\)/), "roas");
  assert.equal(viewOnly.analysis.attributionBasis, undefined, "a view column alone never switches the basis");
  assert.equal(viewOnly.analysis.winners[0].name, "Static_Retarget");

  console.log("attributionRanking: all assertions passed");
} finally {
  cleanup();
}
