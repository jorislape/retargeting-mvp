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

/** last_7d…last_90d are native Graph API date_preset values; the two
 *  longer ranges have no preset and are sent as an explicit time_range
 *  (see fetchAdInsights). */
export const DATE_PRESETS = [
  "last_7d",
  "last_14d",
  "last_30d",
  "last_90d",
  "last_180d",
  "last_365d",
] as const;

export type DatePreset = (typeof DATE_PRESETS)[number];

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  last_7d: "Last 7 days",
  last_14d: "Last 14 days",
  last_30d: "Last 30 days",
  last_90d: "Last 90 days",
  last_180d: "Last 180 days",
  last_365d: "Last 365 days",
};

/**
 * TEMPORARY — one-time ads_archive access diagnostic. Sanitized by
 * construction: it can only ever carry a count/field-name summary or
 * the exact Meta error shape, never ad content and never the access
 * token used to make the call. Gated server-side behind
 * ADS_ARCHIVE_DIAGNOSTIC_ENABLED (default off) in modules/meta/graph.ts
 * — remove this type and its one call site in app/api/meta/callback
 * once ads_archive access is confirmed or ruled out.
 */
export interface AdsArchiveDiagnosticResult {
  ok: boolean;
  /** Present when ok=true. */
  adCount?: number;
  fields?: string[];
  /** Present when ok=false — Meta's own error shape, verbatim. */
  errorCode?: number | null;
  errorSubcode?: number | null;
  errorTitle?: string | null;
  errorMessage?: string | null;
}

/** postMessage payload the OAuth bridge page sends to the opener. */
export interface MetaOAuthMessage {
  type: "meta-oauth";
  ok: boolean;
  token?: string;
  error?: string;
  /** TEMPORARY diagnostic-only field — see AdsArchiveDiagnosticResult. */
  adsArchiveDiagnostic?: AdsArchiveDiagnosticResult;
}
