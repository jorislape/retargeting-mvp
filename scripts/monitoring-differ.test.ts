/**
 * Monitoring beta — snapshot hashing, completeness tiers, and
 * meaningful-change suppression proofs. Runs under plain `node`:
 * `npm run test:monitoring-differ`.
 */
import assert from "node:assert/strict";
import {
  canonicalizeSignals,
  completenessOf,
  contentHashOf,
  diffSnapshots,
  parseStoredSnapshot,
  type StoredSnapshotSignals,
} from "../modules/monitoring/differ.ts";
import {
  CHECK_OUTCOMES,
  isFailureOutcome,
  isTransientAttempt,
  OUTCOME_LABELS,
} from "../modules/monitoring/outcomes.ts";
import { checkOutcome } from "../modules/monitoring/db/schema.ts";

/* ------------------------- canonical hash ------------------------- */

// Whitespace/case churn must NOT change the hash (no false "changed"
// snapshots from page formatting noise).
const base = {
  headline: "Glow brighter in 14 days",
  cta: "Shop now",
  offer: "Free shipping over $50",
  benefits: ["Brightens skin", "Fades dark spots"],
};
const noisy = {
  headline: "  Glow  BRIGHTER in 14 days ",
  cta: "SHOP NOW",
  offer: "free   shipping over $50",
  benefits: ["brightens skin", "Brightens Skin", "Fades dark spots"], // dupe
};
assert.equal(contentHashOf(base), contentHashOf(noisy));

// Real signal change => different hash.
assert.notEqual(
  contentHashOf(base),
  contentHashOf({ ...base, cta: "Start free trial" })
);

// Field order in the input object is irrelevant.
assert.equal(
  canonicalizeSignals({ cta: "Shop now", headline: "H" }),
  canonicalizeSignals({ headline: "H", cta: "Shop now" })
);

// Hash is 64 hex chars.
assert.match(contentHashOf(base), /^[0-9a-f]{64}$/);

/* ----------------------- completeness tiers ----------------------- */

assert.equal(completenessOf({ headline: "H", cta: "Shop now" }), "full");
assert.equal(completenessOf({ cta: "Shop now" }), "partial");
assert.equal(completenessOf({ headline: "   ", cta: "Shop now" }), "partial");

/* -------------------- diff + partial suppression ------------------ */

const full = (signals: object): StoredSnapshotSignals => ({
  v: 1,
  completeness: "full",
  signals,
});
const partial = (signals: object): StoredSnapshotSignals => ({
  v: 1,
  completeness: "partial",
  signals,
});

// Identical snapshots => not meaningful.
{
  const d = diffSnapshots(full(base), full({ ...base }));
  assert.equal(d.suppressed, false);
  assert.equal(d.meaningful, false);
  assert.deepEqual(d.changes, ["No meaningful change detected"]);
}

// Real change => meaningful, with the existing deterministic wording.
{
  const d = diffSnapshots(full(base), full({ ...base, headline: "New angle" }));
  assert.equal(d.meaningful, true);
  assert.ok(d.changes.includes("Headline changed"));
}

// Partial vs full => SUPPRESSED, never reported as changes.
{
  const d = diffSnapshots(full(base), partial({ cta: "Buy now" }));
  assert.equal(d.suppressed, true);
  assert.equal(d.meaningful, false);
  assert.deepEqual(d.changes, []);
  // ...in both directions.
  const d2 = diffSnapshots(partial({ cta: "Buy now" }), full(base));
  assert.equal(d2.suppressed, true);
}

// Partial vs partial: only fields present in BOTH are compared — a
// field one extraction missed is not a "change".
{
  const d = diffSnapshots(
    partial({ cta: "Shop now", offer: "10% off" }),
    partial({ cta: "Shop now" }) // offer missing this time
  );
  assert.equal(d.suppressed, false);
  assert.equal(d.meaningful, false, "missing field must not count as change");

  const d2 = diffSnapshots(
    partial({ cta: "Shop now" }),
    partial({ cta: "Start free trial" })
  );
  assert.equal(d2.meaningful, true);
  assert.ok(d2.changes.includes("CTA changed"));
}

/* ---------------------- stored-shape parsing ----------------------- */

assert.deepEqual(parseStoredSnapshot(full(base)), full(base));
assert.equal(parseStoredSnapshot(null), null);
assert.equal(parseStoredSnapshot("junk"), null);
assert.equal(parseStoredSnapshot({ v: 2, completeness: "full", signals: {} }), null);
assert.equal(parseStoredSnapshot({ v: 1, completeness: "meh", signals: {} }), null);

/* ------------------- outcome vocabulary sync ----------------------- */

// The pure outcome list must exactly match the pg enum.
assert.deepEqual([...CHECK_OUTCOMES], checkOutcome.enumValues);

// Every outcome has a UI label.
for (const o of CHECK_OUTCOMES) {
  assert.ok(OUTCOME_LABELS[o]?.length > 0, `label missing for ${o}`);
}

// Failure classification: the three "check worked" outcomes.
assert.equal(isFailureOutcome("success"), false);
assert.equal(isFailureOutcome("no_change"), false);
assert.equal(isFailureOutcome("partial_parse"), false);
for (const o of ["timeout", "blocked", "dns_error", "error"] as const) {
  assert.equal(isFailureOutcome(o), true);
}

// Transience: timeout + 5xx only.
assert.equal(isTransientAttempt("timeout", null), true);
assert.equal(isTransientAttempt("error", 500), true);
assert.equal(isTransientAttempt("error", 502), true);
assert.equal(isTransientAttempt("error", 404), false);
assert.equal(isTransientAttempt("error", null), false);
assert.equal(isTransientAttempt("blocked", 403), false);
assert.equal(isTransientAttempt("dns_error", null), false);

console.log("monitoring-differ: all assertions passed");
