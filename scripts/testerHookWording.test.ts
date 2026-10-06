/**
 * Tester Feedback Fix 3 — no hook diagnosis without hook evidence.
 *
 * Debrief never sees creative content. T1 used to say "keep the angle,
 * change the hook … new hooks find its ceiling before fatigue does" and
 * the loser test that the ad "might only have a hook problem". Now the
 * opening test is framed as a hypothesis ("One way to test whether the
 * angle has more headroom: vary only the opening"), and the copy says
 * whether the export has a hook-level metric (3-second video plays /
 * ThruPlays / video plays — resolved in columns.ts, display-only) — if
 * it does, the column is cited; if not, the gap is stated. Both
 * registers; the decision is untouched either way.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, TESTER_CSV, loadEngine } from "./testerFeedbackEngine.ts";

const CAUSAL = [
  /ceiling before fatigue/i,
  /before fatigue does/i,
  /hook problem/i,
  /or just the hook/i,
  /keep the angle, change the hook/i,
  /until the hook is rebuilt/i,
];

/** Adds hook-metric columns (and a cost-per column that must NOT count). */
function withHookColumns(csv: string): string {
  const [head, ...rows] = csv.trim().split("\n");
  return (
    [`${head},3-second video plays,ThruPlays,Cost per ThruPlay (EUR)`]
      .concat(rows.map((r, i) => `${r},${1000 + i * 100},${400 + i * 40},0.05`))
      .join("\n") + "\n"
  );
}

const { run, buildSampleMemo, memoToText, cleanup } = loadEngine();
try {
  /* No hook metric (the tester's export) → hypothesis framing, gap stated. */
  const t = run(TESTER_CSV, "cpa");
  assert.equal(t.analysis.hookMetricColumns, undefined, "no hook metric detected");
  const all = [t.buyerText, t.clientText, JSON.stringify(t.memo)];
  for (const txt of all) for (const re of CAUSAL) assert.ok(!re.test(txt), `causal hook wording: ${re}`);
  const t1 = t.memo.nextTests[0];
  assert.match(t1.test, /vary only the opening to test whether the angle has more headroom/);
  assert.match(t1.why, /One way to test whether the angle has more headroom: vary only the opening\./);
  assert.match(t1.why, /This export has no hook-level metric \(3-second video plays, ThruPlays\)/);
  const t2 = t.memo.nextTests[1];
  assert.match(t2.why, /One way to test whether the angle is worth keeping: rebuild only the opening/);
  assert.match(t2.hypothesis, /cheapest controlled way to learn whether the result moves with it/);
  // Both registers (client text passes the same strings through clientizeText).
  assert.match(t.clientText, /One way to test whether the angle has more headroom/);
  assert.match(t.memo.decision.headline, /vary only the opening/);

  /* Hook metric present → cited by its real header; cost-per never counts. */
  const h = run(withHookColumns(TESTER_CSV), "cpa");
  assert.deepEqual(h.analysis.hookMetricColumns, ["3-second video plays", "ThruPlays"]);
  assert.match(h.memo.nextTests[0].why, /This export includes "3-second video plays" \/ "ThruPlays", so compare each version's opening on that as well as on CPA\./);
  for (const txt of [h.buyerText, h.clientText]) for (const re of CAUSAL) assert.ok(!re.test(txt));
  // Detection only: every number and the decision are identical.
  assert.deepEqual(h.memo.decision, t.memo.decision, "hook columns never change the decision");
  assert.equal(h.analysis.median, t.analysis.median);
  assert.equal(h.analysis.spendGate, t.analysis.spendGate);
  assert.deepEqual(h.analysis.rankedAds.map((a) => a.name), t.analysis.rankedAds.map((a) => a.name));

  /* A lone "Cost per ThruPlay" column is a cost, not a hook metric. */
  const costOnly = TESTER_CSV.trim().split("\n").map((l, i) => `${l},${i === 0 ? "Cost per ThruPlay (EUR)" : "0.05"}`).join("\n") + "\n";
  assert.equal(run(costOnly, "cpa").analysis.hookMetricColumns, undefined);

  /* Sample: same reframing (intended change), still no causal phrases. */
  const s = buildSampleMemo();
  for (const txt of [memoToText(s, "buyer", 5, []), memoToText(s, "client", 3, [])])
    for (const re of CAUSAL) assert.ok(!re.test(txt), `sample: ${re}`);

  /* Source scan: the removed phrases are gone from the engine entirely. */
  const memoSrc = readFileSync(join(ROOT, "modules/debrief/memo.ts"), "utf8");
  for (const re of CAUSAL) assert.ok(!re.test(memoSrc), `memo.ts still contains ${re}`);
  // Hook metrics are display-only: never read by the gate/median/decision.
  for (const f of ["analysis.ts", "decision.ts"]) {
    const src = readFileSync(join(ROOT, "modules/debrief", f), "utf8");
    assert.ok(!/videoPlays|thruPlays/.test(src), `${f} must not read hook-metric columns`);
  }

  console.log("tester hook wording: all assertions passed");
} finally {
  cleanup();
}
