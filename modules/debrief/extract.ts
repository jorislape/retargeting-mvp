import { ClickBasis, ColumnMap, clickBasisFor } from "./columns";
import { parseNumericCell } from "./csv";
import {
  CREATIVE_FORMAT_LABELS,
  CreativeFormatOverrides,
  KpiKey,
  ParsedAd,
} from "./types";

/** Lightweight, best-effort creative-format hints from the ad name only
 *  — never presented as a confirmed angle, only as a structural signal
 *  when it's consistent across several ads (see analysis.ts). */
const NAME_TAGS: { tag: string; pattern: RegExp }[] = [
  { tag: "video", pattern: /\bvideo\b/i },
  { tag: "ugc", pattern: /\bugc\b/i },
  { tag: "static", pattern: /\bstatic\b|\bimage\b/i },
  { tag: "carousel", pattern: /\bcarousel\b/i },
  { tag: "testimonial", pattern: /\btestimonial|review\b/i },
  { tag: "before/after", pattern: /before.?after/i },
  { tag: "discount/promo", pattern: /\bsale|discount|promo|off\b|%/i },
  { tag: "urgency", pattern: /\blimited|hurry|ends soon|last chance\b/i },
];

export function extractNameTags(name: string): string[] {
  // Ad names routinely use separator conventions like
  // "UGC_MorningRoutine_V1" — underscores/dots/dashes are \w chars, so
  // \b-anchored patterns would miss them. Normalize to spaces first.
  const haystack = name.replace(/[_\-./]+/g, " ");
  return NAME_TAGS.filter((t) => t.pattern.test(haystack)).map((t) => t.tag);
}

function kpiValueForRow(
  row: Record<string, string>,
  columns: ColumnMap,
  kpi: KpiKey,
  spend: number,
  click: ClickBasis | null = null
): number | null {
  /* Attribution & Intent 2: rank on click-only conversions/value when
     the export has them — blended (view-through-inflated) columns and
     Meta's blended cost/ROAS columns are not read for the KPI then. */
  if (click && kpi === "roas") {
    const value = parseNumericCell(row[click.value as string]);
    return value != null && spend > 0 ? value / spend : null;
  }
  if (click && kpi === "cpa") {
    const n = parseNumericCell(row[click.count as string]);
    return n != null && n > 0 ? spend / n : null;
  }
  switch (kpi) {
    case "purchases": {
      return columns.purchases ? parseNumericCell(row[columns.purchases]) : null;
    }
    case "leads": {
      return columns.leads ? parseNumericCell(row[columns.leads]) : null;
    }
    case "ctr": {
      const direct = columns.ctr ? parseNumericCell(row[columns.ctr]) : null;
      if (direct != null) return direct;
      if (columns.linkClicks && columns.impressions) {
        const clicks = parseNumericCell(row[columns.linkClicks]);
        const impressions = parseNumericCell(row[columns.impressions]);
        if (clicks != null && impressions && impressions > 0) {
          return (clicks / impressions) * 100;
        }
      }
      return null;
    }
    case "cpc": {
      const direct = columns.cpc ? parseNumericCell(row[columns.cpc]) : null;
      if (direct != null) return direct;
      if (columns.linkClicks) {
        const clicks = parseNumericCell(row[columns.linkClicks]);
        if (clicks && clicks > 0) return spend / clicks;
      }
      return null;
    }
    case "cpa": {
      const direct = columns.costPerPurchase
        ? parseNumericCell(row[columns.costPerPurchase])
        : columns.costPerLead
          ? parseNumericCell(row[columns.costPerLead])
          : null;
      if (direct != null) return direct;
      const conversions =
        (columns.purchases ? parseNumericCell(row[columns.purchases]) : null) ??
        (columns.leads ? parseNumericCell(row[columns.leads]) : null);
      if (conversions && conversions > 0) return spend / conversions;
      return null;
    }
    case "roas": {
      const direct = columns.purchaseRoas
        ? parseNumericCell(row[columns.purchaseRoas])
        : null;
      if (direct != null) return direct;
      if (columns.purchaseValue) {
        const value = parseNumericCell(row[columns.purchaseValue]);
        if (value != null && spend > 0) return value / spend;
      }
      return null;
    }
  }
}

/** CPA Leads Label: which data a row's CPA value actually came from —
 *  mirrors kpiValueForRow's "cpa" branch exactly (same columns, same
 *  order, same null rules), so it can never disagree with the value:
 *  the direct cost column (Cost per purchase, else Cost per lead — and
 *  Cost per lead is only read when NO Cost per purchase column exists),
 *  else spend ÷ (purchases ?? leads). null when nothing was readable. */
function cpaBasisForRow(
  row: Record<string, string>,
  columns: ColumnMap
): "purchase" | "lead" | null {
  if (columns.costPerPurchase) {
    if (parseNumericCell(row[columns.costPerPurchase]) != null) return "purchase";
  } else if (columns.costPerLead) {
    if (parseNumericCell(row[columns.costPerLead]) != null) return "lead";
  }
  if (columns.purchases && parseNumericCell(row[columns.purchases]) != null) return "purchase";
  if (columns.leads && parseNumericCell(row[columns.leads]) != null) return "lead";
  return null;
}

/** Tester Feedback Fix 2: true when a CPA row has no computable value
 *  because its conversion count is a real 0 — mirrors the count
 *  kpiValueForRow's "cpa" branch divides by (purchases ?? leads). A
 *  blank/missing cell parses to null and stays false: missing ≠ zero. */
function cpaZeroConversions(row: Record<string, string>, columns: ColumnMap): boolean {
  const count =
    (columns.purchases ? parseNumericCell(row[columns.purchases]) : null) ??
    (columns.leads ? parseNumericCell(row[columns.leads]) : null);
  return count === 0;
}

/** Real-account fix 1: true when a ROAS row has no ROAS value because
 *  it recorded NO purchases — an explicit 0 purchases or 0 purchase
 *  value, or (Meta writes blank, not 0, for "no actions") a blank
 *  purchases/value cell in a column that holds numbers on other rows.
 *  A row with purchases > 0 but no value stays a genuinely missing
 *  value, and a column that is blank on EVERY row proves nothing
 *  (missing ≠ zero) — those stay "no ROAS value". */
function roasZeroPurchases(
  row: Record<string, string>,
  columns: ColumnMap,
  click: ClickBasis | null,
  populated: { count: boolean; value: boolean }
): boolean {
  const countHeader = click ? click.count : columns.purchases;
  const valueHeader = click ? click.value : columns.purchaseValue;
  const count = countHeader ? parseNumericCell(row[countHeader]) : null;
  const value = valueHeader ? parseNumericCell(row[valueHeader]) : null;
  if (count === 0 || value === 0) return true;
  if (count != null || value != null) return false;
  return populated.count || populated.value;
}

/** Evidence Inputs V1: the raw conversion count behind a purchase-based
 *  KPI — purchases for roas/cpa/purchases, leads for leads — when a count
 *  column is present. Returns null for ctr/cpc (their reliability axis is
 *  clicks, not conversions) and null when no count column resolved. NEVER
 *  estimated (e.g. never ROAS × spend ÷ AOV) and never fed to the gate,
 *  median, ranking, or any KPI value — this is display-only context. */
function conversionsForRow(
  row: Record<string, string>,
  columns: ColumnMap,
  kpi: KpiKey,
  click: ClickBasis | null = null
): number | null {
  /* The same click-only count the KPI was ranked on (floor, zero rule,
     displayed counts all agree). */
  if (click && (kpi === "roas" || kpi === "cpa")) {
    return click.count ? parseNumericCell(row[click.count]) : kpi === "roas" ? conversionsForRow(row, columns, kpi) : null;
  }
  switch (kpi) {
    case "leads":
      return columns.leads ? parseNumericCell(row[columns.leads]) : null;
    case "roas":
    case "cpa":
    case "purchases":
      return columns.purchases ? parseNumericCell(row[columns.purchases]) : null;
    case "ctr":
    case "cpc":
      return null;
  }
}

/** Attribution & Intent 3: click vs view-through conversion counts for
 *  the KPI's conversion type (purchases for ROAS/Purchases/purchase CPA,
 *  leads for Leads/CPL) — present only when BOTH a click-only column
 *  (7-day preferred) and a view-through column exist and both cells
 *  parse. Display-only: never fed to the gate, median, ranking or
 *  decision. */
function viewThroughForRow(
  row: Record<string, string>,
  columns: ColumnMap,
  kpi: KpiKey
): { viewThrough?: { click: number; view: number } } {
  const s = columns.attributionSplits;
  const field =
    kpi === "leads" ? "leads" : kpi === "cpa" ? (s.purchases ? "purchases" : "leads") : kpi === "roas" || kpi === "purchases" ? "purchases" : null;
  const split = field ? s[field] : undefined;
  const clickHeader = split?.click7 ?? split?.click1;
  if (!split?.view || !clickHeader) return {};
  const click = parseNumericCell(row[clickHeader]);
  const view = parseNumericCell(row[split.view]);
  return click != null && view != null ? { viewThrough: { click, view } } : {};
}

/** Evidence Diagnostic V1: raw upstream funnel fields, captured on
 *  EVERY ad regardless of the selected KPI — unlike ctr/cpc, which are
 *  only derived when the KPI itself is ctr/cpc, these are read for
 *  every row so evidenceDiagnostic.ts can walk them for whichever ad
 *  needs them. Never estimated: a missing column or unparseable cell
 *  stays null, never 0. */
function upstreamFieldsForRow(row: Record<string, string>, columns: ColumnMap) {
  return {
    impressions: columns.impressions ? parseNumericCell(row[columns.impressions]) : null,
    linkClicks: columns.linkClicks ? parseNumericCell(row[columns.linkClicks]) : null,
    addToCart: columns.addToCart ? parseNumericCell(row[columns.addToCart]) : null,
    contentViews: columns.contentViews ? parseNumericCell(row[columns.contentViews]) : null,
    cpm: columns.cpm ? parseNumericCell(row[columns.cpm]) : null,
    /* Tester Feedback Fix 6: delivery context, display-only. */
    frequency: columns.frequency ? parseNumericCell(row[columns.frequency]) : null,
    reach: columns.reach ? parseNumericCell(row[columns.reach]) : null,
    /* Mixed Segment Warning: structure names, display-only (blank → null). */
    adSetName: columns.adSetName ? row[columns.adSetName]?.trim() || null : null,
    /* Attribution & Intent 4: engagement → intent signals, display-only. */
    videoPlays3s: columns.videoPlays3s ? parseNumericCell(row[columns.videoPlays3s]) : null,
    thruPlays: columns.thruPlays ? parseNumericCell(row[columns.thruPlays]) : null,
    outboundClicks: columns.outboundClicks ? parseNumericCell(row[columns.outboundClicks]) : null,
    campaignName: columns.campaignName ? row[columns.campaignName]?.trim() || null : null,
  };
}

/** Converts raw CSV rows into ParsedAd[]. Rows with no ad-name column
 *  get a positional fallback label so the flow still works, but the
 *  caller should surface that as a confidence note. */
export function extractAds(
  rows: Record<string, string>[],
  columns: ColumnMap,
  kpi: KpiKey
): ParsedAd[] {
  /* Attribution & Intent 2: click-only basis for ROAS/CPA/CPL when the
     export has it (7-day preferred); null ⇒ blended, as before. */
  const click = clickBasisFor(kpi, columns);
  const hasNumber = (header: string | null | undefined) =>
    header != null && rows.some((r) => parseNumericCell(r[header]) != null);
  /* A zero is only inferred when the export carries ROAS data at all
     (a ROAS or purchase-value column with numbers): with neither, no
     ad has a ROAS and a 0-purchase row is no different (missing ≠ 0). */
  const roasData =
    kpi === "roas" &&
    (hasNumber(click ? click.value : columns.purchaseValue) || (!click && hasNumber(columns.purchaseRoas)));
  const roasPopulated = roasData
    ? {
        count: hasNumber(click ? click.count : columns.purchases),
        value: hasNumber(click ? click.value : columns.purchaseValue),
      }
    : null;
  const ads = rows
    .map((row, index) => {
      const spend = columns.spend ? (parseNumericCell(row[columns.spend]) ?? 0) : 0;
      const name = columns.adName && row[columns.adName]
        ? row[columns.adName]
        : `Ad ${index + 1}`;
      /* Period Comparison V2: keep the Ad ID cell (trimmed) when the
         column exists — the reliable cross-period key. Never invented:
         an empty cell stays null. */
      const rawId = columns.adId ? row[columns.adId] : undefined;
      const id = rawId && rawId.trim() !== "" ? rawId.trim() : null;
      const rawKpiValue = kpiValueForRow(row, columns, kpi, spend, click);
      /* Real-account fix 1: a ROAS row with spend and no purchases is a
         0x result, not a missing value — it takes the same zero-outcome
         path as a zero-conversion CPA ad (judged as the worst past its
         own spend bar, set aside and named under it). */
      const roasZero =
        roasPopulated != null &&
        rawKpiValue == null &&
        spend > 0 &&
        roasZeroPurchases(row, columns, click, roasPopulated);
      /* …and its ROAS IS 0x (unlike a zero-conversion CPA, which has no
         value) — kept out of the median by its zeroConversions flag. */
      const kpiValue = roasZero ? 0 : rawKpiValue;
      return {
        name,
        id,
        spend,
        kpiValue,
        /* Tester Feedback Fix 2 — key present only when true, so other
           ads (and every non-CPA run) are key-for-key unchanged. */
        ...((kpi === "cpa" &&
          kpiValue == null &&
          (click ? parseNumericCell(row[click.count as string]) === 0 : cpaZeroConversions(row, columns))) ||
        roasZero
          ? { zeroConversions: true as const }
          : {}),
        nameTags: extractNameTags(name),
        conversions: roasZero ? 0 : conversionsForRow(row, columns, kpi, click),
        ...viewThroughForRow(row, columns, kpi),
        ...upstreamFieldsForRow(row, columns),
        /* Spreadsheet row number (header = row 1) — used only for the
           duplicate-name display label below. */
        fileRow: index + 2,
        /* CPA Leads Label — internal, stripped below. */
        cpaRowBasis:
          kpi === "cpa"
            ? click
              ? parseNumericCell(row[click.count as string]) != null
                ? click.countField === "leads" ? ("lead" as const) : ("purchase" as const)
                : null
              : cpaBasisForRow(row, columns)
            : null,
        leadCount:
          kpi === "cpa"
            ? click
              ? click.countField === "leads" ? parseNumericCell(row[click.count as string]) : null
              : columns.leads ? parseNumericCell(row[columns.leads]) : null
            : null,
      };
    })
    .filter((ad) => ad.spend > 0 || ad.kpiValue != null); // drop fully-blank rows

  /* CPA Leads Label: when EVERY CPA value in this export is lead-based
     (a lead-gen account), the outcome behind CPA is leads — so the count
     carried for display/evidence is the leads count, and each ad is
     tagged cpaBasis "lead". The CPA values themselves are untouched.
     A mixed or purchase-based export keeps the existing purchase count. */
  const valued = ads.filter((a) => a.kpiValue != null);
  const leadBased =
    kpi === "cpa" && valued.length > 0 && valued.every((a) => a.cpaRowBasis === "lead");

  return disambiguateDuplicateNames(ads).map(({ fileRow, ...withMeta }) => {
    const ad: Partial<typeof withMeta> = { ...withMeta };
    const leadCount = withMeta.leadCount;
    delete ad.cpaRowBasis;
    delete ad.leadCount;
    const parsed = ad as ParsedAd;
    return leadBased ? { ...parsed, conversions: leadCount, cpaBasis: "lead" as const } : parsed;
  });
}

/** Trim + collapse internal whitespace — the identity-comparison key
 *  only (never a display value; see disambiguateDuplicateNames). */
export function normalizeRowName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Duplicate Identity fix: the same normalized name on multiple rows
 *  is NOT proof of one creative (the same name routinely appears
 *  across ad sets with very different results). Rows stay separate
 *  ads; each duplicate's display name gains a deterministic,
 *  client-readable "(row N)" suffix so no report sentence can ever
 *  name the same label as both winner and loser. The raw name is
 *  preserved in sourceName for cross-period and override matching —
 *  row positions are NOT stable across exports, so labels must never
 *  become match keys. Files without duplicates are byte-identical to
 *  before this fix.
 *
 *  Factored out of extractAds (Creative Grouping V1) so the Generator's
 *  client-side preview can compute the IDENTICAL per-row disambiguated
 *  identity the server will independently (but deterministically)
 *  recompute — the two must never drift, since Creative Group
 *  assignments are keyed to this exact identity (see
 *  modules/debrief/creativeGroups.ts). */
export function disambiguateDuplicateNames<T extends { name: string; fileRow: number }>(
  items: readonly T[]
): (T & { sourceName?: string })[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = normalizeRowName(item.name);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return items.map((item) => {
    if ((counts.get(normalizeRowName(item.name)) ?? 0) <= 1) return item;
    return {
      ...item,
      name: `${item.name.trim()} (row ${item.fileRow})`,
      sourceName: item.name,
    };
  });
}

/**
 * Applies user-confirmed creative formats (Creative Format Confirmation
 * V1). A matched ad's tags become exactly the confirmed format and it's
 * flagged `formatConfirmed`, so the memo can say "Format confirmed as …"
 * instead of "Ad name suggests …". Touches ONLY nameTags — spend, KPI
 * values, and everything the gate/median/ranking reads stay untouched.
 * Unknown format tags are ignored; no overrides in → the exact same
 * array back out.
 */
export function applyFormatOverrides(
  ads: ParsedAd[],
  overrides: CreativeFormatOverrides
): ParsedAd[] {
  if (Object.keys(overrides).length === 0) return ads;
  return ads.map((ad) => {
    // The generator's confirmation list shows trimmed names; extraction
    // keeps the raw cell — accept either so a padded cell still matches.
    // Duplicate-named rows carry their raw name in sourceName (the
    // display name has a "(row N)" suffix the user never typed); the
    // one override then applies to every row sharing the name, exactly
    // as before the Duplicate Identity fix.
    const raw = ad.sourceName ?? ad.name;
    const format = overrides[raw] ?? overrides[raw.trim()];
    if (!format || !(format in CREATIVE_FORMAT_LABELS)) return ad;
    return { ...ad, nameTags: [format], formatConfirmed: true };
  });
}
