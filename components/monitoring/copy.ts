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

/* ---- Persistence / scheduling clarity (shown once ≥1 competitor exists) ---- */

/** Feature-level confirmation — deliberately not a per-row badge; see
 *  components/monitoring/status.ts for why "Active" can't be
 *  distinguished from "Checked" using only the stored fields. */
export const MONITORING_ACTIVE_LINE = "Weekly monitoring is active.";

export const MONITORING_BACKGROUND_LINE =
  "You can close Debrief — checks continue in the background.";

/** Concise, NOT a duplicate of BETA_WARNING_LINES' cookie bullet
 *  (which stays intact and unabridged before the URL input) — this is
 *  a shorter reinforcement placed where the user is looking at their
 *  actual monitored items, not the pre-submission warning list. */
export const WORKSPACE_OWNERSHIP_LINE =
  "This monitoring workspace is linked to this browser via a functional cookie — clearing cookies or switching browsers means it can't be recovered.";

/** The generator/report vs. monitoring persistence contrast — stated
 *  once, near the active-monitoring confirmation. */
export const GENERATOR_VS_MONITORING_LINE =
  "Generator reports live in this tab's memory and disappear on refresh. Monitoring here is different: it's stored server-side for this browser-linked workspace and keeps running after you close the tab.";

/* ---- Empty state (0 competitors) ---- */

export const EMPTY_STATE_EXPLANATION =
  "Add a page below to start weekly monitoring: Debrief checks it server-side once a week, keeps running after you close this tab, and remembers it for this browser next time you visit.";

/* ---- Scope helper near the URL input ---- */

export const WEBSITE_ONLY_HELPER =
  "Public website URLs only. Meta Ads Library links aren't supported here — paste those into the notes above instead.";

/* ---- Retained-snapshot reassurance (shown per row after a failed check) ---- */

export const retainedSnapshotNote = (lastSuccessAt: string): string =>
  `Showing the last successful snapshot, from ${new Date(lastSuccessAt).toLocaleDateString()}.`;
