/**
 * Robustness Sweep — the tester report "ROAS 0.85 shown as 0.07, and
 * 0.67 shown as 0.22, on a higher-spend campaign".
 *
 * Each candidate cause gets a fixture from scripts/fixtures/variants/
 * that would show the wrong number if that cause were real. For every
 * candidate this proves two things: what the WRONG reading of the file
 * is (computed straight from the file's cells), and what Debrief shows
 * for the tester's two ads — Founder_Video_V3 (0.85x on 2,345.67 spend)
 * and Carousel_Sale_V4 (0.67x on 1,820.00).
 *
 *   reproduced → the wrong reading is what the unfixed engine showed;
 *                fixed on this branch, the variant is its regression.
 *   disproved  → the engine never showed the wrong reading.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadEngine } from "./testerFeedbackEngine.ts";

const DIR = join(ROOT, "scripts/fixtures/variants");
const A = "Founder_Video_V3";
const B = "Carousel_Sale_V4";
const near = (got: number | null | undefined, want: number, label: string) =>
  assert.ok(got != null && Math.abs(got - want) <= 0.01, `${label}: ${got} (expected ${want})`);

const { requireCompiled, cleanup } = loadEngine();
try {
  const { checkExport } = requireCompiled("modules/debrief/fileCheck.js") as {
    checkExport: (t: string, k: string) => { ok: boolean; value: { rows: Record<string, string>[]; columns: unknown } };
  };
  const { extractAds } = requireCompiled("modules/debrief/extract.js") as {
    extractAds: (r: unknown, c: unknown, k: string) => { name: string; kpiValue: number | null }[];
  };
  const { parseCsv, parseNumericCell } = requireCompiled("modules/debrief/csv.js") as {
    parseCsv: (t: string) => string[][];
    parseNumericCell: (v: string | undefined) => number | null;
  };

  const file = (id: string) => readFileSync(join(DIR, `${id}.csv`), "utf8");
  /** ROAS Debrief shows per ad for a variant. */
  const shown = (id: string) => {
    const c = checkExport(file(id), "roas");
    assert.ok(c.ok, `${id} is readable`);
    return new Map(extractAds(c.value.rows, c.value.columns, "roas").map((a) => [a.name, a.kpiValue]));
  };
  /** The file's raw cells for one ad, by column POSITION (so a repeated
   *  header can be read both ways). */
  const cells = (id: string, ad: string) => {
    const [header, ...body] = parseCsv(file(id));
    const nameAt = header.indexOf("Ad name");
    const rows = body.filter((r) => r[nameAt] === ad);
    return { header, rows, at: (h: string, nth = 0) => header.map((x, i) => (x === h ? i : -1)).filter((i) => i >= 0)[nth] };
  };
  const expectShown = (id: string) => {
    const s = shown(id);
    near(s.get(A), 0.85, `${id} ${A}`);
    near(s.get(B), 0.67, `${id} ${B}`);
  };
  const verdicts: string[] = [];

  /* 1 — wrong column: the website-only ROAS column beside Purchase ROAS.
     The website column holds 0.07 / 0.22 for these two ads — the report,
     to the digit. The unfixed engine read it; now Purchase ROAS is read. */
  for (const id of ["04-roas-purchase-and-website-differ", "05-roas-website-columns-first"]) {
    const a = cells(id, A);
    const b = cells(id, B);
    near(parseNumericCell(a.rows[0][a.at("Website purchase ROAS (return on ad spend)")]), 0.07, `${id} website ROAS of ${A}`);
    near(parseNumericCell(b.rows[0][b.at("Website purchase ROAS (return on ad spend)")]), 0.22, `${id} website ROAS of ${B}`);
    expectShown(id);
  }
  verdicts.push("reproduced  wrong column — website-only ROAS read instead of Purchase ROAS (0.85→0.07, 0.67→0.22) — fixed");

  /* 2 — wrong column: the same header twice; the later column (another
     window) overwrote the first. Its cell for the 0.85x ad is 0.07. */
  {
    const id = "23-duplicate-roas-header";
    const a = cells(id, A);
    near(parseNumericCell(a.rows[0][a.at("Purchase ROAS (return on ad spend)", 0)]), 0.85, "first ROAS column");
    near(parseNumericCell(a.rows[0][a.at("Purchase ROAS (return on ad spend)", 1)]), 0.07, "second ROAS column");
    expectShown(id);
    verdicts.push("reproduced  wrong column — a repeated header read its last column (0.85→0.07) — fixed");
  }

  /* 3 — wrong column: per-window ROAS columns ("(1-day view)") beside
     the blended one. The view column says 0.07; it is never read. */
  {
    const id = "22-attribution-roas-windows-beside-blended";
    const a = cells(id, A);
    near(parseNumericCell(a.rows[0][a.at("Purchase ROAS (return on ad spend) (1-day view)")]), 0.07, "1-day view ROAS");
    expectShown(id);
    verdicts.push("disproved   wrong column — a per-window ROAS column read as the blended ROAS");
  }

  /* 4 — value and spend from different columns: ROAS blank on a row
     falls back to value ÷ spend, and a value-only export computes it. */
  for (const id of ["09-value-without-roas-column", "12-value-present-roas-blank", "13-roas-present-value-blank"]) expectShown(id);
  {
    /* The one cross-scope case is cause 1: website value ÷ spend. */
    const a = cells("04-roas-purchase-and-website-differ", A);
    const websiteValue = parseNumericCell(a.rows[0][a.at("Website purchases conversion value")]) ?? 0;
    const spend = parseNumericCell(a.rows[0][a.at("Amount spent (USD)")]) ?? 1;
    near(websiteValue / spend, 0.07, "website value ÷ spend");
    verdicts.push("disproved   value ÷ spend from different columns — same-family fallbacks agree (the cross-family case is cause 1)");
  }

  /* 5 — thousands separators: every number format reads 2,345.67 and
     1,993.82 correctly. (Variant 33 was a real bug, but it shrank spend
     AND value alike, so these two ads kept 0.85 / 0.67.) */
  for (const id of [
    "24-us-thousands-separators", "25-eu-semicolon-decimal-comma", "26-eu-nbsp-thousands", "27-eu-narrow-nbsp-thousands",
    "28-currency-symbol-prefix-in-cell", "29-currency-symbol-suffix-in-cell", "30-currency-dollar-in-cell", "31-currency-code-in-cell",
    "32-percent-sign-cells", "33-eu-whole-numbers-dot-thousands", "34-decimal-comma-in-comma-file", "35-eu-three-decimal-roas",
    "36-us-whole-numbers-comma-thousands", "37-semicolon-with-decimal-points",
  ]) expectShown(id);
  verdicts.push("disproved   thousands-separator parse — 14 number formats all read 0.85 / 0.67");

  /* 6 — aggregation after a merge / ROAS averaged instead of recomputed.
     In variant 48 the plain average of the ad's slice ROAS is far from
     0.85, so an averaging bug could not hide. */
  {
    const a = cells("48-day-breakdown-roas-per-slice", A);
    const slice = a.rows.map((r) => parseNumericCell(r[a.at("Purchase ROAS (return on ad spend)")]) ?? 0);
    const average = slice.reduce((s, v) => s + v, 0) / slice.length;
    assert.ok(slice.length === 3 && Math.abs(average - 0.85) > 0.2, `the slice average (${average.toFixed(2)}) is not 0.85`);
    for (const id of ["44-day-breakdown", "45-age-breakdown", "46-placement-breakdown", "48-day-breakdown-roas-per-slice", "49-same-ad-in-two-ad-sets"])
      expectShown(id);
    verdicts.push(`disproved   aggregation — merged rows are recomputed from the sums (0.85), never averaged (${average.toFixed(2)})`);
  }

  /* 7 — a summary row changes the total and the median, not an ad's ROAS. */
  for (const id of ["38-summary-row-first", "39-total-row-last", "47-day-breakdown-with-summary-row"]) expectShown(id);
  verdicts.push("disproved   summary row — never changed an ad's own ROAS (it did distort totals; fixed)");

  /* 8 — by design, disclosed: with click-only columns in the export the
     ranking uses them (0.85 → 0.78 here), and the card says so. */
  {
    const s = shown("19-attribution-split-parentheses");
    near(s.get(A), 0.78, "7-day click ROAS");
    verdicts.push("by design   click-only ranking when the export has 7-day click columns (0.85→0.78, named on the file card)");
  }

  console.log("ROAS report (0.85→0.07, 0.67→0.22) — candidate causes:");
  for (const v of verdicts) console.log(`  ${v}`);
  console.log("robustness ROAS report: all assertions passed");
} finally {
  cleanup();
}
