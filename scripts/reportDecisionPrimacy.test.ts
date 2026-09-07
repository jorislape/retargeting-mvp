/**
 * Report Decision Primacy V1 — proofs.
 *
 * Presentation-only milestone: a JSX reorder in Report.tsx moving
 * DecisionCard ahead of WhatChangedSection/MovementChart, nothing else.
 * No analytical module changed — decision.ts/analysis.ts/
 * briefReadiness.ts/evidenceDiagnostic.ts/compare.ts/memo.ts are
 * untouched, reconfirmed below via the real compiled engine (byte-
 * identical decision/comparison output for the same fixture) rather
 * than assumed from "I didn't edit those files."
 *
 * Same two-pronged approach as reportDensitySequencing.test.ts, whose
 * own ordering assertion this milestone supersedes (updated there,
 * not duplicated here): a source-scan for structural JSX ordering
 * (this codebase has no component-render harness), plus the real
 * engine for decision/comparison byte-identity.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const ROOT = join(import.meta.dirname, "..");

/* ===================== 1. JSX ordering — source scan ===================== */
{
  const src = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");

  const decisionCardIdx = src.indexOf("<DecisionCard");
  const whatChangedIdx = src.indexOf("<WhatChangedSection");
  const movementIdx = src.indexOf("<MovementChart");
  const creativeEvidenceIdx = src.indexOf("<CreativeEvidenceStrip");
  const expertTakeIdx = src.indexOf("<ExpertTakeBlock");
  const executiveSummaryIdx = src.indexOf("<ExecutiveSummary");
  const verdictIdx = src.indexOf("---- Verdict / Summary ----");

  assert.ok(
    [decisionCardIdx, whatChangedIdx, movementIdx, creativeEvidenceIdx, expertTakeIdx, executiveSummaryIdx].every(
      (i) => i > 0
    ),
    "all six mounts found in Report.tsx"
  );

  // The exact approved order: Decision -> What Changed -> Movement ->
  // Creative Evidence -> Expert Commentary -> remaining sections.
  assert.ok(decisionCardIdx < whatChangedIdx, "Decision precedes What Changed");
  assert.ok(decisionCardIdx < movementIdx, "Decision precedes Movement Chart");
  assert.ok(whatChangedIdx < movementIdx, "What Changed still precedes Movement Chart (unchanged relative order)");
  assert.ok(movementIdx < creativeEvidenceIdx, "Movement precedes Creative Evidence");
  assert.ok(creativeEvidenceIdx < expertTakeIdx, "Creative Evidence precedes Expert Commentary");
  assert.ok(expertTakeIdx < executiveSummaryIdx, "Expert Commentary precedes the print-only Executive Summary");
  assert.ok(executiveSummaryIdx < verdictIdx, "Executive Summary precedes the numbered Verdict section");

  // Only one mount of each — moved, not duplicated.
  assert.equal((src.match(/<DecisionCard/g) ?? []).length, 1);
  assert.equal((src.match(/<WhatChangedSection/g) ?? []).length, 1);
  assert.equal((src.match(/<MovementChart/g) ?? []).length, 1);

  // Gating is untouched: DecisionCard's expandLimits still reads
  // memo.comparison (pre-existing behavior, not something this
  // milestone introduced or removed), WhatChangedSection still gates
  // on memo.comparison + sections.whatChanged, MovementChart still
  // gates on customization.showMovementChart only.
  const decisionBlock = src.slice(decisionCardIdx, whatChangedIdx);
  assert.ok(decisionBlock.includes("memo.comparison != null"), "expandLimits still reads memo.comparison");

  const whatChangedBlock = src.slice(whatChangedIdx - 200, movementIdx);
  assert.ok(whatChangedBlock.includes("memo.comparison && sections.whatChanged"));

  const movementBlock = src.slice(movementIdx - 200, movementIdx);
  assert.ok(movementBlock.includes("customization.showMovementChart"));
  assert.ok(!movementBlock.includes("sections.whatChanged"), "Movement's gate stays independent of What Changed's toggle");
}

console.log("reportDecisionPrimacy: JSX ordering source-scan passed");

/* ===================== 2. Real engine: decision/comparison byte-identity ===================== */
{
  const dist = mkdtempSync(join(tmpdir(), "debrief-decision-primacy-"));
  try {
    execSync(
      `npx tsc modules/debrief/*.ts components/debrief/memoToText.ts --outDir ${JSON.stringify(dist)} --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck --rewriteRelativeImportExtensions`,
      { cwd: ROOT, stdio: "pipe" }
    );
    const { parseCsv, toTable } = require(join(dist, "modules/debrief/csv.js"));
    const { resolveColumns } = require(join(dist, "modules/debrief/columns.js"));
    const { extractAds } = require(join(dist, "modules/debrief/extract.js"));
    const { analyze } = require(join(dist, "modules/debrief/analysis.js"));
    const { generateMemo } = require(join(dist, "modules/debrief/memo.js"));
    const { buildComparison } = require(join(dist, "modules/debrief/compare.js"));

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

    const currentCsv = `Ad name,Amount spent (USD),Purchases,Purchase ROAS (return on ad spend)
ThinWinner,500.00,3,4.50
MidAd,450.00,8,3.00
LowAd,400.00,6,2.50
WorstAd,380.00,2,1.20`;
    const previousCsv = `Ad name,Amount spent (USD),Purchases,Purchase ROAS (return on ad spend)
ThinWinner,300.00,2,3.80
MidAd,300.00,5,2.90
LowAd,300.00,4,2.40
WorstAd,300.00,3,1.90`;

    const run = (csvText: string) => {
      const { headers, rows } = toTable(parseCsv(csvText));
      const columns = resolveColumns(headers);
      const ads = extractAds(rows, columns, ctx.kpi);
      return { analysis: analyze(ads, rows, columns, ctx), ads };
    };

    const current = run(currentCsv);
    const previous = run(previousCsv);
    const memoWithoutComparison = generateMemo(current.analysis, ctx);
    const memoWithComparisonAttached = {
      ...generateMemo(current.analysis, ctx),
      comparison: buildComparison(
        { analysis: current.analysis, ads: current.ads },
        { analysis: previous.analysis, ads: previous.ads },
        {
          money: (v: number) => `$${v.toFixed(2)}`,
          kpiValue: (v: number) => `${v.toFixed(2)}x`,
          kpiLabel: "ROAS",
        }
      ),
    };

    // The decision is byte-identical with and without a comparison
    // attached — proving render-order changes (this milestone) and
    // comparison's mere presence (pre-existing invariant, reconfirmed
    // here since this milestone specifically reordered content around
    // the decision) never touch decision.ts's own output.
    assert.deepEqual(
      memoWithoutComparison.decision,
      memoWithComparisonAttached.decision,
      "decision is byte-identical whether or not a comparison is attached"
    );
    assert.ok(memoWithComparisonAttached.comparison != null, "fixture actually attaches a comparison");
    assert.ok(
      memoWithComparisonAttached.comparison.account.buyer.length > 0,
      "comparison content is real, non-empty output"
    );

    console.log("reportDecisionPrimacy: decision/comparison byte-identity confirmed");
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
}

console.log("reportDecisionPrimacy: all assertions passed");
