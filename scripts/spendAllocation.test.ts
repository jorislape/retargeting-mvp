/**
 * Spend Allocation V1 — plain-Node proofs against the REAL engine.
 *
 * analysis.ts/memo.ts/csv.ts/columns.ts/extract.ts use extensionless
 * imports (not directly Node-loadable), so — same pattern as
 * scripts/decision.test.ts's Stage 2 — this compiles modules/debrief to
 * CommonJS in a temp dir with tsc and runs the real pipeline. Covers:
 * the sample-dataset reconciliation pin (exact numbers hand-computed
 * from sampleCsv.ts), all six KPI modes, absent-category omission, the
 * zero-judged-spend null case, and Report.tsx/Competitor Debrief
 * isolation via lightweight source scans (no compilation needed there).
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const REPO_ROOT = join(import.meta.dirname, "..");

/** Tolerance-based float compare — sum-of-parts vs sum-of-whole can
 *  differ by IEEE754 rounding depending on addition order. */
function assertClose(actual: number, expected: number, message: string, tolerance = 0.01) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message} (expected ≈${expected}, got ${actual}, diff ${Math.abs(actual - expected)})`
  );
}

/* ===================== Source-scan checks (no compile needed) ===================== */

{
  const reportSrc = readFileSync(join(REPO_ROOT, "components/debrief/Report.tsx"), "utf8");
  // The mount point exists and is gated by its own toggle.
  assert.ok(
    /customization\.showSpendAllocationChart\s*&&[\s\S]{0,200}<SpendAllocationChart/.test(reportSrc),
    "SpendAllocationChart is mounted behind customization.showSpendAllocationChart"
  );
  // topAdsShown independence: unlike winners/losers passed to
  // PerformanceRankingChart, memo.spendAllocation must never be sliced.
  assert.ok(
    !/allocation=\{memo\.spendAllocation\.slice/.test(reportSrc) &&
      !/memo\.spendAllocation[\s\S]{0,80}topAdsShown/.test(reportSrc),
    "memo.spendAllocation is never sliced by customization.topAdsShown"
  );
  // Placement: SpendAllocationChart mounts after PerformanceRankingChart
  // and before the numbered Winners section.
  const rankingIdx = reportSrc.indexOf("<PerformanceRankingChart");
  const allocationIdx = reportSrc.indexOf("<SpendAllocationChart");
  const winnersIdx = reportSrc.indexOf('title={client ? "What worked" : "Winners"}');
  assert.ok(rankingIdx > 0 && allocationIdx > rankingIdx && winnersIdx > allocationIdx, "placement: Performance Ranking -> Spend Allocation -> Winners");
}

{
  // Competitor Debrief remains isolated: nothing under modules/competitorDebrief
  // or components/competitorDebrief references Spend Allocation at all.
  const scanDirs = ["modules/competitorDebrief", "components/competitorDebrief", "app/api/competitor-debrief"];
  const offenders: string[] = [];
  for (const dir of scanDirs) {
    let files: string[];
    try {
      files = readdirSync(join(REPO_ROOT, dir));
    } catch {
      continue;
    }
    for (const f of files) {
      if (!/\.(ts|tsx)$/.test(f)) continue;
      const text = readFileSync(join(REPO_ROOT, dir, f), "utf8");
      if (/spendAllocation|SpendAllocationChart|aboveBenchmark|atBenchmark/i.test(text)) {
        offenders.push(`${dir}/${f}`);
      }
    }
  }
  assert.deepEqual(offenders, [], "Competitor Debrief never references Spend Allocation");
}

/* ===================== Compiled real-engine proofs ===================== */

{
  const dist = mkdtempSync(join(tmpdir(), "debrief-spend-allocation-"));
  try {
    execSync(
      `npx tsc modules/debrief/*.ts components/debrief/memoToText.ts --outDir ${JSON.stringify(dist)} --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck --rewriteRelativeImportExtensions`,
      { cwd: REPO_ROOT, stdio: "pipe" }
    );
    const { buildSampleMemo } = require(join(dist, "modules/debrief/sample.js"));
    const { parseCsv, toTable } = require(join(dist, "modules/debrief/csv.js"));
    const { resolveColumns } = require(join(dist, "modules/debrief/columns.js"));
    const { extractAds } = require(join(dist, "modules/debrief/extract.js"));
    const { analyze } = require(join(dist, "modules/debrief/analysis.js"));
    const { generateMemo } = require(join(dist, "modules/debrief/memo.js"));

    /* ---- Sample-dataset reconciliation pin ----
       Hand-computed from sampleCsv.ts's 14-row CSV: judgedSpend
       $3,257.20 (14 - 3 set-aside), median ROAS 2.31 held exactly by
       Lifestyle_BrandVideo_V2 ($288.40) — the odd-count median IS a
       judged ad's own value, so it sits at delta 0 (neither winner nor
       loser under the existing strict >/< pools). Above = the 5 ads
       beating 2.31 ($1,818.15); below = the 5 documented below-
       benchmark ads ($1,150.65, already pinned elsewhere as 35% of
       judged spend). Set-aside = totalSpend $3,385.50 - judgedSpend. */
    const memo = buildSampleMemo();
    const sa = memo.spendAllocation;
    assert.ok(sa != null, "sample carries a non-null spendAllocation");

    assertClose(sa.judgedSpend, 3257.2, "sample judgedSpend");
    assertClose(sa.totalSpend, 3385.5, "sample totalSpend");

    const below = sa.segments.find((s: { id: string }) => s.id === "below");
    const at = sa.segments.find((s: { id: string }) => s.id === "at");
    const above = sa.segments.find((s: { id: string }) => s.id === "above");
    assert.ok(below && at && above, "sample carries all three segments (below/at/above)");
    assertClose(below.spend, 1150.65, "sample belowBenchmarkSpend");
    assert.equal(below.count, 5);
    assert.equal(below.shareLabel, "35%");
    assertClose(at.spend, 288.4, "sample atBenchmarkSpend — Lifestyle_BrandVideo_V2");
    assert.equal(at.count, 1, "exactly one ad sits at the median (odd judged count guarantees this)");
    assert.equal(at.shareLabel, "9%");
    assertClose(above.spend, 1818.15, "sample aboveBenchmarkSpend");
    assert.equal(above.count, 5);
    assert.equal(above.shareLabel, "56%");

    // 1. above + at + below reconciles to judgedSpend.
    assertClose(below.spend + at.spend + above.spend, sa.judgedSpend, "above+at+below === judgedSpend");
    // 2. judgedSpend + setAsideSpend reconciles to totalSpend.
    assert.ok(sa.setAside != null, "sample has set-aside ads");
    assertClose(sa.judgedSpend + sa.setAside.spend, sa.totalSpend, "judgedSpend+setAsideSpend === totalSpend");
    assertClose(sa.setAside.spend, 128.3, "sample setAsideSpend");
    assert.equal(sa.setAside.count, 3);
    assert.equal(sa.setAside.shareOfTotalLabel, "4%");
    // 3. shares derive from judgedSpend, not totalSpend (35% of $3,257.20,
    //    not of $3,385.50 — the two must never be readable as one base).
    assert.ok(
      Math.abs(below.spend / sa.judgedSpend - 0.35325) < 0.001,
      "below share is computed against judgedSpend"
    );

    // 10. Set-aside never participates in the 100% bar: the sum of the
    // three segments alone (excluding setAside entirely) already equals
    // judgedSpend, not totalSpend — proven above. Also confirm no
    // segment carries the set-aside id.
    assert.ok(!sa.segments.some((s: { id: string }) => s.id !== "below" && s.id !== "at" && s.id !== "above"));

    // Headline mentions both numbers, in both registers.
    assert.ok(sa.headline.buyer.includes("56%") && sa.headline.buyer.includes("35%"), "buyer headline states both shares");
    assert.ok(sa.headline.client.includes("56%") && sa.headline.client.includes("35%"), "client headline states both shares");
    assert.ok(!sa.headline.client.includes("benchmark"), "client headline stays jargon-free");
    assert.ok(!sa.headline.client.includes("median"), "client headline never says 'median'");
    for (const word of ["waste", "wasted", "should", "cut", "kill", "scale"]) {
      assert.ok(!sa.headline.buyer.toLowerCase().includes(word), `buyer headline never implies "${word}"`);
      assert.ok(!sa.headline.client.toLowerCase().includes(word), `client headline never implies "${word}"`);
    }

    // TXT export carries one additive, factual line.
    const { memoToText } = require(join(dist, "components/debrief/memoToText.js"));
    const buyerTxt: string = memoToText(memo, "buyer", 5);
    const clientTxt: string = memoToText(memo, "client", 3);
    assert.ok(
      /Spend allocation: 56% above median, 9% at median, 35% below median; \$128\.30 set aside\./.test(buyerTxt),
      "TXT export carries the additive spend-allocation line, buyer register"
    );
    assert.ok(
      clientTxt.includes("Spend allocation: 56% above typical result, 9% at typical result, 35% below typical result"),
      "TXT export client register swaps median -> typical result via clientizeText"
    );

    /* ---- Helper for synthetic engine runs (mirrors decision.test.ts) ---- */
    const ctx = (kpi: string, overrides: Record<string, unknown> = {}) => ({
      kpi,
      product: "",
      offer: "",
      targetCpa: null,
      creativeNotes: "",
      marketContext: "",
      spendGateOverride: null,
      minOutcomeCount: null,
      ...overrides,
    });
    const runEngine = (csv: string, kpi: string, overrides: Record<string, unknown> = {}) => {
      const { headers, rows } = toTable(parseCsv(csv));
      const columns = resolveColumns(headers);
      const ads = extractAds(rows, columns, kpi);
      const analysis = analyze(ads, rows, columns, ctx(kpi, overrides));
      return { analysis, memo: generateMemo(analysis, ctx(kpi, overrides)) };
    };
    const reconciles = (analysis: { aboveBenchmarkSpend: number; atBenchmarkSpend: number; belowBenchmarkSpend: number; judgedSpend: number; totalSpend: number }) => {
      assertClose(
        analysis.aboveBenchmarkSpend + analysis.atBenchmarkSpend + analysis.belowBenchmarkSpend,
        analysis.judgedSpend,
        "above+at+below === judgedSpend"
      );
      assert.ok(analysis.judgedSpend <= analysis.totalSpend + 0.01, "judgedSpend never exceeds totalSpend");
    };

    /* ---- 11. All six KPI modes inherit correct classification with no
       KPI branching in the visual/math layer — reconciliation holds
       identically regardless of which KPI (and polarity) is selected. ---- */
    const roasCsv =
      "Ad name,Amount spent (USD),Purchase ROAS (return on ad spend),Reporting starts,Reporting ends\n" +
      "A,400,5.0,2026-06-01,2026-06-30\nB,360,4.0,2026-06-01,2026-06-30\nC,320,3.0,2026-06-01,2026-06-30\n" +
      "D,280,2.0,2026-06-01,2026-06-30\nE,240,1.5,2026-06-01,2026-06-30\n";
    const cpaCsv =
      "Ad name,Amount spent (USD),Cost per purchase (USD),Reporting starts,Reporting ends\n" +
      "A,400,10.0,2026-06-01,2026-06-30\nB,360,15.0,2026-06-01,2026-06-30\nC,320,20.0,2026-06-01,2026-06-30\n" +
      "D,280,25.0,2026-06-01,2026-06-30\nE,240,30.0,2026-06-01,2026-06-30\n";
    const ctrCsv =
      "Ad name,Amount spent (USD),Impressions,Link clicks,Reporting starts,Reporting ends\n" +
      "A,400,50000,1500,2026-06-01,2026-06-30\nB,360,50000,1200,2026-06-01,2026-06-30\nC,320,50000,900,2026-06-01,2026-06-30\n" +
      "D,280,50000,700,2026-06-01,2026-06-30\nE,240,50000,500,2026-06-01,2026-06-30\n";
    const cpcCsv =
      "Ad name,Amount spent (USD),Link clicks,CPC (cost per link click) (USD),Reporting starts,Reporting ends\n" +
      "A,400,1500,0.27,2026-06-01,2026-06-30\nB,360,1200,0.30,2026-06-01,2026-06-30\nC,320,900,0.36,2026-06-01,2026-06-30\n" +
      "D,280,700,0.40,2026-06-01,2026-06-30\nE,240,500,0.48,2026-06-01,2026-06-30\n";
    const leadsCsv =
      "Ad name,Amount spent (USD),Leads,Reporting starts,Reporting ends\n" +
      "A,400,40,2026-06-01,2026-06-30\nB,360,32,2026-06-01,2026-06-30\nC,320,24,2026-06-01,2026-06-30\n" +
      "D,280,16,2026-06-01,2026-06-30\nE,240,10,2026-06-01,2026-06-30\n";
    const purchasesCsv =
      "Ad name,Amount spent (USD),Purchases,Reporting starts,Reporting ends\n" +
      "A,400,50,2026-06-01,2026-06-30\nB,360,30,2026-06-01,2026-06-30\nC,320,16,2026-06-01,2026-06-30\n" +
      "D,280,8,2026-06-01,2026-06-30\nE,240,5,2026-06-01,2026-06-30\n";
    for (const [kpi, csv] of [
      ["roas", roasCsv],
      ["cpa", cpaCsv],
      ["ctr", ctrCsv],
      ["cpc", cpcCsv],
      ["leads", leadsCsv],
      ["purchases", purchasesCsv],
    ] as const) {
      const { analysis, memo: m } = runEngine(csv, kpi);
      reconciles(analysis);
      assert.ok(m.spendAllocation != null, `${kpi}: spendAllocation renders when there's judged spend`);
    }

    /* ---- 8. Absent categories are omitted, not fake zero-width segments. ---- */

    // No losers: [1,1,1,1,5] -> median (5 values, odd) = sorted[2] = 1.
    // Four ads sit exactly at 1 (neutral), one ad at 5 (above). No ad
    // is below 1, so the below segment is entirely absent.
    const noLosersCsv =
      "Ad name,Amount spent (USD),Purchase ROAS (return on ad spend),Reporting starts,Reporting ends\n" +
      "A,400,1.0,2026-06-01,2026-06-30\nB,360,1.0,2026-06-01,2026-06-30\nC,320,1.0,2026-06-01,2026-06-30\n" +
      "D,280,1.0,2026-06-01,2026-06-30\nE,240,5.0,2026-06-01,2026-06-30\n";
    {
      const { analysis, memo: m } = runEngine(noLosersCsv, "roas");
      assert.equal(analysis.belowBenchmarkCount, 0, "no ad sits below the median in this fixture");
      reconciles(analysis);
      assert.ok(!m.spendAllocation.segments.some((s: { id: string }) => s.id === "below"), "below segment omitted, not zero-width");
      assert.ok(m.spendAllocation.segments.some((s: { id: string }) => s.id === "at"), "at segment present");
      assert.ok(m.spendAllocation.segments.some((s: { id: string }) => s.id === "above"), "above segment present");
    }

    // No winners: [1,5,5,5,5] -> median = sorted[2] = 5. Four ads sit
    // exactly at 5 (neutral), one ad at 1 (below). No ad exceeds 5, so
    // the above segment is entirely absent.
    const noWinnersCsv =
      "Ad name,Amount spent (USD),Purchase ROAS (return on ad spend),Reporting starts,Reporting ends\n" +
      "A,400,1.0,2026-06-01,2026-06-30\nB,360,5.0,2026-06-01,2026-06-30\nC,320,5.0,2026-06-01,2026-06-30\n" +
      "D,280,5.0,2026-06-01,2026-06-30\nE,240,5.0,2026-06-01,2026-06-30\n";
    {
      const { analysis, memo: m } = runEngine(noWinnersCsv, "roas");
      assert.equal(analysis.aboveBenchmarkCount, 0, "no ad sits above the median in this fixture");
      reconciles(analysis);
      assert.ok(!m.spendAllocation.segments.some((s: { id: string }) => s.id === "above"), "above segment omitted, not zero-width");
      assert.ok(
        !m.spendAllocation.headline.buyer.includes("no ad separated above or below"),
        "a present below segment produces a real headline clause, not the all-neutral fallback"
      );
      assert.ok(m.spendAllocation.headline.buyer.includes("below-benchmark"), "headline states the below-benchmark clause");
    }

    // All ads exactly at the median: one neutral bar, nothing else.
    const allFlatCsv =
      "Ad name,Amount spent (USD),Purchase ROAS (return on ad spend),Reporting starts,Reporting ends\n" +
      "A,400,2.0,2026-06-01,2026-06-30\nB,360,2.0,2026-06-01,2026-06-30\nC,320,2.0,2026-06-01,2026-06-30\n" +
      "D,280,2.0,2026-06-01,2026-06-30\nE,240,2.0,2026-06-01,2026-06-30\n";
    {
      const { analysis, memo: m } = runEngine(allFlatCsv, "roas");
      assert.equal(analysis.aboveBenchmarkCount, 0);
      assert.equal(analysis.belowBenchmarkCount, 0);
      assert.equal(analysis.atBenchmarkCount, 5, "all five judged ads sit exactly at the median");
      reconciles(analysis);
      assert.equal(m.spendAllocation.segments.length, 1, "only the neutral segment renders");
      assert.equal(m.spendAllocation.segments[0].id, "at");
      assert.ok(
        m.spendAllocation.headline.buyer.includes("sits at the median — no ad separated above or below"),
        "all-neutral fixture uses the dedicated fallback headline"
      );
      assert.ok(
        m.spendAllocation.headline.client.includes("sits at the account's typical result"),
        "all-neutral client fallback headline"
      );
    }

    /* ---- 7. Zero judged spend -> null spendAllocation. ---- */
    const noJudgedCsv =
      "Ad name,Amount spent (USD),Purchase ROAS (return on ad spend),Reporting starts,Reporting ends\n" +
      "A,2,2.0,2026-06-01,2026-06-30\nB,1,3.0,2026-06-01,2026-06-30\n";
    {
      const { analysis, memo: m } = runEngine(noJudgedCsv, "roas");
      assert.equal(analysis.adsJudged, 0, "both ads fall below the spend gate");
      assert.equal(analysis.judgedSpend, 0);
      assert.equal(m.spendAllocation, null, "no judged spend -> spendAllocation renders nothing");
    }

    /* ---- 1–4 judged ads: chart may still render; the memo's own
       evidence limits stay the authoritative honesty signal (this test
       only confirms spendAllocation itself still reconciles, not that
       it duplicates or overrides the existing limits copy). ---- */
    const thinCsv =
      "Ad name,Amount spent (USD),Purchase ROAS (return on ad spend),Reporting starts,Reporting ends\n" +
      "A,200,4.0,2026-06-01,2026-06-30\nB,180,2.0,2026-06-01,2026-06-30\nC,160,1.0,2026-06-01,2026-06-30\n";
    {
      const { analysis, memo: m } = runEngine(thinCsv, "roas");
      assert.ok(analysis.adsJudged >= 1 && analysis.adsJudged < 5, "fixture stays under the 5-ad decision minimum");
      reconciles(analysis);
      assert.ok(m.spendAllocation != null, "thin sample still renders — same discipline as Performance Ranking");
      assert.equal(m.decision.action, "hold", "the committed decision still gates on adsJudged, unaffected by spendAllocation");
    }
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
}

console.log("spendAllocation: all engine-reconciliation proofs passed");
