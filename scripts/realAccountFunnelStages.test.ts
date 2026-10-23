/**
 * Real-account fix 4 — mixed funnel stages.
 *
 * A real agency export ranked TOFU and BOFU ads against one median, and
 * the Mixed Segment Warning couldn't fire: the export had no ad set or
 * campaign column (detectSegmentSpread needs one), and the stage lived
 * only in the ad names. Proves: stages are read from name tokens, then
 * campaign, then ad set names; >1 stage among judged ads draws ONE
 * limits line per register; the action, median and ranking are
 * untouched; single-stage and stage-less exports are byte-identical.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_BANNED, ROOT, clientStrings, loadEngine } from "./testerFeedbackEngine.ts";
import { detectFunnelMix, stageForAd, stageFromLabel } from "../modules/debrief/funnelStages.ts";

const AGENCY = readFileSync(join(ROOT, "scripts/fixtures/agency-naming-convention.csv"), "utf8");
const ECOM = readFileSync(join(ROOT, "scripts/fixtures/ecom-13ads.csv"), "utf8");

/* ---- Pure stage reading ---- */
assert.equal(stageFromLabel("[VAR]ORG_[FOR]UGC_[STG]TOFU_[HK]01"), "TOFU");
assert.equal(stageFromLabel("S14_Spring_Lifestyle scene_Image_LT_BOFU - Copy"), "BOFU");
assert.equal(stageFromLabel("mofu retarget"), "MOFU", "case-insensitive");
assert.equal(stageFromLabel("TOFUTTI_Dessert"), null, "a stage must be its own token");
assert.equal(stageFromLabel("TOFU_to_BOFU_bridge"), null, "two stages in one label ⇒ unknown, never guessed");
assert.equal(stageFromLabel(null), null);
assert.equal(stageForAd({ name: "Plain", campaignName: "Prospecting | TOFU", adSetName: "BOFU set" }), "TOFU", "campaign before ad set");
assert.equal(stageForAd({ name: "Plain", campaignName: null, adSetName: "BOFU set" }), "BOFU");
assert.equal(stageForAd({ name: "Hero_BOFU", campaignName: "TOFU camp", adSetName: null }), "BOFU", "the ad's own name wins");
assert.equal(detectFunnelMix([]), null);

const { run, buildSampleMemo, cleanup } = loadEngine();
try {
  /* ---- The fixture mixes TOFU and BOFU with no ad set/campaign column ---- */
  const r = run(AGENCY, "roas");
  assert.equal(r.columns.adSetName, null, "fixture mirrors the real export: no ad set column…");
  assert.equal(r.columns.campaignName, null, "…and no campaign column");
  assert.equal(r.analysis.mixedSegments, undefined, "which is why the segment warning can't fire");
  const mix = r.analysis.funnelMix;
  assert.ok(mix, "the stage mix is detected from names");
  assert.deepEqual(mix!.stages.map((s) => s.stage), ["TOFU", "BOFU"]);
  assert.equal(
    mix!.stages.reduce((n, s) => n + s.judged, 0) + mix!.unknown,
    r.analysis.adsJudged,
    "every judged ad is counted once"
  );
  const line = r.memo.decision.limits.buyer.find((l) => l.startsWith("Judged ads mix funnel stages — TOFU ("));
  assert.ok(line, "one buyer limits line");
  assert.match(line!, /TOFU \(\d+ ads, median [\d.]+x\) and BOFU \(\d+ ads, median [\d.]+x\)/);
  assert.match(line!, /run the debrief once per stage/);
  assert.ok(r.memo.decision.limits.client.some((l) => l.includes("ads aimed at new audiences")));
  for (const s of clientStrings(r.memo))
    for (const w of CLIENT_BANNED) assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(s), `client "${w}": ${s}`);

  /* ---- Copy only: removing the stage tokens changes nothing else ---- */
  const stageless = AGENCY.replace(/\[STG\](TOFU|BOFU)/g, "[STG]X").replace(/_(TOFU|BOFU)\b/g, "_X");
  const s = run(stageless, "roas");
  assert.equal(s.analysis.funnelMix, undefined, "no stages ⇒ no line");
  assert.equal(s.memo.decision.action, r.memo.decision.action);
  assert.equal(s.memo.decision.headline.replace(/TOFU|BOFU/g, "X"), r.memo.decision.headline.replace(/TOFU|BOFU/g, "X"));
  assert.equal(s.analysis.median, r.analysis.median);

  /* ---- Ad set names carry the stage when the ad names don't ---- */
  {
    const csv =
      "Ad name,Ad set name,Amount spent (EUR),Purchases,Purchases conversion value\n" +
      ["A,Prospecting TOFU,300,10,900", "B,Prospecting TOFU,300,10,800", "C,Retargeting BOFU,300,10,1500", "D,Retargeting BOFU,300,10,1400", "E,Retargeting BOFU,300,10,1300"].join("\n") + "\n";
    const t = run(csv, "roas");
    assert.deepEqual(t.analysis.funnelMix?.stages.map((x) => [x.stage, x.judged]), [["TOFU", 2], ["BOFU", 3]]);
  }

  /* ---- Single-stage / stage-less exports: untouched ---- */
  assert.equal(run(ECOM, "roas").analysis.funnelMix, undefined);
  assert.ok(!JSON.stringify(buildSampleMemo()).includes("funnel stages"), "sample untouched");

  console.log("real-account funnel stages: all assertions passed");
} finally {
  cleanup();
}
