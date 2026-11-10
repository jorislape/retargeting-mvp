/**
 * Batch D3 — placement / CTR outliers. With a placement column, a
 * placement whose link CTR is ≥ 3× the account CTR while its clicks
 * convert below the median placement's is flagged ("likely accidental
 * clicks — consider excluding"); without one, the same rule runs per ad
 * against the median ad. Display only, buyer only.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadEngine } from "./testerFeedbackEngine.ts";

const { run, buildSampleMemo, cleanup } = loadEngine();
try {
  /* ---- Placement column ---- */
  const p = run(readFileSync(join(ROOT, "scripts/fixtures/placement-breakdown.csv"), "utf8"), "roas");
  const o = p.analysis.clickOutliers!;
  assert.equal(o.basis, "placement");
  assert.deepEqual(o.items.map((i) => i.label), ["Audience Network · Native, banner and interstitial"]);
  assert.equal(o.items[0].ctr, 22);
  assert.ok(o.items[0].ctr >= 3 * o.ctrBar && o.items[0].convRate < o.medianConvRate);
  assert.match(p.memo.clickOutliers!, /^Audience Network · Native, banner and interstitial: CTR 22\.00% vs [\d.]+% account CTR \([\d.]+×\), but [\d.]+% of clicks converted vs [\d.]+% median — likely accidental clicks; consider excluding this placement\.$/);
  assert.ok(p.buyerText.includes(`Click outliers: ${p.memo.clickOutliers}`));
  assert.ok(!p.clientText.includes("accidental"), "buyer only");
  assert.equal(p.analysis.adsJudged, 6, "placement rows are still merged per ad");

  /* ---- No placement column ⇒ per ad, vs the median ad ---- */
  const H = "Ad name,Amount spent (EUR),Impressions,Link clicks,Purchases,Purchases conversion value\n";
  const ads = ["A,400,20000,240,12,900", "B,400,20000,220,11,800", "C,400,20000,200,10,700", "D,400,20000,260,12,750",
    "Clicky,400,20000,1400,3,200", // 7% CTR vs ~1.2% median, 0.2% conversion
    "E,400,20000,180,9,650"];
  const a = run(H + ads.join("\n") + "\n", "roas");
  assert.equal(a.analysis.clickOutliers?.basis, "ad");
  assert.deepEqual(a.analysis.clickOutliers?.items.map((i) => i.label), ["Clicky"]);
  assert.match(a.memo.clickOutliers!, /^"Clicky": CTR 7\.00% vs [\d.]+% median ad's CTR \([\d.]+×\), but 0\.2% of clicks converted vs [\d.]+% median — likely accidental clicks; check its placement breakdown before scaling\.$/);
  /* High CTR that also converts well ⇒ not flagged. */
  const good = run(H + [...ads.slice(0, 4), "Clicky,400,20000,1400,80,6000", ads[5]].join("\n") + "\n", "roas");
  assert.equal(good.analysis.clickOutliers, undefined);
  /* No conversion count ⇒ can't read conversion rate ⇒ nothing. */
  assert.equal(run("Ad name,Amount spent (EUR),Impressions,Link clicks,Purchase ROAS (return on ad spend)\n" + ["A,400,20000,240,2.1", "B,400,20000,220,1.9", "C,400,20000,1400,1.2", "D,400,20000,200,2.4"].join("\n") + "\n", "roas").analysis.clickOutliers, undefined);
  assert.equal(buildSampleMemo().clickOutliers, undefined, "sample untouched");

  /* Display only. */
  assert.ok(!readFileSync(join(ROOT, "modules/debrief/decision.ts"), "utf8").includes("clickOutliers"), "decision.ts never reads it");
  assert.match(readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8"), /\{ label: "Click outliers", value: client \? undefined : memo\.clickOutliers \}/);

  console.log("batch D click outliers: all assertions passed");
} finally {
  cleanup();
}
