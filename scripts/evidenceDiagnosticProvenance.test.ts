/**
 * Evidence Diagnostic Provenance Coherence V1 — plain-Node proofs.
 *
 * Stage 1 (pure, fast): deriveEvidenceDiagnostic is directly Node-
 * loadable (explicit ".ts" extension imports), same as
 * evidenceDiagnostic.test.ts's own Stage 1 — exercises the new
 * provenance wording, confirms it's scoped to the thin_volume branch
 * only, and pins the finding's own fields (rungId/valueLabel/
 * medianLabel/deltaPct) as unaffected by the copy change.
 *
 * Stage 2 (compiled): the real engine on a thin-winner ecommerce
 * fixture and the shipped sample, proving the committed decision and
 * Brief Readiness are byte-identical to their pre-existing pinned
 * values, the Buyer/Client register contract is untouched (source-
 * scan of Report.tsx, plus an actual memoToText() call for both
 * views), and TXT output carries the new wording coherently.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deriveEvidenceDiagnostic } from "../modules/debrief/evidenceDiagnostic.ts";
import { MIN_OUTCOMES_FOR_SUPPORTED } from "../modules/debrief/decision.ts";
import type { AnalysisResult, KpiKey, RankedAd } from "../modules/debrief/types.ts";

const ROOT = join(import.meta.dirname, "..");
const money = (v: number) => `$${v.toFixed(2)}`;

function ad(name: string, spend: number, overrides: Partial<RankedAd> = {}): RankedAd {
  return {
    name,
    spend,
    kpiValue: 1,
    nameTags: [],
    gate: "judged",
    deltaFromMedian: 0,
    deltaPct: 0,
    conversions: null,
    impressions: null,
    linkClicks: null,
    addToCart: null,
    contentViews: null,
    cpm: null,
    ...overrides,
  };
}

function fixture(overrides: Partial<AnalysisResult>): AnalysisResult {
  return {
    kpi: "roas" as KpiKey,
    adsAnalyzed: 10,
    adsJudged: 8,
    adsSetAside: 2,
    totalSpend: 1200,
    judgedSpend: 1000,
    currency: null,
    dateRange: null,
    spendGate: 100,
    spendGateBasis: "floor_or_mean",
    median: 2,
    winners: [],
    losers: [],
    rankedAds: [],
    belowBenchmarkSpend: 0,
    belowBenchmarkCount: 0,
    aboveBenchmarkSpend: 0,
    aboveBenchmarkCount: 0,
    atBenchmarkSpend: 0,
    atBenchmarkCount: 0,
    hasNameSignal: false,
    hasCreativeNotes: false,
    missingColumns: [],
    duplicateAdNames: [],
    ...overrides,
  };
}

/* ===================== 0. Constant untouched (hard scope fence) ===================== */
{
  assert.equal(MIN_OUTCOMES_FOR_SUPPORTED, 10, "the floor value itself was not changed by this milestone");
}

/* ===================== 1. thin_volume: provenance now visible ===================== */
{
  const top = ad("ThinWinner", 500, { conversions: 3, addToCart: 10 });
  const other = ad("Other", 400, { addToCart: 40 });
  const r = deriveEvidenceDiagnostic(fixture({ winners: [top], rankedAds: [top, other] }), money)!;
  assert.equal(r.trigger, "thin_volume");
  assert.match(r.buyer, /noise floor/, "names the floor concept, not just a bare 'too few'");
  assert.match(r.buyer, /\b10\b/, "states the exact floor value");
  assert.match(r.buyer, /Debrief default/, "attributes the floor to Debrief, not the practitioner or an industry rule");
  assert.match(r.buyer, /not a universal threshold/, "explicitly disclaims universality");
  // The ad's own count is still stated (unchanged fact, just no longer parenthetical).
  assert.match(r.buyer, /\b3\b/, "the ad's own recorded count is still stated");
}

/* ===================== 2. unverifiable_volume: no floor to attribute, none implied ===================== */
{
  // No threshold was actually applied here (the count is missing, not
  // low) — provenance language must NOT appear, or it would falsely
  // imply a bar was compared against.
  const top = ad("NoCount", 500, { conversions: null, addToCart: 10 });
  const other = ad("Other", 400, { addToCart: 40 });
  const r = deriveEvidenceDiagnostic(fixture({ winners: [top], rankedAds: [top, other] }), money)!;
  assert.equal(r.trigger, "unverifiable_volume");
  assert.ok(!r.buyer.includes("noise floor"), "no floor language when no floor was actually applied");
  assert.ok(!r.buyer.includes("Debrief default"), "no default-attribution language when no default was actually applied");
  assert.match(r.buyer, /no verifiable .* count/, "unchanged unverifiable framing");
}

/* ===================== 3. No industry/universal-standard language, anywhere ===================== */
{
  const cases: [KpiKey, Partial<RankedAd>, Partial<RankedAd>][] = [
    ["roas", { conversions: 2, addToCart: 5 }, { addToCart: 50 }],
    ["purchases", { conversions: 0, impressions: 1000, linkClicks: 1 }, { impressions: 1000, linkClicks: 100 }],
    ["leads", { conversions: 1, cpm: 40 }, { cpm: 4 }],
  ];
  const banned = [
    "industry",
    "universal standard",
    "statistical significance",
    "always true",
    "every account",
    "scientific law",
    "best practice",
  ];
  for (const [kpi, topOverrides, otherOverrides] of cases) {
    const top = ad("W", 500, topOverrides);
    const other = ad("O", 400, otherOverrides);
    const r = deriveEvidenceDiagnostic(fixture({ kpi, winners: [top], rankedAds: [top, other] }), money)!;
    const text = r.buyer.toLowerCase();
    for (const word of banned) {
      assert.ok(!text.includes(word), `banned universalizing phrase "${word}" leaked into: ${r.buyer}`);
    }
    // Pre-existing magnitude/causal blocklist, reconfirmed unaffected.
    for (const word of ["strong", "weak", "good", "bad", "proves", "causes", "significant"]) {
      assert.ok(!text.includes(word), `pre-existing banned word "${word}" leaked into: ${r.buyer}`);
    }
  }
}

/* ===================== 4. Finding derivation unaffected by the copy change ===================== */
{
  // Same fixture shape as evidenceDiagnostic.test.ts's ladder-order
  // case — rungId/valueLabel/medianLabel/deltaPct are pinned to prove
  // only the trigger-clause STRING changed, not the diagnostic's
  // methodology or numbers.
  const top = ad("W", 500, { conversions: 3, addToCart: 50, contentViews: 200, impressions: 10000, linkClicks: 100, cpm: 5 });
  const other = ad("O", 400, { addToCart: 40, contentViews: 20, impressions: 8000, linkClicks: 800, cpm: 50 });
  const r = deriveEvidenceDiagnostic(fixture({ winners: [top], rankedAds: [top, other] }), money)!;
  assert.equal(r.finding?.rungId, "add_to_cart");
  assert.equal(r.finding?.valueLabel, "$10.00");
  assert.equal(r.finding?.medianLabel, "$10.00");
  assert.equal(r.finding?.deltaPct, 0);
}

/* ===================== Stage 2: real engine — thin-winner fixture + sample pin ===================== */
{
  const require = createRequire(import.meta.url);
  const dist = mkdtempSync(join(tmpdir(), "debrief-evidence-diagnostic-provenance-"));
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
    const { buildSampleMemo } = require(join(dist, "modules/debrief/sample.js"));
    const { memoToText } = require(join(dist, "components/debrief/memoToText.js"));

    // 5. Sample pin — decision/briefReadiness/evidenceDiagnostic all
    // exactly as before this milestone (the sample's winner already
    // clears the floor at 34 purchases, so the diagnostic stays absent
    // — unaffected by a change scoped to the thin_volume wording).
    const sampleMemo = buildSampleMemo();
    assert.equal(sampleMemo.decision.action, "budget");
    assert.equal(sampleMemo.decision.budgetVariant, "shift");
    assert.equal(sampleMemo.decision.evidenceState, "supported");
    assert.equal(sampleMemo.nextTests[0].briefReadiness.state, "directional");
    assert.equal(sampleMemo.nextTests[0].evidenceDiagnostic, undefined);

    // 6. Thin-winner ecommerce fixture through the REAL pipeline (alias
    // resolution -> extraction -> analysis -> memo) — decision and
    // Brief Readiness are computed independently of evidenceDiagnostic
    // and must be identical to what this exact fixture has always
    // produced; the diagnostic itself now carries the provenance line.
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
    const ecomCsv = `Ad name,Amount spent (USD),Purchases,Purchase ROAS (return on ad spend),Adds to cart,Content views,CTR (link click-through rate),"CPM (cost per 1,000 impressions)",Impressions,Link clicks
ThinWinner,500.00,3,4.50,10,40,1.80,25.00,60000,1080
MidAd,450.00,8,3.00,45,120,1.60,18.00,55000,880
LowAd,400.00,6,2.50,50,140,1.55,17.00,50000,775
WorstAd,380.00,2,1.20,60,150,1.40,16.00,48000,672`;
    const { headers, rows } = toTable(parseCsv(ecomCsv));
    const columns = resolveColumns(headers);
    const ads = extractAds(rows, columns, ctx.kpi);
    const memo = generateMemo(analyze(ads, rows, columns, ctx), ctx);

    assert.ok(memo.nextTests[0].evidenceDiagnostic, "fixture activates the diagnostic (3 purchases < floor)");
    assert.equal(memo.nextTests[0].evidenceDiagnostic.trigger, "thin_volume");
    assert.equal(memo.nextTests[0].evidenceDiagnostic.finding?.rungId, "add_to_cart", "rung selection unchanged");
    assert.match(memo.nextTests[0].evidenceDiagnostic.buyer, /Debrief default/, "provenance reaches the memo through the real pipeline");
    assert.match(memo.nextTests[0].evidenceDiagnostic.buyer, /noise floor/);

    // Decision and Brief Readiness for this exact fixture: pinned to
    // whatever this fixture has always produced (evidenceDiagnostic.ts
    // cannot feed back into either — isolation is test-enforced
    // elsewhere — so any drift here would mean something outside this
    // milestone's fence moved).
    assert.equal(memo.decision.action, "hold", "decision unaffected by the diagnostic's wording change");
    assert.equal(memo.nextTests[0].briefReadiness.state, "insufficient", "Brief Readiness unaffected by the diagnostic's wording change");

    // 7. Buyer/Client register contract — an actual memoToText() call
    // for both views on the SAME fixture, not just a source-scan.
    const buyerTxt = memoToText(memo, "buyer");
    const clientTxt = memoToText(memo, "client");
    assert.match(buyerTxt, /Evidence diagnostic:/, "buyer TXT carries the diagnostic line");
    assert.match(buyerTxt, /Debrief default/, "buyer TXT carries the new provenance wording");
    assert.ok(!clientTxt.includes("Evidence diagnostic:"), "client TXT omits Evidence Diagnostic entirely, unchanged");
    assert.ok(!clientTxt.includes("Debrief default"), "no internal provenance language reaches Client TXT");
    assert.ok(!clientTxt.includes("noise floor"), "no internal provenance language reaches Client TXT");

    console.log("evidenceDiagnosticProvenance Stage 2: real engine + sample pin + Buyer/Client TXT proofs passed");
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
}

/* ===================== 8. Buyer/Client register contract — source-scan ===================== */
{
  // Report.tsx's own rendering of Evidence Diagnostic is untouched by
  // this milestone (only evidenceDiagnostic.ts's string changed) —
  // reconfirm it still lives exclusively in the buyer branch.
  const reportSrc = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  const clientBranchStart = reportSrc.indexOf('view === "client" ? (');
  // The ternary's true (client) arm ends at its own ") : (" — NOT at
  // the buyer-side render block further down, which is preceded by
  // the buyer-side gating condition (itself referencing
  // evidenceDiagnostic as part of an OR, legitimately, since that
  // condition decides the buyer branch's own visibility).
  const clientBranchEnd = reportSrc.indexOf(") : (", clientBranchStart);
  const buyerBranchStart = reportSrc.indexOf("test.evidenceDiagnostic && (");
  assert.ok(clientBranchStart !== -1 && clientBranchEnd !== -1 && buyerBranchStart !== -1);
  assert.ok(clientBranchEnd < buyerBranchStart, "client arm closes before the buyer-only render block begins");
  const clientBranch = reportSrc.slice(clientBranchStart, clientBranchEnd);
  assert.ok(!clientBranch.includes("evidenceDiagnostic"), "Evidence Diagnostic still absent from the client branch");
}

console.log("evidenceDiagnosticProvenance: all assertions passed");
