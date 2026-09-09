/**
 * Decision Queue / Multi-Account V1 — integration proofs: the real
 * compiled engine end to end (CSV -> extract -> analyze -> memo ->
 * queue projection) across four realistic account fixtures that
 * naturally produce the four distinct decision states, PLUS the same
 * proof through the Meta virtual-CSV serializer (testable without
 * credentials). Matches the established two-pronged pattern this
 * codebase already uses (e.g. creativeGroupsIntegration.test.ts) —
 * hand-built MemoDecision objects cover the pure-logic matrix
 * (scripts/decisionQueue.test.ts); this file proves the module is
 * genuinely downstream of the real, committed decision.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const ROOT = join(import.meta.dirname, "..");

const dist = mkdtempSync(join(tmpdir(), "debrief-decision-queue-"));
try {
  execSync(
    `npx tsc modules/debrief/*.ts modules/meta/insightsToCsv.ts --outDir ${JSON.stringify(dist)} --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck --rewriteRelativeImportExtensions`,
    { cwd: ROOT, stdio: "pipe" }
  );
  const { parseCsv, toTable } = require(join(dist, "modules/debrief/csv.js"));
  const { resolveColumns } = require(join(dist, "modules/debrief/columns.js"));
  const { extractAds } = require(join(dist, "modules/debrief/extract.js"));
  const { analyze } = require(join(dist, "modules/debrief/analysis.js"));
  const { generateMemo } = require(join(dist, "modules/debrief/memo.js"));
  const { deriveDecisionQueue } = require(join(dist, "modules/debrief/decisionQueue.js"));
  const { insightsToCsv } = require(join(dist, "modules/meta/insightsToCsv.js"));

  const ctx = {
    kpi: "roas",
    product: "Test",
    offer: "",
    targetCpa: null,
    targetRoas: null,
    creativeNotes: "",
    marketContext: "",
    spendGateOverride: null,
    minOutcomeCount: null,
    minBriefOutcomeCount: null,
    minLossSpendMultiple: null,
  };

  function runCsv(csvText: string) {
    const { headers, rows } = toTable(parseCsv(csvText));
    const columns = resolveColumns(headers);
    const ads = extractAds(rows, columns, ctx.kpi);
    const analysis = analyze(ads, rows, columns, ctx);
    return generateMemo(analysis, ctx);
  }

  /* ===================== Fixture A: budget/scale, supported evidence -> needs_decision =====================
     13 judged ads (>= SUPPORTED_MIN_JUDGED), median ROAS 2.0, a clear
     leader at 4.0 (+100%, past the 30% scale bar) with 20 recorded
     purchases (past the 10-outcome noise floor), 5 ads at 2.3 (+15%),
     1 at the median, 6 at 1.7 (-15%, short of the -30% cut bar and
     under the 25% cut-spend-share bar too). */
  const csvA = [
    "Ad name,Amount spent (USD),Purchases,Purchase ROAS (return on ad spend),Reporting starts,Reporting ends",
    "TopAd,100.00,20,4.00,2026-01-01,2026-01-14",
    ...Array.from({ length: 5 }, (_, i) => `AboveAd${i + 1},100.00,12,2.30,2026-01-01,2026-01-14`),
    "MedianAd,100.00,10,2.00,2026-01-01,2026-01-14",
    ...Array.from({ length: 6 }, (_, i) => `BelowAd${i + 1},100.00,8,1.70,2026-01-01,2026-01-14`),
  ].join("\n");
  const memoA = runCsv(csvA);
  assert.equal(memoA.decision.action, "budget");
  assert.equal(memoA.decision.budgetVariant, "scale");
  assert.equal(memoA.decision.evidenceState, "supported");
  console.log("decisionQueueIntegration: fixture A (real CSV) -> budget/scale, supported evidence, as hand-derived");

  /* ===================== Fixture B: test, limited evidence -> watch_review =====================
     7 judged ads (< SUPPORTED_MIN_JUDGED, so evidenceState caps at
     "limited" regardless of separation), median ROAS 2.0, top +20%
     and worst -20% — both outside the flat band but neither clears
     the 30% scale/cut bars, so B1 and H2 both miss and T1 (test)
     fires. */
  const csvB = [
    "Ad name,Amount spent (USD),Purchases,Purchase ROAS (return on ad spend)",
    "TopB,100.00,6,2.40",
    "AboveB1,100.00,6,2.10",
    "AboveB2,100.00,6,2.10",
    "MedianB,100.00,6,2.00",
    "BelowB1,100.00,6,1.90",
    "BelowB2,100.00,6,1.90",
    "WorstB,100.00,6,1.60",
  ].join("\n");
  const memoB = runCsv(csvB);
  assert.equal(memoB.decision.action, "test");
  assert.equal(memoB.decision.evidenceState, "limited");
  console.log("decisionQueueIntegration: fixture B (real CSV) -> test action, limited evidence, as hand-derived");

  /* ===================== Fixture C: insufficient data -> no_action_yet =====================
     Only 3 judged ads — under DECISION_MIN_JUDGED (5), so H1 fires
     regardless of any separation. */
  const csvC = [
    "Ad name,Amount spent (USD),Purchases,Purchase ROAS (return on ad spend)",
    "OnlyAd1,100.00,5,3.00",
    "OnlyAd2,100.00,4,2.00",
    "OnlyAd3,100.00,3,1.00",
  ].join("\n");
  const memoC = runCsv(csvC);
  assert.equal(memoC.decision.action, "hold");
  assert.equal(memoC.decision.holdReason, "insufficient_data");
  console.log("decisionQueueIntegration: fixture C (real CSV) -> insufficient-data hold, as hand-derived");

  /* ===================== Fixture D: flat performance -> stable_hold =====================
     11 judged ads (>= SUPPORTED_MIN_JUDGED), median ROAS 2.0, every
     ad within +/-10% of it — inside the +/-15% flat band, so H2
     fires. */
  const csvD = [
    "Ad name,Amount spent (USD),Purchases,Purchase ROAS (return on ad spend),Reporting starts,Reporting ends",
    ...Array.from({ length: 5 }, (_, i) => `LowD${i + 1},100.00,15,1.80,2026-01-01,2026-01-14`),
    "MedianD,100.00,15,2.00,2026-01-01,2026-01-14",
    ...Array.from({ length: 5 }, (_, i) => `HighD${i + 1},100.00,15,2.20,2026-01-01,2026-01-14`),
  ].join("\n");
  const memoD = runCsv(csvD);
  assert.equal(memoD.decision.action, "hold");
  assert.equal(memoD.decision.holdReason, "flat_performance");
  console.log("decisionQueueIntegration: fixture D (real CSV) -> flat-performance hold, as hand-derived");

  /* ===================== Queue projection over all four real-engine decisions ===================== */
  const decisionABefore = JSON.stringify(memoA.decision);
  const decisionBBefore = JSON.stringify(memoB.decision);
  const decisionCBefore = JSON.stringify(memoC.decision);
  const decisionDBefore = JSON.stringify(memoD.decision);

  const queue = deriveDecisionQueue([
    { id: 1, label: "Stable Retail Co", memo: memoD },
    { id: 2, label: "New Launch Co", memo: memoC },
    { id: 3, label: "Growth Brand Co", memo: memoB },
    { id: 4, label: "Scaling Winner Co", memo: memoA },
  ]);

  assert.deepEqual(
    queue.entries.map((e: { label: string }) => e.label),
    ["Scaling Winner Co", "Growth Brand Co", "New Launch Co", "Stable Retail Co"],
    "the queue reorders strictly by category, independent of input/insertion order"
  );
  assert.deepEqual(
    queue.entries.map((e: { category: string }) => e.category),
    ["needs_decision", "watch_review", "no_action_yet", "stable_hold"]
  );

  /* Decision-blindness / downstream-only proof: each account's own
     committed MemoDecision is byte-identical after being read by the
     queue projection — the queue can only READ decision.ts's output,
     never influence it. */
  assert.equal(JSON.stringify(memoA.decision), decisionABefore);
  assert.equal(JSON.stringify(memoB.decision), decisionBBefore);
  assert.equal(JSON.stringify(memoC.decision), decisionCBefore);
  assert.equal(JSON.stringify(memoD.decision), decisionDBefore);
  console.log("decisionQueueIntegration: real 4-account portfolio orders correctly; every account's own decision is untouched by the projection");

  /* ===================== Meta virtual-CSV path (testable without credentials) ===================== */
  const metaCsv = insightsToCsv(
    [
      { adName: "TopAd", spend: "100.00", impressions: "10000", linkClicks: "500", ctr: "5", cpc: "0.2", purchases: "20", purchaseValue: "400", purchaseRoas: "4.00", costPerPurchase: "5", leads: "", costPerLead: "", dateStart: "2026-01-01", dateStop: "2026-01-07", addToCart: "", contentViews: "", cpm: "" },
      ...Array.from({ length: 5 }, (_, i) => ({ adName: `AboveAd${i + 1}`, spend: "100.00", impressions: "8000", linkClicks: "400", ctr: "5", cpc: "0.25", purchases: "12", purchaseValue: "230", purchaseRoas: "2.30", costPerPurchase: "8.3", leads: "", costPerLead: "", dateStart: "2026-01-01", dateStop: "2026-01-07", addToCart: "", contentViews: "", cpm: "" })),
      { adName: "MedianAd", spend: "100.00", impressions: "8000", linkClicks: "400", ctr: "5", cpc: "0.25", purchases: "10", purchaseValue: "200", purchaseRoas: "2.00", costPerPurchase: "10", leads: "", costPerLead: "", dateStart: "2026-01-01", dateStop: "2026-01-07", addToCart: "", contentViews: "", cpm: "" },
      ...Array.from({ length: 6 }, (_, i) => ({ adName: `BelowAd${i + 1}`, spend: "100.00", impressions: "8000", linkClicks: "400", ctr: "5", cpc: "0.25", purchases: "8", purchaseValue: "170", purchaseRoas: "1.70", costPerPurchase: "12.5", leads: "", costPerLead: "", dateStart: "2026-01-01", dateStop: "2026-01-07", addToCart: "", contentViews: "", cpm: "" })),
    ],
    "USD"
  );
  const memoMeta = runCsv(metaCsv);
  assert.equal(memoMeta.decision.action, "budget", "the Meta virtual-CSV path resolves through the identical columns.ts/extractAds/analyze/generateMemo pipeline as a manual CSV upload");
  assert.equal(memoMeta.decision.budgetVariant, "scale");
  assert.equal(memoMeta.decision.evidenceState, "supported");
  const metaQueue = deriveDecisionQueue([{ id: "meta-1", label: "Meta — Acme Co — Last 7 days", memo: memoMeta }]);
  assert.equal(metaQueue.entries[0].category, "needs_decision", "an account sourced from the Meta virtual CSV feeds the queue identically to a CSV-upload account — the queue module is origin-agnostic by construction");
  console.log("decisionQueueIntegration: Meta virtual-CSV path (no credentials needed) feeds the queue identically to a manual CSV upload");

  console.log("decisionQueueIntegration: all assertions passed");
} finally {
  rmSync(dist, { recursive: true, force: true });
}
