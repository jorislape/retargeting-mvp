/**
 * Batch D2 — "Give a fair test".
 *
 * Among ads set aside for low spend, up to 3 whose early signals beat the
 * account median on ≥ 2 of link CTR / 3-sec hook rate / CPC / adds to
 * cart, with ≥ 1,000 impressions — buyer-only, always labelled a
 * hypothesis from early signals; the client reads one sentence. Ads on
 * the Burning spend list are never suggested. Display only.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_BANNED, ROOT, clientStrings, loadEngine } from "./testerFeedbackEngine.ts";

const H = "Ad name,Amount spent (EUR),Impressions,Link clicks,3-second video plays,Adds to cart,Purchases,Purchases conversion value\n";
const ROWS = [
  // judged ads (spend well past the gate) — never picked
  "J1,800,40000,400,8000,40,40,3200", "J2,700,35000,300,6000,30,30,2100", "J3,600,30000,270,5400,25,25,1500",
  "J4,500,25000,200,4000,20,20,1000", "J5,500,25000,180,3500,15,15,800", "J6,400,20000,150,3000,10,10,500",
  // set aside for low spend
  "Strong3,40,4000,80,1600,8,1,90",  // CTR, hook, CPC, ATC all beat the median
  "Strong2,40,4000,60,600,1,1,80",   // CTR + CPC beat it
  "One,40,4000,30,300,0,1,60",       // only CPC
  "Thin,10,800,40,400,4,1,50",       // < 1,000 impressions
  "Burn,55,5000,100,1500,5,0,0",     // 0 purchases past 1× cost per purchase ⇒ Burning spend, not "push"
];
const { run, buildSampleMemo, cleanup } = loadEngine();
try {
  const r = run(H + ROWS.join("\n") + "\n", "roas");
  assert.ok(r.analysis.burningSpend?.ads.some((a) => a.name === "Burn"), "fixture: Burn is on the burning list");
  const picks = r.analysis.fairTest!;
  assert.deepEqual(picks.map((p) => p.name), ["Strong3", "Strong2"], "≥ 2 signals, ≥ 1,000 impressions, not burning, most signals first");
  assert.deepEqual(picks[0].signals.map((s) => s.key).sort(), ["atcRate", "cpc", "ctr", "hookRate"]);
  assert.ok(picks.every((p) => p.signals.every((s) => s.lift > 0)), "only signals that beat the median are listed");
  const ft = r.memo.fairTest!;
  assert.equal(ft.buyer.intro, "Give a fair test — a hypothesis from early signals, not results:");
  assert.match(ft.buyer.items[0], /^"Strong3" \(€40\.00 spent, 4,000 impressions\): /);
  assert.match(ft.buyer.how, /^If your account has 'Push delivery to this ad', push ~10-20% of the ad set budget for 7 days until it reaches the evidence bar \(≥10 purchases or 10× cost per purchase — €[\d,.]+\); otherwise duplicate it into a test ad set\.$/);
  assert.equal(ft.client, "We're giving 2 promising new ads a fair test.");
  assert.ok(r.buyerText.includes(ft.buyer.intro) && ft.buyer.items.every((i) => r.buyerText.includes(i)) && r.buyerText.includes(ft.buyer.how));
  assert.ok(r.clientText.includes(ft.client) && !r.clientText.includes("Push delivery"), "client: one sentence only");
  for (const s of clientStrings(r.memo)) for (const w of CLIENT_BANNED) assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(s), `client "${w}": ${s}`);

  /* Max 3. */
  const many = run(H + [...ROWS.slice(0, 6), ...[1, 2, 3, 4, 5].map((i) => `S${i},40,4000,${70 + i},1500,8,1,90`)].join("\n") + "\n", "roas");
  assert.equal(many.analysis.fairTest?.length, 3);
  /* No signal columns ⇒ nothing. */
  assert.equal(run(readFileSync(join(ROOT, "scripts/fixtures/agency-naming-convention.csv"), "utf8"), "roas").memo.fairTest, undefined);
  /* Sample (intended change): two low-spend ads; the burning one is left out. */
  const sample = buildSampleMemo();
  assert.equal(sample.fairTest?.client, "We're giving 2 promising new ads a fair test.");
  assert.ok(!sample.fairTest!.buyer.items.some((i) => i.includes("Video_Hook_FastCut_V4")));

  /* Display only. */
  assert.ok(!readFileSync(join(ROOT, "modules/debrief/decision.ts"), "utf8").includes("fairTest"), "decision.ts never reads it");
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  assert.match(report, /\{memo\.fairTest && <p[^>]*>\{memo\.fairTest\.client\}<\/p>\}/, "client sentence");
  assert.match(report, /\{memo\.fairTest\.buyer\.items\.map\(/, "buyer list");

  console.log("batch D fair test: all assertions passed");
} finally {
  cleanup();
}
