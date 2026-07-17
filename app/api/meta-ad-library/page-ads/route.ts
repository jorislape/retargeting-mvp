import { NextRequest, NextResponse } from "next/server";
import { AdLibraryApiError, queryAdsArchive } from "@/modules/metaAdLibrary/client";
import { isSupportedCountry, partitionAdsByPage } from "@/modules/metaAdLibrary/discovery";
import { normalizeArchivedAd } from "@/modules/metaAdLibrary/normalize";
import {
  describeAdLibraryError,
  MISSING_TOKEN_ERROR,
  UNSUPPORTED_COUNTRY_ERROR,
  type AdLibrarySearchError,
} from "@/modules/metaAdLibrary/errors";

/**
 * POST /api/meta-ad-library/page-ads — fetches ACTIVE ads for ONE
 * user-selected advertiser Page ("Search advertiser" mode, step 2).
 *
 * This is the only route allowed to produce ad content for the flow,
 * and only via search_page_ids for an explicit page_id the user chose
 * from the discovery step — never search_terms. Every returned ad is
 * re-validated against that page_id server-side (partitionAdsByPage);
 * mismatches are excluded and counted, never silently included.
 *
 * ad_snapshot_url embeds the caller's own access token in Meta's raw
 * response — normalizeArchivedAd strips it before the ad object exists,
 * so no token-bearing value can reach this route's response body.
 *
 * One page per request (limit below); the client's "Load more" passes
 * the returned cursor back — nothing here auto-fetches beyond a single
 * page. Stateless: nothing stored, cached, or logged.
 */

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;
const PAGE_ID_RE = /^\d{1,30}$/;
const MAX_CURSOR_CHARS = 2000;

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
  const { pageId, country, after } = (body ?? {}) as Record<string, unknown>;

  if (typeof pageId !== "string" || !PAGE_ID_RE.test(pageId)) {
    return fail(400, {
      title: "Page selection required",
      message: "No valid advertiser Page was selected.",
      fix: "Search for the advertiser and choose the exact Page first.",
    });
  }
  if (typeof country !== "string" || !isSupportedCountry(country)) {
    return fail(400, UNSUPPORTED_COUNTRY_ERROR);
  }
  if (after !== undefined && (typeof after !== "string" || after.length > MAX_CURSOR_CHARS)) {
    return fail(400, {
      title: "Invalid paging cursor",
      message: "The load-more cursor wasn't usable.",
      fix: "Re-run the fetch from the start.",
    });
  }

  try {
    const response = await queryAdsArchive({
      accessToken,
      searchPageIds: [pageId],
      adReachedCountries: [country],
      adType: "ALL",
      adActiveStatus: "ACTIVE",
      limit: PAGE_SIZE,
      after: after as string | undefined,
    });

    // Token-free reference link to this Page's public Ads Library view.
    const sourceUrl = `https://www.facebook.com/ads/library/?view_all_page_id=${pageId}`;
    const normalized = response.data.map((raw) => normalizeArchivedAd(raw, sourceUrl));
    const { matching, excludedMismatchedCount } = partitionAdsByPage(normalized, pageId);

    const hasMore = Boolean(response.paging?.next && response.paging?.cursors?.after);
    return ok({
      ok: true,
      ads: matching,
      excludedMismatchedCount,
      hasMore,
      after: hasMore ? response.paging?.cursors?.after : null,
    });
  } catch (err) {
    if (err instanceof AdLibraryApiError) {
      return fail(err.isRateLimit ? 429 : 502, describeAdLibraryError(err));
    }
    throw err;
  }
}
