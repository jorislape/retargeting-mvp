/**
 * Check-outcome vocabulary shared by the fetcher, scheduler,
 * persistence, and UI. Pure — no imports — so every test runs it
 * under plain Node. Must stay in sync with the check_outcome pgEnum
 * in db/schema.ts (a unit test asserts the sets match).
 */

export const CHECK_OUTCOMES = [
  "success",
  "no_change",
  "timeout",
  "blocked",
  "dns_error",
  "invalid_url",
  "redirect_loop",
  "unsupported_content",
  "too_large",
  "ssrf_blocked",
  "partial_parse",
  "error",
] as const;

export type CheckOutcomeValue = (typeof CHECK_OUTCOMES)[number];

/** Outcomes a fetch attempt can produce directly. `no_change` is
 *  decided later, at persistence time, by content-hash comparison. */
export type AttemptOutcome = Exclude<CheckOutcomeValue, "no_change">;

/** Outcomes that count as a FAILED check for the consecutive-failures
 *  counter / auto-pause. success, no_change, and partial_parse are
 *  all "the check worked" (partial still yielded stored signals). */
export function isFailureOutcome(o: CheckOutcomeValue): boolean {
  return o !== "success" && o !== "no_change" && o !== "partial_parse";
}

/**
 * In-run retry policy (exactly one retry, per spec): only timeouts
 * and 5xx responses. `blocked` (403/429/challenge) is deliberately
 * NOT retried — we take no for an answer. Network errors are treated
 * as non-transient per spec ("timeout, 5xx" is the whole list).
 */
export function isTransientAttempt(
  outcome: AttemptOutcome,
  httpStatus: number | null
): boolean {
  if (outcome === "timeout") return true;
  return outcome === "error" && httpStatus !== null && httpStatus >= 500;
}

/** Plain-language status labels for the UI (Phase 4) — honest about
 *  failure, no fake freshness. */
export const OUTCOME_LABELS: Record<CheckOutcomeValue, string> = {
  success: "Checked — snapshot updated",
  no_change: "Checked — no change",
  timeout: "Last check timed out",
  blocked: "Blocked by the site",
  dns_error: "Address didn't resolve",
  invalid_url: "URL is invalid",
  redirect_loop: "Too many redirects",
  unsupported_content: "Page couldn't be read (non-HTML or script-only)",
  too_large: "Page too large to read",
  ssrf_blocked: "Address not allowed",
  partial_parse: "Checked — partial read",
  error: "Last check failed",
};
