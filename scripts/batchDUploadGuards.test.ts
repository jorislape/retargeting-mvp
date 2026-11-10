/**
 * Batch D5 — upload guards. A wrong export gets a clear file-card error
 * with the fix, never a silent nonsense report:
 *  - no Ad name column ⇒ "This is a campaign-level export — export from
 *    the Ads tab.";
 *  - more than one Account ID / name ⇒ "This file has N ad accounts —
 *    export one account at a time.";
 *  - more than one currency ⇒ the same, in currencies;
 *  - Age / Gender / Placement / Day breakdowns are combined per ad and
 *    disclosed as "Breakdown rows combined"; a Day breakdown's span feeds
 *    the existing short-window (< 7 days) check.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadEngine } from "./testerFeedbackEngine.ts";

const fx = (f: string) => readFileSync(join(ROOT, "scripts/fixtures", f), "utf8");
const { run, requireCompiled, cleanup } = loadEngine();
try {
  const { checkExport } = requireCompiled("modules/debrief/fileCheck.js") as {
    checkExport: (t: string, k: string) => { ok: boolean; error?: { title: string; message: string; fix: string } };
  };
  const campaign = checkExport(fx("invalid-campaign-level.csv"), "cpa");
  assert.equal(campaign.ok, false);
  assert.equal(campaign.error?.message, "This is a campaign-level export — export from the Ads tab.");
  assert.match(campaign.error?.fix ?? "", /Ads tab/);

  const accounts = checkExport(fx("multi-account.csv"), "roas");
  assert.equal(accounts.ok, false);
  assert.equal(accounts.error?.title, "More than one ad account");
  assert.equal(accounts.error?.message, "This file has 2 ad accounts — export one account at a time.");

  const currencies = checkExport(fx("multi-currency.csv"), "roas");
  assert.equal(currencies.ok, false);
  assert.equal(currencies.error?.message, "This file has 2 currencies — export one account at a time.");
  const twoSpend = checkExport("Ad name,Amount spent (EUR),Amount spent (USD),Purchases\nA,10,,1\nB,,12,1\n", "purchases");
  assert.equal(twoSpend.error?.message, "This file has 2 currencies — export one account at a time.", "two spend columns in two currencies");

  /* One account / one currency stays fine. */
  assert.equal(checkExport("Account name,Ad name,Currency,Amount spent (EUR),Purchases,Purchases conversion value\nBrand A,A1,EUR,400,10,900\nBrand A,A2,EUR,300,8,600\n", "roas").ok, true);

  /* Breakdowns: combined per ad, disclosed, and the Day span is read. */
  const day = run(fx("day-age-breakdown.csv"), "roas");
  assert.equal(day.analysis.adsAnalyzed, 6, "60 Day × Age rows ⇒ 6 ads");
  assert.deepEqual(day.analysis.mergedRows?.breakdowns, ["Day", "Age"]);
  assert.deepEqual(day.analysis.dateRange, { start: "2025-04-01", end: "2025-04-05" }, "span from the Day column");
  assert.ok(day.memo.decision.limits.buyer.some((l) => /breakdown rows combined — the export is split by Day, Age/.test(l)));
  assert.ok(day.memo.decision.limits.buyer.some((l) => /5 days/.test(l)), "the < 7-day window line fires");
  const { mergedRowsNote } = requireCompiled("modules/debrief/extract.js") as { mergedRowsNote: (m: object) => string | null };
  assert.equal(
    mergedRowsNote({ names: 6, spendRows: 60, creatives: 6, breakdowns: ["Day", "Age"] }),
    "Breakdown rows combined (Day, Age): 54 rows merged into 6 creatives — one per ad name (spend, purchases and value summed)."
  );

  console.log("batch D upload guards: all assertions passed");
} finally {
  cleanup();
}
