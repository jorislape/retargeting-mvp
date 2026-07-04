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
assert.equal(matrix[0].length, 14, "14 columns in header");
assert.equal(matrix[1].length, 14, "nasty row keeps 14 fields");
assert.equal(matrix[0][1], "Amount spent (EUR)");

// The nasty name survives byte-for-byte: comma splits, quote doubling,
// and the embedded newline all round-trip.
assert.equal(matrix[1][0], NASTY_NAME);
assert.equal(matrix[1][1], "412.55");
assert.equal(matrix[1][8], "4.822153");
assert.equal(matrix[2][0], plain.adName);

// Empty metrics serialize as empty cells, not omitted columns.
assert.equal(matrix[1][10], "");
assert.equal(matrix[1][11], "");

// CRLF record delimiters (RFC 4180 §2).
assert.ok(csv.includes("\r\n"), "records are CRLF-delimited");

console.log("csv-escaping: all assertions passed");
