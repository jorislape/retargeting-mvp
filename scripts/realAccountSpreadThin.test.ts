/**
 * Real-account review — "Spend is spread thin".
 *
 * A real export set aside 229 of 303 ads for low spend: the read rested
 * on a quarter of the account and nothing said why. Proves: when ≥50% of
 * analyzed ads are set aside for low spend (or no purchases yet on low
 * spend), the buyer view and buyer TXT carry one line with the count,
 * those ads' average spend and the account cost per purchase; under 50%
 * (or with ads set aside only for a missing KPI value) there is none;
 * the client view never shows it; it is display only (decision.ts never
 * reads it).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, clientStrings, loadEngine } from "./testerFeedbackEngine.ts";

const H = "Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n";
const big = ["A,500,25,2000", "B,500,22,1500", "C,500,20,1200", "D,500,18,1000", "E,500,15,700"];

const { run, buildSampleMemo, cleanup } = loadEngine();
try {
  /* ---- 6 of 11 set aside (5 thin + 1 zero-purchase thin) ---- */
  const thin = ["T1,10,1,30", "T2,12,0,0", "T3,8,1,20", "T4,6,0,0", "T5,14,1,40", "T6,10,1,25"];
  const r = run(H + [...big, ...thin].join("\n") + "\n", "roas");
  assert.equal(r.analysis.spreadThin?.thin, 6);
  const avg = (10 + 12 + 8 + 6 + 14 + 10) / 6;
  const cpp = (2500 + 60) / (100 + 4);
  assert.equal(
    r.memo.spreadThin,
    `Spend is spread thin: 6 of 11 ads never reached the minimum spend (avg €${avg.toFixed(2)} per ad vs €${cpp.toFixed(2)} cost per purchase). Fewer ads per ad set would give each a fair read.`
  );
  assert.ok(r.buyerText.includes(r.memo.spreadThin!), "buyer TXT");
  assert.ok(r.buyerText.indexOf(r.memo.spreadThin!) < r.buyerText.indexOf("\n\n"), "…in the header block, near the top");
  assert.ok(!r.clientText.includes("spread thin"), "never in client TXT");
  /* Bulletproof pass A8: the client sees it as the plan, never as blame. */
  assert.equal(r.memo.spreadThinPlan, "We're concentrating budget into fewer ads so each one gets enough data to judge.");
  // Bulletproof pass C4: in the client's one Notes line, under the Next move.
  const notes = r.clientText.split("\n").find((l) => l.startsWith("Notes: "))!;
  assert.ok(notes.includes(r.memo.spreadThinPlan!), "client TXT Notes line");
  assert.ok(r.clientText.indexOf(notes) > r.clientText.indexOf("NEXT MOVE"), "after the Next move");
  assert.ok(!r.buyerText.includes(r.memo.spreadThinPlan!), "the buyer keeps the finding itself");
  assert.ok(!clientStrings(r.memo).some((s) => s.includes("spread thin")), "never in a client string");

  /* ---- Display only ---- */
  const decision = readFileSync(join(ROOT, "modules/debrief/decision.ts"), "utf8");
  assert.ok(!decision.includes("spreadThin"), "decision.ts never reads it");

  /* ---- Exactly half counts; under half doesn't ---- */
  assert.ok(run(H + [...big, ...thin.slice(0, 5)].join("\n") + "\n", "roas").memo.spreadThin, "5 of 10 = 50%");
  assert.equal(run(H + [...big, ...thin.slice(0, 4)].join("\n") + "\n", "roas").memo.spreadThin, undefined, "4 of 9");

  /* ---- Ads with no KPI value aren't "thin" ---- */
  {
    const csv =
      "Ad name,Amount spent (EUR),Purchases,Purchase ROAS (return on ad spend)\n" +
      ["A,500,25,4", "B,500,22,3", "C,500,20,2.4", "D,500,18,2", "E,500,15,1.4", "N1,500,,", "N2,500,,", "N3,500,,", "N4,500,,", "N5,500,,", "N6,500,,"].join("\n") + "\n";
    assert.equal(run(csv, "roas").memo.spreadThin, undefined);
  }

  /* ---- No outcome count (CTR): no cost comparison ---- */
  {
    const csv =
      "Ad name,Amount spent (EUR),Link clicks,Impressions\n" +
      ["A,500,50,1000", "B,500,45,1000", "C,500,40,1000", "D,500,35,1000", "E,500,30,1000", "T1,10,1,30", "T2,12,1,40", "T3,8,1,30", "T4,6,1,20", "T5,14,1,50", "T6,10,1,30"].join("\n") + "\n";
    const line = run(csv, "ctr").memo.spreadThin!;
    assert.match(line, /^Spend is spread thin: 6 of 11 ads never reached the minimum spend \(avg €10\.00 per ad\)\. Fewer ads/);
  }

  /* ---- The fixture and the sample don't qualify (sample unchanged) ---- */
  assert.equal(run(readFileSync(join(ROOT, "scripts/fixtures/agency-naming-convention.csv"), "utf8"), "roas").memo.spreadThin, undefined);
  assert.ok(!("spreadThin" in buildSampleMemo()));

  /* ---- Report: buyer only, in the masthead ---- */
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  const at = report.indexOf("{!client && memo.spreadThin && (");
  assert.ok(at > 0 && at < report.indexOf("</header>"), "near the top of the buyer view");
  // Bulletproof pass A8: a structural finding in the buyer exec summary
  // (page 1 of the PDF). Pass C4: the client plan joins the Notes line
  // under the Next move card.
  assert.match(report, /\{ label: "Structure", value: memo\.spreadThin \}/);
  const memoToTextSrc = readFileSync(join(ROOT, "components/debrief/memoToText.ts"), "utf8");
  assert.match(memoToTextSrc, /\[memo\.scope\.stageNote\?\.client, memo\.spreadThinPlan, memo\.scope\.attributionClientLine\]/);
  assert.ok(report.indexOf("{client && clientNotes(memo).length > 0 && (") > report.indexOf("</header>"), "client: below the masthead, under the card");

  console.log("real-account spread thin: all assertions passed");
} finally {
  cleanup();
}
