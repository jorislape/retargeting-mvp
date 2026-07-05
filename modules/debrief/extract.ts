import { ColumnMap } from "./columns";
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
  spend: number
): number | null {
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

/** Converts raw CSV rows into ParsedAd[]. Rows with no ad-name column
 *  get a positional fallback label so the flow still works, but the
 *  caller should surface that as a confidence note. */
export function extractAds(
  rows: Record<string, string>[],
  columns: ColumnMap,
  kpi: KpiKey
): ParsedAd[] {
  return rows
    .map((row, index) => {
      const spend = columns.spend ? (parseNumericCell(row[columns.spend]) ?? 0) : 0;
      const name = columns.adName && row[columns.adName]
        ? row[columns.adName]
        : `Ad ${index + 1}`;
      return {
        name,
        spend,
        kpiValue: kpiValueForRow(row, columns, kpi, spend),
        nameTags: extractNameTags(name),
      };
    })
    .filter((ad) => ad.spend > 0 || ad.kpiValue != null); // drop fully-blank rows
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
    const format = overrides[ad.name] ?? overrides[ad.name.trim()];
    if (!format || !(format in CREATIVE_FORMAT_LABELS)) return ad;
    return { ...ad, nameTags: [format], formatConfirmed: true };
  });
}
