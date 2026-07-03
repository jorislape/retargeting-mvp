import { KpiKey } from "./types";

export function fmtMoney(value: number, currency: string | null): string {
  const rounded = Math.round(value * 100) / 100;
  const formatted = rounded.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (!currency || currency === "USD") return `$${formatted}`;
  return `${formatted} ${currency}`;
}

export function fmtCount(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded)
    ? rounded.toLocaleString("en-US")
    : rounded.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

/** Formats a KPI value in its own unit (money for CPA/CPC, "x" for
 *  ROAS, "%" for CTR, a plain count for Leads/Purchases). */
export function fmtKpiValue(
  value: number,
  kpi: KpiKey,
  currency: string | null
): string {
  switch (kpi) {
    case "roas":
      return `${value.toFixed(2)}x`;
    case "ctr":
      return `${value.toFixed(2)}%`;
    case "cpa":
    case "cpc":
      return fmtMoney(value, currency);
    case "leads":
    case "purchases":
      return fmtCount(value);
  }
}

export function fmtDeltaVsMedian(deltaFromMedian: number, deltaPct: number | null): string {
  const direction = deltaFromMedian > 0 ? "better" : "worse";
  if (deltaPct == null) return direction;
  return `${Math.abs(deltaPct).toFixed(0)}% ${direction} than median`;
}
