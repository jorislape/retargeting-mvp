/**
 * First-Run Robustness 2 — the user's own minimum purchases/leads before
 * an ad is judged (DebriefContext.minJudgeOutcomes).
 *
 * The existing DecisionCriteria.minOutcomeCount only gates a SCALE move
 * on the leading ad; this sets low-count ads ASIDE, like low-spend ads,
 * before the median. Proves: unset ⇒ byte-identical memo (sample too);
 * set ⇒ named set-asides in both registers + the user's bar in
 * appliedCriteria, and the decision changes only then; CTR/CPC ignore
 * it (UI hides it); unverifiable counts are disclosed, never zero; a
 * floor that leaves too few ads holds with floor-specific copy.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_BANNED, ROOT, TESTER_CSV, clientStrings, loadEngine } from "./testerFeedbackEngine.ts";

const ECOM = readFileSync(join(ROOT, "scripts/fixtures/ecom-13ads.csv"), "utf8");
const LOW = ["Static_H", "Promo_I", "Meme_J", "Stock_K", "Generic_L", "Clickbait_M"]; // 4–8 purchases each

const { run, buildSampleMemo, cleanup } = loadEngine();
try {
  /* ---- Unset: today's behaviour exactly ---- */
  const base = run(ECOM, "roas");
  for (const extra of [{ minJudgeOutcomes: null }, { minJudgeOutcomes: 0 }, {}]) {
    const r = run(ECOM, "roas", extra);
    assert.equal(JSON.stringify(r.memo), JSON.stringify(base.memo), `unset (${JSON.stringify(extra)}) ⇒ identical memo`);
    assert.equal(r.analysis.outcomeFloor, undefined);
  }
  assert.ok(!JSON.stringify(buildSampleMemo()).includes("outcomeFloor"), "sample untouched");

  /* ---- Set: low-count ads set aside, named, user's bar ---- */
  const f = run(ECOM, "roas", { minJudgeOutcomes: 10 });
  const a = f.analysis;
  assert.equal(a.adsJudged, 7);
  assert.deepEqual(a.outcomeFloor?.setAside.map((x) => x.name).sort(), [...LOW].sort());
  assert.ok(!a.rankedAds.some((x) => LOW.includes(x.name)), "never ranked");
  assert.equal(a.median, 3.2, "median from the ads that clear the floor only");
  const d = f.memo.decision;
  assert.ok(d.limits.buyer.some((l) => l.includes('"Generic_L" set aside — 4 purchases, below your 10 minimum')));
  assert.ok(d.limits.client.some((l) => l.includes('"Generic_L" isn\'t included yet — 4 purchases so far, below the 10 you set')));
  assert.match(f.memo.losers.setAsideNote, /"Static_H" set aside — 8 purchases, below your 10 minimum\./);
  assert.deepEqual(d.appliedCriteria.find((c) => c.label.startsWith("Minimum purchases to judge an ad")), {
    label: "Minimum purchases to judge an ad: 10 — your criterion",
    source: "user",
  });
  assert.match(f.clientText, /6 ads have fewer purchases than the 10 you set — set aside rather than counted against\./);
  assert.ok(f.memo.confidence.notes.some((n) => n.startsWith("6 of 13 ads were set aside by your minimum of 10 purchases")));
  for (const s of clientStrings(f.memo))
    for (const w of CLIENT_BANNED) assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(s), `client "${w}": ${s}`);
  // The decision changes only because the field is set.
  assert.equal(base.memo.decision.budgetVariant, "shift");
  assert.equal(d.budgetVariant, "scale", "fewer judged ads ⇒ a different call");

  /* ---- CTR/CPC: not applicable, memo unchanged ---- */
  for (const kpi of ["ctr", "cpc"]) {
    const r = run(ECOM, kpi, { minJudgeOutcomes: 10 });
    assert.equal(r.analysis.outcomeFloor, undefined, `${kpi}: no floor`);
    assert.equal(JSON.stringify(r.memo), JSON.stringify(run(ECOM, kpi).memo), `${kpi}: identical memo`);
  }

  /* ---- Unverifiable counts: judged as usual and disclosed ---- */
  const noCount = "Ad name,Amount spent (EUR),Cost per purchase (EUR)\n" +
    ["A,300,20", "B,320,25", "C,340,30", "D,360,35", "E,380,40", "F,400,45"].join("\n") + "\n";
  const u = run(noCount, "cpa", { minJudgeOutcomes: 10 });
  assert.equal(u.analysis.adsJudged, 6, "missing count ≠ zero");
  assert.equal(u.analysis.outcomeFloor?.unverifiable, 6);
  assert.ok(u.memo.decision.limits.buyer.some((l) => l.startsWith("Your 10-purchase minimum couldn't be checked for 6 ads")));

  /* ---- A floor that leaves too few ads: floor-specific hold ---- */
  const h = run(ECOM, "roas", { minJudgeOutcomes: 25 });
  assert.equal(h.memo.decision.action, "hold");
  assert.match(h.memo.decision.headline, /^Hold — only \d of 13 ads could be judged: \d+ have fewer than your 25-purchase minimum\. This call needs 5\.$/);
  assert.match(h.memo.decision.clientHeadline, /fewer purchases than the minimum you set/);

  /* ---- Lead-based CPA and the Leads KPI read "leads" ---- */
  const tc = run(TESTER_CSV, "cpa", { minJudgeOutcomes: 15 });
  assert.deepEqual(tc.analysis.outcomeFloor?.setAside.map((x) => x.name).sort(), ["Ad_E", "Ad_G"], "12 and 14 purchases < 15");

  /* ---- UI + plumbing ---- */
  const gen = readFileSync(join(ROOT, "components/debrief/GeneratorPanel.tsx"), "utf8");
  const iKpi = gen.indexOf('<fieldset id="kpi-selector"');
  const iField = gen.indexOf('htmlFor="minJudgeOutcomes"');
  const iRefine = gen.indexOf('htmlFor="minOutcomeCount"');
  assert.ok(iKpi > 0 && iField > iKpi && iField < iRefine, "next to the KPI picker, before Refine");
  assert.match(gen, /Minimum \{nouns\.many\} before an ad is judged/, "label follows the KPI");
  assert.match(gen.slice(iField - 600, iField), /if \(nouns == null\) return null;/, "hidden for CTR/CPC");
  const prov = readFileSync(join(ROOT, "components/workspace/DebriefProvider.tsx"), "utf8");
  assert.match(prov, /fields\.minJudgeOutcomes\.trim\(\) !== "" && kpi !== "ctr" && kpi !== "cpc"/);
  const route = readFileSync(join(ROOT, "app/api/debrief/route.ts"), "utf8");
  assert.match(route, /\.\.\.\(minJudgeOutcomes != null \? \{ minJudgeOutcomes \} : \{\}\)/);

  console.log("outcomeFloor: all assertions passed");
} finally {
  cleanup();
}
