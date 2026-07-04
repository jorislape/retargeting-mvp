import type { AdInsightRow } from "./types.ts";

/**
 * Serializes pulled insights into a "virtual CSV" — byte-for-byte the
 * kind of file a user would export from Ads Manager, so the debrief
 * pipeline (parseCsv → resolveColumns → extractAds) runs on it
 * unchanged and never knows the data arrived via OAuth.
 *
 * Escaping is RFC 4180: any field containing a comma, a double quote,
 * or a line break is wrapped in double quotes, with internal quotes
 * doubled. Ad names in the wild contain all of those (plus emoji,
 * which needs no escaping — the CSV is UTF-8 like Meta's own exports).
 * Records are CRLF-delimited per the RFC; the parser accepts both.
 *
 * This file must stay free of runtime imports (type-only is fine) so
 * the escaping fixture test can run it directly under Node.
 */

/** Headers are chosen to hit modules/debrief/columns.ts alias matching
 *  exactly — including the "(CUR)" suffix on spend, which is where the
 *  debrief engine reads the account currency from. */
const HEADERS = (currency: string) =>
  [
    "Ad name",
    `Amount spent (${currency})`,
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
  ] as const;

export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function insightsToCsv(rows: AdInsightRow[], currency: string): string {
  const lines: string[] = [];
  lines.push(HEADERS(currency).map(escapeCsvField).join(","));
  for (const row of rows) {
    lines.push(
      [
        row.adName,
        row.spend,
        row.impressions,
        row.linkClicks,
        row.ctr,
        row.cpc,
        row.purchases,
        row.purchaseValue,
        row.purchaseRoas,
        row.costPerPurchase,
        row.leads,
        row.costPerLead,
        row.dateStart,
        row.dateStop,
      ]
        .map(escapeCsvField)
        .join(",")
    );
  }
  return lines.join("\r\n") + "\r\n";
}
