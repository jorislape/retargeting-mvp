import { guardedFetch } from "./guardedFetch";
import { extractPageText } from "./pageText";
import type { PageTextParts } from "./types";
import type { UrlRefusalReason } from "./ssrf";

/**
 * SERVER-ONLY: the guarded one-time page fetch behind
 * POST /api/competitor/fetch-page. Import from API routes only, never
 * from client components — the client-safe surface is index.ts.
 *
 * Scope guarantees, matching the product fence:
 *  - ONE fetch per user click. No schedule, no retry loop, no queue —
 *    nothing here runs unless a request just asked. (The separate,
 *    flagged monitoring beta has its own scheduled fetcher; it shares
 *    this file's transport, not its trigger.)
 *  - Nothing is stored or cached BY THIS PATH: the HTML is read into
 *    memory, turned into text parts, and dropped when the response is
 *    sent. Page text and URLs are never logged.
 *  - Ads Library URLs are refused by policy, not fetched-and-parsed.
 *
 * SSRF posture (upgraded from V1): the shared pipeline in
 * guardedFetch.ts validates scheme/credentials/port/hostname, resolves
 * DNS with every answer checked against private/reserved ranges, and
 * then PINS the socket to the validated addresses via a custom lookup
 * — closing V1's documented DNS-rebinding TOCTOU gap. Every redirect
 * hop repeats the full pipeline. Pure validators: ./ssrf.ts.
 */

export type GuardedFetchResult =
  | { ok: true; parts: PageTextParts; finalHost: string }
  | { ok: false; title: string; message: string; fix: string };

const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
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

const NOT_ALLOWED = err(
  "Address not allowed",
  "Local and internal addresses can't be fetched.",
  "Use the competitor's public website address."
);

/** The same user-safe messages V1 showed, keyed by refusal reason. */
const REFUSAL_MESSAGES: Record<
  UrlRefusalReason,
  ReturnType<typeof err>
> = {
  invalid_url: err(
    "Invalid URL",
    "That doesn't look like a valid web address.",
    "Use a full URL like https://example.com/landing-page."
  ),
  scheme: err(
    "Unsupported URL",
    "Only http:// and https:// pages can be fetched.",
    "Paste the page's normal web address."
  ),
  credentials: err(
    "Unsupported URL",
    "URLs with embedded credentials can't be fetched.",
    "Remove the user:password@ part of the URL."
  ),
  port: err(
    "Unsupported URL",
    "Only standard web ports (80/443) can be fetched.",
    "Use the page's normal address without a custom port."
  ),
  blocked_host: NOT_ALLOWED,
  ip_private: NOT_ALLOWED,
  ads_library: err(
    "Ads Library pages are not fetched",
    "Ads Library pages are not fetched in this version.",
    "Paste the visible ad notes manually into the source's Notes field."
  ),
};

/**
 * The whole server-side flow: guarded pinned fetch → text extraction.
 * Returns text PARTS, not HTML — the raw page never leaves this
 * function, and nothing is retained.
 */
export async function fetchCompetitorPage(
  rawUrl: string
): Promise<GuardedFetchResult> {
  const outcome = await guardedFetch(rawUrl, {
    timeoutMs: FETCH_TIMEOUT_MS,
    maxRedirects: MAX_REDIRECTS,
    maxBytes: MAX_HTML_BYTES,
    userAgent: USER_AGENT,
    // Manual-path behavior since V1: an oversized page is read up to
    // the cap and processed, not failed.
    onOversize: "truncate",
  });

  switch (outcome.kind) {
    case "success":
      return {
        ok: true,
        parts: extractPageText(outcome.html),
        finalHost: new URL(outcome.finalUrl).hostname,
      };
    case "refused":
      return REFUSAL_MESSAGES[outcome.reason];
    case "dns_error":
      return err(
        "Page could not be found",
        "The address couldn't be resolved.",
        "Check the URL for typos and try again."
      );
    case "ssrf_blocked":
      return err(
        "Address not allowed",
        "This address doesn't resolve to a public website.",
        "Use the competitor's public website address."
      );
    case "http_error":
      return err(
        "Page could not be fetched",
        `The page responded with an error (HTTP ${outcome.status}).`,
        "Check the URL opens in your browser, or paste the page's key points into Notes manually."
      );
    case "unsupported_content":
      return err(
        "Not a web page",
        "The URL returned something other than an HTML page.",
        "Point at the landing page itself, not a file or API endpoint."
      );
    case "unsupported_encoding":
      return err(
        "Page could not be read",
        "The server sent a compressed response Debrief can't decode.",
        "Open the page and paste its key points (headline, offer, claims) into Notes manually."
      );
    case "too_large":
      return err(
        "Page too large",
        "This page is too large to read.",
        "Try the competitor's main landing page instead."
      );
    case "timeout":
    case "redirect_loop":
    case "network_error":
      return UNREACHABLE;
  }
}
