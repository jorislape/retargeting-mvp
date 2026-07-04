import { NextResponse } from "next/server";
import {
  FACEBOOK_OAUTH_DIALOG,
  META_OAUTH_SCOPE,
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
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const appId = process.env.META_APP_ID;
  const redirectUri = process.env.META_REDIRECT_URI;

  if (!appId || !redirectUri || !process.env.META_APP_SECRET) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Meta connection isn't configured. Set META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: META_OAUTH_SCOPE,
    response_type: "code",
  });

  const res = NextResponse.redirect(`${FACEBOOK_OAUTH_DIALOG}?${params}`, 302);
  res.headers.set("Cache-Control", "no-store");
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: redirectUri.startsWith("https://"),
    path: "/api/meta",
    maxAge: 600,
  });
  return res;
}
