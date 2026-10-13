/**
 * Trust Pass 2 — the real account result for the selected KPI, from
 * TOTALS across every analyzed ad (judged or set aside): what the
 * account actually delivered, shown next to the median (the middle
 * ad). A median of 2.31x can sit beside an account ROAS of 1.32x —
 * showing only the median misread as "the account's ROAS".
 *
 *   ROAS      = Σ value ÷ Σ spend         (value = ROAS × spend per ad)
 *   CPA / CPL = Σ spend ÷ Σ conversions   (count column; else spend ÷ CPA)
 *   CTR       = Σ clicks ÷ Σ impressions × 100
 *   CPC       = Σ spend ÷ Σ clicks
 *   Purchases / Leads = Σ count
 *
 * A zero-outcome ad contributes 0 value / 0 conversions (never dropped
 * — that would flatter the account). An ad whose parts are genuinely
 * unknown is left out, and the coverage (adsCovered of adsTotal) is
 * returned so the label can say so. Pure; display-only — never read by
 * the gate, median, ranking or decision.
 */
import type { KpiKey, ParsedAd } from "./types";

export interface AccountKpi {
  value: number;
  adsCovered: number;
  adsTotal: number;
}

export function computeAccountKpi(ads: readonly ParsedAd[], kpi: KpiKey): AccountKpi | null {
  let num = 0;
  let den = 0;
  let covered = 0;
  for (const ad of ads) {
    let n: number | null = null; // numerator part
    let d: number | null = null; // denominator part
    switch (kpi) {
      case "roas":
        if (ad.kpiValue != null) n = ad.kpiValue * ad.spend;
        else if (ad.conversions === 0) n = 0; // no purchases → no value
        d = ad.spend;
        break;
      case "cpa":
        n = ad.spend;
        d =
          ad.conversions != null
            ? ad.conversions
            : ad.zeroConversions
              ? 0
              : ad.kpiValue != null && ad.kpiValue > 0
                ? ad.spend / ad.kpiValue
                : null;
        break;
      case "ctr": {
        const clicks =
          ad.linkClicks ?? (ad.kpiValue != null && ad.impressions != null ? (ad.kpiValue * ad.impressions) / 100 : null);
        n = clicks;
        d = ad.impressions ?? null;
        break;
      }
      case "cpc":
        n = ad.spend;
        d = ad.linkClicks ?? (ad.kpiValue != null && ad.kpiValue > 0 ? ad.spend / ad.kpiValue : null);
        break;
      case "purchases":
      case "leads":
        n = ad.kpiValue;
        d = 0;
        break;
    }
    if (n == null || d == null) continue;
    num += n;
    den += d;
    covered += 1;
  }
  if (covered === 0) return null;
  let value: number;
  if (kpi === "purchases" || kpi === "leads") value = num;
  else if (den <= 0) return null;
  else value = kpi === "ctr" ? (num / den) * 100 : num / den;
  return { value, adsCovered: covered, adsTotal: ads.length };
}
