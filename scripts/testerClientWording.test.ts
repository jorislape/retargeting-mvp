/**
 * Tester Feedback follow-up — client-register wording leftovers.
 *
 * The client view/TXT showed "Judged: N" and "set aside, not judged",
 * and copy said "1 ad … were set aside". Proves, over several fixtures ×
 * KPIs: the full client TXT never says "judged"/"Judged:"/"set aside,
 * not judged" (it says "Ads with enough spend to compare: N" and "not
 * included yet — too little spend"), and no generated line — buyer or
 * client — pairs a count of 1 with "were set aside" / "they're".
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_BANNED, ROOT, TESTER_CSV, loadEngine } from "./testerFeedbackEngine.ts";

const rows = (n: number, f: (i: number) => string) => Array.from({ length: n }, (_, i) => f(i)).join("\n") + "\n";
const FIXTURES: Record<string, string> = {
  tester: TESTER_CSV,
  nineZero: "Ad name,Amount spent (USD),Purchases,Cost per purchase (USD)\n" +
    [["A", 400, 8], ["B", 380, 0], ["C", 360, 6], ["D", 340, 0], ["E", 320, 0], ["F", 300, 4], ["G", 280, 0], ["H", 260, 3], ["I", 50, 1]]
      .map(([n, s, p]) => `${n},${s},${p},${p ? ((s as number) / (p as number)).toFixed(2) : ""}`).join("\n") + "\n",
  // Exactly one ad below the spend gate.
  oneAside: "Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n" +
    rows(7, (i) => `S_${i},${300 + i * 20},${5 + i},${(5 + i) * 60}`) + "Tiny,20,1,50\n",
  // One blank purchase cell above the gate → a "no value" set-aside.
  oneBlank: "Ad name,Amount spent (EUR),Purchases,Cost per purchase (EUR)\n" +
    rows(6, (i) => `B_${i},${300 + i * 20},${6 + i},${((300 + i * 20) / (6 + i)).toFixed(2)}`) + "Blank,400,,\n",
  // A zero-purchase ad above the gate but under 2× median CPA.
  thinZero: "Ad name,Amount spent (EUR),Purchases,Cost per purchase (EUR)\n" +
    "X1,300,3,100\nX2,320,3,106.67\nX3,340,4,85\nX4,360,3,120\nX5,400,4,100\nZeroThin,190,0,\n",
  leads: "Ad name,Amount spent (EUR),Leads,Cost per lead (EUR)\n" +
    rows(12, (i) => { const s = 150 + i * 45, l = 3 + ((i * 7) % 19); return `L_${i},${s},${l},${(s / l).toFixed(2)}`; }),
};
const KPIS = ["cpa", "roas", "purchases", "leads"] as const;
const ONE_PLURAL = [
  /\b1 ad\b[^.;]*\bwere set aside\b/,
  /\b1 of \d+ ads were set aside\b/,
  /\b1 ad\b[^.;]*\bthey're\b/,
  /\b1 ad\b[^.;]*\babout them\b/,
  /\b1 did not and were set aside\b/,
];

const { run, buildSampleMemo, memoToText, cleanup } = loadEngine();
try {
  let runs = 0;
  const check = (label: string, buyer: string, client: string) => {
    assert.ok(!/\bjudged\b/i.test(client), `${label}: client says "judged": ${client.match(/[^\n]*\bjudged\b[^\n]*/i)?.[0]}`);
    assert.ok(!/Judged:/.test(client), `${label}: client header`);
    assert.ok(!/set aside, not judged/.test(client), `${label}: client signal`);
    for (const w of CLIENT_BANNED.filter((x) => x !== "judged"))
      assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(client), `${label}: client "${w}": ${client.match(new RegExp(`[^\\n]*\\b${w}\\b[^\\n]*`, "i"))?.[0]}`);
    for (const re of ONE_PLURAL)
      for (const [reg, txt] of [["buyer", buyer], ["client", client]] as const)
        assert.ok(!re.test(txt), `${label} ${reg}: plural "${txt.match(re)?.[0]}"`);
    runs++;
  };
  for (const [name, csv] of Object.entries(FIXTURES))
    for (const kpi of KPIS) {
      let r;
      try { r = run(csv, kpi); } catch { continue; }
      // KPI not in this export: the route returns a structured 400 before
      // any memo exists, so this combination never renders.
      if (r.analysis.adsJudged === 0) continue;
      check(`${name}/${kpi}`, r.buyerText, r.clientText);
    }
  const s = buildSampleMemo();
  check("sample", memoToText(s, "buyer", 5, []), memoToText(s, "client", 3, []));
  assert.ok(runs >= 12, `ran ${runs}`);

  /* The replacements read as intended. */
  const t = run(TESTER_CSV, "cpa");
  assert.match(t.clientText, /Ads analyzed: 8 · Ads with enough spend to compare: 5 · Not included yet: 3/);
  assert.match(t.buyerText, /Ads analyzed: 8 · Judged: 5 · Set aside: 3/, "buyer header unchanged");
  assert.match(t.clientText, /3 thin-spend ads aren't included yet — too little spend\./);
  assert.match(t.clientText, /5 ads had enough spend to compare fairly; 3 did not, so they aren't included yet\./);
  const one = run(FIXTURES.oneAside, "roas");
  assert.ok(one.memo.decision.limits.buyer.includes("1 ad had too little spend to judge and was set aside — no conclusion is drawn about it either way."));
  assert.ok(one.memo.decision.limits.client.includes("1 ad didn't have enough spend to include yet, so it's not part of this read."));
  assert.match(one.clientText, /1 did not, so it isn't included yet\./);
  assert.match(one.buyerText, /1 of 8 ads was set aside for insufficient spend/);

  /* Report shares the same sentence and drops the "Judged fairly" card. */
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  assert.match(report, /clientDataUsedSentence\(memo\.scope, viewKpiLabel\)/);
  assert.ok(!/label: "Judged fairly"/.test(report));
  assert.ok(!/to be judged fairly/.test(report));

  console.log(`tester client wording: all assertions passed (${runs} runs)`);
} finally {
  cleanup();
}
