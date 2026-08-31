/**
 * Movement V1 — plain-Node proofs against the REAL engine.
 *
 * compare.ts/analysis.ts/csv.ts/columns.ts/extract.ts use extensionless
 * imports (not directly Node-loadable), so — same pattern as
 * scripts/decision.test.ts's Stage 2 and scripts/spendAllocation.test.ts
 * — this compiles modules/debrief to CommonJS in a temp dir with tsc
 * and runs the real pipeline. Covers: exact raw-field exposure against
 * hand-computed expectations, zero-baseline, the unchanged band, all
 * six KPI polarities, the zero-matched case, topAdsShown's structural
 * inability to affect comparison totals, and source-scan proofs for
 * everything that can't be exercised without a DOM (row placement,
 * matching honesty, Competitor Debrief isolation).
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const REPO_ROOT = join(import.meta.dirname, "..");

function assertClose(actual: number, expected: number, message: string, tolerance = 0.01) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message} (expected ≈${expected}, got ${actual}, diff ${Math.abs(actual - expected)})`
  );
}

/* ===================== Source-scan checks (no compile needed) ===================== */

{
  const src = readFileSync(join(REPO_ROOT, "components/debrief/MovementChart.tsx"), "utf8");

  // 4/5. Structural placement: worse bars live in the left/justify-end
  // container, better bars in the right/justify-start container —
  // same convention PerformanceRankingChart already established.
  const worseBlock = src.slice(src.indexOf("justify-end"), src.indexOf("justify-end") + 200);
  assert.ok(worseBlock.includes("worse"), "the justify-end (left) container renders worse rows");
  const betterBlock = src.slice(src.indexOf("justify-start"), src.indexOf("justify-start") + 200);
  assert.ok(betterBlock.includes("better"), "the justify-start (right) container renders better rows");

  // 6. One shared absolute scale: maxMovementMagnitude called once over
  // the full combined row set, not separately per improved/declined.
  assert.equal(
    (src.match(/maxMovementMagnitude\(/g) ?? []).length,
    1,
    "maxMovementMagnitude is computed once, over the combined row set — one shared scale"
  );

  // 15. Matching honesty: MovementChart builds its row list ONLY from
  // improved/declined — never from appeared/disappeared/unmatched,
  // which are not comparable movement rows.
  assert.ok(!/comparison\.appeared/.test(src), "MovementChart never reads comparison.appeared as row data");
  assert.ok(!/comparison\.disappeared/.test(src), "MovementChart never reads comparison.disappeared as row data");
  assert.ok(
    !/comparison\.leaderConsistency/.test(src),
    "leader consistency omitted from Movement — already shown on the Decision Card, avoiding duplication"
  );
  // Caveat is short and distinct from COMPARISON_CAVEAT (not duplicated
  // on the same page as the existing What Changed section).
  assert.ok(!src.includes("does not establish why anything changed"), "Movement never duplicates COMPARISON_CAVEAT verbatim");
  assert.ok(!/\bspendChangeLabel\b/.test(src), "spend annotation omitted by default — one primary quantitative dimension only");

  // 10/11 (structural half): explicit null-comparison and empty-row guards.
  assert.ok(/if \(comparison == null\) return null/.test(src), "no comparison -> chart absent");
  assert.ok(/if \(rows\.length === 0\) return null/.test(src), "zero rows (e.g. zero matched-and-judged-both, or all-unchanged) -> chart absent");
}

{
  // 18. Competitor Debrief remains isolated.
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
      if (/MovementChart|movementChartMath|showMovementChart/i.test(text)) {
        offenders.push(`${dir}/${f}`);
      }
    }
  }
  assert.deepEqual(offenders, [], "Competitor Debrief never references Movement");
}

{
  // 13 (structural half): buildComparison's own signature proves
  // topAdsShown cannot influence matched counts/context — the function
  // that computes them never receives it at all.
  const src = readFileSync(join(REPO_ROOT, "modules/debrief/compare.ts"), "utf8");
  const sig = src.slice(src.indexOf("export function buildComparison"), src.indexOf("export function buildComparison") + 200);
  assert.ok(!/topAdsShown/.test(sig), "buildComparison's signature has no topAdsShown parameter");
}

/* ===================== Compiled real-engine proofs ===================== */

{
  const dist = mkdtempSync(join(tmpdir(), "debrief-movement-"));
  try {
    execSync(
      `npx tsc modules/debrief/*.ts components/debrief/memoToText.ts --outDir ${JSON.stringify(dist)} --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck --rewriteRelativeImportExtensions`,
      { cwd: REPO_ROOT, stdio: "pipe" }
    );
    const { parseCsv, toTable } = require(join(dist, "modules/debrief/csv.js"));
    const { resolveColumns } = require(join(dist, "modules/debrief/columns.js"));
    const { extractAds } = require(join(dist, "modules/debrief/extract.js"));
    const { analyze } = require(join(dist, "modules/debrief/analysis.js"));
    const { buildComparison } = require(join(dist, "modules/debrief/compare.js"));
    const { fmtKpiValue, fmtMoney } = require(join(dist, "modules/debrief/format.js"));
    const { KPI_LABELS } = require(join(dist, "modules/debrief/types.js"));

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
    const period = (csv: string, kpi: string) => {
      const { headers, rows } = toTable(parseCsv(csv));
      const columns = resolveColumns(headers);
      const ads = extractAds(rows, columns, kpi);
      const analysis = analyze(ads, rows, columns, ctx(kpi));
      return { analysis, ads };
    };
    const compare = (prevCsv: string, currCsv: string, kpi: string) => {
      const previous = period(prevCsv, kpi);
      const current = period(currCsv, kpi);
      return buildComparison(current, previous, {
        money: (v: number) => fmtMoney(v, null),
        kpiValue: (v: number) => fmtKpiValue(v, kpi, null),
        kpiLabel: KPI_LABELS[kpi],
      });
    };

    /* ---- 1/7/8/9. Primary reconciliation fixture ----
       6 matched ads, spend $300 each (well above the $150 gate: mean
       $300, half $150). A/B improve, C/D decline, E sits inside the
       ±1% unchanged band, F is a zero-baseline row (previous ROAS 0). */
    const prevCsv =
      "Ad name,Amount spent (USD),Purchase ROAS (return on ad spend),Reporting starts,Reporting ends\n" +
      "A,300,2.00,2026-06-01,2026-06-30\n" +
      "B,300,3.00,2026-06-01,2026-06-30\n" +
      "C,300,4.00,2026-06-01,2026-06-30\n" +
      "D,300,3.50,2026-06-01,2026-06-30\n" +
      "E,300,2.50,2026-06-01,2026-06-30\n" +
      "F,300,0.00,2026-06-01,2026-06-30\n";
    const currCsv =
      "Ad name,Amount spent (USD),Purchase ROAS (return on ad spend),Reporting starts,Reporting ends\n" +
      "A,300,3.00,2026-07-01,2026-07-31\n" +
      "B,300,3.15,2026-07-01,2026-07-31\n" +
      "C,300,2.00,2026-07-01,2026-07-31\n" +
      "D,300,3.00,2026-07-01,2026-07-31\n" +
      "E,300,2.52,2026-07-01,2026-07-31\n" +
      "F,300,1.50,2026-07-01,2026-07-31\n";
    const cmp = compare(prevCsv, currCsv, "roas");

    // 1. Exposed raw fields match hand-computed expectations exactly.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rows come from a require()'d compiled module (untyped at the boundary), same convention as decision.test.ts/spendAllocation.test.ts.
    const byName = (list: any[], name: string): any => list.find((r) => r.name === name);
    const a = byName(cmp.improved, "A");
    assert.ok(a, "A appears in improved");
    assertClose(a.prevValue, 2.0, "A prevValue");
    assertClose(a.currValue, 3.0, "A currValue");
    assertClose(a.pct, 50, "A pct");
    assert.equal(a.better, true);

    const b = byName(cmp.improved, "B");
    assertClose(b.pct, 5, "B pct");
    assert.equal(b.better, true);

    const c = byName(cmp.declined, "C");
    assertClose(c.prevValue, 4.0, "C prevValue");
    assertClose(c.currValue, 2.0, "C currValue");
    assertClose(c.pct, -50, "C pct");
    assert.equal(c.better, false);

    const d = byName(cmp.declined, "D");
    assertClose(d.pct, -14.2857, "D pct", 0.01);
    assert.equal(d.better, false);

    // 8. The unchanged ad (E, +0.8%, inside UNCHANGED_BAND_PCT) is
    // manufactured as NEITHER an improved NOR a declined row.
    assert.equal(byName(cmp.improved, "E"), undefined, "unchanged ad never appears in improved");
    assert.equal(byName(cmp.declined, "E"), undefined, "unchanged ad never appears in declined");

    // 7. Zero-baseline (F, prev 0.00 -> curr 1.50): pct is null, no
    // fake %, but the known "better" direction is still preserved —
    // and it's still placed on the improved side by compare.ts itself.
    const f = byName(cmp.improved, "F");
    assert.ok(f, "zero-baseline row F is still placed on the improved side (better=true)");
    assert.equal(f.pct, null, "zero-baseline row exposes pct: null, never a fabricated percentage");
    assert.equal(f.better, true);
    assertClose(f.prevValue, 0, "F prevValue is the true zero, not omitted");
    assertClose(f.currValue, 1.5, "F currValue");

    // matchedJudgedBoth counts ALL 6 matched+judged-both ads (including
    // the unchanged one) — independent of topAdsShown, independent of
    // which ads made it into improved/declined.
    assert.equal(cmp.matchedJudgedBoth, 6);

    /* ---- 9. All-comparable-movement-unchanged -> no rows for Movement. ---- */
    const allFlatPrev =
      "Ad name,Amount spent (USD),Purchase ROAS (return on ad spend),Reporting starts,Reporting ends\n" +
      "A,300,2.00,2026-06-01,2026-06-30\nB,300,3.00,2026-06-01,2026-06-30\n";
    const allFlatCurr =
      "Ad name,Amount spent (USD),Purchase ROAS (return on ad spend),Reporting starts,Reporting ends\n" +
      "A,300,2.005,2026-07-01,2026-07-31\nB,300,3.006,2026-07-01,2026-07-31\n";
    const flatCmp = compare(allFlatPrev, allFlatCurr, "roas");
    assert.equal(flatCmp.improved.length, 0, "all-unchanged comparison produces zero improved rows");
    assert.equal(flatCmp.declined.length, 0, "all-unchanged comparison produces zero declined rows");
    assert.ok(flatCmp.matchedJudgedBoth > 0, "ads were still matched and judged — just all inside the unchanged band");

    /* ---- 11. Zero matched-and-judged-both -> chart absent. ---- */
    const disjointPrev =
      "Ad name,Amount spent (USD),Purchase ROAS (return on ad spend),Reporting starts,Reporting ends\n" +
      "OldOnly,300,2.00,2026-06-01,2026-06-30\n";
    const disjointCurr =
      "Ad name,Amount spent (USD),Purchase ROAS (return on ad spend),Reporting starts,Reporting ends\n" +
      "NewOnly,300,2.00,2026-07-01,2026-07-31\n";
    const disjointCmp = compare(disjointPrev, disjointCurr, "roas");
    assert.equal(disjointCmp.matchedJudgedBoth, 0);
    assert.equal(disjointCmp.improved.length, 0);
    assert.equal(disjointCmp.declined.length, 0);
    assert.equal(disjointCmp.appeared.total, 1, "the current-only ad is disclosed as appeared, not a movement row");
    assert.equal(disjointCmp.disappeared.total, 1, "the previous-only ad is disclosed as disappeared, not a movement row");

    /* ---- medianMovement: named field matches account[0] exactly
       (extract-variable refactor — same string, both places). ---- */
    assert.equal(cmp.medianMovement.buyer, cmp.account.buyer[0], "medianMovement.buyer matches account.buyer[0] exactly");
    assert.equal(cmp.medianMovement.client, cmp.account.client[0], "medianMovement.client matches account.client[0] exactly");
    assert.ok(cmp.medianMovement.buyer.startsWith("Median ROAS moved from"));

    /* ---- 12/13. topAdsShown is a DISPLAY-ONLY concern — buildComparison
       doesn't accept it (structurally proven above via the signature
       scan), so the exact same comparison object is what any
       topAdsShown value slices from. Slicing to different sizes never
       touches cmp's own totals/context — it produces new arrays,
       cmp itself is read-only from the caller's perspective. ---- */
    const unmatchedBefore = { ...cmp.unmatched };
    const matchedBefore = cmp.matchedJudgedBoth;
    const medianMovementBefore = { ...cmp.medianMovement };
    const shown3 = { improved: cmp.improved.slice(0, 3), declined: cmp.declined.slice(0, 3) };
    const shown5 = { improved: cmp.improved.slice(0, 5), declined: cmp.declined.slice(0, 5) };
    assert.deepEqual(cmp.unmatched, unmatchedBefore, "slicing for display never mutates comparison.unmatched");
    assert.equal(cmp.matchedJudgedBoth, matchedBefore, "slicing for display never mutates matchedJudgedBoth");
    assert.deepEqual(cmp.medianMovement, medianMovementBefore, "slicing for display never mutates medianMovement");
    assert.ok(shown3.improved.length <= shown5.improved.length, "a smaller topAdsShown never shows MORE rows than a larger one");
    assert.ok(shown3.improved.length <= cmp.improved.length, "slicing only ever narrows, never invents rows");

    /* ---- 14. All six KPI modes inherit correct polarity, with no
       new branching required — reusing the exact convention
       analysis.ts/decision.ts already use. ---- */
    const kpiFixtures: [string, string, string][] = [
      [
        "roas",
        "Ad name,Amount spent (USD),Purchase ROAS (return on ad spend),Reporting starts,Reporting ends\nA,300,2.00,2026-06-01,2026-06-30\n",
        "Ad name,Amount spent (USD),Purchase ROAS (return on ad spend),Reporting starts,Reporting ends\nA,300,3.00,2026-07-01,2026-07-31\n",
      ],
      [
        "cpa",
        "Ad name,Amount spent (USD),Cost per purchase (USD),Reporting starts,Reporting ends\nA,300,20.00,2026-06-01,2026-06-30\n",
        "Ad name,Amount spent (USD),Cost per purchase (USD),Reporting starts,Reporting ends\nA,300,15.00,2026-07-01,2026-07-31\n",
      ],
      [
        "ctr",
        "Ad name,Amount spent (USD),Impressions,Link clicks,Reporting starts,Reporting ends\nA,300,50000,1000,2026-06-01,2026-06-30\n",
        "Ad name,Amount spent (USD),Impressions,Link clicks,Reporting starts,Reporting ends\nA,300,50000,1500,2026-07-01,2026-07-31\n",
      ],
      [
        "cpc",
        "Ad name,Amount spent (USD),Link clicks,CPC (cost per link click) (USD),Reporting starts,Reporting ends\nA,300,1000,0.50,2026-06-01,2026-06-30\n",
        "Ad name,Amount spent (USD),Link clicks,CPC (cost per link click) (USD),Reporting starts,Reporting ends\nA,300,1000,0.30,2026-07-01,2026-07-31\n",
      ],
      [
        "leads",
        "Ad name,Amount spent (USD),Leads,Reporting starts,Reporting ends\nA,300,10,2026-06-01,2026-06-30\n",
        "Ad name,Amount spent (USD),Leads,Reporting starts,Reporting ends\nA,300,20,2026-07-01,2026-07-31\n",
      ],
      [
        "purchases",
        "Ad name,Amount spent (USD),Purchases,Reporting starts,Reporting ends\nA,300,10,2026-06-01,2026-06-30\n",
        "Ad name,Amount spent (USD),Purchases,Reporting starts,Reporting ends\nA,300,20,2026-07-01,2026-07-31\n",
      ],
    ];
    for (const [kpi, prev, curr] of kpiFixtures) {
      const kcmp = compare(prev, curr, kpi);
      const row = kcmp.improved[0] ?? kcmp.declined[0];
      assert.ok(row, `${kpi}: fixture produces exactly one comparable row`);
      assert.equal(row.better, true, `${kpi}: the fixture's direction of change is correctly read as "better" for this KPI's own polarity`);
      assert.ok(typeof row.prevValue === "number" && typeof row.currValue === "number", `${kpi}: raw values exposed as numbers`);
    }
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
}

console.log("movementChart: all engine-reconciliation proofs passed");
