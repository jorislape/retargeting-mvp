/**
 * RFC 4180 escaping proof for the Meta "virtual CSV".
 *
 * Runs under plain `node` (v23.6+ type stripping — no test framework,
 * no build step): `npm run test:csv`.
 *
 * The fixture ad name is deliberately nasty — commas, double quotes,
 * an embedded newline, an em dash, and emoji — because real ad names
 * contain all of these. The proof is two-sided:
 *   1. the serialized field matches the exact RFC 4180 escape, and
 *   2. the app's own parser (modules/debrief/csv.ts, the code that
 *      will actually consume this CSV) round-trips every field back
 *      byte-for-byte.
 */
import assert from "node:assert/strict";
import { escapeCsvField, insightsToCsv } from "../modules/meta/insightsToCsv.ts";
import { parseCsv } from "../modules/debrief/csv.ts";
import type { AdInsightRow } from "../modules/meta/types.ts";

const NASTY_NAME = `UGC — "Lina's before, after" hook 🚀🔥,
15s cut, v2`;

const nasty: AdInsightRow = {
  adName: NASTY_NAME,
  spend: "412.55",
  impressions: "18230",
  linkClicks: "402",
  ctr: "2.204608",
  cpc: "1.026243",
  purchases: "31",
  purchaseValue: "1989.40",
  purchaseRoas: "4.822153",
  costPerPurchase: "13.31",
  leads: "",
  costPerLead: "",
  dateStart: "2026-06-03",
  dateStop: "2026-07-02",
  addToCart: "58",
  contentViews: "134",
  cpm: "22.635767",
};

const plain: AdInsightRow = {
  adName: "Static - Ingredient callout v3",
  spend: "251.75",
  impressions: "9100",
  linkClicks: "180",
  ctr: "1.978021",
  cpc: "1.398611",
  purchases: "12",
  purchaseValue: "675.10",
  purchaseRoas: "2.681708",
  costPerPurchase: "20.98",
  leads: "",
  costPerLead: "",
  dateStart: "2026-06-03",
  dateStop: "2026-07-02",
  // No add-to-cart/content-view actions fired for this ad, and Meta
  // had no CPM to report — all three stay honestly missing, not "0".
  addToCart: "",
  contentViews: "",
  cpm: "",
};

/* 1 — the field-level escape is the exact RFC 4180 form:
       wrapped in quotes, internal quotes doubled, newline preserved. */
assert.equal(
  escapeCsvField(NASTY_NAME),
  `"UGC — ""Lina's before, after"" hook 🚀🔥,\n15s cut, v2"`
);

/* Fields without delimiters/quotes/newlines stay unquoted. */
assert.equal(escapeCsvField(plain.adName), plain.adName);
assert.equal(escapeCsvField("412.55"), "412.55");

/* 2 — full-document round-trip through the app's own parser. */
const csv = insightsToCsv([nasty, plain], "EUR");
const matrix = parseCsv(csv);

assert.equal(matrix.length, 3, "header + 2 data rows");
assert.equal(matrix[0].length, 17, "17 columns in header (Meta Funnel-Column Parity V1 adds 3)");
assert.equal(matrix[1].length, 17, "nasty row keeps 17 fields");
assert.equal(matrix[0][1], "Amount spent (EUR)");
assert.deepEqual(
  matrix[0].slice(14),
  ["Adds to cart", "Content views", "CPM (cost per 1,000 impressions)"],
  "new columns are appended, existing 14 columns keep their position"
);

// The nasty name survives byte-for-byte: comma splits, quote doubling,
// and the embedded newline all round-trip.
assert.equal(matrix[1][0], NASTY_NAME);
assert.equal(matrix[1][1], "412.55");
assert.equal(matrix[1][8], "4.822153");
assert.equal(matrix[2][0], plain.adName);

// Empty metrics serialize as empty cells, not omitted columns.
assert.equal(matrix[1][10], "");
assert.equal(matrix[1][11], "");

// Funnel columns round-trip when present, and stay honestly empty
// (never fabricated as "0") when Meta reported no such action/field.
assert.equal(matrix[1][14], "58", "nasty row: adds to cart survives");
assert.equal(matrix[1][15], "134", "nasty row: content views survives");
assert.equal(matrix[1][16], "22.635767", "nasty row: cpm survives");
assert.equal(matrix[2][14], "", "plain row: missing add-to-cart stays blank, not 0");
assert.equal(matrix[2][15], "", "plain row: missing content view stays blank, not 0");
assert.equal(matrix[2][16], "", "plain row: missing cpm stays blank, not 0");

// CRLF record delimiters (RFC 4180 §2).
assert.ok(csv.includes("\r\n"), "records are CRLF-delimited");

console.log("csv-escaping: all assertions passed");
