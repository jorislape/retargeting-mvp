import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  GraphApiError,
  STATE_COOKIE,
} from "@/modules/meta";
import type { MetaOAuthMessage } from "@/modules/meta";

/**
 * GET /api/meta/callback — the OAuth bridge page.
 *
 * Facebook redirects here after the consent dialog. The route verifies
 * the CSRF state against the HttpOnly cookie, exchanges the code for a
 * short-lived user token (the app secret never leaves this server),
 * and returns a tiny HTML page whose only job is to hand the result to
 * the opener via postMessage and close itself.
 *
 * Security invariants — do not relax:
 * - postMessage targets the app's EXACT origin (derived from
 *   META_REDIRECT_URI), never "*". If the opener isn't that origin,
 *   the browser drops the message and the token goes nowhere.
 * - The opener (MetaProvider) additionally rejects any message whose
 *   event.origin !== its own origin, with strict equality.
 * - The token is never persisted: no cookie, no storage, no log. It
 *   exists in this response body and then only in the opener's memory.
 */

export const dynamic = "force-dynamic";

function bridgeHtml(payload: MetaOAuthMessage, targetOrigin: string): string {
  // <-escape so a hostile error string can't close the <script>.
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  const origin = JSON.stringify(targetOrigin).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Connecting…</title></head>
<body style="background:#0a0e1a;color:#a1a1aa;font:14px system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
<p>Returning to Debrief… you can close this window.</p>
<script>
(function () {
  if (window.opener) {
    window.opener.postMessage(${json}, ${origin});
  }
  window.close();
})();
</script>
</body>
</html>`;
}

function bridgeResponse(
  payload: MetaOAuthMessage,
  targetOrigin: string
): NextResponse {
  const res = new NextResponse(bridgeHtml(payload, targetOrigin), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
  // The nonce is single-use: clear it whatever the outcome.
  res.cookies.set(STATE_COOKIE, "", { path: "/api/meta", maxAge: 0 });
  return res;
}

export async function GET(request: NextRequest) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI;

  if (!appId || !appSecret || !redirectUri) {
    return NextResponse.json(
      { ok: false, error: "Meta connection isn't configured." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  // The exact origin the bridge is allowed to talk to — and the only
  // origin that could legitimately have opened this popup.
  const appOrigin = new URL(redirectUri).origin;
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
    const token = await exchangeCodeForToken(code, appId, appSecret, redirectUri);
    return bridgeResponse({ type: "meta-oauth", ok: true, token }, appOrigin);
  } catch (error) {
    const message =
      error instanceof GraphApiError
        ? error.message
        : "Meta sign-in failed. Try connecting again.";
    return fail(message);
  }
}
