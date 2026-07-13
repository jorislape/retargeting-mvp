import { NextResponse } from "next/server";
import { STATE_COOKIE } from "./graph";
import type { MetaOAuthMessage } from "./types";

/**
 * The OAuth bridge page — a tiny HTML response whose only job is to
 * hand an OAuth outcome to the opener via postMessage and close the
 * popup. Used by the callback route (success and failure) and by the
 * login route when configuration is broken, so the popup never strands
 * the user on a raw JSON error.
 *
 * Security invariants — do not relax:
 * - postMessage targets the app's EXACT origin, never "*". If the
 *   opener isn't that origin, the browser drops the message and the
 *   token goes nowhere.
 * - The opener (MetaProvider) additionally rejects any message whose
 *   event.origin !== its own origin, with strict equality.
 * - The token is never persisted: no cookie, no storage, no log. It
 *   exists in this response body and then only in the opener's memory.
 */

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
  // A brief delay before closing: postMessage is queued synchronously
  // but delivered asynchronously in the opener's event loop. Closing
  // immediately in the same tick has been observed (Safari especially)
  // to tear the popup down before that delivery completes, silently
  // dropping the message. This costs nothing on the happy path and
  // only matters for that race.
  window.setTimeout(function () { window.close(); }, 250);
})();
</script>
</body>
</html>`;
}

export function bridgeResponse(
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
