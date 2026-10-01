import { ColumnMap, requiredColumnsFor } from "./columns";
import { extractAds } from "./extract";
import { KpiKey } from "./types";

/**
 * First-Run Fixes: can this export actually be read with a given KPI?
 *
 * "Has columns" (the existing requiredColumnsFor check) isn't enough —
 * a Meta pull always carries a ROAS column, empty for a lead-gen
 * account. This counts how many ads get a real value for each KPI,
 * using the exact extraction the engine runs (extractAds), so the
 * preview, the auto-switch, and the decision's suggestion can never
 * disagree with what the analysis will actually see.
 *
 * Read-only and deterministic: nothing here touches a number, the
 * gate, or the decision.
 */

/** Same order as the generator's KPI selector. */
export const KPI_ORDER: readonly KpiKey[] = ["roas", "cpa", "ctr", "cpc", "leads", "purchases"];

export interface KpiUsability {
  kpi: KpiKey;
  /** Every column the KPI needs resolved (requiredColumnsFor is empty). */
  hasColumns: boolean;
  /** Ads with a real value for this KPI. */
  withValue: number;
  /** Ads in the export. */
  total: number;
  /** Columns present AND at least one ad has a value. */
  usable: boolean;
}

export function kpiUsability(
  rows: Record<string, string>[],
  columns: ColumnMap
): Record<KpiKey, KpiUsability> {
  const out = {} as Record<KpiKey, KpiUsability>;
  for (const kpi of KPI_ORDER) {
    const hasColumns = requiredColumnsFor(kpi, columns).length === 0;
    const ads = hasColumns ? extractAds(rows, columns, kpi) : [];
    const withValue = ads.filter((a) => a.kpiValue != null).length;
    out[kpi] = {
      kpi,
      hasColumns,
      withValue,
      total: hasColumns ? ads.length : rows.length,
      usable: hasColumns && withValue > 0,
    };
  }
  return out;
}

/** Preference when the data has to pick the KPI: conversion outcomes
 *  before click metrics. Deliberately NOT plain selector order — CPA is
 *  purchase-framed throughout the engine (outcomeNounsForKpi), so a
 *  lead-gen export switched to CPA would read "this export carries no
 *  purchase counts" everywhere; such an export should land on Leads. */
const AUTO_PREFERENCE: readonly KpiKey[] = ["roas", "cpa", "purchases", "leads", "ctr", "cpc"];

/** The best KPI this export can be read with, excluding `except`.
 *  CPA only counts when purchases actually back it. Shared by the
 *  generator's auto-switch and the hold's "Try …" suggestion so the two
 *  never disagree. */
export function preferredUsableKpi(
  usability: Record<KpiKey, KpiUsability>,
  except?: KpiKey
): KpiKey | null {
  return (
    AUTO_PREFERENCE.find(
      (k) =>
        k !== except &&
        usability[k].usable &&
        (k !== "cpa" || usability.purchases.usable)
    ) ?? null
  );
}

/** The KPI to switch to after new data loads, or null to keep the
 *  current one. Never switches away from a manual choice, never away
 *  from a usable KPI, and never invents one (null ⇒ the existing
 *  missing-column guidance applies). */
export function chooseAutoKpi(
  current: KpiKey,
  usability: Record<KpiKey, KpiUsability>,
  manuallyChosen: boolean
): KpiKey | null {
  if (manuallyChosen) return null;
  if (usability[current]?.usable) return null;
  return preferredUsableKpi(usability, current);
}

/** Preview warning: the selected KPI's column exists but most ads have
 *  no value in it (fewer than half). null when it doesn't apply. */
export function sparseKpiWarning(u: KpiUsability, label: string): string | null {
  if (!u.hasColumns || u.total === 0) return null;
  if (u.withValue === 0) {
    return `No ${label} values in this export — every ad would be set aside. Pick a KPI this export has values for.`;
  }
  if (u.withValue * 2 < u.total) {
    return `Only ${u.withValue} of ${u.total} ads have a ${label} value in this export — the rest will be set aside, not judged.`;
  }
  return null;
}
