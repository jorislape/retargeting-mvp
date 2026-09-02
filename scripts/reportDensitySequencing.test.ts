/**
 * Report Density & Sequencing Coherence V1 — proofs.
 *
 * Presentation-only milestone (Report.tsx, memoToText.ts,
 * PerformanceRankingChart.tsx caption). No analytical module changed —
 * decision.ts/analysis.ts/briefReadiness.ts/evidenceDiagnostic.ts/
 * compare.ts are untouched, so byte-identity there is a structural
 * given (nothing to derive differently), reconfirmed below via the
 * real compiled engine rather than assumed.
 *
 * This codebase has no component-render test harness (no jsdom/RTL) —
 * every existing test either exercises pure functions directly or
 * source-scans a .tsx file for an expected pattern (see
 * reportCustomization.test.ts's own regex checks against
 * PerformanceRankingChart.tsx). This file follows the same two
 * precedents: clientizeText is a pure function, tested directly
 * through the real compiled engine; Report.tsx's structural claims
 * (ordering, grouping, gating) are source-scanned.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const ROOT = join(import.meta.dirname, "..");
const dist = mkdtempSync(join(tmpdir(), "debrief-report-density-"));

try {
  execSync(
    `npx tsc modules/debrief/*.ts components/debrief/memoToText.ts --outDir ${JSON.stringify(dist)} --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck --rewriteRelativeImportExtensions`,
    { cwd: ROOT, stdio: "pipe" }
  );
  const { clientizeText } = require(join(dist, "components/debrief/memoToText.js"));
  const { parseCsv, toTable } = require(join(dist, "modules/debrief/csv.js"));
  const { resolveColumns } = require(join(dist, "modules/debrief/columns.js"));
  const { extractAds } = require(join(dist, "modules/debrief/extract.js"));
  const { analyze } = require(join(dist, "modules/debrief/analysis.js"));
  const { generateMemo } = require(join(dist, "modules/debrief/memo.js"));
  const { buildSampleMemo } = require(join(dist, "modules/debrief/sample.js"));

  /* ===================== 3. Client jargon fix — clientizeText ===================== */

  // A. The proven leak, both singular and plural, is fixed.
  assert.equal(
    clientizeText(`it's the account's weakest judged ad — one rebuild`),
    `it's the account's weakest ad with enough spend to judge fairly — one rebuild`
  );
  assert.equal(
    clientizeText(`No judged ad is failing clearly this period.`),
    `No ad with enough spend to judge fairly is failing clearly this period.`
  );
  assert.equal(
    clientizeText(`3 judged ads cleared the gate.`),
    `3 ads with enough spend to judge fairly cleared the gate.`
  );

  // B. Legitimate plain-language phrasing is NOT touched — the fix is
  // word-boundary-anchored to the exact "judged ad(s)" noun phrase,
  // never the verb phrase "judge fairly" the earlier rules already
  // produce or any other use of "judge"/"judged" alone.
  assert.equal(
    clientizeText("ads had enough spend to judge fairly"),
    "ads had enough spend to judge fairly"
  );
  assert.equal(
    clientizeText("Judged fairly"),
    "Judged fairly"
  );
  assert.equal(
    clientizeText("5 ads judged this period"), // "judged" not followed by "ad(s)"
    "5 ads judged this period"
  );

  // C. Existing rules (median, spend gate) remain unaffected by the
  // new rules appended after them.
  assert.equal(clientizeText("clears the spend gate"), "has enough spend to judge fairly");
  assert.equal(clientizeText("below the median ROAS"), "below the typical ROAS");
  assert.equal(clientizeText("at the median"), "at the typical result");

  console.log("reportDensitySequencing: clientizeText proofs passed");

  /* ===================== 3b. No "judged ad" reaches Client-register
     memo output end-to-end (real engine, real T2 branch that produces
     the proven leak) ===================== */
  {
    const csv = `Ad name,Amount spent (USD),Purchases,Purchase ROAS (return on ad spend)
StrongWinner,500.00,60,4.50
MidAd,450.00,20,3.00
LowAd,400.00,15,2.50
LowerAd,390.00,12,2.60
WorstAd,380.00,5,1.20`;
    const { headers, rows } = toTable(parseCsv(csv));
    const columns = resolveColumns(headers);
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
    const ads = extractAds(rows, columns, ctx.kpi);
    const memo = generateMemo(analyze(ads, rows, columns, ctx), ctx);
    // Confirms the T2 branch that historically produced "weakest judged
    // ad" is actually exercised by this fixture.
    assert.ok(memo.nextTests[1].why.includes("judged ad"), "fixture exercises the known buyer-side phrase");
    // Buyer keeps its own vocabulary — this fix is Client-only.
    assert.ok(memo.nextTests[1].why.includes("judged"), "buyer why is untouched");
    const clientWhy = clientizeText(memo.nextTests[1].why);
    const clientHypothesis = clientizeText(memo.nextTests[1].hypothesis);
    assert.ok(!/\bjudged ads?\b/.test(clientWhy), `client-register why still contains "judged ad": ${clientWhy}`);
    assert.ok(!/\bjudged ads?\b/.test(clientHypothesis), `client-register hypothesis still contains "judged ad": ${clientHypothesis}`);
  }

  console.log("reportDensitySequencing: end-to-end Client jargon proof passed");

  /* ===================== 1 & 8. Decision byte-identity: nothing
     analytical changed by this presentation-only milestone ===================== */
  {
    const sampleMemo = buildSampleMemo();
    assert.equal(sampleMemo.decision.action, "budget");
    assert.equal(sampleMemo.decision.budgetVariant, "shift");
    assert.equal(sampleMemo.decision.evidenceState, "supported");
    assert.equal(sampleMemo.nextTests[0].briefReadiness.state, "directional");
    assert.equal(sampleMemo.nextTests[0].evidenceDiagnostic, undefined);
    // Same pins already established by briefReadiness.test.ts and
    // evidenceDiagnostic.test.ts — reconfirmed here as this milestone's
    // own explicit proof that presentation-only changes never touched
    // the committed decision or any evidence-layer derivation.
  }

  console.log("reportDensitySequencing: decision byte-identity reconfirmed");

  /* ===================== 1. Movement repositioning — source scan ===================== */
  {
    const src = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");

    const whatChangedIdx = src.indexOf("<WhatChangedSection");
    const movementIdx = src.indexOf("<MovementChart");
    const decisionCardIdx = src.indexOf("<DecisionCard");
    const rankingIdx = src.indexOf("<PerformanceRankingChart");
    const spendAllocationIdx = src.indexOf("<SpendAllocationChart");

    assert.ok(whatChangedIdx > 0 && movementIdx > 0 && decisionCardIdx > 0);
    assert.ok(
      whatChangedIdx < movementIdx && movementIdx < decisionCardIdx,
      "What Changed -> Movement -> Next Move ordering"
    );
    // Only one <MovementChart mount exists — it moved, it didn't duplicate.
    assert.equal((src.match(/<MovementChart/g) ?? []).length, 1);

    // Performance Ranking and Spend Allocation stay AFTER Decision Card,
    // in their original position, unmoved.
    assert.ok(decisionCardIdx < rankingIdx, "Performance Ranking still renders after Next Move");
    assert.ok(decisionCardIdx < spendAllocationIdx, "Spend Allocation still renders after Next Move");

    // Movement's gate is independent of What Changed's own toggle —
    // it must reference only customization.showMovementChart, never
    // sections.whatChanged.
    const movementBlock = src.slice(movementIdx - 200, movementIdx);
    assert.ok(movementBlock.includes("customization.showMovementChart"));
    assert.ok(!movementBlock.includes("sections.whatChanged"));
  }

  console.log("reportDensitySequencing: Movement repositioning source-scan passed");

  /* ===================== 2. Evidence grouping — source scan ===================== */
  {
    const src = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");

    // The shared "Evidence" group header exists, buyer-only, and Evidence
    // Diagnostic stays gated behind view !== "client" inside it.
    assert.ok(src.includes('title={"Evidence"}') || />\s*Evidence\s*</.test(src), "shared Evidence group label present");
    const evidenceGroupIdx = src.indexOf(">\n              Evidence\n");
    assert.ok(evidenceGroupIdx > -1, "Evidence group header present in TestRow");

    const groupSlice = src.slice(evidenceGroupIdx, evidenceGroupIdx + 1600);
    assert.ok(groupSlice.includes("Readiness"), "readiness sub-label present in the group");
    assert.ok(groupSlice.includes("Diagnostic"), "diagnostic sub-label present in the group");
    assert.ok(groupSlice.includes("test.evidenceDiagnostic"), "diagnostic value still sourced from test.evidenceDiagnostic, unchanged derivation");
    assert.ok(groupSlice.includes("test.briefReadiness"), "readiness value still sourced from test.briefReadiness, unchanged derivation");

    // Evidence Diagnostic must still never render for view === "client"
    // anywhere in TestRow. The evidence block is now a
    // `view === "client" ? (...clientBranch...) : (...buyerBranch...)`
    // ternary — assert structurally that evidenceDiagnostic is absent
    // from the client (then) branch and present only in the buyer
    // (else) branch, rather than matching one exact old string pattern.
    const testRowIdx = src.indexOf("function TestRow(");
    const testRowEnd = src.indexOf("\nfunction ", testRowIdx + 10);
    const testRowSrc = src.slice(testRowIdx, testRowEnd === -1 ? undefined : testRowEnd);
    const ternaryStart = testRowSrc.indexOf('view === "client" ? (');
    const elseMarker = testRowSrc.indexOf(") : (", ternaryStart);
    assert.ok(ternaryStart > -1 && elseMarker > ternaryStart, "the view === client ternary structure is present");
    const clientBranch = testRowSrc.slice(ternaryStart, elseMarker);
    const buyerBranch = testRowSrc.slice(elseMarker);
    assert.ok(!clientBranch.includes("evidenceDiagnostic"), "Evidence Diagnostic absent from the client branch");
    assert.ok(buyerBranch.includes("test.evidenceDiagnostic"), "Evidence Diagnostic present in the buyer branch");
    const clientCardsIdx = src.indexOf("function ClientTestCards(");
    const clientCardsEnd = src.indexOf("\nfunction ", clientCardsIdx + 10);
    const clientCardsSrc = src.slice(clientCardsIdx, clientCardsEnd === -1 ? undefined : clientCardsEnd);
    assert.ok(!clientCardsSrc.includes("evidenceDiagnostic"), "Evidence Diagnostic never referenced in the client-only card component");

    // Hypothesis remains a distinct field/row, separate from the
    // Evidence group.
    const hypothesisIdx = testRowSrc.indexOf("Hypothesis");
    const groupIdxInRow = testRowSrc.indexOf("Evidence");
    assert.ok(groupIdxInRow > -1 && hypothesisIdx > groupIdxInRow, "Hypothesis stays a separate field, after the Evidence group");
  }

  console.log("reportDensitySequencing: Evidence grouping source-scan passed");

  /* ===================== PerformanceRankingChart client caption fix ===================== */
  {
    const chartSrc = readFileSync(join(ROOT, "components/debrief/PerformanceRankingChart.tsx"), "utf8");
    assert.ok(
      chartSrc.includes('"Displayed ads relative to one shared reference point"'),
      "client-register caption drops the bare judged-ad phrase"
    );
    assert.ok(
      chartSrc.includes('"Displayed judged ads relative to one shared reference point"'),
      "buyer-register caption is unchanged"
    );
  }

  console.log("reportDensitySequencing: chart caption fix confirmed");

  /* ===================== 4. Overflow fix — DecisionCard dd elements ===================== */
  {
    const src = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
    // The three Next-controlled-test <dd> elements (Preserve/Change/
    // Watch) — the real, proven 320px overflow source (a bare flex
    // child with no min-width:0) — now carry min-w-0 break-words.
    // AdTable's min-w-[540px] table is deliberately untouched: browser
    // QA proved it's correctly contained by its own overflow-x-auto
    // and never causes genuine page-level scroll.
    const nextControlledIdx = src.indexOf("Next controlled test");
    const block = src.slice(nextControlledIdx, nextControlledIdx + 2000);
    const ddMatches = block.match(/<dd className="min-w-0 break-words">\{cz/g) ?? [];
    assert.equal(ddMatches.length, 3, "all three Preserve/Change/Watch <dd> elements carry the overflow fix");
    assert.ok(
      src.includes('min-w-[540px]'),
      "AdTable's min-w-[540px] is left untouched, as proven safe by browser QA"
    );
  }

  console.log("reportDensitySequencing: 320px overflow fix source-scan passed");
} finally {
  rmSync(dist, { recursive: true, force: true });
}
