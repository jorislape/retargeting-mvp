/**
 * Bulletproof pass B5 — client wording.
 *
 * The reduce group reads as an area to optimise, not money lost: without
 * a breakeven the copy says how much lost money can't be known; with one
 * it states the part of that spend on ads below breakeven. Tests promise
 * variations on the strongest observed results; the split cards read
 * "Above / Below the middle ad" instead of "Worked well / Needs
 * improvement". ("Account average" was the requested phrase, but the
 * cards group by the median, and on real data a quarter of the above-
 * median ads sit below the account ROAS the client cards show — so the
 * copy keeps the client's existing word for the median.)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_BANNED, ROOT, clientStrings, loadEngine } from "./testerFeedbackEngine.ts";

const AGENCY = readFileSync(join(ROOT, "scripts/fixtures/agency-naming-convention.csv"), "utf8");
const { run, buildSampleMemo, memoToText, cleanup } = loadEngine();
try {
  const OPT = "went to ads that trailed the middle ad — an area to optimise, not money lost; ";

  /* ---- No breakeven: the unknown is stated ---- */
  const plain = run(AGENCY, "roas").memo;
  const move = plain.decision.budgetMove!;
  const summary = plain.clientSummary.find((l) => l.includes(OPT))!;
  assert.ok(summary.startsWith(`${move.trimSpendLabel} ${OPT}without a breakeven we can't say how much of it lost money.`), summary);
  assert.ok(plain.losers.clientInstruction.startsWith(`${move.trimSpendLabel} ${OPT}without a breakeven`));

  /* ---- Breakeven set: the part below it is stated instead ---- */
  const be = 2.5;
  const beRun = run(AGENCY, "roas", { targetRoas: be });
  const withBe = beRun.memo;
  const trimNames = new Set(withBe.losers.rows.filter((r) => !r.holdNote).map((r) => r.name));
  const trims = beRun.analysis.losers.filter((a) => trimNames.has(a.name));
  assert.equal(trims.length, trimNames.size);
  const under = trims.filter((a) => (a.kpiValue ?? 0) < be).reduce((s, a) => s + a.spend, 0);
  assert.ok(under > 0, "fixture: some trims sit below a 2.5x breakeven");
  const fmt = (n: number) => `€${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const beLine = withBe.clientSummary.find((l) => l.includes(OPT))!;
  assert.ok(beLine.includes(`${OPT}${fmt(under)} of it went to ads below your breakeven (2.50x).`), beLine);
  assert.ok(!beLine.includes("without a breakeven"));

  /* ---- Tests promise variations on the strongest observed results ---- */
  assert.ok(plain.clientSummary.some((l) => l.startsWith("Next, we'll test variations based on the strongest observed results")));
  const clientText = memoToText(plain, "client", 3, []);
  assert.ok(clientText.includes("WHAT WE'LL TEST NEXT\n") && clientText.includes("We'll test variations based on the strongest observed results."));
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  assert.match(report, /We&apos;ll test variations based on the strongest observed\s+results/);

  /* ---- Split cards ---- */
  assert.match(report, /title: "Above the middle ad",/);
  assert.match(report, /title: "Below the middle ad",/);
  assert.ok(!/"Worked well"|"Needs improvement"/.test(report), "old card titles gone");

  for (const m of [plain, withBe, buildSampleMemo()])
    for (const s of clientStrings(m)) for (const w of CLIENT_BANNED) assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(s), `client "${w}": ${s}`);

  console.log("bulletproof client wording: all assertions passed");
} finally {
  cleanup();
}
