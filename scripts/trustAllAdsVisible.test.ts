/**
 * Trust Pass 1 — every ad the report mentions is visible.
 *
 * analysis.ts used to cut winners/losers to 5 while the decision and the
 * kill-list copy counted the full pools, so a 6th below-median ad was
 * mentioned ("…and 4 more", in the spend total) and shown nowhere. Now
 * the memo carries the full pools; the report caps only the display
 * ("+N more … Show all", every row in print), TXT/Copy lists every row,
 * and the budget decision carries the full from/to list.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadEngine } from "./testerFeedbackEngine.ts";

const ECOM = readFileSync(join(ROOT, "scripts/fixtures/ecom-13ads.csv"), "utf8");
const BELOW = ["Static_H", "Promo_I", "Meme_J", "Stock_K", "Generic_L", "Clickbait_M"];
const ABOVE = ["Hero_UGC_A", "Review_B", "Demo_C", "Bundle_D", "Founder_E", "Unbox_F"];

const { run, memoToText, cleanup } = loadEngine();
try {
  const t = run(ECOM, "roas");
  const a = t.analysis;
  assert.equal(a.belowBenchmarkCount, 6);
  assert.deepEqual([...a.losers.map((l) => l.name)].sort(), [...BELOW].sort(), "full loser pool");
  assert.deepEqual([...a.winners.map((w) => w.name)].sort(), [...ABOVE].sort(), "full winner pool");
  const m = t.memo;
  assert.equal(m.losers.rows.length, 6, "memo rows = the count the copy uses");
  assert.equal(m.winners.length, 6);

  // The decision moves budget from all six, into the leader — named.
  assert.equal(m.decision.action, "budget");
  assert.equal(m.decision.budgetVariant, "shift");
  assert.deepEqual(m.decision.budgetMove?.from.map((x) => x.name).sort(), [...BELOW].sort());
  assert.deepEqual(m.decision.budgetMove?.to.map((x) => x.name), ["Hero_UGC_A"]);
  assert.match(m.decision.headline, /and 4 more into "Hero_UGC_A"/);

  // Every below-median ad appears in buyer TXT, client TXT, and at the
  // client's 3-row display cap too (the rest after "+N more:").
  for (const [label, txt] of [["buyer", t.buyerText], ["client", t.clientText], ["client top-3", memoToText(m, "client", 3, [])], ["buyer top-3", memoToText(m, "buyer", 3, [])]] as const) {
    for (const name of [...BELOW, ...ABOVE]) assert.ok(txt.includes(name), `${label} TXT names ${name}`);
  }
  assert.match(memoToText(m, "buyer", 5, []), /\n\+1 more:\n- Clickbait_M|\n\+1 more:\n- Static_H/, "the 6th row follows a +1 more marker");
  assert.match(t.buyerText, /Pause or trim: "Clickbait_M" \(\$384\.00\), .*"Static_H" \(\$379\.00\)/);
  assert.match(t.clientText, /Pausing or reducing: /); // labels made concrete in Trust Pass 3d
  // TL;DR "others" = every other below-median ad.
  assert.ok(m.tldr.some((l) => l.includes("and 5 other below-benchmark ads")));

  /* Report: no row is sliced away; collapsed rows still print; counts
     and names come from the same full list. */
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  assert.ok(!/rows\.slice\(0, topAdsShown\)/.test(report), "tables no longer drop rows");
  assert.match(report, /i >= topAdsShown && !expanded \? "hidden print:table-row"/);
  assert.match(report, /i >= topAdsShown && !expanded \? "hidden print:flex"/);
  assert.match(report, /<MoreToggle\s+names=\{rows\.slice\(topAdsShown\)\.map\(\(a\) => a\.name\)\}/);
  assert.match(report, /\{d\.budgetMove && <BudgetMoveNames move=\{d\.budgetMove\} client=\{client\}/);
  assert.match(report, /count: memo\.losers\.rows\.length,/);
  assert.match(report, /\+\{group\.count - group\.names\.length\} more — listed below/);

  console.log("trustAllAdsVisible: all assertions passed");
} finally {
  cleanup();
}
