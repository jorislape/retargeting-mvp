import { NextRequest, NextResponse } from "next/server";
import { GRAPH_API_VERSION, resolveMetaConfig } from "@/modules/meta";

/**
 * GET /api/meta/config — OAuth configuration diagnostics.
 *
 * Answers two questions without exposing any secret:
 *   1. Is the Meta data source configured at all? (drives whether the
 *      Connect button is enabled)
 *   2. Which exact redirect URI will this deployment send to Facebook?
 *      (must appear verbatim in the Meta app's "Valid OAuth Redirect
 *      URIs" — the answer to every "URL blocked" error)
 *
 * Safe by construction: the redirect URI and redirectSource are public
 * facts (the URI appears in the OAuth dialog URL the browser visits);
 * META_APP_SECRET is never read into the response.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const config = resolveMetaConfig(request);

  const body = config.ok
    ? {
        ok: true,
        configured: true,
        redirectUri: config.redirectUri,
        redirectSource: config.redirectSource,
        graphVersion: GRAPH_API_VERSION,
      }
    : {
        ok: true,
        configured: false,
        missing: config.missing,
        error: config.error,
      };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
