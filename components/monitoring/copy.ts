/**
 * Monitoring beta copy — kept in one place so Checkpoint-4-approved
 * wording can't drift. Honest about limits: no promise of reliable
 * checks, no competitor-performance implications, explicit about the
 * cookie and about what clearing browser data means.
 */

export const BETA_TITLE = "Monitor weekly (beta)";

export const BETA_TAGLINE =
  "Optional: re-check up to 3 competitor pages once a week, server-side, and keep a history of what changed.";

/** Shown BEFORE enabling and kept visible on the section. */
export const BETA_WARNING_LINES = [
  "Public websites may block automated checks or change their structure — failed checks are expected and shown honestly.",
  "Only publicly accessible pages are fetched. Extracted signals are stored, never full page copies.",
  "No competitor spend, traffic, or performance is inferred — page signals are directional creative context only.",
  "Monitoring uses one anonymous-workspace cookie. Clearing browser data (cookies) permanently disconnects this device from its monitoring history — there is no account to recover it.",
  "This is a beta: monitoring data may be reset as the feature evolves. Your ads data is unaffected — it is never stored.",
] as const;

export const UNAVAILABLE_MESSAGE =
  "Monitoring is temporarily unavailable. Everything else works normally — your data, reports, and watchlist are unaffected.";

export const PAUSED_NOTE =
  "Paused after 4 failed weekly checks in a row. Resume to try again.";
