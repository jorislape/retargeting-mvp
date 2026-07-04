/**
 * OAuth configuration resolution — server-only.
 *
 * The redirect URI must be byte-identical in three places: the OAuth
 * dialog request (login route), the code-for-token exchange (callback
 * route), and the Meta app's "Valid OAuth Redirect URIs" allowlist.
 * Historically it came only from META_REDIRECT_URI, which meant a
 * localhost value copied into a production deploy sent Facebook a
 * redirect it could never accept ("URL blocked").
 *
 * Resolution order:
 *   1. META_REDIRECT_URI, when set — an explicit override for setups
 *      where the public origin can't be derived from the request
 *      (unusual proxies). Validated hard: must be an absolute
 *      http(s) URL whose path is exactly the callback route, and
 *      plain http is only accepted for localhost (Meta enforces the
 *      same rule).
 *   2. Otherwise derived from the incoming request's forwarded
 *      headers: `<origin>/api/meta/callback`. This gives localhost in
 *      dev and the deployment URL in production with zero per-env
 *      config. Login and callback land on the same origin, so both
 *      derive the same value and the token exchange matches.
 *
 * Never logged or returned anywhere: META_APP_SECRET. The redirect
 * URI and app id are public by construction (both appear in the OAuth
 * dialog URL) and are safe to expose for diagnostics.
 */

export const META_CALLBACK_PATH = "/api/meta/callback";

export interface MetaConfigOk {
  ok: true;
  appId: string;
  appSecret: string;
  redirectUri: string;
  /** Where the redirect URI came from — surfaced by /api/meta/config. */
  redirectSource: "env" | "request";
}

export interface MetaConfigErr {
  ok: false;
  /** Env vars that are absent or unusable, e.g. ["META_APP_ID"]. */
  missing: string[];
  /** One human-readable sentence, safe to show in the UI. */
  error: string;
}

export type MetaConfig = MetaConfigOk | MetaConfigErr;

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

/** Public origin of the incoming request, trusting the platform's
 *  forwarded headers first (Vercel sets x-forwarded-proto/host). */
export function requestOrigin(request: Request): string | null {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return null;

  let hostname: string;
  try {
    hostname = new URL(`http://${host}`).hostname;
  } catch {
    return null;
  }

  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (isLocalHostname(hostname) ? "http" : "https");
  return `${proto}://${host}`;
}

/** Validates an explicit META_REDIRECT_URI. Returns an error sentence,
 *  or null when the value is usable. */
function validateEnvRedirect(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return `META_REDIRECT_URI is not an absolute URL: "${value}".`;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return `META_REDIRECT_URI must be http(s), got "${url.protocol}//".`;
  }
  if (url.protocol === "http:" && !isLocalHostname(url.hostname)) {
    return `META_REDIRECT_URI uses http:// on a non-localhost host (${url.hostname}) — Meta only allows plain http for localhost. Use https.`;
  }
  if (url.pathname !== META_CALLBACK_PATH) {
    return `META_REDIRECT_URI path must be ${META_CALLBACK_PATH} (the callback route), got "${url.pathname}".`;
  }
  return null;
}

export function resolveMetaConfig(request: Request): MetaConfig {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  const missing: string[] = [];
  if (!appId) missing.push("META_APP_ID");
  if (!appSecret) missing.push("META_APP_SECRET");

  const envRedirect = process.env.META_REDIRECT_URI?.trim();
  let redirectUri: string | null = null;
  let redirectSource: "env" | "request" = "request";

  if (envRedirect) {
    const problem = validateEnvRedirect(envRedirect);
    if (problem) {
      console.error("meta: invalid META_REDIRECT_URI", { problem });
      missing.push("META_REDIRECT_URI (set but invalid)");
      return {
        ok: false,
        missing,
        error:
          missing.length > 1
            ? `Meta connection isn't configured: ${missing.join(", ")}.`
            : problem,
      };
    }
    redirectUri = envRedirect;
    redirectSource = "env";

    // The classic misconfiguration: a localhost redirect deployed to
    // production (or vice versa). The env override still wins — it's
    // explicit — but say so loudly in the server log.
    const origin = requestOrigin(request);
    if (origin && new URL(envRedirect).origin !== origin) {
      console.warn("meta: META_REDIRECT_URI origin differs from request origin", {
        redirectOrigin: new URL(envRedirect).origin,
        requestOrigin: origin,
        hint: "Unset META_REDIRECT_URI to derive it from the request, or set it per environment.",
      });
    }
  } else {
    const origin = requestOrigin(request);
    if (origin) {
      redirectUri = `${origin}${META_CALLBACK_PATH}`;
    } else {
      missing.push("META_REDIRECT_URI (and no Host header to derive it from)");
    }
  }

  if (missing.length > 0 || !appId || !appSecret || !redirectUri) {
    console.error("meta: oauth not configured", { missing });
    return {
      ok: false,
      missing,
      error: `Meta connection isn't configured: ${missing.join(", ")}.`,
    };
  }

  return { ok: true, appId, appSecret, redirectUri, redirectSource };
}
