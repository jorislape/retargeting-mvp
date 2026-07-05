import { NextRequest, NextResponse } from "next/server";
import { extractPageSignals, type FetchPageResponse } from "@/modules/competitor";
import { fetchCompetitorPage } from "@/modules/competitor/server";

/**
 * POST /api/competitor/fetch-page — Competitor Landing Page Fetch V1.
 *
 * One user-triggered fetch of one public landing page, returned as
 * deterministic "observed on page" signals. This is NOT monitoring:
 * nothing recurs, nothing is scheduled, and Ads Library URLs are
 * refused by policy inside the guard.
 *
 * Stateless like the rest of the product: the page HTML lives in
 * memory for this request only — no database, no cache, no file. The
 * URL and page text are never logged (errors below log nothing at
 * all; every failure path is already a structured, user-safe message,
 * so server internals are never exposed either).
 *
 * SSRF protection lives in modules/competitor/server.ts: http/https
 * only, no credentials, standard ports, hostname blocklist, DNS
 * resolution with every address checked against private/reserved
 * ranges, and re-validation of every redirect hop. See that file.
 */

export const dynamic = "force-dynamic";

const MAX_URL_LENGTH = 2000;

function respond(body: FetchPageResponse, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  let url: unknown;
  try {
    ({ url } = await request.json());
  } catch {
    url = null;
  }
  if (typeof url !== "string" || url.trim() === "" || url.length > MAX_URL_LENGTH) {
    return respond(
      {
        ok: false,
        title: "No URL to fetch",
        message: "A valid page URL wasn't included in the request.",
        fix: "Enter the competitor's landing page URL and try again.",
      },
      400
    );
  }

  const result = await fetchCompetitorPage(url);
  if (!result.ok) {
    return respond(result, 400);
  }

  const signals = extractPageSignals(result.parts);
  if (signals === null) {
    return respond(
      {
        ok: false,
        title: "No readable signals",
        message:
          "The page loaded, but no usable text signals were found — it may be heavily scripted or nearly empty.",
        fix: "Open the page and paste its key points (headline, offer, claims) into Notes manually.",
      },
      422
    );
  }

  return respond({ ok: true, signals }, 200);
}
