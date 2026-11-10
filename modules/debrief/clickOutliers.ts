/**
 * Batch D3 — click outliers (a real export showed Audience Network at a
 * 22% CTR with almost nothing behind the clicks).
 *
 * With a placement/platform breakdown column, rows are summed per
 * placement and a placement is flagged when its link CTR is ≥ 3× the
 * account CTR while its clicks convert below the median placement's —
 * likely accidental clicks. Without one, the same rule runs per ad
 * (CTR ≥ 3× the median ad's, conversion rate below the median). Pure,
 * decision-blind, display only (never read by the gate, median, ranking
 * or decision).
 */
import { parseNumericCell } from "./csv";
import type { ColumnMap } from "./columns";
import type { ParsedAd } from "./types";

export const CLICK_OUTLIER_MULTIPLE = 3;
const MIN_IMPRESSIONS = 1000;
const MIN_POOL = 3;

/** Placement-type breakdown headers (normalized, exact match). */
const PLACEMENT_HEADERS = new Set(["platform", "publisher platform", "placement", "position", "platform position"]);

export function placementColumns(headers: readonly string[]): string[] {
  return headers.filter((h) => PLACEMENT_HEADERS.has(h.trim().toLowerCase().replace(/\s+/g, " ")));
}

export interface ClickOutlier {
  /** Placement label ("Audience Network · Native, banner…") or ad name. */
  label: string;
  impressions: number;
  ctr: number;
  /** Conversion rate: outcomes per 100 link clicks. */
  convRate: number;
}

export interface ClickOutliers {
  basis: "placement" | "ad";
  /** Account CTR (placement basis) or the median ad's CTR (ad basis). */
  ctrBar: number;
  medianConvRate: number;
  items: ClickOutlier[];
}

function median(values: number[]): number {
  const s = [...values].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

type Unit = { label: string; impressions: number; clicks: number; outcomes: number };

function flag(units: Unit[], basis: ClickOutliers["basis"], ctrBarOf: (pool: Unit[]) => number): ClickOutliers | null {
  const pool = units.filter((u) => u.impressions >= MIN_IMPRESSIONS && u.clicks > 0);
  if (pool.length < MIN_POOL) return null;
  const ctrBar = ctrBarOf(pool);
  const medianConvRate = median(pool.map((u) => (u.outcomes / u.clicks) * 100));
  const items = pool
    .map((u) => ({ label: u.label, impressions: u.impressions, ctr: (u.clicks / u.impressions) * 100, convRate: (u.outcomes / u.clicks) * 100 }))
    .filter((u) => ctrBar > 0 && u.ctr >= CLICK_OUTLIER_MULTIPLE * ctrBar && u.convRate < medianConvRate)
    .sort((x, y) => y.ctr - x.ctr);
  return items.length > 0 ? { basis, ctrBar, medianConvRate, items } : null;
}

/** `outcomeColumn` is the count column behind the KPI (purchases or
 *  leads); without it, conversion rate can't be read and nothing is
 *  flagged. */
export function detectClickOutliers(
  rawRows: readonly Record<string, string>[],
  columns: ColumnMap,
  ads: readonly ParsedAd[],
  outcomeColumn: string | null
): ClickOutliers | null {
  const placements = placementColumns(Object.keys(rawRows[0] ?? {}));
  if (placements.length > 0 && columns.impressions && (columns.linkClicks || columns.ctr) && outcomeColumn) {
    const byPlacement = new Map<string, Unit>();
    for (const row of rawRows) {
      const label = placements.map((c) => row[c]?.trim()).filter(Boolean).join(" · ");
      const impressions = parseNumericCell(row[columns.impressions]) ?? 0;
      if (!label || impressions <= 0) continue;
      const clicks = columns.linkClicks
        ? parseNumericCell(row[columns.linkClicks]) ?? 0
        : ((parseNumericCell(row[columns.ctr!]) ?? 0) * impressions) / 100;
      const u = byPlacement.get(label) ?? { label, impressions: 0, clicks: 0, outcomes: 0 };
      u.impressions += impressions;
      u.clicks += clicks;
      u.outcomes += parseNumericCell(row[outcomeColumn]) ?? 0;
      byPlacement.set(label, u);
    }
    const units = [...byPlacement.values()];
    const total = units.reduce((s, u) => ({ i: s.i + u.impressions, c: s.c + u.clicks }), { i: 0, c: 0 });
    return flag(units, "placement", () => (total.i > 0 ? (total.c / total.i) * 100 : 0));
  }
  const units = ads
    .filter((a) => a.impressions != null && a.linkClicks != null && a.conversions != null)
    .map((a) => ({ label: a.name, impressions: a.impressions as number, clicks: a.linkClicks as number, outcomes: a.conversions as number }));
  return flag(units, "ad", (pool) => median(pool.map((u) => (u.clicks / u.impressions) * 100)));
}
