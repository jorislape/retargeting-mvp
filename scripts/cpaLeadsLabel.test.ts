/**
 * CPA Leads Label — proofs.
 *
 * When every CPA value comes from lead data, the report says cost per
 * lead: "CPL" in the buyer register, plain "cost per lead" in the client
 * register, leads (never purchases) as the outcome — in the memo, the
 * decision card, Brief readiness, the KPI source line and both text
 * exports. Numbers and the decision are the same CPA. The generator's
 * auto-switch prefers cost per lead over the raw Leads count for a
 * lead-gen export, never over a manual choice.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { insightsToCsv } from "../modules/meta/insightsToCsv.ts";

const require = createRequire(import.meta.url);
const ROOT = join(import.meta.dirname, "..");
const CLIENT_BANNED = ["kill", "gate", "benchmark", "median", "judged"];

const dist = mkdtempSync(join(tmpdir(), "debrief-cpl-"));
try {
  execSync(
    `npx tsc modules/debrief/*.ts components/debrief/memoToText.ts --outDir ${JSON.stringify(dist)} --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck --rewriteRelativeImportExtensions`,
    { cwd: ROOT, stdio: "pipe" }
  );
  const { parseCsv, toTable } = require(join(dist, "modules/debrief/csv.js"));
  const { resolveColumns, kpiSourcePreview } = require(join(dist, "modules/debrief/columns.js"));
  const { extractAds } = require(join(dist, "modules/debrief/extract.js"));
  const { analyze } = require(join(dist, "modules/debrief/analysis.js"));
  const { generateMemo } = require(join(dist, "modules/debrief/memo.js"));
  const { kpiUsability, chooseAutoKpi } = require(join(dist, "modules/debrief/kpiUsability.js"));
  const { buildSampleMemo } = require(join(dist, "modules/debrief/sample.js"));
  const { memoToText } = require(join(dist, "components/debrief/memoToText.js"));

  const ctx = (kpi: string) => ({ kpi, product: "", offer: "", targetCpa: null, creativeNotes: "", marketContext: "" });
  const run = (csv: string, kpi: string) => {
    const { headers, rows } = toTable(parseCsv(csv));
    const columns = resolveColumns(headers);
    const analysis = analyze(extractAds(rows, columns, kpi), rows, columns, ctx(kpi));
    return { analysis, memo: generateMemo(analysis, ctx(kpi)), columns, rows };
  };

  // A lead-gen CSV (Cost per lead column, no purchase columns) and the
  // SAME numbers with purchase headers — identical CPA values either way.
  const shape = Array.from({ length: 12 }, (_, i) => {
    const spend = 150 + i * 45;
    const leads = 3 + ((i * 7) % 19);
    return { name: `Ad_${i}`, spend, leads, cpl: (spend / leads).toFixed(2) };
  });
  const leadCsv = "Ad name,Amount spent (EUR),Leads,Cost per lead (EUR)\n" +
    shape.map((r) => `${r.name},${r.spend},${r.leads},${r.cpl}`).join("\n") + "\n";
  const purchaseCsv = "Ad name,Amount spent (EUR),Purchases,Cost per purchase (EUR)\n" +
    shape.map((r) => `${r.name},${r.spend},${r.leads},${r.cpl}`).join("\n") + "\n";

  /* ===================== 1. Labels, nouns, text exports ===================== */
  const lead = run(leadCsv, "cpa");
  {
    assert.equal(lead.analysis.cpaBasis, "leads", "lead-gen export: CPA is lead-based");
    assert.equal(lead.memo.scope.kpiLabel, "CPL", "buyer label");
    assert.equal(lead.memo.scope.kpiLabelClient, "cost per lead", "client label");
    assert.equal(lead.memo.scope.kpiExplainer, "Cost per lead — what one lead costs in ad spend");

    const d = lead.memo.decision;
    assert.match(d.rationale, /median CPL/, "decision rationale says CPL");
    assert.ok(!/\bCPA\b/.test(d.headline + d.rationale), "no CPA label on the decision card");
    const clientCard = [d.clientHeadline, d.clientRationale, ...d.limits.client, d.reassess.client].join(" ");
    assert.ok(!/\bCPL\b|\bCPA\b/.test(clientCard), "client card uses plain words, no acronym");
    for (const w of CLIENT_BANNED) assert.ok(!clientCard.toLowerCase().includes(w), `client card free of "${w}"`);

    // Outcome is leads everywhere: conversion labels and the leading-ad line.
    assert.ok(lead.memo.winners.every((w: { conversionLabel?: string }) => !w.conversionLabel || /\blead/.test(w.conversionLabel)));
    assert.match(lead.memo.leadingConversion?.buyer ?? "", /\bleads?\b/);
    assert.match(lead.memo.leadingConversion?.client ?? "", /\bleads?\b/);
    // Brief readiness (on the decision card + tests) never says purchases.
    const briefs = lead.memo.nextTests.map((t: { briefReadiness?: { buyer: string; client: string } }) => t.briefReadiness).filter(Boolean);
    for (const b of briefs) assert.ok(!/purchase/i.test(b.buyer + b.client), "brief readiness speaks of leads, not purchases");

    const buyerText = memoToText(lead.memo, "buyer");
    const clientText = memoToText(lead.memo, "client");
    assert.ok(!/purchase/i.test(buyerText), "buyer text export: no purchase wording");
    assert.ok(!/purchase/i.test(clientText), "client text export: no purchase wording");
    assert.match(buyerText, /— CPL DEBRIEF/, "buyer text header names CPL");
    assert.match(buyerText, /Median CPL:/);
    assert.match(clientText, /— cost per lead PERFORMANCE REPORT/, "client text header names cost per lead");
    assert.match(clientText, /Typical cost per lead:/);
    assert.ok(!/\bCPL\b/.test(clientText), "client text never shows the CPL acronym");
    // The only remaining "CPA" in the buyer text names the generator's
    // own "Target CPA" input field, which keeps its name.
    for (const line of buyerText.split("\n").filter((l: string) => /\bCPA\b/.test(l))) {
      assert.match(line, /target CPA/, `buyer "CPA" only refers to the Target CPA field (got: ${line.slice(0, 80)})`);
    }

    // KPI source line: the actual columns, never empty purchase columns.
    assert.equal(
      kpiSourcePreview("cpa", lead.columns, "leads"),
      "Cost per lead from column 'Cost per lead (EUR)'; Leads from column 'Leads'."
    );
    console.log("cpaLeadsLabel: CPL buyer / cost per lead client — card, memo, brief readiness, text exports, source line");
  }

  /* ===================== 2. Numbers and decision unchanged ===================== */
  {
    const purchase = run(purchaseCsv, "cpa");
    assert.equal(purchase.analysis.cpaBasis, undefined, "purchase export keeps plain CPA");
    assert.equal(purchase.memo.scope.kpiLabel, "CPA");
    assert.equal(purchase.memo.scope.kpiLabelClient, undefined, "no client label key when it doesn't differ");
    const nums = (a: { spendGate: number; median: number; adsJudged: number; rankedAds: { name: string; kpiValue: number; deltaPct: number }[]; winners: { name: string }[]; losers: { name: string }[] }) => ({
      gate: a.spendGate, median: a.median, judged: a.adsJudged,
      ranked: a.rankedAds.map((r) => [r.name, r.kpiValue, r.deltaPct]),
      winners: a.winners.map((w) => w.name), losers: a.losers.map((l) => l.name),
    });
    assert.deepEqual(nums(lead.analysis), nums(purchase.analysis), "identical CPA numbers whether the data is leads or purchases");
    for (const k of ["action", "budgetVariant", "holdReason", "evidenceState", "evidenceShape"] as const) {
      assert.deepEqual(lead.memo.decision[k], purchase.memo.decision[k], `decision.${k} unchanged by the label`);
    }
    assert.equal(lead.memo.confidence.level, purchase.memo.confidence.level);
    console.log("cpaLeadsLabel: numbers and decision identical to the same data read as purchases");
  }

  /* ===================== 3. Auto-switch prefers cost per lead ===================== */
  {
    // Lead-gen CSV without ROAS.
    const { headers, rows } = toTable(parseCsv(leadCsv));
    const u = kpiUsability(rows, resolveColumns(headers));
    assert.equal(u.cpa.cpaLeadBased, true);
    assert.equal(chooseAutoKpi("roas", u, false), "cpa", "lead-gen CSV: cost per lead, not the raw Leads count");
    assert.equal(chooseAutoKpi("roas", u, true), null, "manual choice never overridden");
    assert.equal(chooseAutoKpi("leads", u, false), null, "a usable current KPI is kept");

    // Meta virtual CSV for a lead-gen account (empty purchase columns,
    // Cost per lead empty too ⇒ CPL = spend ÷ leads).
    const metaRows = Array.from({ length: 14 }, (_, i) => ({
      adName: `LeadAd_${i}`, spend: String(100 + i * 37), impressions: "9000", linkClicks: "120",
      ctr: "1.3", cpc: "0.9", purchases: "", purchaseValue: "", purchaseRoas: "", costPerPurchase: "",
      leads: String(3 + ((i * 7) % 25)), costPerLead: "", dateStart: "2026-08-01", dateStop: "2026-08-31",
      cpm: "11", addToCart: "", contentViews: "",
    }));
    const metaCsv = insightsToCsv(metaRows, "EUR");
    const mt = toTable(parseCsv(metaCsv));
    const mu = kpiUsability(mt.rows, resolveColumns(mt.headers));
    assert.equal(chooseAutoKpi("roas", mu, false), "cpa", "Meta lead-gen: cost per lead");
    assert.equal(chooseAutoKpi("roas", mu, true), null, "Meta lead-gen: manual ROAS kept");
    const meta = run(metaCsv, "cpa");
    assert.equal(meta.memo.scope.kpiLabel, "CPL");
    assert.equal(
      kpiSourcePreview("cpa", meta.columns, "leads"),
      "Leads from column 'Leads'. Cost per lead = spend ÷ leads.",
      "Meta: the empty Cost per purchase / Cost per lead columns are never named"
    );
    assert.ok(!/purchase/i.test(memoToText(meta.memo, "buyer")), "Meta lead-gen buyer text: no purchase wording");

    // Why prefer cost per lead: on this export the two KPIs crown
    // different winners — a count favours where the money went.
    const asLeads = run(metaCsv, "leads");
    assert.notEqual(asLeads.analysis.winners[0].name, meta.analysis.winners[0].name, "Leads and cost per lead disagree on the leader here");

    // Purchase export without ROAS still lands on (purchase) CPA.
    const pt = toTable(parseCsv(purchaseCsv));
    const pu = kpiUsability(pt.rows, resolveColumns(pt.headers));
    assert.equal(pu.cpa.cpaLeadBased, false);
    assert.equal(chooseAutoKpi("roas", pu, false), "cpa", "purchase export: CPA as before");
    console.log("cpaLeadsLabel: auto-switch — cost per lead for lead-gen CSV and Meta CSV, CPA for purchases, manual never overridden");
  }

  /* ===================== 4. Sample untouched ===================== */
  {
    const sample = buildSampleMemo();
    assert.equal(sample.scope.kpiLabel, "ROAS");
    assert.equal(sample.scope.kpiLabelClient, undefined, "sample memo has no new key");
  }
} finally {
  rmSync(dist, { recursive: true, force: true });
}

/* ===================== 5. Generator wiring (source scan) ===================== */
{
  const gen = readFileSync(join(ROOT, "components/debrief/GeneratorPanel.tsx"), "utf8");
  assert.match(gen, /switched to \{kpiDisplay\(kpiNotice\.to\)\}/, "notice names cost per lead when that's what CPA is");
  assert.match(gen, /\(longForm \? "CPA \(cost per lead\)" : "cost per lead"\)/);
  assert.match(gen, /kpiSourcePreview\(fields\.kpi, preview\.columnMap, previewCpl \? "leads" : undefined\)/);
  console.log("cpaLeadsLabel: generator notice, preview label, source line");
}
{
  const page = readFileSync(join(ROOT, "app/(workspace)/generator/page.tsx"), "utf8");
  assert.match(page, /Get your next move\./, "generator heading uses the homepage's 'next move' wording");
  assert.ok(!page.includes("Get your next tests."), "old 'next tests' heading gone");
  console.log("cpaLeadsLabel: generator heading says 'next move'");
}

console.log("cpaLeadsLabel: all assertions passed");
