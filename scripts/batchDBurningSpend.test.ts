/**
 * Batch D1 — early zero-conversion flag ("Burning spend").
 *
 * Buyers pause 0-purchase ads long before the 2× cost-per-purchase bar
 * the report judges at. The report lists ads with 0 outcomes and spend
 * ≥ 1× the account's cost per outcome (≥ 1× target CPA when set): buyer
 * exec summary + Below median, one plain client line. Display only —
 * never read by the gate, median, ranking or decision.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_BANNED, ROOT, clientStrings, loadEngine } from "./testerFeedbackEngine.ts";

const H = "Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n";
const ROWS = ["A,600,30,2400", "B,500,25,1500", "C,400,15,900", "D,300,10,500", "E,300,8,400", "F,250,6,300",
  "Z1,120,0,0", // 0 purchases, ≥ 1× cost per purchase
  "Z2,90,,",    // blank purchases in a file that has purchases ⇒ 0
  "Z3,20,0,0",  // 0 purchases but under 1×
];
const { run, buildSampleMemo, cleanup } = loadEngine();
try {
  const r = run(H + ROWS.join("\n") + "\n", "roas");
  const spend = ROWS.reduce((s, l) => s + Number(l.split(",")[1]), 0);
  const purchases = ROWS.reduce((s, l) => s + (Number(l.split(",")[2]) || 0), 0);
  const cpp = spend / purchases;
  const b = r.analysis.burningSpend!;
  assert.ok(b, "flagged");
  assert.ok(Math.abs(b.bar - cpp) < 1e-9, "bar = 1× the account's cost per purchase");
  assert.equal(b.basis, "cost_per_outcome");
  assert.deepEqual(b.ads.map((a) => a.name), ["Z1", "Z2"], "0 purchases at ≥ 1×, most spend first; Z3 is under the bar");
  assert.equal(b.total, 210);
  assert.ok(r.memo.burningSpend!.buyer.startsWith(`Burning spend: 2 ads with 0 purchases already spent ≥ €${cpp.toFixed(2)} (1× the account's cost per purchase) — €210.00 in total: "Z1" (€120.00), "Z2" (€90.00).`));
  assert.ok(r.memo.burningSpend!.buyer.endsWith("the report still judges an ad only at 2×, so the decision is unchanged."));
  assert.equal(r.memo.burningSpend!.client, "2 ads have spent at least what one sale usually costs without a sale yet (€210.00 in total) — we're reviewing them early.");
  assert.ok(r.buyerText.includes(r.memo.burningSpend!.buyer) && r.clientText.includes(r.memo.burningSpend!.client));
  assert.ok(!r.clientText.includes("Burning spend"), "client: one plain line, no buyer label");
  for (const s of clientStrings(r.memo)) for (const w of CLIENT_BANNED) assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(s), `client "${w}": ${s}`);

  /* Target CPA replaces the bar on CPA runs. */
  const cpa = run(H.replace(",Purchases conversion value", ",Cost per purchase (EUR)") + ["A,600,30,20", "B,500,25,20", "C,400,15,26.67", "D,300,10,30", "E,300,8,37.5", "Z1,120,0,", "Z2,45,0,"].join("\n") + "\n", "cpa", { targetCpa: 40 });
  assert.equal(cpa.analysis.burningSpend?.basis, "target_cpa");
  assert.equal(cpa.analysis.burningSpend?.bar, 40);
  assert.deepEqual(cpa.analysis.burningSpend?.ads.map((a) => a.name), ["Z1", "Z2"]);
  assert.match(cpa.memo.burningSpend!.buyer, /≥ €40\.00 \(1× your target CPA\)/);

  /* No zero-outcome ad past 1× ⇒ nothing (byte-identical memo key). */
  assert.equal(run(readFileSync(join(ROOT, "scripts/fixtures/ecom-13ads.csv"), "utf8"), "cpa").memo.burningSpend, undefined);
  /* Sample (intended change): its one $24.15 zero-purchase ad. */
  assert.match(buildSampleMemo().burningSpend!.buyer, /^Burning spend: 1 ad with 0 purchases already spent ≥ \$19\.95 .* "Video_Hook_FastCut_V4" \(\$24\.15\)\./);

  /* Display only: the decision layer never reads it. */
  for (const f of ["modules/debrief/decision.ts", "modules/debrief/funnelStages.ts"]) assert.ok(!readFileSync(join(ROOT, f), "utf8").includes("burningSpend"), `${f} never reads it`);
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  assert.match(report, /\{ label: "Burning spend", value: client \? undefined : memo\.burningSpend\?\.buyer\.replace\(\/\^Burning spend: \/, ""\) \}/, "buyer exec summary");
  assert.match(report, /<Names text=\{client \? memo\.burningSpend\.client : memo\.burningSpend\.buyer\} \/>/, "Below median section, both views");

  console.log("batch D burning spend: all assertions passed");
} finally {
  cleanup();
}
