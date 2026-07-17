import { NextRequest, NextResponse } from "next/server";
import { AdLibraryApiError, queryAdsArchive } from "@/modules/metaAdLibrary/client";
import { dedupePageCandidates, isSupportedCountry } from "@/modules/metaAdLibrary/discovery";
import {
  describeAdLibraryError,
  MISSING_TOKEN_ERROR,
  UNSUPPORTED_COUNTRY_ERROR,
  type AdLibrarySearchError,
} from "@/modules/metaAdLibrary/errors";

/**
 * POST /api/meta-ad-library/search — advertiser DISCOVERY for the
 * "Search advertiser" mode (Meta Ad Library API Integration V1).
 *
 * Deliberately returns candidate PAGES only, never ads: search_terms
 * is full-text matching over creative content (confirmed live — a
 * brand-name search returns unrelated advertisers whose ad text
 * happens to match), so nothing from this route is allowed to be
 * presented as, or flow into, any competitor's ad payload. The ads
 * behind the search exist here only long enough to be reduced to a
 * deduplicated page_name/page_id list.
 *
 * Stateless like the rest of the product: nothing about the request
 * or response is stored, cached, or logged (upstream failures are
 * logged as structural facts only, inside the shared client). The
 * Meta access token is read from the server environment per request
 * and never reaches the browser, the response body, or a log line.
 */

export const dynamic = "force-dynamic";

const MAX_QUERY_CHARS = 100; // ads_archive's documented search_terms cap
const DISCOVERY_SAMPLE_LIMIT = 25;

function ok(body: unknown) {
  return NextResponse.json(body, { status: 200, headers: { "Cache-Control": "no-store" } });
}

function fail(status: number, error: AdLibrarySearchError) {
  return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const accessToken = process.env.META_AD_LIBRARY_ACCESS_TOKEN;
  if (!accessToken) return fail(503, MISSING_TOKEN_ERROR);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, {
      title: "Request could not be read",
      message: "The request body wasn't valid JSON.",
      fix: "Try again from the advertiser search form.",
    });
  }
  const { query, country } = (body ?? {}) as Record<string, unknown>;

  if (typeof query !== "string" || query.trim() === "") {
    return fail(400, {
      title: "Search text required",
      message: "Enter an advertiser or brand name to search for.",
      fix: "Type a name and try again.",
    });
  }
  if (query.length > MAX_QUERY_CHARS) {
    return fail(400, {
      title: "Search text too long",
      message: `Search text must be under ${MAX_QUERY_CHARS} characters.`,
      fix: "Shorten the search text.",
    });
  }
  if (typeof country !== "string" || !isSupportedCountry(country)) {
    return fail(400, UNSUPPORTED_COUNTRY_ERROR);
  }

  try {
    const response = await queryAdsArchive({
      accessToken,
      searchTerms: query.trim(),
      adReachedCountries: [country],
      adType: "ALL",
      limit: DISCOVERY_SAMPLE_LIMIT,
    });
    return ok({ ok: true, pages: dedupePageCandidates(response.data) });
  } catch (err) {
    if (err instanceof AdLibraryApiError) {
      return fail(err.isRateLimit ? 429 : 502, describeAdLibraryError(err));
    }
    throw err;
  }
}
