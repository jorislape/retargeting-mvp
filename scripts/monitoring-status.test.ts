/**
 * Monitoring beta — status/scheduling presentation proofs:
 * deriveMonitoringStatus() must map every outcome+paused combination
 * to a truthful 5-state label built on isFailureOutcome() (never
 * drifting from the server's own success/failure classification), and
 * formatNextCheck() must never expose a precise clock time.
 */
import assert from "node:assert/strict";
import {
  CHECK_OUTCOMES,
  isFailureOutcome,
  type CheckOutcomeValue,
} from "../modules/monitoring/outcomes.ts";
import {
  deriveMonitoringStatus,
  formatNextCheck,
} from "../components/monitoring/status.ts";

/* --------------------------- paused overrides ---------------------- */

// paused=true wins regardless of lastOutcome, including null and every
// outcome value — Paused is never confused with any other state.
{
  for (const outcome of [null, ...CHECK_OUTCOMES] as (CheckOutcomeValue | null)[]) {
    const s = deriveMonitoringStatus(true, outcome);
    assert.equal(s.label, "Paused", `paused must win over outcome=${outcome}`);
    assert.equal(s.tone, "muted");
    assert.equal(s.isFailure, false);
    assert.equal(s.note, null);
  }
}

/* ------------------------- no attempt yet --------------------------- */

{
  const s = deriveMonitoringStatus(false, null);
  assert.equal(s.label, "Pending first check");
  assert.equal(s.tone, "muted");
  assert.equal(s.isFailure, false);
  assert.equal(s.note, null);
}

/* ---------------------- every outcome, not paused -------------------- */

// Exhaustive: every value in the real enum maps somewhere sane, and
// the Blocked/Failed/Checked split matches isFailureOutcome() exactly
// (the one exception: "blocked" is itself a failure outcome per
// isFailureOutcome, but gets its OWN label distinct from "Failed").
{
  for (const outcome of CHECK_OUTCOMES) {
    const s = deriveMonitoringStatus(false, outcome);

    if (outcome === "blocked") {
      assert.equal(s.label, "Blocked");
      assert.equal(s.tone, "muted");
      assert.equal(s.isFailure, true);
      assert.match(s.note ?? "", /Blocked by the site/);
      assert.match(s.note ?? "", /next scheduled run/);
      continue;
    }

    if (isFailureOutcome(outcome)) {
      assert.equal(s.label, "Failed", `outcome=${outcome}`);
      assert.equal(s.tone, "muted");
      assert.equal(s.isFailure, true);
      assert.ok(s.note && s.note.length > 0, `outcome=${outcome} needs a note`);
      assert.match(s.note ?? "", /next scheduled run/);
      continue;
    }

    // success | no_change | partial_parse
    assert.equal(s.label, "Checked", `outcome=${outcome}`);
    assert.equal(s.tone, "accent");
    assert.equal(s.isFailure, false);
  }
}

// Plain "success" needs no extra note — the badge already says it.
{
  const s = deriveMonitoringStatus(false, "success");
  assert.equal(s.note, null);
}

// no_change / partial_parse DO carry a supplementary note (more
// specific than the bare "Checked" badge).
{
  const noChange = deriveMonitoringStatus(false, "no_change");
  assert.ok(noChange.note && noChange.note.length > 0);
  const partial = deriveMonitoringStatus(false, "partial_parse");
  assert.ok(partial.note && partial.note.length > 0);
  assert.notEqual(noChange.note, partial.note);
}

/* ----------------------------- formatNextCheck ----------------------- */

const DAY_MS = 24 * 60 * 60 * 1000;

{
  const now = new Date("2026-07-12T12:00:00Z");

  // Exactly due right now.
  assert.equal(
    formatNextCheck(now.toISOString(), now),
    "Due within the next daily monitoring run"
  );

  // Overdue (in the past) — same honest phrase, not a negative duration.
  const overdue = new Date(now.getTime() - DAY_MS);
  assert.equal(
    formatNextCheck(overdue.toISOString(), now),
    "Due within the next daily monitoring run"
  );

  // A freshly-added competitor (next_check_at === add time === now).
  assert.equal(
    formatNextCheck(now.toISOString(), now),
    "Due within the next daily monitoring run"
  );

  // Future: approximate, DATE-level only — assert no clock time
  // (no colon, no am/pm) ever appears in the output.
  const future = new Date(now.getTime() + 5 * DAY_MS);
  const label = formatNextCheck(future.toISOString(), now);
  assert.match(label, /^Next check on or around /);
  assert.ok(!/:/.test(label), `must not contain a clock time: "${label}"`);
  assert.ok(!/\b(am|pm|AM|PM)\b/.test(label), `must not contain am/pm: "${label}"`);
}

console.log("monitoring-status: all assertions passed");
