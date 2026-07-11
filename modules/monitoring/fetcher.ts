import {
  guardedFetch,
  type GuardedFetchConfig,
  type GuardedFetchOutcome,
} from "../competitor/guardedFetch.ts";
import { extractPageSignals } from "../competitor/pageSignals.ts";
import { extractPageText } from "../competitor/pageText.ts";
import {
  completenessOf,
  contentHashOf,
  type StoredSnapshotSignals,
} from "./differ.ts";
import { isTransientAttempt, type AttemptOutcome } from "./outcomes.ts";

/**
 * The monitoring check worker — one URL in, one attempt result out.
 * Shared verbatim by the cron batch and the manual retry route.
 *
 * Transport: the SAME pinned guardedFetch pipeline as the manual
 * one-time fetch (modules/competitor/guardedFetch.ts) — http/https
 * only, ports 80/443, DNS validated against private/reserved ranges
 * with the socket pinned to the validated IPs, every redirect hop
 * re-validated, 10s total deadline, streamed 1.5MB hard cap (abort,
 * not truncate), text/html only.
 *
 * Honesty rules:
 *  - 403/429/challenge => outcome "blocked". No retry, no evasion of
 *    any kind — a site saying no is a recorded status, not an
 *    obstacle.
 *  - Extraction yielding nothing usable => "unsupported_content";
 *    missing the primary field => "partial_parse" with the partial
 *    signals stored (never diffed against a full snapshot).
 *  - detail strings are short, generic reason text ("HTTP 403",
 *    "redirect limit exceeded") — never URLs, hosts, tokens, or page
 *    content. Callers may log domain + outcome + duration, nothing
 *    more.
 */

/** Honest self-identification for scheduled checks. */
export const MONITOR_USER_AGENT =
  "DebriefMonitor/1.0 (scheduled weekly competitor page check)";

const CONFIG: Omit<GuardedFetchConfig, "resolver" | "transport"> = {
  timeoutMs: 10_000,
  maxRedirects: 5,
  maxBytes: 1_500_000,
  userAgent: MONITOR_USER_AGENT,
  onOversize: "abort",
};

export interface CheckAttemptResult {
  outcome: AttemptOutcome;
  httpStatus: number | null;
  finalUrl: string | null;
  /** <=200 chars, generic reason only — safe for check_events. */
  detail: string;
  /** Present for success | partial_parse. */
  snapshot: { stored: StoredSnapshotSignals; contentHash: string } | null;
  /** Whether the in-run single-retry policy applies (timeout / 5xx). */
  transient: boolean;
}

function result(
  outcome: AttemptOutcome,
  detail: string,
  extra?: Partial<CheckAttemptResult>
): CheckAttemptResult {
  const httpStatus = extra?.httpStatus ?? null;
  return {
    outcome,
    detail: detail.slice(0, 200),
    httpStatus,
    finalUrl: extra?.finalUrl ?? null,
    snapshot: extra?.snapshot ?? null,
    transient: isTransientAttempt(outcome, httpStatus),
  };
}

/** Test seam: the fetch implementation can be injected. */
export type FetchImpl = (
  url: string,
  cfg: GuardedFetchConfig
) => Promise<GuardedFetchOutcome>;

export async function runCheckAttempt(
  url: string,
  fetchImpl: FetchImpl = guardedFetch
): Promise<CheckAttemptResult> {
  const out = await fetchImpl(url, { ...CONFIG });

  switch (out.kind) {
    case "refused":
      /* Syntactic garbage => invalid_url; policy/private-address
         refusals => ssrf_blocked. Both should normally be caught at
         add time — seeing them here means the page changed under us
         (e.g. a redirect now points somewhere refused). */
      return out.reason === "invalid_url" ||
        out.reason === "scheme" ||
        out.reason === "credentials" ||
        out.reason === "port"
        ? result("invalid_url", `URL refused (${out.reason})`)
        : result("ssrf_blocked", `address refused (${out.reason})`);
    case "dns_error":
      return result("dns_error", "DNS resolution failed");
    case "ssrf_blocked":
      return result("ssrf_blocked", "resolved to a non-public address");
    case "timeout":
      return result("timeout", "timed out after 10s");
    case "redirect_loop":
      return result("redirect_loop", "redirect limit exceeded");
    case "network_error":
      return result("error", "connection failed");
    case "too_large":
      return result("too_large", "response exceeded 1.5MB cap", {
        httpStatus: out.status,
      });
    case "unsupported_content":
      return result("unsupported_content", "non-HTML response", {
        httpStatus: out.status,
      });
    case "unsupported_encoding":
      /* Refused BEFORE extraction — never mislabeled as an empty
         extract. Distinct detail; the shared outcome enum value is
         intentional (schema is frozen). */
      return result(
        "unsupported_content",
        "compressed response (unsupported encoding)",
        { httpStatus: out.status }
      );
    case "http_error": {
      if (out.status === 403 || out.status === 429 || out.challenge) {
        return result(
          "blocked",
          out.challenge ? "anti-bot challenge" : `HTTP ${out.status}`,
          { httpStatus: out.status }
        );
      }
      return result("error", `HTTP ${out.status}`, { httpStatus: out.status });
    }
    case "success": {
      const signals = extractPageSignals(extractPageText(out.html));
      if (signals === null) {
        return result("unsupported_content", "no usable text signals", {
          httpStatus: out.status,
          finalUrl: out.finalUrl,
        });
      }
      const completeness = completenessOf(signals);
      const stored: StoredSnapshotSignals = { v: 1, completeness, signals };
      return result(
        completeness === "full" ? "success" : "partial_parse",
        completeness === "full" ? "ok" : "partial extraction (no headline)",
        {
          httpStatus: out.status,
          finalUrl: out.finalUrl,
          snapshot: { stored, contentHash: contentHashOf(signals) },
        }
      );
    }
  }
}
