/**
 * Meta Ad Library API spike — minimal server-side client for the
 * `ads_archive` Graph API edge (NOT the same edge as
 * modules/meta/graph.ts's Ad Insights pull — different product,
 * different access rules, deliberately NOT imported from there or
 * anywhere in modules/meta to keep this spike fully isolated and
 * removable if the decision is "not viable").
 *
 * Scoping fact confirmed against Meta's own docs (developers.facebook.
 * com/docs/graph-api/reference/ads_archive/): "Ads that did not reach
 * any location in the EU will only return if they are about social
 * issues, elections or politics." I.e. non-political commercial ads
 * are only queryable when ad_reached_countries targets an EU country
 * (UK is cited in secondary sources but wasn't confirmed on an
 * official page during this spike — see the report).
 *
 * Token handling: read from an environment variable only, forwarded
 * as a query param the way Meta's own ads_archive examples show it
 * (this edge, unlike Insights, does not document an Authorization-
 * header form) — never logged, never returned to a caller. Errors are
 * logged as structural facts (status/code/type) only, same discipline
 * as modules/meta/graph.ts.
 */

export const AD_LIBRARY_GRAPH_API_VERSION = "v23.0";
const GRAPH_BASE = `https://graph.facebook.com/${AD_LIBRARY_GRAPH_API_VERSION}`;

export class AdLibraryApiError extends Error {
  status: number;
  code: number | null;
  type: string | null;
  subcode: number | null;

  constructor(message: string, status: number, code: number | null, type: string | null, subcode: number | null) {
    super(message);
    this.name = "AdLibraryApiError";
    this.status = status;
    this.code = code;
    this.type = type;
    this.subcode = subcode;
  }

  /** Token invalid/expired (190) or the request wasn't authenticated at all. */
  get isAuthError(): boolean {
    return this.status === 401 || this.code === 190;
  }

  /** Permission-shaped: the token is valid but this app/token isn't
   *  authorized for the Ad Library API specifically — the likely shape
   *  of "needs ID verification" or "Ad Library API product not added"
   *  per the spike's unverified-but-likely findings. */
  get isPermissionError(): boolean {
    return this.code === 10 || this.code === 200 || this.code === 294 || this.code === 3;
  }

  /** Graph throttling codes (same set modules/meta/graph.ts treats as
   *  rate-limit, plus 613 which Meta's ads_archive page cites by name). */
  get isRateLimit(): boolean {
    return this.code === 4 || this.code === 17 || this.code === 32 || this.code === 613;
  }
}

export interface RawArchivedAd {
  id?: string;
  page_id?: string;
  page_name?: string;
  ad_creation_time?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  ad_snapshot_url?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_captions?: string[];
  ad_creative_link_descriptions?: string[];
  publisher_platforms?: string[];
  languages?: string[];
}

export interface AdsArchiveResponse {
  data: RawArchivedAd[];
  paging?: { cursors?: { before?: string; after?: string }; next?: string };
}

interface GraphErrorBody {
  error?: { message?: string; type?: string; code?: number; error_subcode?: number };
}

/** All-ads fields confirmed available regardless of ad_type on the
 *  fetched archived-ad reference page — deliberately excludes the
 *  political/issue-ads-only fields (bylines, spend, impressions,
 *  demographic_distribution, etc.), which this spike has no legitimate
 *  use for and which would silently be empty/absent for commercial ads
 *  anyway. */
const FIELDS = [
  "id",
  "page_id",
  "page_name",
  "ad_creation_time",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "ad_snapshot_url",
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "ad_creative_link_captions",
  "ad_creative_link_descriptions",
  "publisher_platforms",
  "languages",
].join(",");

export interface AdsArchiveQuery {
  accessToken: string;
  searchTerms: string;
  /** ISO country codes. Per the confirmed EU-scoping fact, this must
   *  contain at least one EU country for a non-political advertiser's
   *  ads to return anything at all. */
  adReachedCountries: string[];
  adType?: "ALL" | "POLITICAL_AND_ISSUE_ADS" | "FINANCIAL_PRODUCTS_AND_SERVICES_ADS" | "EMPLOYMENT_ADS" | "HOUSING_ADS";
  limit?: number;
}

/**
 * One-shot query against ads_archive. Never throws on a well-formed
 * Graph error response — it maps that into AdLibraryApiError so the
 * probe script can classify auth/permission/rate-limit/other cleanly.
 * Network-level failures (DNS, timeout, refused) throw a generic
 * AdLibraryApiError with status 502.
 */
export async function queryAdsArchive(query: AdsArchiveQuery): Promise<AdsArchiveResponse> {
  const params = new URLSearchParams({
    access_token: query.accessToken,
    search_terms: query.searchTerms,
    ad_type: query.adType ?? "ALL",
    ad_reached_countries: JSON.stringify(query.adReachedCountries),
    fields: FIELDS,
    limit: String(query.limit ?? 10),
  });

  let res: Response;
  try {
    res = await fetch(`${GRAPH_BASE}/ads_archive?${params}`, { cache: "no-store" });
  } catch {
    throw new AdLibraryApiError("Couldn't reach the Meta Graph API.", 502, null, null, null);
  }

  const body = (await res.json().catch(() => ({}))) as AdsArchiveResponse & GraphErrorBody;
  if (!res.ok || body.error) {
    const err = body.error ?? {};
    // Structural log only: never the access token, never returned ad data.
    console.error("metaAdLibrary: ads_archive request failed", {
      status: res.status,
      code: err.code ?? null,
      type: err.type ?? null,
      subcode: err.error_subcode ?? null,
    });
    throw new AdLibraryApiError(
      err.message ?? "Ad Library API request failed.",
      res.status,
      err.code ?? null,
      err.type ?? null,
      err.error_subcode ?? null
    );
  }
  return body;
}
