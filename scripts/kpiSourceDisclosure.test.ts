/**
 * KPI Source Column Disclosure — proofs.
 *
 * Disclosure only: which CSV column a KPI's conversion data was read
 * from, surfaced as one Evidence-limits line (partial or Meta "Results"
 * matches only) and in the upload preview. The chosen column, every
 * number, and the decision must be unchanged.
 *
 * columns.ts/analysis.ts use extensionless imports, so — like the other
 * real-engine suites (e.g. scripts/decision.test.ts Stage 2) — the
 * engine is compiled to CommonJS in a temp dir. insightsToCsv.ts is
 * runtime-import-free and is imported directly.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { insightsToCsv } from "../modules/meta/insightsToCsv.ts";
import { kpiSourceLimitLines } from "../modules/debrief/decision.ts";

const require = createRequire(import.meta.url);
const ROOT = join(import.meta.dirname, "..");
const KPIS = ["roas", "cpa", "ctr", "cpc", "leads", "purchases"] as const;
const CLIENT_BANNED = ["kill", "gate", "benchmark", "median", "judged"];

const dist = mkdtempSync(join(tmpdir(), "debrief-kpisource-"));
try {
  execSync(
    `npx tsc modules/debrief/*.ts components/debrief/memoToText.ts --outDir ${JSON.stringify(dist)} --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck --rewriteRelativeImportExtensions`,
    { cwd: ROOT, stdio: "pipe" }
  );
  const { parseCsv, toTable } = require(join(dist, "modules/debrief/csv.js"));
  const { resolveColumns, kpiColumnSourcesFor, kpiSourcePreview } = require(join(dist, "modules/debrief/columns.js"));
  const { extractAds } = require(join(dist, "modules/debrief/extract.js"));
  const { analyze } = require(join(dist, "modules/debrief/analysis.js"));
  const { generateMemo } = require(join(dist, "modules/debrief/memo.js"));
  const { buildSampleMemo } = require(join(dist, "modules/debrief/sample.js"));
  const { SAMPLE_CSV_TEXT } = require(join(dist, "modules/debrief/sampleCsv.js"));
  const { memoToText } = require(join(dist, "components/debrief/memoToText.js"));

  const ctx = (kpi: string) => ({
    kpi,
    product: "",
    offer: "",
    targetCpa: null,
    creativeNotes: "",
    marketContext: "",
  });
  const run = (csv: string, kpi: string) => {
    const { headers, rows } = toTable(parseCsv(csv));
    const columns = resolveColumns(headers);
    const ads = extractAds(rows, columns, kpi);
    const analysis = analyze(ads, rows, columns, ctx(kpi));
    return { analysis, memo: generateMemo(analysis, ctx(kpi)) };
  };

  /* ===================== 1. Column matching (audit table) ===================== */
  {
    const base = ["Ad name", "Amount spent (EUR)"];

    // Partial: only a variant header present.
    const q = resolveColumns([...base, "Qualified leads"]);
    assert.equal(q.leads, "Qualified leads", "partial: resolved column unchanged");
    assert.deepEqual(q.sources.leads, { header: "Qualified leads", match: "partial", ignored: [] });

    // Both present: standard exact wins (current behaviour), variant noted as ignored.
    const both = resolveColumns([...base, "Qualified leads", "Leads"]);
    assert.equal(both.leads, "Leads", "both-present: exact standard column still wins");
    assert.deepEqual(both.sources.leads, { header: "Leads", match: "exact", ignored: ["Qualified leads"] });

    const wo = resolveColumns([...base, "Offline purchases", "Website purchases", "Offline purchases conversion value"]);
    assert.equal(wo.purchases, "Website purchases");
    assert.deepEqual(wo.sources.purchases?.ignored, ["Offline purchases"],
      "a value column containing 'purchases' is never listed as a competing purchases count");

    // Offline-only: partial for both count and value.
    const off = resolveColumns([...base, "Offline purchases", "Offline purchases conversion value"]);
    assert.equal(off.purchases, "Offline purchases");
    assert.equal(off.sources.purchases?.match, "partial");
    assert.equal(off.purchaseValue, "Offline purchases conversion value");
    assert.equal(off.sources.purchaseValue?.match, "partial");

    // Results / Cost per result: exact header text, but classified "results".
    const r = resolveColumns([...base, "Results", "Cost per result"]);
    assert.equal(r.purchases, "Results", "Results still resolves as purchases (behaviour unchanged)");
    assert.equal(r.costPerPurchase, "Cost per result");
    assert.equal(r.sources.purchases?.match, "results");
    assert.equal(r.sources.costPerPurchase?.match, "results");

    // Standard money columns carry a currency suffix — still exact, never flagged.
    const cur = resolveColumns([...base, "Cost per purchase (EUR)", "Purchases", "Purchases conversion value (EUR)"]);
    assert.equal(cur.costPerPurchase, "Cost per purchase (EUR)");
    assert.equal(cur.sources.costPerPurchase?.match, "exact", "currency suffix is not a variant");
    assert.equal(cur.sources.purchaseValue?.match, "exact");
    for (const kpi of KPIS) assert.deepEqual(kpiColumnSourcesFor(kpi, cur), [], `currency-suffixed standard export: silent for ${kpi}`);

    // Unrecognised custom conversion: nothing resolves, nothing recorded.
    const custom = resolveColumns([...base, "Demo booked", "Cost per Demo booked"]);
    for (const f of ["purchases", "leads", "purchaseValue", "purchaseRoas", "costPerPurchase", "costPerLead"]) {
      assert.equal(custom[f], null, `custom: ${f} unresolved`);
    }
    assert.deepEqual(custom.sources, {}, "custom: no sources recorded");

    // Fields only listed when actually read for the KPI.
    assert.deepEqual(kpiColumnSourcesFor("ctr", q), [], "CTR reads no conversion column");
    assert.deepEqual(kpiColumnSourcesFor("purchases", q), [], "a partial leads column is irrelevant to Purchases");
    assert.deepEqual(kpiColumnSourcesFor("leads", q), [{ field: "leads", header: "Qualified leads", match: "partial" }]);
    assert.deepEqual(kpiColumnSourcesFor("leads", both), [], "exact standard match stays silent");

    console.log("kpiSourceDisclosure: column matching — exact / partial / Results / both-present / custom");
  }

  /* ===================== 2. Meta pull + sample: always exact, never flagged ===================== */
  {
    const empty = {
      adName: "A", spend: "1", impressions: "", linkClicks: "", ctr: "", cpc: "",
      purchases: "", purchaseValue: "", purchaseRoas: "", costPerPurchase: "",
      leads: "", costPerLead: "", dateStart: "", dateStop: "", cpm: "",
      addToCart: "", contentViews: "",
    };
    for (const currency of ["USD", "EUR"]) {
      const { headers } = toTable(parseCsv(insightsToCsv([empty], currency)));
      const cols = resolveColumns(headers);
      for (const [field, src] of Object.entries(cols.sources) as [string, { match: string }][]) {
        assert.equal(src.match, "exact", `Meta pull (${currency}): ${field} is an exact standard match`);
      }
      for (const kpi of KPIS) {
        assert.deepEqual(kpiColumnSourcesFor(kpi, cols), [], `Meta pull (${currency}): no disclosure for ${kpi}`);
      }
    }

    const { headers } = toTable(parseCsv(SAMPLE_CSV_TEXT));
    const sampleCols = resolveColumns(headers);
    for (const kpi of KPIS) {
      assert.deepEqual(kpiColumnSourcesFor(kpi, sampleCols), [], `sample: no disclosure for ${kpi}`);
    }
    const sample = buildSampleMemo();
    for (const view of ["buyer", "client"] as const) {
      const text = memoToText(sample, view);
      assert.ok(!text.includes("read from the column") && !text.includes("come from the column"),
        `sample ${view} text carries no source line`);
    }
    console.log("kpiSourceDisclosure: Meta virtual CSV and sample never trigger the line");
  }

  /* ===================== 3. Limits line present / absent, both registers ===================== */
  const rowsFor = (countHeader: string) =>
    `Ad name,Amount spent (USD),${countHeader},Reporting starts,Reporting ends\n` +
    [
      ["A", 400, 40], ["B", 380, 30], ["C", 360, 22], ["D", 340, 18],
      ["E", 320, 12], ["F", 300, 9], ["G", 280, 6],
    ].map(([n, s, c]) => `${n},${s},${c},2026-06-01,2026-06-30`).join("\n") + "\n";

  {
    const partial = run(rowsFor("Qualified leads"), "leads").memo.decision;
    assert.ok(
      partial.limits.buyer.includes("Leads were read from the column 'Qualified leads'. Confirm it's the conversion you want judged."),
      "partial: buyer line present, exact wording"
    );
    const clientLine = partial.limits.client.find((l: string) => l.includes("'Qualified leads'"));
    assert.ok(clientLine?.startsWith("The results counted here come from the column 'Qualified leads' in the export"),
      "partial: client line present");
    assert.equal(partial.limits.buyer[1].startsWith("Leads were read"), true,
      "placed directly after the permanent dataset caveat");

    const results = run(rowsFor("Results"), "purchases").memo.decision;
    assert.ok(
      results.limits.buyer.includes("'Results' is Meta's optimisation event for each campaign, read here as purchases. Confirm it's the conversion you want judged."),
      "Results: buyer line present, exact wording"
    );
    assert.ok(results.limits.client.some((l: string) => l.includes("come from the column 'Results'")),
      "Results: client line present");

    const exact = run(rowsFor("Leads"), "leads").memo.decision;
    assert.ok(!exact.limits.buyer.some((l: string) => l.includes("read from the column")), "exact: no buyer line");
    assert.ok(!exact.limits.client.some((l: string) => l.includes("come from the column")), "exact: no client line");

    // Client jargon blocklist (the same list decision.test.ts's contract enforces).
    for (const d of [partial, results]) {
      const client = d.limits.client.join(" ").toLowerCase();
      for (const w of CLIENT_BANNED) assert.ok(!client.includes(w), `client limits free of "${w}"`);
    }

    // Reaches Copy/Download text in both views.
    const partialMemo = run(rowsFor("Qualified leads"), "leads").memo;
    assert.ok(memoToText(partialMemo, "buyer").includes("Leads were read from the column 'Qualified leads'"), "buyer text export carries it");
    assert.ok(memoToText(partialMemo, "client").includes("come from the column 'Qualified leads'"), "client text export carries it");
    console.log("kpiSourceDisclosure: limits line present for partial/Results, absent for exact, both registers, jargon-clean");
  }

  /* ===================== 4. Only headers differ ⇒ numbers and decision unchanged ===================== */
  {
    const a = run(rowsFor("Leads"), "leads");
    const b = run(rowsFor("Qualified leads"), "leads");
    const { kpiColumnSources, ...bAnalysis } = b.analysis;
    assert.ok(kpiColumnSources?.length === 1, "variant run carries the source");
    assert.ok(!("kpiColumnSources" in a.analysis), "exact run omits the key entirely");
    assert.deepEqual(bAnalysis, a.analysis, "every analysis number/field identical apart from the disclosure");

    const strip = (m: { decision: { limits: unknown } }) => ({ ...m, decision: { ...m.decision, limits: null } });
    assert.deepEqual(strip(b.memo), strip(a.memo), "memo identical apart from decision.limits");
    assert.deepEqual(
      b.memo.decision.limits.buyer.filter((l: string) => !l.includes("read from the column")),
      a.memo.decision.limits.buyer,
      "limits differ ONLY by the one added line"
    );
    assert.equal(b.memo.decision.action, a.memo.decision.action);
    assert.equal(b.memo.decision.headline, a.memo.decision.headline);
    console.log("kpiSourceDisclosure: header-only difference changes nothing but the one limits line");
  }

  /* ===================== 5. Preview copy ===================== */
  {
    const both = resolveColumns(["Ad name", "Amount spent (EUR)", "Qualified leads", "Leads"]);
    assert.equal(kpiSourcePreview("leads", both), "Leads from column 'Leads' — 'Qualified leads' also found, not used.");
    const q = resolveColumns(["Ad name", "Amount spent (EUR)", "Qualified leads"]);
    assert.equal(kpiSourcePreview("leads", q), "Leads from column 'Qualified leads'.");
    const r = resolveColumns(["Ad name", "Amount spent (EUR)", "Results"]);
    assert.match(kpiSourcePreview("purchases", r) ?? "", /Purchases from column 'Results' \(Meta's optimisation event/);
    assert.equal(kpiSourcePreview("ctr", q), null, "CTR shows no conversion source");
    console.log("kpiSourceDisclosure: preview names the column used and any ignored variant");
  }
} finally {
  rmSync(dist, { recursive: true, force: true });
}

/* ===================== 6. Pure helper edge cases (no compile) ===================== */
{
  assert.equal(kpiSourceLimitLines(undefined), null);
  assert.equal(kpiSourceLimitLines([]), null);
  const both = kpiSourceLimitLines([
    { field: "costPerPurchase", header: "Cost per result", match: "results" },
    { field: "purchases", header: "Results", match: "results" },
  ])!;
  assert.equal(
    both.buyer,
    "'Results' is Meta's optimisation event for each campaign, read here as purchases. 'Cost per result' is the cost of that event, read here as cost per purchase. Confirm it's the conversion you want judged."
  );
  assert.equal(
    both.client,
    "The results counted here come from the columns 'Cost per result' and 'Results' in the export — worth checking they're the result you mean to measure."
  );
  const offline = kpiSourceLimitLines([
    { field: "purchaseValue", header: "Offline purchases conversion value", match: "partial" },
    { field: "purchases", header: "Offline purchases", match: "partial" },
  ])!;
  assert.equal(
    offline.buyer,
    "Purchase value was read from the column 'Offline purchases conversion value', and purchases from 'Offline purchases'. Confirm it's the conversion you want judged."
  );
  console.log("kpiSourceDisclosure: helper wording for combined Results and multi-field partial cases");
}

console.log("kpiSourceDisclosure: all assertions passed");
