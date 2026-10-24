/**
 * Bulletproof pass A4 — ad set mechanics. Budget lives at ad set /
 * campaign level, so every budget move says how to execute it: pause or
 * trim the weakest ads (Meta re-spreads their ad set's budget) and raise
 * budget on the ad sets running the scale candidates by ≤20% every 2–3
 * days, re-reading after each step; past ROAS doesn't guarantee the same
 * return on extra budget. The ad sets are named when the export has an
 * ad set column. Shown on the card, in the losers instruction (= the
 * exec-summary Trim line), in TXT; the scale test uses the same steps.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_BANNED, ROOT, clientStrings, loadEngine } from "./testerFeedbackEngine.ts";

const SHIFT =
  "Pause or trim the weakest ads (Meta re-spreads their ad set's budget to the remaining ads) and raise budget on the ad sets running the scale candidates by ≤20% every 2–3 days, re-reading after each step — larger jumps can restart Meta's learning phase. Past ROAS doesn't guarantee the same return on extra budget.";

const { run, buildSampleMemo, cleanup } = loadEngine();
try {
  /* ---- Shift without an ad set column: the generic sentence ---- */
  const agency = run(readFileSync(join(ROOT, "scripts/fixtures/agency-naming-convention.csv"), "utf8"), "roas");
  assert.equal(agency.memo.decision.budgetVariant, "shift");
  assert.equal(agency.memo.decision.execution?.buyer, SHIFT);
  assert.ok(agency.memo.losers.killInstruction.startsWith(SHIFT), "the losers instruction / exec-summary Trim line");
  assert.ok(agency.buyerText.includes(`How to execute: ${SHIFT}`));
  assert.ok(!agency.memo.decision.rationale.includes("in steps, re-reading"), "said once, not again in the rationale");

  /* ---- With an ad set column the receivers' ad sets are named ---- */
  const sample = buildSampleMemo();
  assert.equal(
    sample.decision.execution?.buyer,
    SHIFT.replace("the scale candidates by", 'the scale candidates ("Prospecting — Broad" and "Retargeting — 30d engagers") by')
  );

  /* ---- Scale-only and trim-only variants ---- */
  const H = "Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n";
  const scale = run(H + ["A,400,30,1600", "B,400,20,1200", "C,400,20,1220", "D,400,20,1180", "E,400,20,1150", "F,400,20,1100"].join("\n") + "\n", "roas").memo;
  assert.equal(scale.decision.budgetVariant, "scale");
  {
    assert.equal(
      scale.decision.execution?.buyer,
      "Raise budget on the ad sets running the scale candidates by ≤20% every 2–3 days, re-reading after each step — larger jumps can restart Meta's learning phase. Past ROAS doesn't guarantee the same return on extra budget."
    );
    const t = scale.nextTests.find((x) => x.test.startsWith("Raise the budget on the ad set running "));
    assert.ok(t, "the scale test steps the ad set budget");
    assert.match(t!.test, /by ≤20% every 2–3 days\.$/);
  }
  const trim = run(H + ["Thin,200,6,2000", "A,400,20,800", "B,400,20,800", "C,400,20,760", "D,400,20,720", "E,400,8,200", "F,400,6,150"].join("\n") + "\n", "roas").memo;
  assert.equal(trim.decision.budgetVariant, "cut");
  assert.equal(
    trim.decision.execution?.buyer,
    "Pause or trim the weakest ads (Meta re-spreads their ad set's budget to the remaining ads), re-reading after each step; the freed budget stays with the current ads."
  );

  /* ---- Client wording: plain, same mechanics ---- */
  assert.match(agency.memo.decision.execution!.client, /^We reduce or pause the weakest ads \(Meta moves their budget to the other ads in the same group\) and raise budget on the groups running the leading ads by up to 20% every 2–3 days/);
  for (const s of [...clientStrings(agency.memo), agency.memo.decision.execution!.client])
    for (const w of CLIENT_BANNED) assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(s), `client "${w}": ${s}`);

  /* ---- The card renders it ---- */
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  assert.match(report, /\{client \? "How we'll do it" : "How to execute"\}/);
  assert.match(report, /<Names text=\{client \? d\.execution\.client : d\.execution\.buyer\} \/>/);

  console.log("bulletproof execution: all assertions passed");
} finally {
  cleanup();
}
