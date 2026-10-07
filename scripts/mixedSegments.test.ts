/**
 * Mixed Segment Warning — proofs.
 *
 * Judged ads are grouped by ad set (campaign as fallback); with ≥2
 * groups of ≥2 judged ads whose typical KPI is ≥ SEGMENT_SPREAD_MULTIPLE
 * apart, one limits line warns in both registers. Display-only: the
 * gate, median, ranking, action and evidenceState are identical with
 * and without the ad set column.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_BANNED, ROOT, clientStrings, loadEngine } from "./testerFeedbackEngine.ts";

const HEAD = "Ad name,Campaign name,Ad set name,Amount spent (EUR),Purchases,Cost per purchase (EUR)\n";
type Row = [name: string, campaign: string, adSet: string, spend: number, purchases: number];
const csv = (rows: Row[]) =>
  HEAD + rows.map(([n, c, a, s, p]) => `${n},${c},${a},${s},${p},${(s / p).toFixed(2)}`).join("\n") + "\n";
const dropColumn = (text: string, header: string) => {
  const lines = text.trim().split("\n").map((l) => l.split(","));
  const i = lines[0].indexOf(header);
  return lines.map((l) => l.filter((_, j) => j !== i).join(",")).join("\n") + "\n";
};

// Ad set A: CPA ≈ 10; ad set B: CPA ≈ 30 → 3× apart.
const FAR: Row[] = [
  ["A1", "Spring", "Set A", 300, 30], ["A2", "Spring", "Set A", 320, 32], ["A3", "Spring", "Set A", 280, 27],
  ["B1", "Spring", "Set B", 300, 10], ["B2", "Spring", "Set B", 330, 11], ["B3", "Spring", "Set B", 290, 10],
];
// Ad set A ≈ 20, ad set B ≈ 24 → 1.2× apart.
const CLOSE: Row[] = [
  ["A1", "Spring", "Set A", 300, 15], ["A2", "Spring", "Set A", 320, 16], ["A3", "Spring", "Set A", 280, 14],
  ["B1", "Spring", "Set B", 300, 12], ["B2", "Spring", "Set B", 336, 14], ["B3", "Spring", "Set B", 288, 12],
];

const { run, requireCompiled, buildSampleMemo, cleanup } = loadEngine();
try {
  const { SEGMENT_SPREAD_MULTIPLE } = requireCompiled("modules/debrief/segmentSpread.js") as { SEGMENT_SPREAD_MULTIPLE: number };
  assert.equal(SEGMENT_SPREAD_MULTIPLE, 1.5);

  /* Far apart → warning, both registers. */
  const far = run(csv(FAR), "cpa");
  assert.equal(far.columns.adSetName, "Ad set name");
  assert.equal(far.columns.campaignName, "Campaign name");
  assert.equal(far.ads[0].adSetName, "Set A");
  assert.deepEqual(
    { ...far.analysis.mixedSegments, ratio: Number(far.analysis.mixedSegments?.ratio.toFixed(2)) },
    { dimension: "ad set", segments: 2, lowLabel: "10.00 EUR", highLabel: "30.00 EUR", ratio: 3 }
  );
  const buyer =
    "This export mixes 2 ad sets whose typical CPA ranges from 10.00 EUR to 30.00 EUR (3.0× apart) — ranking them against one account median may compare unlike products. For a fairer read, export one ad set or campaign at a time.";
  assert.ok(far.memo.decision.limits.buyer.includes(buyer), "buyer limits line");
  const client = far.memo.decision.limits.client.find((l) => l.startsWith("This file mixes 2 ad sets"));
  assert.ok(client, "client limits line");
  assert.ok(far.buyerText.includes(buyer) && far.clientText.includes(client as string));
  for (const s of clientStrings(far.memo))
    for (const w of CLIENT_BANNED) assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(s), `client "${w}": ${s}`);

  /* Display-only: identical gate/median/ranking/action/evidence without the column. */
  const noSet = run(dropColumn(dropColumn(csv(FAR), "Ad set name"), "Campaign name"), "cpa");
  assert.equal(noSet.analysis.mixedSegments, undefined, "no ad set / campaign column → no warning");
  assert.equal(noSet.analysis.spendGate, far.analysis.spendGate);
  assert.equal(noSet.analysis.median, far.analysis.median);
  assert.deepEqual(noSet.analysis.rankedAds.map((a) => [a.name, a.deltaFromMedian]), far.analysis.rankedAds.map((a) => [a.name, a.deltaFromMedian]));
  assert.equal(noSet.memo.decision.action, far.memo.decision.action);
  assert.equal(noSet.memo.decision.budgetVariant, far.memo.decision.budgetVariant);
  assert.equal(noSet.memo.decision.evidenceState, far.memo.decision.evidenceState);
  assert.equal(noSet.memo.decision.headline, far.memo.decision.headline);
  assert.deepEqual(
    far.memo.decision.limits.buyer.filter((l) => l !== buyer),
    noSet.memo.decision.limits.buyer,
    "the warning is the only difference in the limits"
  );

  /* Campaign fallback when there's no ad set column. */
  const camp = run(
    dropColumn(csv(FAR.map(([n, , a, s, p]) => [n, a === "Set A" ? "Camp A" : "Camp B", a, s, p] as Row)), "Ad set name"),
    "cpa"
  );
  assert.equal(camp.analysis.mixedSegments?.dimension, "campaign");
  assert.ok(camp.memo.decision.limits.buyer.some((l) => l.startsWith("This export mixes 2 campaigns")));

  /* Close together → none. */
  const close = run(csv(CLOSE), "cpa");
  assert.ok(close.analysis.mixedSegments === undefined, `1.2× is under the bar`);
  assert.ok(!close.memo.decision.limits.buyer.some((l) => l.startsWith("This export mixes")));

  /* Fewer than 2 qualifying groups (one ad in Set B) → none. */
  const thin = run(csv([...FAR.slice(0, 3), FAR[3], ["C1", "Spring", "Set C", 310, 31], ["C2", "Spring", "Set C", 300, 30]]), "cpa");
  assert.equal(thin.analysis.mixedSegments, undefined, "Set A ≈ Set C; Set B has one ad");

  /* Higher-is-better KPI (ROAS) uses the same symmetric bar. */
  const roas = "Ad name,Ad set name,Amount spent (EUR),Purchases conversion value\n" +
    "R1,Hi,300,1500\nR2,Hi,320,1600\nR3,Lo,300,600\nR4,Lo,310,620\n";
  assert.equal(run(roas, "roas").analysis.mixedSegments?.segments, 2, "5x vs 2x ROAS → flagged");

  /* Count KPIs never trigger it, even at a 3× spread (Set A: 30/32/27
     purchases vs Set B: 10/11/10). Lead-based CPA (cost per lead) does. */
  const { SEGMENT_SPREAD_KPIS } = requireCompiled("modules/debrief/segmentSpread.js") as { SEGMENT_SPREAD_KPIS: string[] };
  assert.deepEqual(SEGMENT_SPREAD_KPIS, ["roas", "cpa", "ctr", "cpc"]);
  assert.equal(run(csv(FAR), "purchases").analysis.mixedSegments, undefined, "Purchases: never");
  const farLeads = "Ad name,Ad set name,Amount spent (EUR),Leads,Cost per lead (EUR)\n" +
    FAR.map(([n, , a, s, p]) => `${n},${a},${s},${p},${(s / p).toFixed(2)}`).join("\n") + "\n";
  const leadsRun = run(farLeads, "leads");
  assert.equal(leadsRun.analysis.mixedSegments, undefined, "Leads: never");
  assert.ok(!leadsRun.memo.decision.limits.buyer.some((l) => l.startsWith("This export mixes")));
  const cpl = run(farLeads, "cpa");
  assert.equal(cpl.analysis.cpaBasis, "leads");
  assert.ok(cpl.memo.decision.limits.buyer.some((l) => l.startsWith("This export mixes 2 ad sets whose typical CPL")), "cost per lead: yes");

  /* Sample: its ROAS memo is untouched (spread 1.24× < 1.5×), and the
     same data under Purchases / Leads (1.67× / 1.70×) no longer warns —
     what "Load sample data" with those KPIs produces. */
  assert.equal(buildSampleMemo().decision.limits.buyer.some((l) => l.startsWith("This export mixes")), false);
  const { SAMPLE_CSV_TEXT, SAMPLE_CONTEXT } = requireCompiled("modules/debrief/sampleCsv.js") as {
    SAMPLE_CSV_TEXT: string;
    SAMPLE_CONTEXT: Record<string, unknown>;
  };
  for (const kpi of ["purchases", "leads"]) {
    const r = run(SAMPLE_CSV_TEXT, kpi, { ...SAMPLE_CONTEXT, kpi });
    assert.equal(r.analysis.mixedSegments, undefined, `sample under ${kpi}: no warning`);
    assert.ok(!/mixes \d+ ad sets/.test(r.buyerText + r.clientText), `sample under ${kpi}: no warning text`);
  }

  /* Isolation: rules never read it; only buildLimits copy does. */
  const decision = readFileSync(join(ROOT, "modules/debrief/decision.ts"), "utf8");
  const inLimits = decision.slice(decision.indexOf("export function buildLimits("), decision.indexOf("export function buildDecision("));
  assert.equal((decision.match(/mixedSegments/g) ?? []).length, (inLimits.match(/mixedSegments/g) ?? []).length);
  const mod = readFileSync(join(ROOT, "modules/debrief/segmentSpread.ts"), "utf8");
  assert.ok(!/from "\.\/(decision|memo|analysis)/.test(mod), "segmentSpread.ts imports types only");

  console.log("mixedSegments: all assertions passed");
} finally {
  cleanup();
}
