/**
 * Meta Funnel-Column Parity + CSV Requirements Disclosure V1 — plain-
 * Node proofs.
 *
 * Stage 1 (fast, no compile): graph.ts's mapInsightRow/pickAction/key-
 * ladder logic, and insightsToCsv.ts's round-trip — but graph.ts uses
 * a TS parameter-property class (GraphApiError) that Node's strip-only
 * mode can't parse, and both files use extensionless-style resolution
 * once combined with modules/debrief, so everything here compiles via
 * the same tsc-to-temp-dir approach compare.test.ts/evidenceDiagnostic
 * .test.ts's own Stage 2 uses, run once and shared across all checks.
 *
 * Isolation: evidenceDiagnostic.ts is asserted to stay Meta-unaware —
 * the parity requirement is that ingestion produces equivalent inputs,
 * never that the diagnostic special-cases the data's origin.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const ROOT = join(import.meta.dirname, "..");
const dist = mkdtempSync(join(tmpdir(), "debrief-meta-funnel-parity-"));

try {
  execSync(
    `npx tsc modules/debrief/*.ts modules/meta/graph.ts modules/meta/types.ts modules/meta/insightsToCsv.ts --outDir ${JSON.stringify(dist)} --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck --rewriteRelativeImportExtensions`,
    { cwd: ROOT, stdio: "pipe" }
  );

  const {
    INSIGHTS_FIELDS,
    mapInsightRow,
    META_OAUTH_SCOPE,
  } = require(join(dist, "modules/meta/graph.js"));
  const { insightsToCsv } = require(join(dist, "modules/meta/insightsToCsv.js"));
  const { parseCsv, toTable } = require(join(dist, "modules/debrief/csv.js"));
  const { resolveColumns } = require(join(dist, "modules/debrief/columns.js"));
  const { extractAds } = require(join(dist, "modules/debrief/extract.js"));
  const { analyze } = require(join(dist, "modules/debrief/analysis.js"));
  const { deriveEvidenceDiagnostic } = require(join(dist, "modules/debrief/evidenceDiagnostic.js"));

  const money = (v: number) => `$${v.toFixed(2)}`;

  /* ===================== 1. Requested fields ===================== */
  {
    assert.deepEqual(
      [...INSIGHTS_FIELDS],
      [
        "ad_name",
        "spend",
        "impressions",
        "inline_link_clicks",
        "inline_link_click_ctr",
        "cost_per_inline_link_click",
        "actions",
        "action_values",
        "purchase_roas",
        "cost_per_action_type",
        "cpm",
        "account_currency",
        "date_start",
        "date_stop",
      ],
      "exact field list requested from /insights — cpm added, nothing existing dropped/reordered/renamed"
    );
  }

  /* ===================== 2. CPM survives Meta -> virtual CSV ===================== */
  {
    const row = mapInsightRow({ ad_name: "CpmAd", spend: "100.00", cpm: "18.42" });
    assert.equal(row.cpm, "18.42", "cpm read verbatim from Meta's own field, not recomputed");
    const { headers, rows } = toTable(parseCsv(insightsToCsv([row], "USD")));
    const cols = resolveColumns(headers);
    assert.ok(cols.cpm, "cpm header resolves through columns.ts's existing alias");
    assert.equal(rows[0][cols.cpm], "18.42");
  }

  /* ===================== 3/4. Add-to-cart / content-view survive Meta actions -> virtual CSV ===================== */
  {
    const row = mapInsightRow({
      ad_name: "FunnelAd",
      spend: "50.00",
      actions: [
        { action_type: "omni_add_to_cart", value: "12" },
        { action_type: "omni_view_content", value: "77" },
      ],
    });
    assert.equal(row.addToCart, "12");
    assert.equal(row.contentViews, "77");
    const { headers, rows } = toTable(parseCsv(insightsToCsv([row], "USD")));
    const cols = resolveColumns(headers);
    assert.ok(cols.addToCart && cols.contentViews, "both headers resolve through columns.ts's existing aliases");
    assert.equal(rows[0][cols.addToCart], "12");
    assert.equal(rows[0][cols.contentViews], "77");

    // Pixel-only fallback variants (older accounts, no unified omni_* total).
    const fallback = mapInsightRow({
      actions: [
        { action_type: "offsite_conversion.fb_pixel_add_to_cart", value: "5" },
        { action_type: "offsite_conversion.fb_pixel_view_content", value: "9" },
      ],
    });
    assert.equal(fallback.addToCart, "5", "pixel-only add-to-cart fallback key accepted");
    assert.equal(fallback.contentViews, "9", "pixel-only view-content fallback key accepted");

    // First present key wins — variants are never summed together.
    const noDoubleCount = mapInsightRow({
      actions: [
        { action_type: "omni_add_to_cart", value: "10" },
        { action_type: "add_to_cart", value: "10" },
      ],
    });
    assert.equal(noDoubleCount.addToCart, "10", "two action_type variants for the same event never sum to 20");
  }

  /* ===================== 5. Missing funnel values stay honestly missing ===================== */
  {
    const row = mapInsightRow({ ad_name: "NoFunnelData", spend: "10.00" });
    assert.equal(row.cpm, "");
    assert.equal(row.addToCart, "");
    assert.equal(row.contentViews, "");
    const { headers, rows } = toTable(parseCsv(insightsToCsv([row], "USD")));
    const cols = resolveColumns(headers);
    assert.equal(rows[0][cols.cpm], "", "missing cpm serializes as a blank cell, not 0");
    assert.equal(rows[0][cols.addToCart], "", "missing add-to-cart serializes as a blank cell, not 0");
    assert.equal(rows[0][cols.contentViews], "", "missing content-view serializes as a blank cell, not 0");

    // And stays null (not 0) once the debrief engine's own extraction reads it.
    const ads = extractAds(rows, cols, "roas");
    assert.equal(ads[0].cpm, null, "extractAds: blank cpm cell -> null, never 0");
    assert.equal(ads[0].addToCart, null, "extractAds: blank add-to-cart cell -> null, never 0");
    assert.equal(ads[0].contentViews, null, "extractAds: blank content-view cell -> null, never 0");
  }

  /* ===================== 6. Existing purchase/lead mapping unaffected (regression) ===================== */
  {
    const purchaseRow = mapInsightRow({
      ad_name: "Purchaser",
      spend: "300.00",
      actions: [{ action_type: "omni_purchase", value: "9" }],
      action_values: [{ action_type: "omni_purchase", value: "450.00" }],
      purchase_roas: [{ action_type: "omni_purchase", value: "1.5" }],
      cost_per_action_type: [{ action_type: "omni_purchase", value: "33.33" }],
    });
    assert.equal(purchaseRow.purchases, "9");
    assert.equal(purchaseRow.purchaseValue, "450.00");
    assert.equal(purchaseRow.purchaseRoas, "1.5");
    assert.equal(purchaseRow.costPerPurchase, "33.33");

    const leadRow = mapInsightRow({
      ad_name: "Lead",
      spend: "120.00",
      actions: [{ action_type: "lead", value: "4" }],
      cost_per_action_type: [{ action_type: "lead", value: "30.00" }],
    });
    assert.equal(leadRow.leads, "4");
    assert.equal(leadRow.costPerLead, "30.00");
  }

  /* ===================== 7. Existing virtual CSV fields remain intact ===================== */
  {
    const row = mapInsightRow({ ad_name: "X", spend: "1.00" });
    const { headers } = toTable(parseCsv(insightsToCsv([row], "USD")));
    assert.deepEqual(
      headers.slice(0, 14),
      [
        "Ad name",
        "Amount spent (USD)",
        "Impressions",
        "Link clicks",
        "CTR (link click-through rate)",
        "CPC (cost per link click)",
        "Purchases",
        "Purchases conversion value",
        "Purchase ROAS (return on ad spend)",
        "Cost per purchase",
        "Leads",
        "Cost per lead",
        "Reporting starts",
        "Reporting ends",
      ],
      "the pre-existing 14 headers keep their exact name and position"
    );
  }

  /* ===================== 8. New headers resolve through the existing alias system ===================== */
  {
    const row = mapInsightRow({
      ad_name: "AliasCheck",
      spend: "1.00",
      cpm: "2.00",
      actions: [
        { action_type: "omni_add_to_cart", value: "1" },
        { action_type: "omni_view_content", value: "1" },
      ],
    });
    const { headers } = toTable(parseCsv(insightsToCsv([row], "USD")));
    assert.deepEqual(
      headers.slice(14),
      ["Adds to cart", "Content views", "CPM (cost per 1,000 impressions)"],
      "new headers are additive, appended after the existing 14"
    );
    const cols = resolveColumns(headers);
    assert.equal(cols.addToCart, "Adds to cart");
    assert.equal(cols.contentViews, "Content views");
    assert.equal(cols.cpm, "CPM (cost per 1,000 impressions)");
    // Existing resolution is unaffected by the new columns being present.
    assert.equal(cols.adName, "Ad name");
    assert.equal(cols.spend, "Amount spent (USD)");
  }

  /* ===================== 9. Parity: equivalent Meta + manual-CSV fixtures -> equivalent Evidence Diagnostic ===================== */
  {
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

    // Same underlying dataset as evidenceDiagnostic.test.ts's Stage 2
    // ecommerce fixture: a thin winner (3 purchases, below the 10-
    // outcome floor) with comparable add-to-cart data on the other
    // judged ads, so the diagnostic activates and stops at add_to_cart.
    const manualCsv = `Ad name,Amount spent (USD),Purchases,Purchase ROAS (return on ad spend),Adds to cart,Content views,CTR (link click-through rate),"CPM (cost per 1,000 impressions)",Impressions,Link clicks
ThinWinner,500.00,3,4.50,10,40,1.80,25.00,60000,1080
MidAd,450.00,8,3.00,45,120,1.60,18.00,55000,880
LowAd,400.00,6,2.50,50,140,1.55,17.00,50000,775
WorstAd,380.00,2,1.20,60,150,1.40,16.00,48000,672`;

    const runManual = () => {
      const { headers, rows } = toTable(parseCsv(manualCsv));
      const cols = resolveColumns(headers);
      const ads = extractAds(rows, cols, ctx.kpi);
      return analyze(ads, rows, cols, ctx);
    };

    // The identical dataset, shaped as Meta insights fixtures and
    // pushed through the real OAuth serialization path (mapInsightRow
    // -> insightsToCsv -> the same parseCsv/resolveColumns/extractAds
    // the manual-upload path just used).
    const metaFixture = [
      {
        ad_name: "ThinWinner",
        spend: "500.00",
        impressions: "60000",
        inline_link_clicks: "1080",
        inline_link_click_ctr: "1.80",
        cpm: "25.00",
        actions: [
          { action_type: "omni_purchase", value: "3" },
          { action_type: "omni_add_to_cart", value: "10" },
          { action_type: "omni_view_content", value: "40" },
        ],
        purchase_roas: [{ action_type: "omni_purchase", value: "4.50" }],
      },
      {
        ad_name: "MidAd",
        spend: "450.00",
        impressions: "55000",
        inline_link_clicks: "880",
        inline_link_click_ctr: "1.60",
        cpm: "18.00",
        actions: [
          { action_type: "omni_purchase", value: "8" },
          { action_type: "omni_add_to_cart", value: "45" },
          { action_type: "omni_view_content", value: "120" },
        ],
        purchase_roas: [{ action_type: "omni_purchase", value: "3.00" }],
      },
      {
        ad_name: "LowAd",
        spend: "400.00",
        impressions: "50000",
        inline_link_clicks: "775",
        inline_link_click_ctr: "1.55",
        cpm: "17.00",
        actions: [
          { action_type: "omni_purchase", value: "6" },
          { action_type: "omni_add_to_cart", value: "50" },
          { action_type: "omni_view_content", value: "140" },
        ],
        purchase_roas: [{ action_type: "omni_purchase", value: "2.50" }],
      },
      {
        ad_name: "WorstAd",
        spend: "380.00",
        impressions: "48000",
        inline_link_clicks: "672",
        inline_link_click_ctr: "1.40",
        cpm: "16.00",
        actions: [
          { action_type: "omni_purchase", value: "2" },
          { action_type: "omni_add_to_cart", value: "60" },
          { action_type: "omni_view_content", value: "150" },
        ],
        purchase_roas: [{ action_type: "omni_purchase", value: "1.20" }],
      },
    ].map(mapInsightRow);

    const runMeta = () => {
      const csvText = insightsToCsv(metaFixture, "USD");
      const { headers, rows } = toTable(parseCsv(csvText));
      const cols = resolveColumns(headers);
      const ads = extractAds(rows, cols, ctx.kpi);
      return analyze(ads, rows, cols, ctx);
    };

    const manualAnalysis = runManual();
    const metaAnalysis = runMeta();

    // Winner-row inputs Evidence Diagnostic actually reads must match
    // exactly between the two ingestion paths.
    const pick = (w: Record<string, unknown>) => ({
      name: w.name,
      spend: w.spend,
      kpiValue: w.kpiValue,
      conversions: w.conversions,
      impressions: w.impressions,
      linkClicks: w.linkClicks,
      addToCart: w.addToCart,
      contentViews: w.contentViews,
      cpm: w.cpm,
    });
    assert.deepEqual(
      pick(metaAnalysis.winners[0]),
      pick(manualAnalysis.winners[0]),
      "Meta-derived and manually-uploaded winner rows expose identical Evidence Diagnostic inputs"
    );

    const manualFinding = deriveEvidenceDiagnostic(manualAnalysis, money);
    const metaFinding = deriveEvidenceDiagnostic(metaAnalysis, money);
    assert.ok(manualFinding, "manual path: diagnostic activates (3 purchases < floor)");
    assert.deepEqual(
      metaFinding,
      manualFinding,
      "identical Evidence Diagnostic output for equivalent Meta-derived vs manual-CSV data"
    );
    assert.equal(metaFinding.trigger, "thin_volume");
    assert.equal(metaFinding.finding?.rungId, "add_to_cart");
  }

  /* ===================== 11. OAuth scope unchanged ===================== */
  {
    assert.equal(META_OAUTH_SCOPE, "ads_read", "read-only scope unchanged — never widened by this milestone");
  }

  /* ===================== Isolation: no Meta special-casing in evidenceDiagnostic.ts ===================== */
  {
    // "Meta" the ad platform is legitimately named in doc comments here
    // (e.g. "Meta's own event taxonomy") — the actual isolation
    // contract is architectural: this module never imports the OAuth
    // data-source code, so it structurally cannot branch on where the
    // AnalysisResult it receives came from.
    const src = readFileSync(join(ROOT, "modules/debrief/evidenceDiagnostic.ts"), "utf8");
    assert.ok(
      !/from ["']\.\.?\/.*meta/i.test(src) && !/modules\/meta/i.test(src),
      "evidenceDiagnostic.ts never imports modules/meta — parity is an ingestion property, not a diagnostic special case"
    );
  }

  console.log("metaFunnelParity: all assertions passed");
} finally {
  rmSync(dist, { recursive: true, force: true });
}

/* ===================== 10. Generator CSV-requirements copy ===================== */
{
  const src = readFileSync(join(ROOT, "components/debrief/GeneratorPanel.tsx"), "utf8");
  // "CSV requirements" also appears once, earlier, in a plain doc
  // comment (line ~96) describing KPI_ALIAS_DOC — anchor on the actual
  // JSX section body instead, which is the only place this intro line
  // appears.
  const start = src.indexOf("From Meta Ads Manager, export ads at ad level");
  assert.ok(start !== -1, "CSV requirements section exists");
  const end = src.indexOf("</details>", start);
  const section = src.slice(start, end);

  assert.match(section, /Adds to cart/, "copy names Adds to cart");
  assert.match(section, /Content views/, "copy names Content views");
  assert.match(section, /CPM/, "copy names CPM");

  // Presented under an "Optional" heading, not folded into "Required".
  const optionalIdx = section.indexOf("Optional");
  const requiredIdx = section.indexOf("Required");
  const addToCartIdx = section.indexOf("Adds to cart");
  assert.ok(optionalIdx !== -1 && optionalIdx < addToCartIdx, "the new columns sit under an Optional heading");
  const requiredSection = section.slice(requiredIdx, optionalIdx);
  assert.ok(
    !/Adds to cart|Content views|CPM/.test(requiredSection),
    "the new columns are never listed under Required"
  );

  // No internal terminology leaked into user-facing copy.
  assert.ok(!/evidence diagnostic/i.test(section), "no internal feature name in user-facing copy");
  assert.ok(!/upstream fallback/i.test(section), "no internal mechanism name in user-facing copy");
  assert.ok(!/diagnostic tier/i.test(section), "no internal mechanism name in user-facing copy");

  console.log("metaFunnelParity (Generator copy): all assertions passed");
}
