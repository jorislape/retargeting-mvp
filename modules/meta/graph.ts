import type {
  AdInsightRow,
  AdsArchiveDiagnosticResult,
  DatePreset,
  MetaAdAccount,
} from "./types";

/**
 * Server-side Meta Graph API client for the read-only data source.
 *
 * Version policy: pinned to the newest stable release so the app never
 * ships against a version already burning deprecation runway. v25.0
 * released 2026-02-18; Graph versions get ~2 years of support, so this
 * pin is safe until ~2028. When bumping, re-check the /insights field
 * list and `use_unified_attribution_setting` in the changelog.
 *
 * Token handling: the user access token arrives per-request from the
 * client (it lives only in browser memory — see MetaProvider) and is
 * forwarded to Graph via the Authorization header, never as a query
 * parameter, so it can't leak into URLs, paging links, or logs. Errors
 * are logged as structural facts (code/type) only.
 */

export const GRAPH_API_VERSION = "v25.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export const FACEBOOK_OAUTH_DIALOG = `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`;

/** Read-only. Never widen without an explicit product decision. */
export const META_OAUTH_SCOPE = "ads_read";

/** CSRF nonce cookie for the OAuth round-trip (login → callback).
 *  A flow nonce only — the access token itself is never cookied. */
export const STATE_COOKIE = "meta_oauth_state";

const INSIGHTS_PAGE_SIZE = 500;
/** Hard cap well under the debrief route's 5,000-row limit. */
export const MAX_INSIGHTS_ROWS = 2000;

/** Extracts the user token from an Authorization header value.
 *  Meta user tokens are URL-safe (alnum plus |_-); anything else is
 *  rejected before it can reach a fetch call. */
export function bearerToken(header: string | null): string | null {
  const match = (header ?? "").match(/^Bearer ([A-Za-z0-9|_-]+)$/);
  return match ? match[1] : null;
}

export class GraphApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: number | null,
    readonly type: string | null
  ) {
    super(message);
    this.name = "GraphApiError";
  }

  /** True when the failure is the token (expired/invalidated) rather
   *  than the request — the UI should prompt a reconnect. */
  get isAuthError(): boolean {
    return this.status === 401 || this.code === 190;
  }

  /** Graph throttling codes — the user should wait, not reconnect. */
  get isRateLimit(): boolean {
    return (
      this.code === 4 || this.code === 17 || this.code === 32 || this.code === 613
    );
  }

  /** Permission-shaped failures: the login works but can't read this
   *  account's insights (missing ads_read grant on the asset, etc.). */
  get isPermissionError(): boolean {
    return this.code === 10 || this.code === 200 || this.code === 294 || this.code === 3;
  }
}

interface GraphErrorBody {
  error?: { message?: string; type?: string; code?: number };
}

async function graphGet<T>(url: string, accessToken: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
  } catch {
    throw new GraphApiError("Couldn't reach the Meta API.", 502, null, null);
  }

  const body = (await res.json().catch(() => ({}))) as T & GraphErrorBody;
  if (!res.ok || body.error) {
    const err = body.error ?? {};
    // Structural log only: never the token, never response data.
    console.error("meta: graph request failed", {
      status: res.status,
      code: err.code ?? null,
      type: err.type ?? null,
    });
    throw new GraphApiError(
      err.message ?? "Meta API request failed.",
      res.status,
      err.code ?? null,
      err.type ?? null
    );
  }
  return body;
}

/* ---------------- OAuth code exchange (app secret stays here) ------ */

export async function exchangeCodeForToken(
  code: string,
  appId: string,
  appSecret: string,
  redirectUri: string
): Promise<string> {
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });
  let res: Response;
  try {
    res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params}`, {
      cache: "no-store",
    });
  } catch {
    throw new GraphApiError("Couldn't reach the Meta API.", 502, null, null);
  }
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
  } & GraphErrorBody;
  if (!res.ok || !body.access_token) {
    const err = body.error ?? {};
    console.error("meta: token exchange failed", {
      status: res.status,
      code: err.code ?? null,
      type: err.type ?? null,
    });
    throw new GraphApiError(
      "Meta didn't accept the sign-in. Try connecting again.",
      res.status,
      err.code ?? null,
      err.type ?? null
    );
  }
  return body.access_token;
}

/* ---------------- TEMPORARY: ads_archive access diagnostic --------- */
/* One-time, flag-gated check of whether the just-connected user token */
/* can query the Ad Library API at all. Remove this whole block (plus  */
/* its one call site in app/api/meta/callback/route.ts and the         */
/* AdsArchiveDiagnosticResult type) once ads_archive access is         */
/* confirmed or ruled out — this is not the ingestion feature itself.  */

const ADS_ARCHIVE_DIAGNOSTIC_SEARCH_TERMS = "ColonBroom";
const ADS_ARCHIVE_DIAGNOSTIC_COUNTRY = "US";
const ADS_ARCHIVE_DIAGNOSTIC_LIMIT = 5;

/** Off unless ADS_ARCHIVE_DIAGNOSTIC_ENABLED is exactly "true" or "1"
 *  — same convention as modules/monitoring/flag.ts. Default OFF means
 *  normal OAuth behavior (message shape, network calls) is completely
 *  unchanged unless someone deliberately flips this for this one test. */
export function adsArchiveDiagnosticEnabled(): boolean {
  const v = (process.env.ADS_ARCHIVE_DIAGNOSTIC_ENABLED ?? "").trim().toLowerCase();
  return v === "true" || v === "1";
}

interface AdsArchiveErrorBody {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    error_user_title?: string;
  };
}

/**
 * Calls ads_archive ONCE with a fixed, small, hardcoded query
 * (ColonBroom / US / limit 5) using the token that was just obtained —
 * never a stored or reused token. Returns only a sanitized summary:
 * ad count and field NAMES (never ad content) on success, or Meta's
 * exact error code/subcode/title/message on failure. The access token
 * itself is used solely as this fetch's Authorization header value —
 * it is never included in the returned object, never logged, and
 * nothing about this call is persisted anywhere.
 */
export async function checkAdsArchiveAccess(
  accessToken: string
): Promise<AdsArchiveDiagnosticResult> {
  const params = new URLSearchParams({
    search_terms: ADS_ARCHIVE_DIAGNOSTIC_SEARCH_TERMS,
    ad_reached_countries: JSON.stringify([ADS_ARCHIVE_DIAGNOSTIC_COUNTRY]),
    limit: String(ADS_ARCHIVE_DIAGNOSTIC_LIMIT),
  });
  try {
    const res = await fetch(`${GRAPH_BASE}/ads_archive?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as {
      data?: Record<string, unknown>[];
    } & AdsArchiveErrorBody;

    if (!res.ok || body.error) {
      const err = body.error ?? {};
      return {
        ok: false,
        errorCode: err.code ?? null,
        errorSubcode: err.error_subcode ?? null,
        errorTitle: err.error_user_title ?? null,
        errorMessage: err.message ?? "Unknown error",
      };
    }

    const data = Array.isArray(body.data) ? body.data : [];
    const fields = [...new Set(data.flatMap((ad) => Object.keys(ad)))];
    return { ok: true, adCount: data.length, fields };
  } catch {
    return {
      ok: false,
      errorCode: null,
      errorSubcode: null,
      errorTitle: null,
      errorMessage: "Network error calling ads_archive.",
    };
  }
}

/* ---------------- Ad accounts ------------------------------------- */

interface RawAdAccount {
  id: string;
  name?: string;
  account_id?: string;
  currency?: string;
}

export async function fetchAdAccounts(
  accessToken: string
): Promise<MetaAdAccount[]> {
  const params = new URLSearchParams({
    fields: "name,account_id,currency",
    limit: "100",
  });
  const body = await graphGet<{ data?: RawAdAccount[] }>(
    `${GRAPH_BASE}/me/adaccounts?${params}`,
    accessToken
  );
  return (body.data ?? []).map((a) => ({
    id: a.id,
    name: a.name ?? `Account ${a.account_id ?? a.id}`,
    currency: (a.currency ?? "USD").toUpperCase(),
  }));
}

/* ---------------- Ad-level insights ------------------------------- */

interface ActionEntry {
  action_type?: string;
  value?: string;
}

interface RawInsightRow {
  ad_name?: string;
  spend?: string;
  impressions?: string;
  inline_link_clicks?: string;
  inline_link_click_ctr?: string;
  cost_per_inline_link_click?: string;
  actions?: ActionEntry[];
  action_values?: ActionEntry[];
  purchase_roas?: ActionEntry[];
  cost_per_action_type?: ActionEntry[];
  account_currency?: string;
  date_start?: string;
  date_stop?: string;
}

/** With unified attribution, omni_* is the cross-channel total Ads
 *  Manager shows; the pixel-specific types are fallbacks for older
 *  accounts. First present key wins. */
const PURCHASE_KEYS = [
  "omni_purchase",
  "purchase",
  "offsite_conversion.fb_pixel_purchase",
];
const LEAD_KEYS = ["lead", "offsite_conversion.fb_pixel_lead"];

function pickAction(
  entries: ActionEntry[] | undefined,
  keys: string[]
): string {
  if (!entries) return "";
  for (const key of keys) {
    const hit = entries.find((e) => e.action_type === key);
    if (hit?.value != null) return hit.value;
  }
  return "";
}

export interface InsightsResult {
  rows: AdInsightRow[];
  currency: string;
  dateStart: string | null;
  dateStop: string | null;
  truncated: boolean;
}

/** Ranges the Graph API has no date_preset for — sent as an explicit
 *  trailing time_range instead. */
const RELATIVE_RANGE_DAYS: Partial<Record<DatePreset, number>> = {
  last_180d: 180,
  last_365d: 365,
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function fetchAdInsights(
  accessToken: string,
  accountId: string,
  datePreset: DatePreset
): Promise<InsightsResult> {
  const params = new URLSearchParams({
    level: "ad",
    // REQUIRED: makes pulled conversions/ROAS follow each ad set's
    // unified attribution setting, so numbers match Ads Manager.
    use_unified_attribution_setting: "true",
    fields: [
      "ad_name",
      "spend",
      "impressions",
      "inline_link_clicks",
      "inline_link_click_ctr",
      "cost_per_inline_link_click",
      "actions",
      "action_values",
      "purchase_roas",
      "cost_per_action_type",
      "account_currency",
      "date_start",
      "date_stop",
    ].join(","),
    limit: String(INSIGHTS_PAGE_SIZE),
  });

  const rangeDays = RELATIVE_RANGE_DAYS[datePreset];
  if (rangeDays) {
    const until = new Date();
    const since = new Date(until.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    params.set(
      "time_range",
      JSON.stringify({ since: isoDate(since), until: isoDate(until) })
    );
  } else {
    params.set("date_preset", datePreset);
  }

  const raw: RawInsightRow[] = [];
  let currency = "USD";
  let url: string | null = `${GRAPH_BASE}/${accountId}/insights?${params}`;
  let truncated = false;

  while (url && raw.length < MAX_INSIGHTS_ROWS) {
    const body: {
      data?: RawInsightRow[];
      paging?: { next?: string };
    } = await graphGet(url, accessToken);
    for (const row of body.data ?? []) {
      if (raw.length >= MAX_INSIGHTS_ROWS) {
        truncated = true;
        break;
      }
      raw.push(row);
      if (row.account_currency) currency = row.account_currency.toUpperCase();
    }
    // paging.next never contains the token (it was sent via header).
    url = body.paging?.next ?? null;
    if (url && raw.length >= MAX_INSIGHTS_ROWS) truncated = true;
  }

  const rows: AdInsightRow[] = raw.map((r) => ({
    adName: r.ad_name ?? "",
    spend: r.spend ?? "",
    impressions: r.impressions ?? "",
    linkClicks: r.inline_link_clicks ?? "",
    ctr: r.inline_link_click_ctr ?? "",
    cpc: r.cost_per_inline_link_click ?? "",
    purchases: pickAction(r.actions, PURCHASE_KEYS),
    purchaseValue: pickAction(r.action_values, PURCHASE_KEYS),
    purchaseRoas: pickAction(r.purchase_roas, PURCHASE_KEYS),
    costPerPurchase: pickAction(r.cost_per_action_type, PURCHASE_KEYS),
    leads: pickAction(r.actions, LEAD_KEYS),
    costPerLead: pickAction(r.cost_per_action_type, LEAD_KEYS),
    dateStart: r.date_start ?? "",
    dateStop: r.date_stop ?? "",
  }));

  return {
    rows,
    currency,
    dateStart: raw[0]?.date_start ?? null,
    dateStop: raw[0]?.date_stop ?? null,
    truncated,
  };
}
