import { KpiKey } from "./types";

/**
 * Meta Ads Manager CSV exports don't have fixed column names — they
 * vary with the columns/breakdowns the user picked before exporting
 * ("Purchases" vs "Website purchases", "CTR (all)" vs "CTR (link
 * click-through rate)", …). This resolves a logical field to whichever
 * header is actually present, by normalized substring match against a
 * priority-ordered alias list.
 */

function normalize(header: string): string {
  return header
    .toLowerCase()
    .replace(/[()%$,._-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Finds the first header whose normalized form matches one of the
 *  aliases exactly, then falls back to substring containment — exact
 *  matches first so e.g. "results" doesn't shadow "cost per result".
 *  Very short aliases ("ad") are exact-only: as substrings they match
 *  into unrelated headers ("leads", "return on ad spend"). */
function findHeader(headers: string[], aliases: readonly string[]): string | null {
  const normalized = headers.map((h) => ({ header: h, norm: normalize(h) }));
  for (const alias of aliases) {
    const exact = normalized.find((h) => h.norm === alias);
    if (exact) return exact.header;
  }
  for (const alias of aliases) {
    if (alias.length < 3) continue;
    const partial = normalized.find((h) => h.norm.includes(alias));
    if (partial) return partial.header;
  }
  return null;
}

const ALIASES = {
  adName: ["ad name", "ad", "creative name"],
  spend: ["amount spent usd", "amount spent", "spend"],
  impressions: ["impressions"],
  linkClicks: ["link clicks", "clicks all", "clicks"],
  ctr: ["ctr link click through rate", "ctr all", "ctr", "click through rate"],
  cpc: ["cpc cost per link click", "cpc all", "cpc", "cost per click"],
  purchases: [
    "website purchases",
    "on facebook purchases",
    "purchases",
    "results",
  ],
  purchaseValue: [
    "website purchases conversion value",
    "purchases conversion value",
    "conversion value",
  ],
  purchaseRoas: [
    "website purchase roas return on ad spend",
    "purchase roas return on ad spend",
    "roas",
    "return on ad spend",
  ],
  costPerPurchase: [
    "cost per website purchase",
    "cost per purchase",
    "cost per result",
    "cost per action",
    "cpa",
  ],
  leads: ["website leads", "on facebook leads", "leads"],
  costPerLead: ["cost per lead"],
  reportingStarts: ["reporting starts"],
  reportingEnds: ["reporting ends"],
} as const;

export interface ColumnMap {
  adName: string | null;
  spend: string | null;
  impressions: string | null;
  linkClicks: string | null;
  ctr: string | null;
  cpc: string | null;
  purchases: string | null;
  purchaseValue: string | null;
  purchaseRoas: string | null;
  costPerPurchase: string | null;
  leads: string | null;
  costPerLead: string | null;
  reportingStarts: string | null;
  reportingEnds: string | null;
  /** 3-letter currency code pulled from the spend header, if present. */
  currency: string | null;
}

export function resolveColumns(headers: string[]): ColumnMap {
  /* The generic "spend" alias must never substring-match a ROAS column
     ("…return on ad spend") — resolve spend only among headers that
     aren't ROAS-shaped. Real spend headers are unaffected. */
  const spendCandidates = headers.filter(
    (h) => !/roas|return on ad spend/i.test(h)
  );
  const spendHeader = findHeader(spendCandidates, ALIASES.spend);
  const currencyMatch = spendHeader?.match(/\(([A-Za-z]{3})\)/);

  return {
    adName: findHeader(headers, ALIASES.adName),
    spend: spendHeader,
    impressions: findHeader(headers, ALIASES.impressions),
    linkClicks: findHeader(headers, ALIASES.linkClicks),
    ctr: findHeader(headers, ALIASES.ctr),
    cpc: findHeader(headers, ALIASES.cpc),
    purchases: findHeader(headers, ALIASES.purchases),
    purchaseValue: findHeader(headers, ALIASES.purchaseValue),
    purchaseRoas: findHeader(headers, ALIASES.purchaseRoas),
    costPerPurchase: findHeader(headers, ALIASES.costPerPurchase),
    leads: findHeader(headers, ALIASES.leads),
    costPerLead: findHeader(headers, ALIASES.costPerLead),
    reportingStarts: findHeader(headers, ALIASES.reportingStarts),
    reportingEnds: findHeader(headers, ALIASES.reportingEnds),
    currency: currencyMatch ? currencyMatch[1].toUpperCase() : null,
  };
}

/** Columns required to compute a given KPI, for a clear "missing X" error
 *  — checked against what resolveColumns actually found. */
export function requiredColumnsFor(kpi: KpiKey, columns: ColumnMap): string[] {
  const missing: string[] = [];
  if (!columns.spend) missing.push("Amount spent");

  switch (kpi) {
    case "purchases":
      if (!columns.purchases) missing.push("Purchases");
      break;
    case "leads":
      if (!columns.leads) missing.push("Leads");
      break;
    case "ctr":
      if (!columns.ctr && !(columns.linkClicks && columns.impressions)) {
        missing.push("CTR (or Link Clicks + Impressions)");
      }
      break;
    case "cpc":
      if (!columns.cpc && !columns.linkClicks) {
        missing.push("CPC (or Link Clicks)");
      }
      break;
    case "cpa":
      if (
        !columns.costPerPurchase &&
        !columns.costPerLead &&
        !columns.purchases &&
        !columns.leads
      ) {
        missing.push("Cost per purchase/lead (or Purchases/Leads)");
      }
      break;
    case "roas":
      if (!columns.purchaseRoas && !columns.purchaseValue) {
        missing.push("Purchase ROAS (or purchase conversion value)");
      }
      break;
  }
  return missing;
}
