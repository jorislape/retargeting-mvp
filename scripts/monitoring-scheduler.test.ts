/**
 * Monitoring beta — scheduling + persistence state-machine proofs:
 * the failure matrix, hash-dedup no_change rule, auto-pause
 * threshold, retry cooldowns, weekly cadence bounds, and THE
 * retention invariant: a failed attempt's update payload physically
 * contains no last-success fields.
 */
import assert from "node:assert/strict";
import {
  AUTO_PAUSE_AFTER_FAILURES,
  buildCompetitorUpdate,
  CHECK_INTERVAL_MS,
  CHECK_JITTER_MAX_MS,
  nextCheckAt,
  planPersistence,
  RETRY_COOLDOWN_BLOCKED_MS,
  RETRY_COOLDOWN_MS,
  retryAllowedAt,
} from "../modules/monitoring/scheduler.ts";

const snap = (hash: string) => ({
  stored: { v: 1 as const, completeness: "full" as const, signals: {} },
  contentHash: hash,
});

/* ------------------------- planPersistence ------------------------ */

// New content => snapshot inserted, streak reset.
{
  const p = planPersistence({
    attempt: { outcome: "success", snapshot: snap("aaa") },
    latestSnapshotHash: "bbb",
    consecutiveFailures: 3,
  });
  assert.deepEqual(p, {
    eventOutcome: "success",
    insertSnapshot: true,
    countsAsSuccess: true,
    newConsecutiveFailures: 0,
    autoPause: false,
  });
}

// Identical hash => no_change event, NO snapshot row.
{
  const p = planPersistence({
    attempt: { outcome: "success", snapshot: snap("aaa") },
    latestSnapshotHash: "aaa",
    consecutiveFailures: 0,
  });
  assert.equal(p.eventOutcome, "no_change");
  assert.equal(p.insertSnapshot, false);
  assert.equal(p.countsAsSuccess, true);
}

// First-ever check (no latest hash) inserts.
{
  const p = planPersistence({
    attempt: { outcome: "success", snapshot: snap("aaa") },
    latestSnapshotHash: null,
    consecutiveFailures: 0,
  });
  assert.equal(p.insertSnapshot, true);
}

// partial_parse behaves like success for storage/streak, keeps its
// honest outcome label when content is new.
{
  const p = planPersistence({
    attempt: { outcome: "partial_parse", snapshot: snap("ccc") },
    latestSnapshotHash: "aaa",
    consecutiveFailures: 2,
  });
  assert.equal(p.eventOutcome, "partial_parse");
  assert.equal(p.insertSnapshot, true);
  assert.equal(p.newConsecutiveFailures, 0);
}

// Failure streak: increments, auto-pauses at the 4th consecutive.
{
  for (const [prior, expectPause] of [
    [0, false],
    [1, false],
    [2, false],
    [3, true], // 4th consecutive failure => pause
    [7, true],
  ] as const) {
    const p = planPersistence({
      attempt: { outcome: "timeout", snapshot: null },
      latestSnapshotHash: "aaa",
      consecutiveFailures: prior,
    });
    assert.equal(p.insertSnapshot, false);
    assert.equal(p.countsAsSuccess, false);
    assert.equal(p.newConsecutiveFailures, prior + 1);
    assert.equal(p.autoPause, expectPause, `prior=${prior}`);
  }
  assert.equal(AUTO_PAUSE_AFTER_FAILURES, 4);
}

/* --------- THE invariant: failures can't touch last-success -------- */

{
  const now = new Date("2026-07-12T06:00:00Z");
  const due = new Date("2026-07-19T06:00:00Z");
  for (const outcome of [
    "timeout",
    "blocked",
    "dns_error",
    "invalid_url",
    "redirect_loop",
    "unsupported_content",
    "too_large",
    "ssrf_blocked",
    "error",
  ] as const) {
    const plan = planPersistence({
      attempt: { outcome, snapshot: null },
      latestSnapshotHash: "aaa",
      consecutiveFailures: 1,
    });
    const update = buildCompetitorUpdate(plan, now, due, null);
    const keys = Object.keys(update);
    assert.ok(
      !keys.includes("lastSuccessAt") && !keys.includes("lastSuccessSnapshotId"),
      `failure update for ${outcome} must not mention last-success fields`
    );
  }

  // no_change: success bookkeeping WITHOUT touching the snapshot pointer.
  const noChange = buildCompetitorUpdate(
    planPersistence({
      attempt: { outcome: "success", snapshot: snap("aaa") },
      latestSnapshotHash: "aaa",
      consecutiveFailures: 0,
    }),
    now,
    due,
    null
  );
  assert.equal(noChange.lastSuccessAt, now);
  assert.ok(!Object.keys(noChange).includes("lastSuccessSnapshotId"));

  // fresh snapshot: pointer updates to the inserted row.
  const fresh = buildCompetitorUpdate(
    planPersistence({
      attempt: { outcome: "success", snapshot: snap("new") },
      latestSnapshotHash: "aaa",
      consecutiveFailures: 0,
    }),
    now,
    due,
    "snap-id-1"
  );
  assert.equal(fresh.lastSuccessSnapshotId, "snap-id-1");

  // auto-pause sets paused: true; non-pausing failures don't mention it.
  const pausing = buildCompetitorUpdate(
    planPersistence({
      attempt: { outcome: "blocked", snapshot: null },
      latestSnapshotHash: null,
      consecutiveFailures: 3,
    }),
    now,
    due,
    null
  );
  assert.equal(pausing.paused, true);
  const notPausing = buildCompetitorUpdate(
    planPersistence({
      attempt: { outcome: "blocked", snapshot: null },
      latestSnapshotHash: null,
      consecutiveFailures: 0,
    }),
    now,
    due,
    null
  );
  assert.ok(!Object.keys(notPausing).includes("paused"));
}

/* ----------------------- cadence + cooldowns ----------------------- */

{
  const now = new Date("2026-07-12T06:00:00Z");
  const min = nextCheckAt(now, () => 0).getTime();
  const max = nextCheckAt(now, () => 0.999999).getTime();
  assert.equal(min, now.getTime() + CHECK_INTERVAL_MS);
  assert.ok(max < now.getTime() + CHECK_INTERVAL_MS + CHECK_JITTER_MAX_MS);
  assert.ok(max > min);
}

{
  const at = new Date("2026-07-12T06:00:00Z");
  assert.equal(
    retryAllowedAt(at, "timeout").getTime(),
    at.getTime() + RETRY_COOLDOWN_MS
  );
  assert.equal(
    retryAllowedAt(at, "blocked").getTime(),
    at.getTime() + RETRY_COOLDOWN_BLOCKED_MS
  );
  assert.equal(retryAllowedAt(null, null).getTime(), 0);
  assert.equal(RETRY_COOLDOWN_MS, 10 * 60 * 1000);
  assert.equal(RETRY_COOLDOWN_BLOCKED_MS, 60 * 60 * 1000);
}

console.log("monitoring-scheduler: all assertions passed");
