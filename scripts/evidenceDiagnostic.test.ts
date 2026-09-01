/**
 * Evidence Diagnostic V1 — plain-Node proofs.
 *
 * Stage 1 (pure, fast): evidenceDiagnostic.ts depends only on
 * decision.ts and types.ts, both already directly Node-loadable
 * (explicit ".ts" extension imports) — same pattern
 * briefReadiness.test.ts's own Stage 1 uses. Hand-built AnalysisResult
 * fixtures exercise activation boundaries, ladder order, the no-
 * materiality-cutoff stopping rule, missing-data honesty, and the
 * isolation contract.
 *
 * Stage 2 (compiled): synthetic ecommerce + lead-gen CSV fixtures and
 * the sample-dataset pin, exercised through the REAL engine (column
 * alias resolution -> extraction -> analysis -> memo), the same
 * tsc-to-temp-dir approach briefReadiness.test.ts's own Stage 2 uses.
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

const money = (v: number) => `$${v.toFixed(2)}`;

function ad(
  name: string,
  spend: number,
  overrides: Partial<RankedAd> = {}
): RankedAd {
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

/* ===================== 1. Activation boundaries ===================== */
{
  // n = 9 -> thin_volume, activates (given SOME comparable ladder data).
  const top = ad("W", 500, { conversions: 9, addToCart: 10, cpm: null, impressions: null, linkClicks: null, contentViews: null });
  const other = ad("O", 400, { addToCart: 20 });
  const r = deriveEvidenceDiagnostic(
    fixture({ winners: [top], rankedAds: [top, other] }),
    money
  );
  assert.ok(r, "n=9 activates the diagnostic");
  assert.equal(r!.trigger, "thin_volume");
}
{
  // n = 10 -> sufficient, does NOT activate (mirrors decision.ts's own
  // strict "<" boundary for MIN_OUTCOMES_FOR_SUPPORTED).
  assert.equal(MIN_OUTCOMES_FOR_SUPPORTED, 10, "reused constant is still 10");
  const top = ad("W", 500, { conversions: 10 });
  const r = deriveEvidenceDiagnostic(fixture({ winners: [top], rankedAds: [top] }), money);
  assert.equal(r, null, "n=10 clears the floor — diagnostic not generated");
}
{
  // Missing count -> unverifiable_volume, NOT thin — missing != zero.
  const top = ad("W", 500, { conversions: null, addToCart: 10 });
  const other = ad("O", 400, { addToCart: 20 });
  const r = deriveEvidenceDiagnostic(fixture({ winners: [top], rankedAds: [top, other] }), money);
  assert.ok(r);
  assert.equal(r!.trigger, "unverifiable_volume");
  assert.ok(!r!.buyer.includes(" 0 "), "unverifiable is never worded as a zero count");
}
{
  // No winner at all -> null, not generated.
  const r = deriveEvidenceDiagnostic(fixture({ winners: [], rankedAds: [] }), money);
  assert.equal(r, null);
}
{
  // CTR selected as primary KPI -> no outcome concept, never activates,
  // regardless of how thin anything else looks.
  const top = ad("W", 500, { conversions: null, addToCart: 1 });
  const r = deriveEvidenceDiagnostic(fixture({ kpi: "ctr", winners: [top], rankedAds: [top] }), money);
  assert.equal(r, null, "ctr has no outcome concept to gate on");
}
{
  // CPC selected as primary KPI -> same as ctr.
  const top = ad("W", 500, { conversions: null });
  const r = deriveEvidenceDiagnostic(fixture({ kpi: "cpc", winners: [top], rankedAds: [top] }), money);
  assert.equal(r, null);
}

/* ===================== 2. Ecommerce ladder order ===================== */
{
  // Add-to-cart is checked first; when it's comparable, content
  // view/CTR/CPM are never reached even though they'd also be
  // comparable and would show a LARGER deviation.
  const top = ad("W", 500, { conversions: 3, addToCart: 50, contentViews: 200, impressions: 10000, linkClicks: 100, cpm: 5 });
  const other = ad("O", 400, { addToCart: 40, contentViews: 20, impressions: 8000, linkClicks: 800, cpm: 50 });
  const r = deriveEvidenceDiagnostic(fixture({ winners: [top], rankedAds: [top, other] }), money);
  assert.ok(r?.finding);
  assert.equal(r!.finding!.rungId, "add_to_cart", "first rung with usable data wins, even though CPM would show a bigger %");
}
{
  // Add-to-cart column absent entirely -> skipped -> content view found.
  const top = ad("W", 500, { conversions: 3, addToCart: null, contentViews: 30 });
  const other = ad("O", 400, { addToCart: null, contentViews: 20 });
  const r = deriveEvidenceDiagnostic(fixture({ winners: [top], rankedAds: [top, other] }), money);
  assert.equal(r?.finding?.rungId, "content_view");
}
{
  // Add-to-cart AND content-view both absent -> CTR found.
  const top = ad("W", 500, { conversions: 3, impressions: 10000, linkClicks: 150 });
  const other = ad("O", 400, { impressions: 8000, linkClicks: 100 });
  const r = deriveEvidenceDiagnostic(fixture({ winners: [top], rankedAds: [top, other] }), money);
  assert.equal(r?.finding?.rungId, "ctr");
}
{
  // Everything but CPM absent -> CPM found (last rung).
  const top = ad("W", 500, { conversions: 3, cpm: 12 });
  const other = ad("O", 400, { cpm: 9 });
  const r = deriveEvidenceDiagnostic(fixture({ winners: [top], rankedAds: [top, other] }), money);
  assert.equal(r?.finding?.rungId, "cpm");
}

/* ===================== 3. Lead-gen ladder ===================== */
{
  // Leads KPI: shorter ladder, CTR first, add_to_cart/content_view NEVER
  // referenced even when the ad happens to carry that data (forcing the
  // ecommerce shape onto a lead objective would be dishonest).
  const top = ad("L", 500, { conversions: 4, addToCart: 999, contentViews: 999, impressions: 10000, linkClicks: 200 });
  const other = ad("O", 400, { addToCart: 1, contentViews: 1, impressions: 8000, linkClicks: 80 });
  const r = deriveEvidenceDiagnostic(fixture({ kpi: "leads", winners: [top], rankedAds: [top, other] }), money);
  assert.equal(r?.finding?.rungId, "ctr", "leads ladder starts at CTR, never add_to_cart/content_view");
}
{
  const top = ad("L", 500, { conversions: 4, cpm: 8 });
  const other = ad("O", 400, { cpm: 6 });
  const r = deriveEvidenceDiagnostic(fixture({ kpi: "leads", winners: [top], rankedAds: [top, other] }), money);
  assert.equal(r?.finding?.rungId, "cpm");
}

/* ===================== 4. No materiality cutoff ===================== */
{
  // 1%, 15%, and 80% deltas all use the identical neutral template —
  // no "unusual"/"strong"/"weak" classification, no different wording
  // shape at different magnitudes.
  const build = (topAtc: number, otherAtc: number) => {
    const top = ad("W", 500, { conversions: 3, addToCart: topAtc });
    const other = ad("O", 400, { addToCart: otherAtc });
    return deriveEvidenceDiagnostic(fixture({ winners: [top], rankedAds: [top, other] }), money)!;
  };
  // top cost/ATC = 500/50 = 10 (fixed); other (=median) = 400/otherAtc,
  // chosen so top's cost sits ~1%/~15%/~80% above that median.
  const small = build(50, 40.4); // ~1% delta
  const mid = build(50, 46.0); // ~15% delta
  const big = build(50, 72.0); // ~80% delta
  for (const r of [small, mid, big]) {
    assert.match(r.finding!.buyer, /above this account's median/);
    assert.match(r.finding!.buyer, /This is an upstream signal to inspect, not evidence that the ad is failing/);
    for (const banned of ["strong", "weak", "unusual", "significant", "notable", "concerning"]) {
      assert.ok(!r.finding!.buyer.toLowerCase().includes(banned), `no magnitude classification word "${banned}"`);
    }
  }
  assert.equal(Math.round(small.finding!.deltaPct!), 1);
  assert.equal(Math.round(mid.finding!.deltaPct!), 15);
  assert.equal(Math.round(big.finding!.deltaPct!), 80);
  assert.notEqual(small.finding!.deltaPct, mid.finding!.deltaPct);
  assert.notEqual(mid.finding!.deltaPct, big.finding!.deltaPct);
}

/* ===================== 5. Never polarity-corrected into better/worse ===================== */
{
  const top = ad("W", 500, { conversions: 3, addToCart: 10 }); // cost/ATC = 50 (worse — higher cost)
  const other = ad("O", 400, { addToCart: 40 }); // cost/ATC = 10
  const r = deriveEvidenceDiagnostic(fixture({ winners: [top], rankedAds: [top, other] }), money)!;
  // "failing" legitimately appears once, only inside the required
  // negation clause ("not evidence that the ad is failing") — banning
  // it outright would reject the approved template itself. What must
  // never appear is an AFFIRMATIVE polarity/causal claim.
  for (const banned of ["better", "worse", "good", "bad", "proves", "causes"]) {
    assert.ok(!r.buyer.toLowerCase().includes(banned), `no polarity/causal word "${banned}" in: ${r.buyer}`);
  }
  assert.equal(
    (r.buyer.match(/failing/g) ?? []).length,
    1,
    "the only occurrence of 'failing' is inside the required negation clause"
  );
  assert.ok(r.buyer.includes("not evidence that the ad is failing"));
  assert.ok(r.finding!.deltaPct! > 0, "raw magnitude direction only — ad's own value is numerically higher");
}

/* ===================== 6. Zero-count for this ad — rung skipped, not divided by zero ===================== */
{
  // This ad's own add-to-cart count is 0 despite real spend -> not a
  // valid value for that rung (can't divide by zero) -> skip to the
  // next rung, never presented as an infinite/undefined cost.
  const top = ad("W", 500, { conversions: 3, addToCart: 0, contentViews: 15 });
  const other = ad("O", 400, { addToCart: 20, contentViews: 10 });
  const r = deriveEvidenceDiagnostic(fixture({ winners: [top], rankedAds: [top, other] }), money);
  assert.equal(r?.finding?.rungId, "content_view", "zero add-to-cart is skipped, not divided by zero");
}

/* ===================== 7. Zero-median honesty ===================== */
{
  // Every OTHER comparable ad has CPM exactly 0 -> median is 0 -> no
  // percentage can be shown; raw values only.
  const top = ad("W", 500, { conversions: 3, cpm: 5 });
  const other1 = ad("O1", 400, { cpm: 0 });
  const other2 = ad("O2", 300, { cpm: 0 });
  const r = deriveEvidenceDiagnostic(
    fixture({ winners: [top], rankedAds: [top, other1, other2] }),
    money
  )!;
  assert.equal(r.finding?.rungId, "cpm");
  assert.equal(r.finding!.deltaPct, null, "zero median never manufactures a percentage");
  assert.ok(r.finding!.buyer.includes("no percentage difference can be shown"));
}

/* ===================== 8. No comparable evidence at all ===================== */
{
  // No upstream columns available anywhere -> explicit could-not-
  // evaluate state, never silently absent and never a fabricated
  // finding.
  const top = ad("W", 500, { conversions: 3 });
  const other = ad("O", 400, {});
  const r = deriveEvidenceDiagnostic(fixture({ winners: [top], rankedAds: [top, other] }), money)!;
  assert.equal(r.finding, null);
  assert.equal(r.noComparableEvidence, true);
  assert.ok(r.buyer.includes("could not evaluate upstream evidence"));
}
{
  // Column present for the target ad but no OTHER judged ad has a
  // usable value -> no comparable median -> same could-not-evaluate
  // state (not silently treated as "in line").
  const top = ad("W", 500, { conversions: 3, addToCart: 10 });
  const other = ad("O", 400, { addToCart: null });
  const r = deriveEvidenceDiagnostic(fixture({ winners: [top], rankedAds: [top, other] }), money)!;
  assert.equal(r.finding, null);
  assert.equal(r.noComparableEvidence, true);
}
{
  // Diagnosed ad is the ONLY judged ad -> comparable pool is empty by
  // construction (excludes itself) -> could-not-evaluate.
  const top = ad("W", 500, { conversions: 3, addToCart: 10, cpm: 5 });
  const r = deriveEvidenceDiagnostic(fixture({ winners: [top], rankedAds: [top] }), money)!;
  assert.equal(r.finding, null);
  assert.equal(r.noComparableEvidence, true);
}

/* ===================== 9. Missing != zero — vocabulary check ===================== */
{
  const top = ad("W", 500, { conversions: null });
  const other = ad("O", 400, {});
  const r = deriveEvidenceDiagnostic(fixture({ winners: [top], rankedAds: [top, other] }), money)!;
  assert.match(r.buyer, /no verifiable .* count/, "unverifiable framing, never '0 purchases'");
}

/* ===================== 10. Diagnostic-vocabulary / causal-overclaim scan ===================== */
{
  // "failing" is deliberately excluded from this list — it appears
  // once, legitimately, inside every finding's required negation
  // clause ("not evidence that the ad is failing"). What's actually
  // banned is an AFFIRMATIVE classification of the delta.
  const banned = ["good", "bad", "strong", "weak", "proves", "causes", "significant"];
  const cases: [KpiKey, Partial<RankedAd>, Partial<RankedAd>][] = [
    ["roas", { conversions: 2, addToCart: 5 }, { addToCart: 50 }],
    ["cpa", { conversions: null, contentViews: 5 }, { contentViews: 500 }],
    ["purchases", { conversions: 0, impressions: 1000, linkClicks: 1 }, { impressions: 1000, linkClicks: 100 }],
    ["leads", { conversions: 1, cpm: 40 }, { cpm: 4 }],
  ];
  for (const [kpi, topOverrides, otherOverrides] of cases) {
    const top = ad("W", 500, topOverrides);
    const other = ad("O", 400, otherOverrides);
    const r = deriveEvidenceDiagnostic(fixture({ kpi, winners: [top], rankedAds: [top, other] }), money);
    assert.ok(r, `case ${kpi} should activate`);
    const text = r!.buyer.toLowerCase();
    for (const word of banned) {
      assert.ok(!text.includes(word), `banned word "${word}" leaked into: ${r!.buyer}`);
    }
  }
}

/* ===================== 11. Isolation ===================== */
{
  const decisionSrc = readFileSync(
    join(import.meta.dirname, "..", "modules", "debrief", "decision.ts"),
    "utf8"
  );
  assert.ok(
    !/from\s+"\.\/evidenceDiagnostic/.test(decisionSrc),
    "decision.ts never imports evidenceDiagnostic.ts"
  );
  const src = readFileSync(
    join(import.meta.dirname, "..", "modules", "debrief", "evidenceDiagnostic.ts"),
    "utf8"
  );
  assert.ok(!/from\s+"\.\/memo/.test(src), "evidenceDiagnostic.ts never imports memo.ts");
  assert.ok(!/from\s+"\.\/compare/.test(src), "evidenceDiagnostic.ts never imports compare.ts");
  assert.ok(
    !/from\s+"\.\/briefReadiness/.test(src),
    "evidenceDiagnostic.ts never imports briefReadiness.ts — independently derived facts, no cross-module coupling"
  );
}
{
  // Arity-based proof: deriveEvidenceDiagnostic takes only (analysis,
  // money) — it structurally cannot read DecisionCriteria or
  // MemoComparison, mirroring briefReadiness.test.ts's own arity checks.
  assert.equal(deriveEvidenceDiagnostic.length, 2);
}

console.log("evidenceDiagnostic Stage 1: all pure-logic proofs passed");

/* ===================== Stage 2: real engine — synthetic fixtures + sample pin ===================== */

{
  const require = createRequire(import.meta.url);
  const dist = mkdtempSync(join(tmpdir(), "debrief-evidence-diagnostic-"));
  try {
    execSync(
      `npx tsc modules/debrief/*.ts components/debrief/memoToText.ts --outDir ${JSON.stringify(dist)} --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck --rewriteRelativeImportExtensions`,
      { cwd: join(import.meta.dirname, ".."), stdio: "pipe" }
    );
    const { parseCsv, toTable } = require(join(dist, "modules/debrief/csv.js"));
    const { resolveColumns } = require(join(dist, "modules/debrief/columns.js"));
    const { extractAds } = require(join(dist, "modules/debrief/extract.js"));
    const { analyze } = require(join(dist, "modules/debrief/analysis.js"));
    const { generateMemo } = require(join(dist, "modules/debrief/memo.js"));
    const { buildSampleMemo } = require(join(dist, "modules/debrief/sample.js"));

    const baseContext = {
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

    const runCsv = (csvText: string, contextOverrides: Record<string, unknown>) => {
      const { headers, rows } = toTable(parseCsv(csvText));
      const columns = resolveColumns(headers);
      const ctx = { ...baseContext, ...contextOverrides };
      const ads = extractAds(rows, columns, ctx.kpi);
      return generateMemo(analyze(ads, rows, columns, ctx), ctx);
    };

    // 12/16. Synthetic ecommerce fixture: real Meta-shaped column names
    // (the CPM header's embedded comma is RFC4180-quoted, same as any
    // real Meta export would produce), a thin winner (3 purchases), and
    // comparable upstream data on other judged ads — proves alias
    // resolution end to end, not just the pure module in isolation.
    const ecomCsv = `Ad name,Amount spent (USD),Purchases,Purchase ROAS (return on ad spend),Adds to cart,Content views,CTR (link click-through rate),"CPM (cost per 1,000 impressions)",Impressions,Link clicks
ThinWinner,500.00,3,4.50,10,40,1.80,25.00,60000,1080
MidAd,450.00,8,3.00,45,120,1.60,18.00,55000,880
LowAd,400.00,6,2.50,50,140,1.55,17.00,50000,775
WorstAd,380.00,2,1.20,60,150,1.40,16.00,48000,672`;
    const ecom = runCsv(ecomCsv, { kpi: "roas" });
    assert.ok(ecom.nextTests[0].evidenceDiagnostic, "ecommerce fixture: T1 carries a diagnostic (3 purchases < floor)");
    assert.equal(ecom.nextTests[0].evidenceDiagnostic.trigger, "thin_volume");
    assert.equal(
      ecom.nextTests[0].evidenceDiagnostic.finding?.rungId,
      "add_to_cart",
      "add-to-cart column resolved via alias and used as the first rung"
    );

    // 13/17. Synthetic lead-gen fixture: leads KPI, no add-to-cart/
    // content-view columns at all — proves the shorter ladder is used,
    // not silently padded with N/A ecommerce rungs. Every ad (including
    // the winner) has under 10 leads: for a leads KPI the outcome count
    // IS the kpiValue, so a fixture meant to test "thin winner" must
    // keep the whole field thin, not just the non-winning rows.
    const leadCsv = `Ad name,Amount spent (USD),Leads,CTR (link click-through rate),"CPM (cost per 1,000 impressions)",Impressions,Link clicks
ThinWinner,500.00,8,1.20,30.00,40000,480
MidLead,450.00,5,1.50,20.00,42000,630
LowLead,400.00,3,1.55,19.00,41000,635`;
    const leadGen = runCsv(leadCsv, { kpi: "leads" });
    assert.ok(leadGen.nextTests[0].evidenceDiagnostic, "lead-gen fixture: T1 carries a diagnostic (8 leads < floor)");
    assert.equal(leadGen.nextTests[0].evidenceDiagnostic.finding?.rungId, "ctr", "leads ladder starts at CTR");

    // 14/19. Diagnostic absent when primary evidence is already
    // sufficient — same ecommerce shape, winner now has 12 purchases.
    const sufficientCsv = ecomCsv.replace("ThinWinner,500.00,3,4.50", "ThinWinner,500.00,12,4.50");
    const sufficient = runCsv(sufficientCsv, { kpi: "roas" });
    assert.equal(
      sufficient.nextTests[0].evidenceDiagnostic,
      undefined,
      "12 purchases clears the floor — diagnostic not generated"
    );

    // 15. Sample-dataset pin: the sample's own top winner
    // (UGC_MorningRoutine_V1) has 34 purchases — already past the
    // 10-outcome floor — so Evidence Diagnostic is correctly ABSENT on
    // the shipped sample. No sample enrichment was made for this
    // milestone; this assertion pins that the sample demonstrates
    // "sufficient evidence, nothing to diagnose", not a contrived
    // "columns unavailable" path.
    const sampleMemo = buildSampleMemo();
    assert.equal(
      sampleMemo.nextTests[0].evidenceDiagnostic,
      undefined,
      "sample's winner (34 purchases) already clears the floor"
    );

    // Decision/Brief Readiness/comparison byte-identity: same sample
    // run through the full pipeline with and without upstream funnel
    // columns present is irrelevant to decision.ts, since sampleCsv.ts
    // carries none — this proves the ecommerce/lead-gen fixtures above
    // (which DO carry upstream columns and DO activate the diagnostic)
    // still produce decisions indistinguishable in shape from a run
    // with no upstream columns at all.
    const ecomNoUpstream = runCsv(
      `Ad name,Amount spent (USD),Purchases,Purchase ROAS (return on ad spend)
ThinWinner,500.00,3,4.50
MidAd,450.00,8,3.00
LowAd,400.00,6,2.50
WorstAd,380.00,2,1.20`,
      { kpi: "roas" }
    );
    assert.deepEqual(
      ecomNoUpstream.decision,
      ecom.decision,
      "decision is byte-identical whether or not upstream funnel columns (and therefore the diagnostic) are present"
    );
    assert.deepEqual(
      ecomNoUpstream.nextTests[0].briefReadiness,
      ecom.nextTests[0].briefReadiness,
      "Brief Readiness is unaffected by the presence of upstream funnel columns"
    );
    assert.equal(ecomNoUpstream.comparison, null);
    assert.equal(ecom.comparison, null);
    // The trigger still fires (3 purchases < floor) — but with zero
    // upstream columns in this CSV, no rung is ever comparable, so the
    // diagnostic is present with the explicit could-not-evaluate state
    // rather than a fabricated finding.
    assert.ok(ecomNoUpstream.nextTests[0].evidenceDiagnostic, "diagnostic still generated (trigger fires)");
    assert.equal(ecomNoUpstream.nextTests[0].evidenceDiagnostic.finding, null);
    assert.equal(ecomNoUpstream.nextTests[0].evidenceDiagnostic.noComparableEvidence, true);
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
}

console.log("evidenceDiagnostic Stage 2: synthetic fixtures + sample pin passed");
