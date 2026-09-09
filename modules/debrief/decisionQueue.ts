import type { Memo, MemoDecision } from "./types";

/**
 * Decision Queue / Multi-Account V1 — a PURE, deterministic portfolio
 * PROJECTION over already-completed, independent Debrief results. This
 * module never analyzes anything: it takes a list of already-generated
 * Memo objects (each the product of the existing analyze() ->
 * generateMemo() -> optional comparison pipeline, run independently
 * per account) and derives a prioritized read of "which account
 * deserves a look first, and why" — using ONLY categorical facts the
 * engine already computed (MemoDecision.action/holdReason/
 * evidenceState, Memo.confidence.level).
 *
 * Hard isolation rules, mirroring compare.ts/creativeGroups.ts:
 *  - never calls analyze() or generateMemo();
 *  - never mutates a Memo, never mutates its input array;
 *  - never compares one account's raw KPI/spend/performance number
 *    against another's — different accounts may have different KPIs,
 *    targets, spend gates, and business context, so there is no safe
 *    cross-account performance comparison to make;
 *  - no blended/weighted "health score" of any kind — every ordering
 *    decision is a lexicographic comparison over EXISTING categorical
 *    facts (category, then action type, then confidence, then label,
 *    then insertion order), never arithmetic;
 *  - Period Comparison (Memo.comparison) is surfaced as a read-only,
 *    non-ordering ANNOTATION only (see comparisonAnnotation below) —
 *    it never affects category or position, so this file can never
 *    become a second, trend-based decision engine.
 */

/** The four truthful buckets this module derives — nothing invented
 *  beyond MemoDecision's own action/holdReason/evidenceState fields.
 *  Order below is also the DISPLAY/priority order (see CATEGORY_ORDER):
 *  an actionable, well-evidenced call first, down to a confirmed-flat
 *  account last (it does not need attention — pretending otherwise
 *  would be dishonest, per decision.ts's own "hold, never a forced
 *  call" discipline). */
export type QueueCategory =
  /** action is "budget" or "test" AND evidenceState is "supported" —
   *  the engine has a committed call backed by its strongest evidence
   *  label. The clearest "look here first" bucket. */
  | "needs_decision"
  /** action is "budget" or "test" but evidenceState is NOT "supported"
   *  (limited, or the defensive/never-expected "insufficient") — a
   *  call exists, but the evidence framing behind it is weaker, so it
   *  deserves a context check before acting on it. */
  | "watch_review"
  /** action is "hold" with holdReason "insufficient_data" — the
   *  engine explicitly could not evaluate this account yet (too few
   *  judged ads). Nothing to review; the account needs more data. */
  | "no_action_yet"
  /** action is "hold" with holdReason "flat_performance" — the engine
   *  evaluated the account and found no ad separated from the median.
   *  A genuinely settled read, not an unresolved one — ranked last on
   *  purpose. */
  | "stable_hold";

/** Fixed priority order for QueueCategory — the first tier of the
 *  lexicographic sort. Not a numeric score: a plain, documented,
 *  totally-ordered ranking of four discrete states. */
const CATEGORY_ORDER: Record<QueueCategory, number> = {
  needs_decision: 0,
  watch_review: 1,
  no_action_yet: 2,
  stable_hold: 3,
};

/** Buyer-facing label for each category — the evidence-honesty voice
 *  this product already uses elsewhere (never "broken", "AI detected",
 *  "guaranteed issue", or a causal root-cause claim). */
export const QUEUE_CATEGORY_LABELS: Record<QueueCategory, string> = {
  needs_decision: "Decision ready",
  watch_review: "Needs context check",
  no_action_yet: "Not enough evidence yet",
  stable_hold: "Stable — no action needed",
};

/** One line explaining WHY an account landed where it did, as a
 *  sequence of categorical facts — never a number. Mirrors the
 *  "Priority reason: Budget decision ready · supported evidence"
 *  pattern the milestone specifies, never "Health score: 82". */
function priorityReason(category: QueueCategory, action: MemoDecision["action"]): string {
  if (category === "no_action_yet") return "Not enough evidence yet";
  if (category === "stable_hold") return "Stable performance — no action needed";
  const actionLabel = action === "budget" ? "Budget decision ready" : "Test decision ready";
  const evidenceLabel = category === "needs_decision" ? "supported evidence" : "needs context check";
  return `${actionLabel} · ${evidenceLabel}`;
}

/** Derives the category from ONLY MemoDecision's own action/
 *  holdReason/evidenceState — no new analytical meaning. A defensive
 *  fallback (action is budget/test but evidenceState is somehow not
 *  "supported"/"limited"/anything but those) never upgrades to
 *  needs_decision — it's always safer to under-claim readiness than
 *  over-claim it. Likewise a hold with a missing holdReason (should
 *  never happen per the type, but the field is optional) is treated
 *  as the more conservative no_action_yet rather than assumed stable. */
function categorize(decision: MemoDecision): QueueCategory {
  if (decision.action === "hold") {
    return decision.holdReason === "flat_performance" ? "stable_hold" : "no_action_yet";
  }
  return decision.evidenceState === "supported" ? "needs_decision" : "watch_review";
}

/** One already-completed, independent Debrief result plus the minimal
 *  session metadata the queue needs to display and order it. `memo` is
 *  read-only here — never mutated, never re-analyzed. */
export interface QueueAccountInput {
  /** Session-local identity (e.g. an incrementing counter) — never a
   *  business-sensitive value, never persisted. */
  id: string | number;
  /** User-typed or deterministically-derived account/client label —
   *  display only, never analyzed. */
  label: string;
  memo: Memo;
}

export interface QueueEntry {
  id: string | number;
  label: string;
  category: QueueCategory;
  categoryLabel: string;
  priorityReason: string;
  action: MemoDecision["action"];
  /** Reused verbatim from the account's own committed decision — the
   *  queue never rewrites or reinterprets this copy. */
  headline: string;
  evidenceState: MemoDecision["evidenceState"];
  confidenceLevel: Memo["confidence"]["level"];
  /** Period Comparison V2 — a read-only annotation ONLY (see this
   *  file's header comment). null when the account has no comparison,
   *  or has one but no top winner to describe (leaderConsistency-style
   *  gaps) — never a placeholder claim. Sourced from
   *  memo.comparison.medianMovement.buyer, an already-generated,
   *  already-descriptive sentence — nothing here re-derives or
   *  re-words it. */
  comparisonAnnotation: string | null;
}

export interface DecisionQueue {
  entries: QueueEntry[];
  counts: Record<QueueCategory, number>;
}

const ACTION_ORDER: Record<MemoDecision["action"], number> = {
  budget: 0,
  test: 1,
  hold: 2,
};
const CONFIDENCE_ORDER: Record<Memo["confidence"]["level"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function buildEntry(account: QueueAccountInput): QueueEntry {
  const { decision } = account.memo;
  const category = categorize(decision);
  return {
    id: account.id,
    label: account.label,
    category,
    categoryLabel: QUEUE_CATEGORY_LABELS[category],
    priorityReason: priorityReason(category, decision.action),
    action: decision.action,
    headline: decision.headline,
    evidenceState: decision.evidenceState,
    confidenceLevel: account.memo.confidence.level,
    comparisonAnnotation: account.memo.comparison?.medianMovement.buyer ?? null,
  };
}

/**
 * Deterministic lexicographic ordering — NEVER a weighted/numeric
 * score. Tiers, in order:
 *   1. QueueCategory (needs_decision -> watch_review -> no_action_yet
 *      -> stable_hold)
 *   2. Action type within the same category (budget before test — a
 *      budget move is already a committed spend change; a hold's
 *      action is constant within its own categories, so this tier is
 *      a no-op there)
 *   3. Memo.confidence.level (high -> medium -> low) — reused exactly
 *      as the memo computed it, never blended with evidenceState
 *   4. Label, case-insensitive alphabetical — a readable, predictable
 *      tie-break the user can reason about
 *   5. Original insertion order — the final deterministic fallback for
 *      genuinely identical entries (e.g. duplicate labels)
 */
function compareEntries(
  a: QueueEntry,
  b: QueueEntry,
  indexOf: Map<string | number, number>
): number {
  const categoryDiff = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
  if (categoryDiff !== 0) return categoryDiff;
  const actionDiff = ACTION_ORDER[a.action] - ACTION_ORDER[b.action];
  if (actionDiff !== 0) return actionDiff;
  const confidenceDiff = CONFIDENCE_ORDER[a.confidenceLevel] - CONFIDENCE_ORDER[b.confidenceLevel];
  if (confidenceDiff !== 0) return confidenceDiff;
  const labelDiff = a.label.toLowerCase().localeCompare(b.label.toLowerCase());
  if (labelDiff !== 0) return labelDiff;
  return (indexOf.get(a.id) ?? 0) - (indexOf.get(b.id) ?? 0);
}

/**
 * Pure projection: completed, independent Debrief results in -> a
 * prioritized, categorized queue out. Does not call analyze() or
 * generateMemo(); does not mutate `accounts` or any Memo within it
 * (every derived value is copied out into a new QueueEntry).
 */
export function deriveDecisionQueue(accounts: readonly QueueAccountInput[]): DecisionQueue {
  const indexOf = new Map<string | number, number>();
  accounts.forEach((a, i) => indexOf.set(a.id, i));

  const entries = accounts.map(buildEntry).sort((a, b) => compareEntries(a, b, indexOf));

  const counts: Record<QueueCategory, number> = {
    needs_decision: 0,
    watch_review: 0,
    no_action_yet: 0,
    stable_hold: 0,
  };
  for (const entry of entries) counts[entry.category] += 1;

  return { entries, counts };
}
