/**
 * First-Run Fixes — proofs.
 *
 * 1. A hold caused by ads with no KPI value names that cause (with
 *    counts) instead of blaming the spend gate; the hold itself, every
 *    number, and the decision are unchanged.
 * 2. The KPI follows the data after a load, never over a manual choice.
 * 3. Product / industry is optional.
 * 4–6. Generator/Meta UI wiring (source scans — no render harness here,
 *    see CLAUDE.md).
 *
 * decision.ts and kpi-free fixtures run under plain Node; the real
 * engine (columns/extract/analysis/memo) is compiled to a temp dir like
 * the other real-engine suites.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDecision } from "../modules/debrief/decision.ts";
import { insightsToCsv } from "../modules/meta/insightsToCsv.ts";
import type { AnalysisResult, KpiGaps, MemoDecision, RankedAd } from "../modules/debrief/types.ts";

const require = createRequire(import.meta.url);
const ROOT = join(import.meta.dirname, "..");
const money = (v: number) => `$${v.toFixed(2)}`;
const CLIENT_BANNED = ["kill", "gate", "benchmark", "median", "judged"];

function ad(name: string, spend: number, deltaPct: number): RankedAd {
  return { name, spend, kpiValue: 1, nameTags: [], gate: "judged", deltaFromMedian: deltaPct, deltaPct };
}
function fixture(o: Partial<AnalysisResult>): AnalysisResult {
  return {
    kpi: "roas", adsAnalyzed: 10, adsJudged: 8, adsSetAside: 2, totalSpend: 1200, judgedSpend: 1000,
    currency: null, dateRange: null, spendGate: 100, spendGateBasis: "floor_or_mean", median: 2,
    winners: [], losers: [], rankedAds: [], belowBenchmarkSpend: 0, belowBenchmarkCount: 0,
    aboveBenchmarkSpend: 0, aboveBenchmarkCount: 0, atBenchmarkSpend: 0, atBenchmarkCount: 0,
    hasNameSignal: false, hasCreativeNotes: false, missingColumns: [], duplicateAdNames: [],
    ...o,
  };
}
function clientClean(d: MemoDecision, label: string) {
  const text = [d.clientHeadline, d.clientRationale, ...d.avoidNow.client, d.reassess.client, ...d.limits.client]
    .join(" ")
    .toLowerCase();
  for (const w of CLIENT_BANNED) assert.ok(!text.includes(w), `${label}: client copy free of "${w}"`);
  assert.ok(/\d/.test(d.reassess.buyer) && /\d/.test(d.reassess.client), `${label}: reassess stays numeric`);
}

/* ===================== 1. Hold wording: spend gate vs no value vs both ===================== */
{
  const hold = { adsJudged: 2, adsSetAside: 8, winners: [ad("W", 200, 40)], losers: [ad("L", 200, -40)] };

  // Spend gate only (no kpiGaps) — byte-identical to the pre-change wording.
  const gateOnly = buildDecision(fixture(hold), "Test.", money);
  assert.equal(gateOnly.headline, "Hold — 2 of 10 ads cleared the $100.00 spend gate; this call needs 5.");
  assert.equal(gateOnly.clientHeadline, "Hold — most ads haven't had enough spend to judge fairly yet.");
  assert.ok(gateOnly.limits.buyer.includes(
    "8 ads had too little spend to judge and were set aside — no conclusion is drawn about them either way."
  ), "spend-only limits line unchanged");

  // No value only, every ad — the lead-gen-with-ROAS case.
  const none: KpiGaps = { setAsideNoValue: 8, noValue: 10, zeroOutcome: 0, belowGateWithValue: 0, suggestedKpi: "cpa" };
  const noValue = buildDecision(fixture({ ...hold, adsJudged: 0, adsSetAside: 10, kpiGaps: none }), "Test.", money);
  assert.equal(noValue.headline, "Hold — none of the 10 ads has a ROAS value in this export. Try CPA.");
  assert.equal(
    noValue.clientHeadline,
    "Hold — none of the 10 ads has a ROAS figure in this file, so there isn't enough to compare yet. Switching the report to CPA would use the results this file does have."
  );
  assert.ok(!noValue.headline.includes("spend gate"), "no-value hold never blames the spend gate");
  assert.ok(noValue.limits.buyer.includes(
    "10 ads had no ROAS value in the export — set aside, so no conclusion is drawn about them either way."
  ));
  assert.ok(noValue.limits.client.includes("10 ads had no ROAS figure in the file, so they're not part of this read."));
  assert.ok(!noValue.limits.buyer.some((l) => l.includes("too little spend")), "no spend claim for no-value ads");
  clientClean(noValue, "no-value");

  // Some (not all) without a value.
  const some = buildDecision(
    fixture({ ...hold, kpiGaps: { setAsideNoValue: 6, noValue: 6, zeroOutcome: 0, belowGateWithValue: 0, suggestedKpi: null } }),
    "Test.", money
  );
  assert.equal(some.headline, "Hold — 6 of 10 ads have no ROAS value in this export.");

  // Both causes, with counts.
  const both = buildDecision(
    fixture({ ...hold, kpiGaps: { setAsideNoValue: 5, noValue: 6, zeroOutcome: 0, belowGateWithValue: 2, suggestedKpi: null } }),
    "Test.", money
  );
  assert.equal(
    both.headline,
    "Hold — only 2 of 10 ads could be judged: 6 have no ROAS value in this export, and 2 more didn't clear the $100.00 spend gate. This call needs 5."
  );
  assert.equal(
    both.clientHeadline,
    "Hold — 6 of 10 ads have no ROAS figure in this file, and 2 more haven't had enough spend to compare fairly, so there isn't enough to compare yet."
  );
  assert.ok(both.limits.buyer.includes(
    "6 ads had no ROAS value in the export, and 2 had too little spend to judge — set aside, so no conclusion is drawn about them either way."
  ));
  clientClean(both, "both");

  // CPA with zero-purchase ads: "can't be computed", not "missing".
  const cpa = buildDecision(
    fixture({ ...hold, kpi: "cpa", kpiGaps: { setAsideNoValue: 4, noValue: 4, zeroOutcome: 4, belowGateWithValue: 1, suggestedKpi: null } }),
    "Test.", money
  );
  assert.equal(
    cpa.headline,
    "Hold — only 2 of 10 ads could be judged: 4 had no purchases, so CPA can't be computed for them, and 1 more didn't clear the $100.00 spend gate. This call needs 5."
  );
  assert.ok(!cpa.headline.includes("no CPA value"), "zero purchases is never reported as a missing value");
  assert.ok(cpa.clientHeadline.includes("4 ads had no purchases yet, so their CPA can't be worked out"));
  clientClean(cpa, "cpa-zero");

  // The decision itself is untouched by the wording: same action, hold
  // reason, evidence state, rationale, avoidNow, criteria.
  for (const [label, d] of [["no-value", noValue], ["both", both], ["cpa", cpa]] as const) {
    const base = buildDecision(fixture({ ...hold, ...(label === "no-value" ? { adsJudged: 0, adsSetAside: 10 } : {}), ...(label === "cpa" ? { kpi: "cpa" as const } : {}) }), "Test.", money);
    for (const k of ["action", "holdReason", "budgetVariant", "evidenceState", "evidenceShape", "rationale", "avoidNow", "appliedCriteria", "nextControlledTest"] as const) {
      assert.deepEqual(d[k], base[k], `${label}: ${k} unchanged by kpiGaps`);
    }
  }

  // A non-hold decision with some no-value ads: action and headline
  // unchanged; only the set-aside limits line is re-worded.
  const budgetBase = fixture({
    adsJudged: 8, winners: [ad("W", 300, 45)], losers: [ad("L1", 200, -40), ad("L2", 150, -33)],
    judgedSpend: 1000, belowBenchmarkSpend: 350, belowBenchmarkCount: 2,
  });
  const budget = buildDecision({ ...budgetBase, kpiGaps: { setAsideNoValue: 1, noValue: 1, zeroOutcome: 0, belowGateWithValue: 1, suggestedKpi: null } }, "Test.", money);
  const budgetPlain = buildDecision(budgetBase, "Test.", money);
  assert.equal(budget.action, "budget");
  assert.equal(budget.headline, budgetPlain.headline, "non-hold headline untouched");
  assert.ok(budget.limits.buyer.includes(
    "1 ad had no ROAS value in the export, and 1 had too little spend to judge — set aside, so no conclusion is drawn about them either way."
  ));
  clientClean(budget, "budget-with-gaps");
  console.log("firstRunFixes: hold wording — spend gate / no value / both / CPA zero purchases; decision unchanged");
}

/* ===================== 2. Real engine: Meta lead-gen, CPA zero purchases, auto-switch ===================== */
const dist = mkdtempSync(join(tmpdir(), "debrief-firstrun-"));
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
  const { kpiUsability, chooseAutoKpi, sparseKpiWarning } = require(join(dist, "modules/debrief/kpiUsability.js"));
  const { buildSampleMemo } = require(join(dist, "modules/debrief/sample.js"));
  const { SAMPLE_CSV_TEXT } = require(join(dist, "modules/debrief/sampleCsv.js"));
  const { memoToText } = require(join(dist, "components/debrief/memoToText.js"));

  const ctx = (kpi: string, product = "") => ({ kpi, product, offer: "", targetCpa: null, creativeNotes: "", marketContext: "" });
  const table = (csv: string) => toTable(parseCsv(csv));
  const run = (csv: string, kpi: string, product = "") => {
    const { headers, rows } = table(csv);
    const columns = resolveColumns(headers);
    const analysis = analyze(extractAds(rows, columns, kpi), rows, columns, ctx(kpi, product));
    return { analysis, memo: generateMemo(analysis, ctx(kpi, product)), columns, rows };
  };

  // Meta virtual CSV for a lead-gen account: ROAS column present, empty.
  const metaRows = Array.from({ length: 14 }, (_, i) => ({
    adName: `LeadAd_${i}`, spend: String(100 + i * 37), impressions: "9000", linkClicks: "120",
    ctr: "1.3", cpc: "0.9", purchases: "", purchaseValue: "", purchaseRoas: "", costPerPurchase: "",
    leads: String(3 + ((i * 7) % 25)), costPerLead: "", dateStart: "2026-08-01", dateStop: "2026-08-31",
    cpm: "11", addToCart: "", contentViews: "",
  }));
  const metaCsv = insightsToCsv(metaRows, "EUR");
  {
    const { analysis, memo } = run(metaCsv, "roas");
    assert.equal(analysis.adsJudged, 0);
    assert.equal(analysis.kpiGaps.noValue, 14);
    assert.equal(analysis.kpiGaps.suggestedKpi, "leads",
      "lead-gen export: suggests Leads, not purchase-framed CPA");
    assert.equal(
      analysis.adsJudged + analysis.kpiGaps.noValue + analysis.kpiGaps.belowGateWithValue,
      analysis.adsAnalyzed,
      "the set-aside partition covers every ad exactly once"
    );
    assert.equal(memo.decision.action, "hold");
    assert.equal(memo.decision.holdReason, "insufficient_data", "same hold the engine always reached");
    assert.equal(memo.decision.headline, "Hold — none of the 14 ads has a ROAS value in this export. Try Leads.");
    assert.deepEqual(memo.scope.setAsideBreakdown, { spend: 0, noValue: 14 });
    for (const view of ["buyer", "client"] as const) {
      const text = memoToText(memo, view);
      assert.ok(!/had too little spend|hadn't spent enough|haven't spent enough/.test(text), `${view} text never blames spend for no-value ads`);
    }

    // Auto-switch: ROAS has a column but no values -> first usable KPI.
    const { headers, rows } = table(metaCsv);
    const u = kpiUsability(rows, resolveColumns(headers));
    assert.equal(u.roas.hasColumns, true);
    assert.equal(u.roas.withValue, 0);
    assert.equal(u.roas.usable, false);
    assert.equal(chooseAutoKpi("roas", u, false), "leads", "Meta lead-gen: switches off empty ROAS to Leads");
    assert.equal(u.cpa.usable, true, "CPA has values (spend ÷ leads) …");
    assert.equal(u.purchases.usable, false, "… but no purchases back it, so it isn't auto-picked");
    assert.equal(chooseAutoKpi("roas", u, true), null, "a manual ROAS choice is never overridden");
    assert.equal(chooseAutoKpi("leads", u, false), null, "a usable current KPI is kept");
    assert.equal(sparseKpiWarning(u.roas, "ROAS"),
      "No ROAS values in this export — every ad would be set aside. Pick a KPI this export has values for.");
    // After switching, the decision really has data to work with.
    const switched = run(metaCsv, "leads");
    assert.equal(switched.analysis.kpiGaps, undefined, "switched KPI has values for every ad");
    assert.ok(switched.analysis.adsJudged > 0);
  }

  // CSV lead-gen export without any ROAS column.
  {
    const leadsCsv =
      "Ad name,Amount spent (EUR),Leads,Cost per lead (EUR)\n" +
      Array.from({ length: 8 }, (_, i) => `L${i},${200 + i * 30},${5 + i},${((200 + i * 30) / (5 + i)).toFixed(2)}`).join("\n") + "\n";
    const { headers, rows } = table(leadsCsv);
    const u = kpiUsability(rows, resolveColumns(headers));
    assert.equal(u.roas.hasColumns, false);
    assert.equal(chooseAutoKpi("roas", u, false), "leads", "CSV lead-gen export with no ROAS column: switches to Leads");
    assert.equal(chooseAutoKpi("roas", u, true), null, "manual choice kept even when unusable");
  }

  // Purchase export without a ROAS column: CPA is purchase-backed -> CPA.
  {
    const purchCsv =
      "Ad name,Amount spent (EUR),Purchases,Cost per purchase (EUR)\n" +
      Array.from({ length: 8 }, (_, i) => `P${i},${200 + i * 30},${2 + i},${((200 + i * 30) / (2 + i)).toFixed(2)}`).join("\n") + "\n";
    const { headers, rows } = table(purchCsv);
    assert.equal(chooseAutoKpi("roas", kpiUsability(rows, resolveColumns(headers)), false), "cpa",
      "purchase export without ROAS: switches to CPA");
  }

  // Sample: ROAS usable, never switches; no kpiGaps anywhere.
  {
    const { headers, rows } = table(SAMPLE_CSV_TEXT);
    const u = kpiUsability(rows, resolveColumns(headers));
    assert.equal(chooseAutoKpi("roas", u, false), null, "the sample never triggers a switch");
    const sample = buildSampleMemo();
    assert.equal(sample.scope.setAsideBreakdown, undefined, "sample memo carries no breakdown key");
    assert.ok(!memoToText(sample, "buyer").includes("value in this export"));
  }

  // CPA with zero-purchase ads (real zeros, cost column blank where 0).
  {
    let csv = "Ad name,Amount spent (USD),Purchases,Cost per purchase (USD)\n";
    [["A", 400, 8], ["B", 380, 0], ["C", 360, 6], ["D", 340, 0], ["E", 320, 0], ["F", 300, 4], ["G", 280, 0], ["H", 260, 3], ["I", 50, 1]]
      .forEach(([n, s, p]) => (csv += `${n},${s},${p},${p ? ((s as number) / (p as number)).toFixed(2) : ""}\n`));
    const cpa = run(csv, "cpa");
    assert.equal(cpa.analysis.kpiGaps.zeroOutcome, 4, "zero-purchase ads recognised as zero outcomes");
    assert.ok(cpa.memo.decision.headline.includes("4 had no purchases, so CPA can't be computed for them"));
    // For the Purchases KPI, zero IS a value: the same ads are judged, no gaps.
    const purchases = run(csv, "purchases");
    assert.equal(purchases.analysis.kpiGaps, undefined, "zero purchases is a real value for a count KPI");
    assert.ok(purchases.analysis.adsJudged >= 8);
  }

  // Product optional: the engine's existing fallback labels the report.
  {
    const { memo } = run(metaCsv, "cpa", "");
    assert.equal(memo.scope.product, "Your account");
  }
  console.log("firstRunFixes: real engine — Meta lead-gen, CSV without ROAS, sample, CPA zero purchases, product fallback");
} finally {
  rmSync(dist, { recursive: true, force: true });
}

/* ===================== 3. UI wiring (source scans) ===================== */
{
  const gen = readFileSync(join(ROOT, "components/debrief/GeneratorPanel.tsx"), "utf8");
  assert.match(gen, /const canSubmit = !!file;/, "Generate needs data only — product is optional");
  assert.ok(!gen.includes("Product / industry *"), "no required marker on Product / industry");
  assert.match(gen, /\(optional\)/);

  // Manual choice guard: both user paths go through chooseKpiManually.
  assert.match(gen, /onClick=\{\(\) => chooseKpiManually\(opt\.value\)\}/, "KPI selector marks a manual choice");
  assert.match(gen, /chooseKpiManually\(k\);\s*clearError\(\);/, "error one-click switch marks a manual choice");
  assert.match(gen, /chooseAutoKpi\(current, usability, kpiManualRef\.current\)/, "auto-switch respects the manual flag");
  assert.match(gen, /No \{KPI_LABELS\[kpiNotice\.from\]\} values in this export —\s*switched to \{KPI_LABELS\[kpiNotice\.to\]\}\./);

  // Early Generate button: a second submit button in the same form — the
  // form's single onSubmit is the only handler.
  const submits = gen.match(/type="submit"/g) ?? [];
  assert.equal(submits.length, 2, "two Generate buttons, both plain submits of the one form");
  assert.equal((gen.match(/onSubmit=/g) ?? []).length, 1, "one submit handler");

  // Ad-name warning uses the shared guidance.
  assert.match(gen, /!preview\.columnMap\.adName/);
  assert.match(gen, /\{EXPORT_AT_AD_LEVEL\}/);

  const meta = readFileSync(join(ROOT, "components/debrief/MetaConnect.tsx"), "utf8");
  assert.match(meta, /\{selectedAccount\.name\}/, "Meta: selected account named next to Pull");
  assert.match(meta, /\{DATE_PRESET_LABELS\[datePreset\]\}/, "Meta: date range named next to Pull");

  const route = readFileSync(join(ROOT, "app/api/debrief/route.ts"), "utf8");
  assert.ok(!/const EXPORT_AT_AD_LEVEL =/.test(route), "the API uses the shared guidance constant");
  console.log("firstRunFixes: generator + Meta wiring");
}

console.log("firstRunFixes: all assertions passed");
