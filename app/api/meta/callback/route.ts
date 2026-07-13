import { NextRequest, NextResponse } from "next/server";
import {
  adsArchiveDiagnosticEnabled,
  bridgeResponse,
  checkAdsArchiveAccess,
  exchangeCodeForToken,
  GraphApiError,
  resolveMetaConfig,
  STATE_COOKIE,
} from "@/modules/meta";

/**
 * GET /api/meta/callback — the OAuth return leg.
 *
 * Facebook redirects here after the consent dialog. The route verifies
 * the CSRF state against the HttpOnly cookie, exchanges the code for a
 * short-lived user token (the app secret never leaves this server),
 * and returns the bridge page (modules/meta/bridge.ts) whose only job
 * is to hand the result to the opener via postMessage and close.
 *
 * The redirect URI passed to the token exchange must be byte-identical
 * to the one the login route sent to the dialog. Both use
 * resolveMetaConfig — same env override, same request-origin
 * derivation (the browser lands on the same origin it started from) —
 * so they always agree.
 *
 * TEMPORARY: when ADS_ARCHIVE_DIAGNOSTIC_ENABLED is on (default off),
 * this route makes ONE extra, read-only ads_archive call with the
 * token it just obtained, purely to check whether that token can
 * query the Ad Library API at all. The token is used only as that
 * call's Authorization header — never logged, persisted, or included
 * in the postMessage payload. Only a sanitized pass/fail summary
 * (modules/meta/graph.ts's checkAdsArchiveAccess) travels back to the
 * opener. Remove this block (and the diagnostic function it calls)
 * once ads_archive access is confirmed or ruled out — this is not the
 * ingestion feature itself.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const config = resolveMetaConfig(request);

  if (!config.ok) {
    return NextResponse.json(
      { ok: false, error: config.error },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  // The exact origin the bridge is allowed to talk to — and the only
  // origin that could legitimately have opened this popup.
  const appOrigin = new URL(config.redirectUri).origin;
  const fail = (error: string) =>
    bridgeResponse({ type: "meta-oauth", ok: false, error }, appOrigin);

  const query = request.nextUrl.searchParams;

  if (query.get("error")) {
    // User closed/denied the consent dialog — not a fault state.
    return fail("Meta sign-in was cancelled.");
  }

  const state = query.get("state");
  const cookieState = request.cookies.get(STATE_COOKIE)?.value;
  if (!state || !cookieState || state !== cookieState) {
    return fail("Sign-in session didn't match — try connecting again.");
  }

  const code = query.get("code");
  if (!code) {
    return fail("Meta didn't return a sign-in code. Try again.");
  }

  try {
    const token = await exchangeCodeForToken(
      code,
      config.appId,
      config.appSecret,
      config.redirectUri
    );

    // TEMPORARY diagnostic — see the file header comment. Off by
    // default; when off this is a single boolean check, no extra
    // network call, no change to the message payload shape.
    const adsArchiveDiagnostic = adsArchiveDiagnosticEnabled()
      ? await checkAdsArchiveAccess(token)
      : undefined;

    return bridgeResponse(
      { type: "meta-oauth", ok: true, token, adsArchiveDiagnostic },
      appOrigin
    );
  } catch (error) {
    const message =
      error instanceof GraphApiError
        ? error.message
        : "Meta sign-in failed. Try connecting again.";
    return fail(message);
  }
}
