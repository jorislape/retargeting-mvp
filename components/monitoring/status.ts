import {
  isFailureOutcome,
  OUTCOME_LABELS,
  type CheckOutcomeValue,
} from "../../modules/monitoring/outcomes.ts";

/**
 * Client-safe presentation helpers for monitoring status. Pure — no
 * side effects, no fetch, no imports beyond the shared outcome
 * vocabulary — so this runs under plain Node for tests exactly like
 * modules/monitoring/outcomes.ts does.
 *
 * Deliberately NOT in modules/monitoring/scheduler.ts: that file
 * transitively imports fetcher.ts -> guardedFetch.ts, which uses
 * node:http/node:dns and is server-only. Anything a "use client"
 * component imports must stay outside that import chain.
 */

export type StatusTone = "accent" | "muted";

export interface MonitoringStatus {
  /** One of five understandable states — never a 6th "Active" badge
   *  here; "active" is the feature-level confirmation shown once the
   *  workspace has >=1 competitor (see copy.ts), not a per-row claim
   *  these fields can't truthfully distinguish from "Checked". */
  label: "Paused" | "Pending first check" | "Checked" | "Blocked" | "Failed";
  tone: StatusTone;
  /** True for Blocked/Failed — the caller uses this to decide whether
   *  to also surface the retained-last-successful-snapshot line. */
  isFailure: boolean;
  /** Supplementary detail, reusing the existing OUTCOME_LABELS text
   *  verbatim rather than inventing new copy — null when the badge
   *  alone is already the whole story (a first check, or a plain
   *  "success" with nothing more specific to add). */
  note: string | null;
}

/**
 * Reduces the 12-value check-outcome enum + paused flag to five
 * truthful, understandable states. Built directly on the existing
 * isFailureOutcome() so this can never drift from the server's own
 * success/failure classification — a new outcome value added to the
 * enum is either already a "failure" per that function (and lands in
 * Blocked/Failed here) or not (and lands in Checked), with no
 * separate judgment call to keep in sync.
 */
export function deriveMonitoringStatus(
  paused: boolean,
  lastOutcome: CheckOutcomeValue | null
): MonitoringStatus {
  if (paused) {
    return { label: "Paused", tone: "muted", isFailure: false, note: null };
  }
  if (lastOutcome === null) {
    return {
      label: "Pending first check",
      tone: "muted",
      isFailure: false,
      note: null,
    };
  }
  if (lastOutcome === "blocked") {
    return {
      label: "Blocked",
      tone: "muted",
      isFailure: true,
      note: `${OUTCOME_LABELS.blocked} — Debrief will try again on the next scheduled run. No workaround is attempted.`,
    };
  }
  if (isFailureOutcome(lastOutcome)) {
    return {
      label: "Failed",
      tone: "muted",
      isFailure: true,
      note: `${OUTCOME_LABELS[lastOutcome]} — Debrief will try again on the next scheduled run.`,
    };
  }
  // success | no_change | partial_parse — a plain "success" needs no
  // extra note (the badge says it all); the other two get their
  // existing, more specific label as supplementary detail.
  return {
    label: "Checked",
    tone: "accent",
    isFailure: false,
    note: lastOutcome === "success" ? null : OUTCOME_LABELS[lastOutcome],
  };
}

/**
 * Truthful next-check phrasing. next_check_at is a real stored
 * timestamp (now + 7 days + up to 6h jitter, or "now" for a
 * freshly-added competitor — see modules/monitoring/scheduler.ts),
 * but checks only execute when the next DAILY cron pass finds a due
 * row — so a precise clock time would promise more than the system
 * guarantees. Due-or-overdue collapses to one honest phrase; a future
 * date is shown at day granularity only, never a time.
 */
export function formatNextCheck(nextCheckAtIso: string, now: Date): string {
  const due = new Date(nextCheckAtIso);
  if (due.getTime() <= now.getTime()) {
    return "Due within the next daily monitoring run";
  }
  const dateLabel = due.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `Next check on or around ${dateLabel}`;
}
