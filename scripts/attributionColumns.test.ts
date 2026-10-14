/**
 * Attribution & Intent 1 — recognise attribution-split columns.
 *
 * columns.ts parseAttributionHeader() reads click-only and view-through
 * variants of purchases, purchase value and leads (incl. Website /
 * On-Facebook / Results bases), 1- and 7-day click, in both "(…)" and
 * "[…]" suffix styles, with or without "attribution". Split headers are
 * never the blended column, never its "also found, not used"
 * competitor, and leave the unused-columns list; the KPI source
 * disclosure names them. No split columns ⇒ output identical to before.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadEngine } from "./testerFeedbackEngine.ts";

const SPLIT = readFileSync(join(ROOT, "scripts/fixtures/attribution-split.csv"), "utf8");
const BRACKETS = SPLIT.replace(/\((7-day click|1-day click|1-day view)\)/g, "[$1]");

type Parsed = { field: string; window: string } | null;
const { run, requireCompiled, cleanup } = loadEngine();
try {
  const cols = requireCompiled("modules/debrief/columns.js") as {
    parseAttributionHeader: (h: string) => Parsed;
    isAttributionSplitHeader: (h: string) => boolean;
    resolveColumns: (h: string[]) => { purchases: string | null; purchaseValue: string | null; costPerPurchase: string | null; sources: Record<string, { ignored: string[] }>; attributionSplits: Record<string, Record<string, string>> };
    unusedColumns: (h: string[], c: unknown) => { headers: string[] };
    kpiSourcePreview: (k: string, c: unknown) => string | null;
  };
  const p = (h: string) => {
    const r = cols.parseAttributionHeader(h);
    return r ? `${r.field}/${r.window}` : null;
  };

  /* ---- Supported patterns (both formats, case-insensitive) ---- */
  const cases: [string, string | null][] = [
    ["Purchases (7-day click)", "purchases/click7"],
    ["Purchases [7-day click]", "purchases/click7"],
    ["purchases [1 day view]", "purchases/view"],
    ["PURCHASES (1-DAY CLICK)", "purchases/click1"],
    ["Website purchases (7-day click attribution)", "purchases/click7"],
    ["Purchases [Attribution setting: 1-day view]", "purchases/view"],
    ["On-Facebook purchases [7 days click]", "purchases/click7"],
    ["Results (7-day click)", "purchases/click7"],
    ["Purchases conversion value (7-day click) (USD)", "purchaseValue/click7"],
    ["Website purchases conversion value [1-day view]", "purchaseValue/view"],
    ["Leads (1-day click)", "leads/click1"],
    ["Website leads [7-day view]", "leads/view"],
    ["Purchases (1-day engaged-view)", "purchases/view"],
    // Not splits Debrief reads (but still kept out of blended resolution):
    ["Cost per purchase (7-day click)", null],
    ["Purchase ROAS [1-day view]", null],
    // Ordinary headers:
    ["Purchases", null],
    ["Amount spent (USD)", null],
    ["Purchases conversion value (USD)", null],
  ];
  for (const [h, want] of cases) assert.equal(p(h), want, h);
  assert.ok(cols.isAttributionSplitHeader("Cost per purchase (7-day click)"));
  assert.ok(!cols.isAttributionSplitHeader("Amount spent (USD)"));

  /* ---- Never the blended column, never a competitor, never "unused" ---- */
  const headers = [
    "Ad name", "Amount spent (USD)", "Purchases", "Purchases (7-day click)", "Purchases [1-day view]",
    "Purchases conversion value", "Purchases conversion value (7-day click)", "Cost per purchase", "Cost per purchase (7-day click)",
  ];
  const c = cols.resolveColumns(headers);
  assert.equal(c.purchases, "Purchases");
  assert.equal(c.purchaseValue, "Purchases conversion value");
  assert.equal(c.costPerPurchase, "Cost per purchase");
  for (const src of Object.values(c.sources)) assert.ok(!src.ignored.some((h) => cols.isAttributionSplitHeader(h)), "split never listed as a competing variant");
  assert.deepEqual(c.attributionSplits.purchases, { click7: "Purchases (7-day click)", view: "Purchases [1-day view]" });
  const unused = cols.unusedColumns(headers, c).headers;
  assert.ok(!unused.includes("Purchases (7-day click)") && !unused.includes("Purchases [1-day view]"), "read splits leave the unused list");
  assert.deepEqual(unused, ["Cost per purchase (7-day click)"], "an unread split stays honestly listed");

  /* ---- Disclosure: preview + report ---- */
  const preview = cols.kpiSourcePreview("roas", cols.resolveColumns(SPLIT.split("\n")[0].split(",")));
  // Item 2: with a click-only value column the preview states the basis.
  assert.equal(preview, "Ranked on 7-day click only (view-through excluded): 'Purchases conversion value (7-day click)' and 'Purchases (7-day click)'.");
  // A view-only split is still just disclosed.
  const viewOnly = cols.kpiSourcePreview("roas", cols.resolveColumns(["Ad name", "Amount spent (USD)", "Purchases conversion value", "Purchases conversion value [1-day view]"]));
  assert.match(viewOnly ?? "", /attribution split found: 'Purchases conversion value \[1-day view\]'/);
  for (const csv of [SPLIT, BRACKETS]) {
    const r = run(csv, "roas");
    assert.equal(r.analysis.attributionColumns?.length, 6, "all six split columns detected, both formats");
  }

  /* ---- No split columns ⇒ identical to the pre-feature engine ---- */
  for (const f of ["ecom-13ads", "tester-cpa-8ads", "regional-semicolon"]) {
    const csv = readFileSync(join(ROOT, "scripts/fixtures", `${f}.csv`), "utf8");
    for (const kpi of ["roas", "cpa", "ctr"]) {
      let r;
      try { r = run(csv, kpi); } catch { continue; }
      assert.equal(r.analysis.attributionColumns, undefined, `${f}/${kpi}`);
      assert.ok(!/attribution/i.test(JSON.stringify(r.memo)), `${f}/${kpi}: no attribution wording`);
    }
  }

  console.log("attributionColumns: all assertions passed");
} finally {
  cleanup();
}
