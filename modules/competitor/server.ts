import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { extractPageText } from "./pageText";
import type { PageTextParts } from "./types";

/**
 * SERVER-ONLY (node:dns / node:net): the guarded one-time page fetch
 * behind POST /api/competitor/fetch-page. Import from API routes only,
 * never from client components — the client-safe surface is index.ts.
 *
 * Scope guarantees, matching the product fence:
 *  - ONE fetch per user click. No schedule, no retry loop, no queue,
 *    no monitoring — nothing here runs unless a request just asked.
 *  - Nothing is stored or cached: the HTML is read into memory, turned
 *    into text parts, and dropped when the response is sent. Page text
 *    and URLs are never logged.
 *  - Ads Library URLs are refused by policy (see guard below), not
 *    fetched-and-parsed — this feature is landing pages only.
 *
 * SSRF posture: syntactic checks (protocol / credentials / port /
 * hostname), then DNS resolution with every resolved address checked
 * against private/reserved ranges, re-done for every redirect hop.
 * Residual risk: a DNS answer that changes between our lookup and the
 * fetch's own lookup (rebinding) — accepted for V1; the fetch itself
 * is a one-shot GET with a hard timeout and size cap.
 */

export type GuardedFetchResult =
  | { ok: true; parts: PageTextParts; finalHost: string }
  | { ok: false; title: string; message: string; fix: string };

const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 1_500_000;
/** Honest self-identification — this is a user-triggered single fetch. */
const USER_AGENT = "DebriefPageFetch/1.0 (one-time user-triggered fetch)";

const err = (title: string, message: string, fix: string) =>
  ({ ok: false, title, message, fix }) as const;

const UNREACHABLE = err(
  "Page could not be fetched",
  "The page didn't respond in time or refused the request.",
  "Check the URL opens in your browser, or paste the page's key points into Notes manually."
);

/* ---------------------------- IP checks --------------------------- */

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n))) return true;
  const [a, b] = parts;
  return (
    a === 0 || // "this network"
    a === 10 ||
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) || // 192.0.0/24 + 192.0.2/24 (conservative)
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    (a === 198 && b === 51) || // 198.51.100/24 (conservative)
    (a === 203 && b === 0) || // 203.0.113/24 (conservative)
    a >= 224 // multicast, reserved, broadcast
  );
}

/** Conservative: anything not clearly a public unicast address is
 *  treated as private. */
function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) return isPrivateIPv4(ip);
  const v6 = ip.toLowerCase();
  // IPv4-mapped / IPv4-translated — judge the embedded IPv4
  const mapped = v6.match(/(?:^|:)(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  if (v6 === "::" || v6 === "::1") return true; // unspecified / loopback
  if (/^fe[89ab]/.test(v6)) return true; // link-local fe80::/10
  if (/^f[cd]/.test(v6)) return true; // unique local fc00::/7
  if (v6.startsWith("ff")) return true; // multicast
  if (v6.startsWith("64:ff9b")) return true; // NAT64 (embedded v4 unknown)
  if (v6.startsWith("2001:db8")) return true; // documentation
  return false;
}

/* --------------------------- URL guard ---------------------------- */

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".home.arpa",
  ".test",
  ".invalid",
];

/** Facebook-family hosts whose Ads Library paths are refused by
 *  policy — this feature never reads Ads Library, in any form. */
const ADS_LIBRARY_HOSTS = ["facebook.com", "fb.com", "fb.me", "fb.watch"];

const ADS_LIBRARY_ERROR = err(
  "Ads Library pages are not fetched",
  "Ads Library pages are not fetched in this version.",
  "Paste the visible ad notes manually into the source's Notes field."
);

/** Syntactic validation + DNS check for one URL (initial or redirect
 *  hop). Returns the parsed URL or a structured, user-safe error. */
async function guardUrl(
  raw: string
): Promise<{ ok: true; url: URL } | { ok: false; title: string; message: string; fix: string }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return err(
      "Invalid URL",
      "That doesn't look like a valid web address.",
      "Use a full URL like https://example.com/landing-page."
    );
  }

  /* Protocol allowlist rejects javascript:, data:, file:, etc. */
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return err(
      "Unsupported URL",
      "Only http:// and https:// pages can be fetched.",
      "Paste the page's normal web address."
    );
  }
  if (url.username !== "" || url.password !== "") {
    return err(
      "Unsupported URL",
      "URLs with embedded credentials can't be fetched.",
      "Remove the user:password@ part of the URL."
    );
  }
  if (url.port !== "" && url.port !== "80" && url.port !== "443") {
    return err(
      "Unsupported URL",
      "Only standard web ports (80/443) can be fetched.",
      "Use the page's normal address without a custom port."
    );
  }

  const host = url.hostname.replace(/\.$/, "").toLowerCase();
  if (
    host === "" ||
    host === "localhost" ||
    BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))
  ) {
    return err(
      "Address not allowed",
      "Local and internal addresses can't be fetched.",
      "Use the competitor's public website address."
    );
  }
  const adsHost = ADS_LIBRARY_HOSTS.some(
    (h) => host === h || host.endsWith(`.${h}`)
  );
  if (adsHost && /\/ads\/library/i.test(url.pathname)) {
    return ADS_LIBRARY_ERROR;
  }

  /* IP-literal hosts are judged directly; hostnames are resolved and
     EVERY answer must be public (covers decimal/hex IP spellings too,
     since the resolver normalizes them). */
  const literal = host.startsWith("[") ? host.slice(1, -1) : host;
  if (isIP(literal) !== 0) {
    if (isPrivateIp(literal)) {
      return err(
        "Address not allowed",
        "Local and internal addresses can't be fetched.",
        "Use the competitor's public website address."
      );
    }
    return { ok: true, url };
  }
  try {
    const addresses = await lookup(host, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
      return err(
        "Address not allowed",
        "This address doesn't resolve to a public website.",
        "Use the competitor's public website address."
      );
    }
  } catch {
    return err(
      "Page could not be found",
      "The address couldn't be resolved.",
      "Check the URL for typos and try again."
    );
  }
  return { ok: true, url };
}

/* --------------------------- the fetch ---------------------------- */

/** Reads the response body up to MAX_HTML_BYTES, then stops. */
async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let html = "";
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    html += decoder.decode(value, { stream: true });
    if (bytes >= MAX_HTML_BYTES) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  return html + decoder.decode();
}

/**
 * The whole server-side flow: guard → fetch (manual redirects, each
 * hop re-guarded) → text extraction. Returns text PARTS, not HTML —
 * the raw page never leaves this function, and nothing is retained.
 */
export async function fetchCompetitorPage(
  rawUrl: string
): Promise<GuardedFetchResult> {
  let current = rawUrl.trim();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const guarded = await guardUrl(current);
    if (!guarded.ok) return guarded;

    let res: Response;
    try {
      res = await fetch(guarded.url, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en",
        },
      });
    } catch {
      return UNREACHABLE;
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      res.body?.cancel().catch(() => {});
      if (!location || hop === MAX_REDIRECTS) return UNREACHABLE;
      try {
        current = new URL(location, guarded.url).toString();
      } catch {
        return UNREACHABLE;
      }
      continue; // next hop is re-guarded at the top of the loop
    }

    if (!res.ok) {
      res.body?.cancel().catch(() => {});
      return err(
        "Page could not be fetched",
        `The page responded with an error (HTTP ${res.status}).`,
        "Check the URL opens in your browser, or paste the page's key points into Notes manually."
      );
    }

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      res.body?.cancel().catch(() => {});
      return err(
        "Not a web page",
        "The URL returned something other than an HTML page.",
        "Point at the landing page itself, not a file or API endpoint."
      );
    }

    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_HTML_BYTES * 4) {
      res.body?.cancel().catch(() => {});
      return err(
        "Page too large",
        "This page is too large to read.",
        "Try the competitor's main landing page instead."
      );
    }

    let html: string;
    try {
      html = await readCapped(res);
    } catch {
      return UNREACHABLE;
    }
    return {
      ok: true,
      parts: extractPageText(html),
      finalHost: guarded.url.hostname,
    };
  }
  return UNREACHABLE;
}
