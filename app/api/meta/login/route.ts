import { NextRequest, NextResponse } from "next/server";
import {
  bridgeResponse,
  FACEBOOK_OAUTH_DIALOG,
  META_OAUTH_SCOPE,
  requestOrigin,
  resolveMetaConfig,
  STATE_COOKIE,
} from "@/modules/meta";

/**
 * GET /api/meta/login — opened in a popup by the Generator.
 *
 * Generates a CSRF state nonce, stores it in a short-lived HttpOnly
 * cookie (this is a login-flow nonce, NOT token persistence — the
 * access token itself never touches a cookie or any server storage),
 * and redirects to Facebook's OAuth dialog with the read-only
 * ads_read scope.
 *
 * The redirect URI is resolved per environment (see modules/meta/
 * config.ts): derived from the request origin unless META_REDIRECT_URI
 * explicitly overrides it. If configuration is broken, the popup gets
 * the bridge page with an error message instead of raw JSON, so it
 * hands the error to the app and closes itself.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const config = resolveMetaConfig(request);

  if (!config.ok) {
    const origin = requestOrigin(request);
    if (origin) {
      return bridgeResponse(
        { type: "meta-oauth", ok: false, error: config.error },
        origin
      );
    }
    return NextResponse.json(
      { ok: false, error: config.error },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Structural log only — the redirect URI and its source are public
  // facts (they appear in the OAuth dialog URL); the secret never is.
  console.log("meta: oauth login", {
    redirectUri: config.redirectUri,
    source: config.redirectSource,
  });

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: config.redirectUri,
    state,
    scope: META_OAUTH_SCOPE,
    response_type: "code",
  });

  const res = NextResponse.redirect(`${FACEBOOK_OAUTH_DIALOG}?${params}`, 302);
  res.headers.set("Cache-Control", "no-store");
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.redirectUri.startsWith("https://"),
    path: "/api/meta",
    maxAge: 600,
  });
  return res;
}
