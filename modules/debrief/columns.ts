import { ColumnMatch, ConversionField, CpaBasis, KpiColumnSource, KpiKey } from "./types";

/**
 * Meta Ads Manager CSV exports don't have fixed column names — they
 * vary with the columns/breakdowns the user picked before exporting
 * ("Purchases" vs "Website purchases", "CTR (all)" vs "CTR (link
 * click-through rate)", …). This resolves a logical field to whichever
 * header is actually present, by normalized substring match against a
 * priority-ordered alias list.
 */

/** The one "export at ad level" instruction — shared by the API's
 *  structured errors and the generator's upload preview so the two can
 *  never drift. */
export const EXPORT_AT_AD_LEVEL = "Export ads at ad level for a date range with delivery.";

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
 *  into unrelated headers ("leads", "return on ad spend").
 *
 *  KPI Source Column Disclosure: also reports WHICH alias matched and
 *  whether it matched exactly — the chosen header is identical to the
 *  pre-disclosure resolver (same passes, same order); this only
 *  exposes how it was found. */
function findHeaderMatch(
  headers: string[],
  aliases: readonly string[]
): { header: string; alias: string; exact: boolean } | null {
  const normalized = headers.map((h) => ({ header: h, norm: normalize(h) }));
  for (const alias of aliases) {
    const exact = normalized.find((h) => h.norm === alias);
    if (exact) return { header: exact.header, alias, exact: true };
  }
  for (const alias of aliases) {
    if (alias.length < 3) continue;
    const partial = normalized.find((h) => h.norm.includes(alias));
    if (partial) return { header: partial.header, alias, exact: false };
  }
  return null;
}

function findHeader(headers: string[], aliases: readonly string[]): string | null {
  return findHeaderMatch(headers, aliases)?.header ?? null;
}

/** True when a header would match any alias under findHeaderMatch's
 *  own rules (exact, or containment for aliases of 3+ characters). */
function matchesAny(header: string, aliases: readonly string[]): boolean {
  const norm = normalize(header);
  return aliases.some((a) => norm === a || (a.length >= 3 && norm.includes(a)));
}

const ALIASES = {
  adName: ["ad name", "ad", "creative name"],
  /* Period Comparison V2: Meta's optional "Ad ID" column — the reliable
     cross-period identifier when the user included it in the export.
     Exact-first like every alias; no existing header contains "ad id"
     as a substring, so the fallback pass is safe too. */
  adId: ["ad id"],
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
  /* Evidence Diagnostic V1: upstream funnel signals, resolved the same
     way as every other alias here but never required — a CSV without
     these columns is a complete no-op for the diagnostic (see
     modules/debrief/evidenceDiagnostic.ts), never an error. */
  addToCart: ["website adds to cart", "adds to cart", "add to cart"],
  contentViews: ["website content views", "content views"],
  /* Meta's own reported CPM column — read verbatim, never derived from
     spend/impressions, so there is never a second, competing CPM
     definition alongside whatever Ads Manager itself computed. */
  cpm: ["cpm cost per 1 000 impressions", "cpm"],
} as const;

/** Meta's per-campaign optimisation-event columns. They're resolved as
 *  purchases / cost per purchase (unchanged behaviour), but "Results"
 *  counts whatever each campaign optimises for — so a match through
 *  these aliases is always disclosed, exact or not. */
const RESULTS_ALIASES: readonly string[] = ["results", "cost per result"];

/** The conversion fields whose source header is recorded. Other fields
 *  (spend, CTR, dates, …) are standard, unambiguous Meta columns and
 *  stay out of the disclosure entirely. */
const CONVERSION_FIELDS: readonly ConversionField[] = [
  "purchases",
  "leads",
  "purchaseValue",
  "purchaseRoas",
  "costPerPurchase",
  "costPerLead",
];

/** A header that matches a MORE specific field is never listed as an
 *  ignored variant of a broader one — e.g. "Offline purchases
 *  conversion value" contains "purchases" but is a value column, not a
 *  competing purchases count. */
const MORE_SPECIFIC: Partial<Record<ConversionField, ConversionField[]>> = {
  purchases: ["purchaseValue", "purchaseRoas", "costPerPurchase"],
  leads: ["costPerLead"],
};

export interface ColumnSource {
  header: string;
  match: ColumnMatch;
  /** Other headers that ALSO matched this field's aliases but weren't
   *  used (e.g. "Qualified leads" when "Leads" won). Display-only. */
  ignored: string[];
}

export interface ColumnMap {
  adName: string | null;
  /** "Ad ID" when present — optional; used only for cross-period ad
   *  matching (Period Comparison V2), never required. */
  adId: string | null;
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
  /** Evidence Diagnostic V1 — optional upstream funnel columns. */
  addToCart: string | null;
  contentViews: string | null;
  cpm: string | null;
  /** 3-letter currency code pulled from the spend header, if present. */
  currency: string | null;
  /** KPI Source Column Disclosure: for each RESOLVED conversion field,
   *  the header used and how it matched. Never read by extract/analysis
   *  math — disclosure only. */
  sources: Partial<Record<ConversionField, ColumnSource>>;
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
    adId: findHeader(headers, ALIASES.adId),
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
    addToCart: findHeader(headers, ALIASES.addToCart),
    contentViews: findHeader(headers, ALIASES.contentViews),
    cpm: findHeader(headers, ALIASES.cpm),
    currency: currencyMatch ? currencyMatch[1].toUpperCase() : null,
    sources: resolveSources(headers),
  };
}

function resolveSources(headers: string[]): ColumnMap["sources"] {
  const sources: ColumnMap["sources"] = {};
  for (const field of CONVERSION_FIELDS) {
    const aliases = ALIASES[field];
    const hit = findHeaderMatch(headers, aliases);
    if (!hit) continue;
    const excluded = (MORE_SPECIFIC[field] ?? []).flatMap((f) => [...ALIASES[f]]);
    const ignored = headers.filter(
      (h) => h !== hit.header && matchesAny(h, aliases) && !matchesAny(h, excluded)
    );
    /* A trailing currency code ("Cost per purchase (USD)") is how Meta
       labels standard money columns — that's still the standard column,
       not a variant, so it classifies as exact. Classification only:
       the resolved header above is untouched. */
    const exactModuloCurrency =
      hit.exact || normalize(hit.header.replace(/\s*\([A-Za-z]{3}\)\s*$/, "")) === hit.alias;
    sources[field] = {
      header: hit.header,
      match: RESULTS_ALIASES.includes(hit.alias)
        ? "results"
        : exactModuloCurrency
          ? "exact"
          : "partial",
      ignored,
    };
  }
  return sources;
}

/** The conversion fields extract.ts actually reads for a KPI, in read
 *  order — mirrors kpiValueForRow/conversionsForRow exactly:
 *  roas: direct ROAS column, else purchase value; plus the purchases
 *        count (display-only conversions)
 *  cpa:  direct cost-per-purchase, else cost-per-lead; plus purchases
 *        (count + per-row fallback divisor), else leads (fallback only)
 *  ctr/cpc read no conversion field. */
export function kpiReadFields(
  kpi: KpiKey,
  columns: ColumnMap,
  /** CPA Leads Label: lead-based CPA reads Cost per lead only when NO
   *  Cost per purchase column exists (extract.ts's order), else spend ÷
   *  leads — never the empty purchase columns. */
  cpaBasis?: CpaBasis
): ConversionField[] {
  const has = (f: ConversionField) => columns[f] != null;
  if (kpi === "cpa" && cpaBasis === "leads") {
    const out: ConversionField[] = [];
    if (!has("costPerPurchase") && has("costPerLead")) out.push("costPerLead");
    if (has("leads")) out.push("leads");
    return out;
  }
  switch (kpi) {
    case "purchases":
      return has("purchases") ? ["purchases"] : [];
    case "leads":
      return has("leads") ? ["leads"] : [];
    case "roas": {
      const out: ConversionField[] = [];
      if (has("purchaseRoas")) out.push("purchaseRoas");
      else if (has("purchaseValue")) out.push("purchaseValue");
      if (has("purchases")) out.push("purchases");
      return out;
    }
    case "cpa": {
      const out: ConversionField[] = [];
      if (has("costPerPurchase")) out.push("costPerPurchase");
      else if (has("costPerLead")) out.push("costPerLead");
      if (has("purchases")) out.push("purchases");
      else if (has("leads")) out.push("leads");
      return out;
    }
    case "ctr":
    case "cpc":
      return [];
  }
}

/** The disclosure-worthy sources behind a KPI: only partial matches and
 *  Meta "Results"-alias matches. Standard exact matches return nothing,
 *  so a normal export (and the sample) produces an empty list. */
export function kpiColumnSourcesFor(
  kpi: KpiKey,
  columns: ColumnMap,
  cpaBasis?: CpaBasis
): KpiColumnSource[] {
  const out: KpiColumnSource[] = [];
  for (const field of kpiReadFields(kpi, columns, cpaBasis)) {
    const src = columns.sources[field];
    if (src && src.match !== "exact") out.push({ field, header: src.header, match: src.match });
  }
  return out;
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

const PREVIEW_LABEL: Record<ConversionField, string> = {
  purchases: "Purchases",
  leads: "Leads",
  purchaseValue: "Purchase value",
  purchaseRoas: "ROAS",
  costPerPurchase: "Cost per purchase",
  costPerLead: "Cost per lead",
};

function quoted(headers: string[]): string {
  const q = headers.map((h) => `'${h}'`);
  if (q.length <= 1) return q.join("");
  return `${q.slice(0, -1).join(", ")} and ${q[q.length - 1]}`;
}

/** Upload-preview line: which column each conversion field behind the
 *  selected KPI is read from, and which competing variants were found
 *  but not used. null for KPIs that read no conversion column (CTR/CPC)
 *  or when none resolved. Display only — same resolver the API uses. */
export function kpiSourcePreview(
  kpi: KpiKey,
  columns: ColumnMap,
  cpaBasis?: CpaBasis
): string | null {
  const fields = kpiReadFields(kpi, columns, cpaBasis);
  const parts = fields.flatMap((field) => {
    const src = columns.sources[field];
    if (!src) return [];
    let part = `${PREVIEW_LABEL[field]} from column '${src.header}'`;
    if (src.match === "results") part += " (Meta's optimisation event — check it's the conversion you mean)";
    /* Report Clarity Pass: a partial match ("Qualified leads" read as
       leads) gets the same check-the-conversion hint. */
    if (src.match === "partial") part += " (check it's the conversion you mean)";
    if (src.ignored.length > 0) {
      part += ` — ${quoted(src.ignored)} also found, not used`;
    }
    return [part];
  });
  if (parts.length === 0) return null;
  /* CPA Leads Label: no direct cost column read ⇒ CPL is derived. */
  const derived =
    kpi === "cpa" && cpaBasis === "leads" && !fields.includes("costPerLead")
      ? " Cost per lead = spend ÷ leads."
      : "";
  return `${parts.join("; ")}.${derived}`;
}
