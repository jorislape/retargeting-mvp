import { NextRequest, NextResponse } from "next/server";
import {
  generateCompetitorDebrief,
  type CompetitorDebriefApiError,
} from "@/modules/competitorDebrief";

/**
 * POST /api/competitor-debrief — the entire backend for the Competitor
 * Debrief flow (separate from /api/debrief's CSV pipeline).
 *
 * Stateless, same as /api/debrief: the request body is read, validated,
 * turned into a debrief in memory, and returned. Nothing is written to
 * a database, disk, cache, or log — not the competitor name, not the
 * URLs, not the pasted observations.
 *
 * No network access happens here or in the engine: the Ads Library URL
 * and the optional website URL are validated for shape only and echoed
 * back as source references — never fetched. That is a deliberate
 * scope decision for this version, not an oversight.
 */

export const dynamic = "force-dynamic";

const MAX_NAME_CHARS = 200;
const MAX_URL_CHARS = 2000;
const MAX_OBSERVATIONS_CHARS = 20_000;

function ok(body: unknown) {
  return NextResponse.json(body, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

function fail(status: number, error: CompetitorDebriefApiError) {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

/** Lenient shape check: accepts URLs missing a scheme by assuming
 *  https://, since this is never fetched — only stored as a reference
 *  string. Returns null when it still can't parse as a URL. */
function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, {
      title: "Request could not be read",
      message: "The request body wasn't valid JSON.",
      fix: "Try again from the Competitor Debrief form.",
    });
  }

  if (typeof body !== "object" || body === null) {
    return fail(400, {
      title: "Request could not be read",
      message: "The request body wasn't in the expected shape.",
      fix: "Try again from the Competitor Debrief form.",
    });
  }

  const { competitorName, adsLibraryUrl, websiteUrl, observations } =
    body as Record<string, unknown>;

  if (typeof competitorName !== "string" || competitorName.trim() === "") {
    return fail(400, {
      title: "Competitor name required",
      message: "Enter the competitor's name.",
      fix: "Add a competitor name and try again.",
    });
  }
  if (competitorName.length > MAX_NAME_CHARS) {
    return fail(400, {
      title: "Competitor name too long",
      message: `Competitor name must be under ${MAX_NAME_CHARS} characters.`,
      fix: "Shorten the competitor name.",
    });
  }
  // A competitor name is never a URL — reject outright rather than let
  // a misplaced/autofilled URL end up standing in for the name
  // throughout the debrief (that exact bug shipped in an earlier
  // preview: a deployment URL was pasted into this field and echoed
  // back everywhere the name should appear).
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(competitorName.trim())) {
    return fail(400, {
      title: "That looks like a URL, not a name",
      message: "The competitor name field can't be a web address.",
      fix: 'Enter the competitor\'s name (e.g. "ColonBroom") and put URLs in the Ads Library / Website fields.',
    });
  }

  if (typeof adsLibraryUrl !== "string" || adsLibraryUrl.trim() === "") {
    return fail(400, {
      title: "Ads Library URL required",
      message: "Paste the Meta Ads Library URL for this competitor.",
      fix: "Find the competitor in the Meta Ads Library and paste the page URL.",
    });
  }
  if (adsLibraryUrl.length > MAX_URL_CHARS) {
    return fail(400, {
      title: "Ads Library URL too long",
      message: "That URL is too long to be valid.",
      fix: "Paste the direct Ads Library page URL.",
    });
  }
  const normalizedAdsLibraryUrl = normalizeUrl(adsLibraryUrl);
  if (!normalizedAdsLibraryUrl) {
    return fail(400, {
      title: "Invalid Ads Library URL",
      message: "That doesn't look like a valid web address.",
      fix: "Paste a full URL, e.g. https://www.facebook.com/ads/library/?...",
    });
  }

  let normalizedWebsiteUrl: string | undefined;
  if (typeof websiteUrl === "string" && websiteUrl.trim() !== "") {
    if (websiteUrl.length > MAX_URL_CHARS) {
      return fail(400, {
        title: "Website URL too long",
        message: "That URL is too long to be valid.",
        fix: "Paste the competitor's landing page URL.",
      });
    }
    const normalized = normalizeUrl(websiteUrl);
    if (!normalized) {
      return fail(400, {
        title: "Invalid website URL",
        message: "That doesn't look like a valid web address.",
        fix: "Paste a full URL, e.g. https://example.com, or leave it blank.",
      });
    }
    normalizedWebsiteUrl = normalized;
  }

  if (typeof observations !== "string") {
    return fail(400, {
      title: "Observations required",
      message: "Add what you observed about this competitor's ads.",
      fix: "Paste ad copy, hooks, offers, formats, or general notes.",
    });
  }
  if (observations.length > MAX_OBSERVATIONS_CHARS) {
    return fail(400, {
      title: "Observations too long",
      message: `Observations must be under ${MAX_OBSERVATIONS_CHARS.toLocaleString()} characters.`,
      fix: "Trim the pasted text to the most relevant parts.",
    });
  }

  const debrief = generateCompetitorDebrief({
    competitorName,
    adsLibraryUrl: normalizedAdsLibraryUrl,
    websiteUrl: normalizedWebsiteUrl,
    observations,
  });

  return ok({ ok: true, debrief });
}
