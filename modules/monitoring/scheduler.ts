import type { CheckAttemptResult } from "./fetcher.ts";
import { isFailureOutcome, type CheckOutcomeValue } from "./outcomes.ts";

/**
 * Pure scheduling + persistence PLANNING — every rule the spec's
 * failure matrix demands, expressed as decisions over plain data so
 * the state machine is unit-testable without a database. service.ts
 * applies these plans; nothing here touches I/O.
 */

/** Weekly cadence. */
export const CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
/** Jitter so one workspace's competitors (and everyone's Mondays)
 *  don't stampede the same daily run: 0–6h added to the base week. */
export const CHECK_JITTER_MAX_MS = 6 * 60 * 60 * 1000;
/** Auto-pause a competitor after this many consecutive failed weekly
 *  checks. Resume is MANUAL (user clicks) — unlike workspace
 *  dormancy, which resumes automatically on any visit. */
export const AUTO_PAUSE_AFTER_FAILURES = 4;
/** Manual retry cooldowns. */
export const RETRY_COOLDOWN_MS = 10 * 60 * 1000; // 1 per competitor per 10min
export const RETRY_COOLDOWN_BLOCKED_MS = 60 * 60 * 1000; // blocked => 60min

/** next_check_at after any attempt: one week out, plus jitter.
 *  `rand` injected for determinism in tests (0..1). */
export function nextCheckAt(now: Date, rand: () => number = Math.random): Date {
  return new Date(
    now.getTime() + CHECK_INTERVAL_MS + Math.floor(rand() * CHECK_JITTER_MAX_MS)
  );
}

/** Manual-retry gate: how long after the last attempt a retry of this
 *  competitor is allowed. `blocked` gets the extended cooldown — we
 *  don't hammer a site that told us no. */
export function retryAllowedAt(
  lastAttemptAt: Date | null,
  lastOutcome: CheckOutcomeValue | null
): Date {
  if (lastAttemptAt === null) return new Date(0);
  const cooldown =
    lastOutcome === "blocked" ? RETRY_COOLDOWN_BLOCKED_MS : RETRY_COOLDOWN_MS;
  return new Date(lastAttemptAt.getTime() + cooldown);
}

export interface PersistencePlan {
  /** What the check_events row records. */
  eventOutcome: CheckOutcomeValue;
  /** Insert a snapshot row? (Never true for failures or no_change.) */
  insertSnapshot: boolean;
  /** Update last_success_at / last_outcome-success bookkeeping. */
  countsAsSuccess: boolean;
  newConsecutiveFailures: number;
  /** Set paused=true (threshold crossed by THIS failure). */
  autoPause: boolean;
}

/**
 * The core invariant table. Given the attempt result, the latest
 * stored snapshot hash, and the current failure streak:
 *
 *  - success/partial_parse whose content hash EQUALS the latest
 *    snapshot => record `no_change`, insert NOTHING, streak resets.
 *  - success/partial_parse with a new hash => insert snapshot, streak
 *    resets. (partial_parse stays partial_parse in the event so the
 *    UI can be honest about it.)
 *  - any failure outcome => record it, increment the streak,
 *    auto-pause when it reaches the threshold. A failed attempt NEVER
 *    inserts, modifies, or deletes snapshot state — the last good
 *    snapshot survives by construction because no code path here
 *    touches it.
 */
export function planPersistence(input: {
  attempt: Pick<CheckAttemptResult, "outcome" | "snapshot">;
  latestSnapshotHash: string | null;
  consecutiveFailures: number;
}): PersistencePlan {
  const { attempt, latestSnapshotHash, consecutiveFailures } = input;

  if (!isFailureOutcome(attempt.outcome) && attempt.snapshot !== null) {
    const unchanged = attempt.snapshot.contentHash === latestSnapshotHash;
    return {
      eventOutcome: unchanged ? "no_change" : attempt.outcome,
      insertSnapshot: !unchanged,
      countsAsSuccess: true,
      newConsecutiveFailures: 0,
      autoPause: false,
    };
  }

  const streak = consecutiveFailures + 1;
  return {
    eventOutcome: attempt.outcome,
    insertSnapshot: false,
    countsAsSuccess: false,
    newConsecutiveFailures: streak,
    autoPause: streak >= AUTO_PAUSE_AFTER_FAILURES,
  };
}

/** The exact column set an attempt is allowed to write back to
 *  monitored_competitors. Pure so the invariant is TESTABLE: for any
 *  failure plan, the returned object contains NO lastSuccessAt /
 *  lastSuccessSnapshotId keys — a failed attempt physically cannot
 *  touch last-success state, because the update payload never
 *  mentions it. */
export interface CompetitorUpdate {
  lastAttemptAt: Date;
  lastOutcome: CheckOutcomeValue;
  nextCheckAt: Date;
  consecutiveFailures: number;
  lastSuccessAt?: Date;
  lastSuccessSnapshotId?: string;
  paused?: true;
}

export function buildCompetitorUpdate(
  plan: PersistencePlan,
  now: Date,
  due: Date,
  insertedSnapshotId: string | null
): CompetitorUpdate {
  const base = {
    lastAttemptAt: now,
    lastOutcome: plan.eventOutcome,
    nextCheckAt: due,
  };
  if (plan.insertSnapshot && insertedSnapshotId !== null) {
    return {
      ...base,
      consecutiveFailures: 0,
      lastSuccessAt: now,
      lastSuccessSnapshotId: insertedSnapshotId,
    };
  }
  if (plan.countsAsSuccess) {
    // no_change: last_success_snapshot_id already points at the
    // still-latest snapshot — deliberately not mentioned here.
    return { ...base, consecutiveFailures: 0, lastSuccessAt: now };
  }
  return {
    ...base,
    consecutiveFailures: plan.newConsecutiveFailures,
    ...(plan.autoPause && { paused: true as const }),
  };
}
