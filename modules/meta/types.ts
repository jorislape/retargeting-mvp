/**
 * Shared types for the Meta data source ("virtual CSV").
 *
 * The design contract: OAuth pulls ad-level insights from the Graph
 * API and serializes them into the SAME CSV shape a user would export
 * from Ads Manager. The debrief engine (modules/debrief) is never
 * imported here and never learns where a CSV came from.
 */

export interface MetaAdAccount {
  /** Graph id, always "act_<number>". */
  id: string;
  name: string;
  currency: string;
}

/** One ad's insights, flattened from the Graph response into exactly
 *  the fields the virtual CSV serializes. Numeric fields are kept as
 *  the strings Graph returns ("123.45") — the debrief parser owns
 *  numeric interpretation, same as for a real export. Empty string =
 *  metric absent for this ad (serialized as an empty CSV cell). */
export interface AdInsightRow {
  adName: string;
  spend: string;
  impressions: string;
  linkClicks: string;
  ctr: string;
  cpc: string;
  purchases: string;
  purchaseValue: string;
  purchaseRoas: string;
  costPerPurchase: string;
  leads: string;
  costPerLead: string;
  dateStart: string;
  dateStop: string;
}

export const DATE_PRESETS = [
  "last_7d",
  "last_14d",
  "last_30d",
  "last_90d",
] as const;

export type DatePreset = (typeof DATE_PRESETS)[number];

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  last_7d: "Last 7 days",
  last_14d: "Last 14 days",
  last_30d: "Last 30 days",
  last_90d: "Last 90 days",
};

/** postMessage payload the OAuth bridge page sends to the opener. */
export interface MetaOAuthMessage {
  type: "meta-oauth";
  ok: boolean;
  token?: string;
  error?: string;
}
