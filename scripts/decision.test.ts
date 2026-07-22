/**
 * Decision-First V1 — plain-Node proofs for modules/debrief/decision.ts.
 *
 * Stage 1 (pure, fast): hand-built AnalysisResult fixtures exercise
 * every rule (H1, B1 shift/scale/cut, H2, T1) and every threshold
 * boundary, plus the register-purity and honesty contracts. decision.ts
 * is directly importable here because it depends only on types.ts via
 * an explicit-extension import — the rest of modules/debrief is NOT
 * plain-Node loadable (extensionless imports), which is why…
 *
 * Stage 2 (compiled): …the sample-dataset pin compiles modules/debrief
 * to CommonJS in a temp dir with tsc and runs the REAL engine on
 * SAMPLE_CSV_TEXT, asserting the decision documented in sampleCsv.ts's
 * invariants header. Slower (~seconds) but the only honest way to pin
 * the full pipeline without a dev server; same tolerance as the
 * monitoring-routes suite.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
import {
  buildDecision,
  buildLimits,
  CONCENTRATION_GUARDRAIL_PCT,
  CUT_MIN_SPEND_SHARE_PCT,
  DECISION_MIN_JUDGED,
  deriveEvidenceShape,
  deriveEvidenceState,
  FLAT_FIELD_DELTA_PCT,
  SCALE_TEST_MIN_DELTA_PCT,
  SUPPORTED_MIN_JUDGED,
} from "../modules/debrief/decision.ts";
import type { AnalysisResult, MemoDecision, RankedAd } from "../modules/debrief/types.ts";

const money = (v: number) => `$${v.toFixed(2)}`;

function ad(name: string, spend: number, deltaPct: number | null): RankedAd {
  return {
    name,
    spend,
    kpiValue: 1,
    nameTags: [],
    gate: "judged",
    deltaFromMedian: deltaPct ?? 0,
    deltaPct,
  };
}

/** N ranked ads at a fixed delta — for group-size fixtures where only
 *  the count (and, in buildDecision integration, the extreme delta)
 *  matters. */
function ads(n: number, deltaPct: number): RankedAd[] {
  return Array.from({ length: n }, (_, i) => ad(`A${i}`, 100, deltaPct));
}

function fixture(overrides: Partial<AnalysisResult>): AnalysisResult {
  return {
    kpi: "roas",
    adsAnalyzed: 10,
    adsJudged: 8,
    adsSetAside: 2,
    totalSpend: 1200,
    judgedSpend: 1000,
    currency: null,
    dateRange: null,
    spendGate: 100,
    spendGateBasis: "floor_or_mean",
    median: 2,
    winners: [],
    losers: [],
    belowBenchmarkSpend: 0,
    belowBenchmarkCount: 0,
    hasNameSignal: false,
    hasCreativeNotes: false,
    missingColumns: [],
    ...overrides,
  };
}

/** Every client-register string on the card, for the jargon scan. */
function clientStrings(d: MemoDecision): string {
  return [d.clientHeadline, d.clientRationale, ...d.avoidNow.client, d.reassess.client].join(" ");
}

function assertContract(d: MemoDecision, label: string) {
  // avoidNow max 2 per register.
  assert.ok(d.avoidNow.buyer.length <= 2 && d.avoidNow.client.length <= 2, `${label}: avoidNow capped at 2`);
  // reassess always carries a numeric trigger, both registers.
  assert.ok(/\d/.test(d.reassess.buyer) && /\d/.test(d.reassess.client), `${label}: reassess is numeric`);
  // client register bans buyer jargon.
  const banned = ["kill", "gate", "benchmark", "median", "judged"];
  const client = clientStrings(d).toLowerCase();
  for (const word of banned) {
    assert.ok(!client.includes(word), `${label}: client copy must not contain "${word}" (got: ${client})`);
  }
  // hold ⇔ holdReason.
  assert.equal(d.holdReason !== undefined, d.action === "hold", `${label}: holdReason iff hold`);

  // Evidence-Explicit Decision V1: evidence fields present on every
  // decision, and the client register of limits stays jargon-free.
  assert.ok(
    ["insufficient", "limited", "supported"].includes(d.evidenceState),
    `${label}: valid evidenceState (got: ${d.evidenceState})`
  );
  assert.ok(
    d.limits.buyer.length > 0 && d.limits.client.length > 0,
    `${label}: limits populated in both registers`
  );
  const clientLimits = d.limits.client.join(" ").toLowerCase();
  for (const word of banned) {
    assert.ok(!clientLimits.includes(word), `${label}: client limits must not contain "${word}"`);
  }
}

/* ===================== H1: minimum judged ads ===================== */

{
  // 4 judged → hold, even with a monster winner (weak base beats big delta).
  const d = buildDecision(
    fixture({ adsJudged: 4, winners: [ad("W", 400, 80)], losers: [ad("L", 100, -40)] }),
    "Some test.",
    money
  );
  assert.equal(d.action, "hold");
  assert.equal(d.holdReason, "insufficient_data");
  assert.ok(d.headline.includes("4 of 10"), "hold headline cites the judged/analyzed counts");
  assert.ok(d.reassess.buyer.includes(`${DECISION_MIN_JUDGED}`), "reassess cites the 5-ad bar");
  assertContract(d, "H1@4");

  // 5 judged, same shape → H1 no longer fires (falls through to B1 scale).
  const d5 = buildDecision(
    fixture({ adsJudged: 5, winners: [ad("W", 400, 80)], losers: [ad("L", 100, -40)] }),
    "Some test.",
    money
  );
  assert.equal(d5.action, "budget", "boundary: exactly 5 judged is enough");
  assertContract(d5, "H1@5");
}

/* ===================== B1 scale boundary: 29 vs 30 ===================== */

{
  const base = { losers: [ad("L", 100, -10)], belowBenchmarkSpend: 100, belowBenchmarkCount: 1 };
  const at29 = buildDecision(fixture({ ...base, winners: [ad("W", 300, 29)] }), "Fallback test.", money);
  assert.equal(at29.action, "test", "29% misses the scale bar → test");
  const at30 = buildDecision(fixture({ ...base, winners: [ad("W", 300, 30)] }), "Fallback test.", money);
  assert.equal(at30.action, "budget", "30% exactly clears the scale bar");
  assert.ok(at30.headline.startsWith('Scale "W"'), "scale-only variant");
  assert.ok(at30.rationale.includes(`${SCALE_TEST_MIN_DELTA_PCT}%`), "rationale names the bar it cleared");
  assertContract(at29, "scale@29");
  assertContract(at30, "scale@30");
}

/* ===================== B1 cut boundary: 24 vs 25% share ===================== */

{
  // Worst ad clears -30; only the spend share varies. Top ad modest (+10).
  const mk = (share: number) =>
    fixture({
      winners: [ad("W", 200, 10)],
      losers: [ad("L1", share * 10, -35), ad("L2", 50, -32)],
      judgedSpend: 1000,
      belowBenchmarkSpend: share * 10, // share% of judgedSpend
      belowBenchmarkCount: 4,
    });
  const at24 = buildDecision(mk(24), "Fallback test.", money);
  assert.equal(at24.action, "test", "24% share misses the cut bar → test");
  const at25 = buildDecision(mk(25), "Fallback test.", money);
  assert.equal(at25.action, "budget", "25% share exactly clears the cut bar");
  assert.ok(at25.headline.startsWith("Cut "), "cut-only variant");
  assert.ok(at25.headline.includes("and 2 more"), "loser names honest about the remainder");
  assert.ok(at25.rationale.includes(`${CUT_MIN_SPEND_SHARE_PCT}`) || at25.rationale.includes("25"), "rationale carries the share");
  assertContract(at24, "cut@24");
  assertContract(at25, "cut@25");
}

/* ===================== shift (both eligible) ===================== */

{
  const d = buildDecision(
    fixture({
      winners: [ad("Hero", 300, 45)],
      losers: [ad("L1", 200, -40), ad("L2", 150, -33)],
      judgedSpend: 1000,
      belowBenchmarkSpend: 350,
      belowBenchmarkCount: 2,
    }),
    "Fallback test.",
    money
  );
  assert.equal(d.action, "budget");
  assert.ok(d.headline.startsWith("Shift budget from"), "shift variant when both bars clear");
  assert.ok(d.headline.includes('"Hero"') && d.clientHeadline.includes('"Hero"'), "both registers commit to the same leader");
  assert.ok(d.rationale.includes("45%") && d.rationale.includes("35%"), "rationale cites winner delta and spend share");
  assertContract(d, "shift");
}

/* ===================== H2 flat field: 14 / 15 / 16 ===================== */

{
  const mk = (topDelta: number, worstDelta: number) =>
    fixture({ winners: [ad("W", 200, topDelta)], losers: [ad("L", 200, worstDelta)] });
  const at14 = buildDecision(mk(14, -14), "Fallback test.", money);
  assert.equal(at14.action, "hold");
  assert.equal(at14.holdReason, "flat_performance");
  const at15 = buildDecision(mk(15, -15), "Fallback test.", money);
  assert.equal(at15.action, "hold", "±15% is inclusive — still inside the band");
  assert.equal(at15.holdReason, "flat_performance");
  const at16 = buildDecision(mk(16, -14), "Fallback test.", money);
  assert.equal(at16.action, "test", "16% breaks the band → falls through to T1");
  assert.ok(at14.reassess.buyer.includes(`${FLAT_FIELD_DELTA_PCT}%`), "flat reassess cites the numeric band");
  assertContract(at14, "flat@14");
  assertContract(at15, "flat@15");
  assertContract(at16, "flat@16");
}

/* ===================== T1 + honest fallback ===================== */

{
  const shape = fixture({ winners: [ad("W", 200, 20)], losers: [ad("L", 200, -20)] });
  const withTest = buildDecision(shape, "Test problem-first hooks vs current openers.", money);
  assert.equal(withTest.action, "test");
  assert.ok(
    withTest.headline.includes("Test problem-first hooks vs current openers") &&
      !withTest.headline.includes(".."),
    "test title embedded without double punctuation"
  );
  assert.ok(withTest.rationale.includes(`${SCALE_TEST_MIN_DELTA_PCT}%`) && withTest.rationale.includes(`${CUT_MIN_SPEND_SHARE_PCT}%`), "test rationale names both missed bars");
  assertContract(withTest, "T1");

  // No test available → honest insufficient-data hold, never an invented call.
  const noTest = buildDecision(shape, null, money);
  assert.equal(noTest.action, "hold");
  assert.equal(noTest.holdReason, "insufficient_data");
  assertContract(noTest, "T1-fallback");
}

/* ===================== concentration guardrail: copy-only ===================== */

{
  const mk = (winnerSpend: number) =>
    fixture({
      winners: [ad("Big", winnerSpend, 40)],
      losers: [ad("L", 100, -10)],
      judgedSpend: 1000,
      belowBenchmarkSpend: 100,
      belowBenchmarkCount: 1,
    });
  const at49 = buildDecision(mk(490), "Fallback test.", money);
  const at50 = buildDecision(mk(500), "Fallback test.", money);
  // Action identical either side of the guardrail — copy only, never the action.
  assert.equal(at49.action, "budget");
  assert.equal(at50.action, "budget");
  assert.equal(at49.headline, at50.headline, "guardrail never changes the recommendation");
  assert.ok(!at49.avoidNow.buyer.some((l) => l.includes("consolidate")), "49% share: no guardrail line");
  assert.ok(
    at50.avoidNow.buyer.some((l) => l.includes("consolidate further")),
    `50% share: guardrail line present (bar: ${CONCENTRATION_GUARDRAIL_PCT}%)`
  );
  assert.ok(at50.avoidNow.buyer.length <= 2 && at50.avoidNow.client.length <= 2, "guardrail respects the 2-item cap");
  assertContract(at49, "conc@49");
  assertContract(at50, "conc@50");
}

/* ===================== null-median honesty ===================== */

{
  // Zero median ⇒ deltaPct null everywhere ⇒ no rule may guess; with a
  // test available the honest move is the test, never a budget call.
  const d = buildDecision(
    fixture({ median: 0, winners: [ad("W", 200, null)], losers: [ad("L", 200, null)] }),
    "Fallback test.",
    money
  );
  assert.equal(d.action, "test", "null deltas disqualify budget and flat rules rather than guessing");
  assertContract(d, "null-median");
}

/* ============ Evidence-Explicit Decision V1: state derivation ============ */

/* deriveEvidenceState in isolation — flatField passed explicitly, so
   only the evidence facts (median, judged count, groups, completeness,
   flatness) decide. */
{
  // Insufficient = genuine inability to evaluate.
  assert.equal(deriveEvidenceState(fixture({ median: null }), false), "insufficient", "null median");
  assert.equal(deriveEvidenceState(fixture({ adsJudged: 4 }), false), "insufficient", "under 5 judged");
  // Group absence alone is NOT insufficient — that's a flat result.
  assert.equal(
    deriveEvidenceState(fixture({ adsJudged: 12, winners: [], losers: [] }), true),
    "supported",
    "0/0 with 12 judged + flat = supported flatness, not insufficient"
  );
  // Supported separation.
  assert.equal(
    deriveEvidenceState(fixture({ adsJudged: 12, winners: ads(3, 22), losers: ads(3, -22) }), false),
    "supported"
  );
  // Supported flatness needs no groups.
  assert.equal(deriveEvidenceState(fixture({ adsJudged: 10, winners: [], losers: [] }), true), "supported");
  // Completeness gates supported.
  assert.equal(
    deriveEvidenceState(fixture({ adsJudged: 12, missingColumns: ["Ad name"] }), true),
    "limited",
    "missing column blocks supported flatness"
  );
  // Sample-size boundary: 9 vs 10.
  assert.equal(
    deriveEvidenceState(fixture({ adsJudged: 9, winners: ads(3, 22), losers: ads(3, -22) }), false),
    "limited"
  );
  assert.equal(
    deriveEvidenceState(fixture({ adsJudged: 10, winners: ads(3, 22), losers: ads(3, -22) }), false),
    "supported"
  );
  // Group-balance boundary: 2 vs 3 (separation shape).
  assert.equal(
    deriveEvidenceState(fixture({ adsJudged: 12, winners: ads(2, 22), losers: ads(3, -22) }), false),
    "limited"
  );
  assert.equal(
    deriveEvidenceState(fixture({ adsJudged: 12, winners: ads(3, 22), losers: ads(3, -22) }), false),
    "supported"
  );

  // Shape — set only when a median exists; independent of action.
  assert.equal(deriveEvidenceShape(fixture({ median: null }), false), undefined, "no median → no shape");
  assert.equal(deriveEvidenceShape(fixture({}), true), "flatness");
  assert.equal(deriveEvidenceShape(fixture({}), false), "separation");
  assert.equal(SUPPORTED_MIN_JUDGED, 10, "documented heuristic bar");

  // Limits — permanent dataset-only line always present; client register clean.
  const lim = buildLimits(fixture({ adsSetAside: 2 }), false);
  assert.ok(lim.buyer.length >= 1 && lim.client.length >= 1, "limits both registers");
  assert.ok(lim.buyer[0].includes("not why") && lim.buyer[0].includes("doesn't guarantee future"), "permanent buyer caveat");
  assert.ok(lim.client[0].includes("audience") && lim.client[0].includes("budget"), "permanent client caveat names uncontrolled dimensions");
  for (const word of ["kill", "gate", "benchmark", "median", "judged"]) {
    assert.ok(!lim.client.join(" ").toLowerCase().includes(word), `client limits clean of "${word}"`);
  }
}

/* action ⟂ evidenceState — the seven canonical cases, proving the two
   dimensions are independent (a test can be supported, a budget can be
   limited, a hold can be supported / limited / insufficient). */
{
  const separationWin = [ad("W1", 200, 22), ad("W2", 180, 20), ad("W3", 160, 18)];
  const separationLose = [ad("L1", 120, -18), ad("L2", 110, -17), ad("L3", 100, -16)];

  // supported budget (shift): both bars clear, 12 judged, groups ≥3.
  const supportedBudget = buildDecision(
    fixture({
      adsJudged: 12,
      winners: [ad("W1", 300, 45), ...ads(3, 32)],
      losers: [ad("L1", 200, -40), ...ads(3, -33)],
      judgedSpend: 1000,
      belowBenchmarkSpend: 570,
      belowBenchmarkCount: 4,
    }),
    "T",
    money
  );
  assert.equal(supportedBudget.action, "budget");
  assert.equal(supportedBudget.evidenceState, "supported");
  assert.equal(supportedBudget.evidenceShape, "separation");
  assertContract(supportedBudget, "supported-budget");

  // limited budget: scale fires (+32%), but only 6 judged.
  const limitedBudget = buildDecision(
    fixture({
      adsJudged: 6,
      winners: [ad("W", 300, 32)],
      losers: [ad("L", 100, -10)],
      judgedSpend: 1000,
      belowBenchmarkSpend: 100,
      belowBenchmarkCount: 1,
    }),
    "T",
    money
  );
  assert.equal(limitedBudget.action, "budget");
  assert.equal(limitedBudget.evidenceState, "limited");
  assertContract(limitedBudget, "limited-budget");

  // supported test: moderate separation, 14 judged, groups ≥3.
  const supportedTest = buildDecision(
    fixture({ adsJudged: 14, winners: separationWin, losers: separationLose }),
    "Test problem-first hooks.",
    money
  );
  assert.equal(supportedTest.action, "test");
  assert.equal(supportedTest.evidenceState, "supported");
  assert.equal(supportedTest.evidenceShape, "separation");
  assertContract(supportedTest, "supported-test");

  // limited test: same shape, only 8 judged.
  const limitedTest = buildDecision(
    fixture({ adsJudged: 8, winners: [ad("W", 200, 18)], losers: [ad("L", 150, -18)] }),
    "Test problem-first hooks.",
    money
  );
  assert.equal(limitedTest.action, "test");
  assert.equal(limitedTest.evidenceState, "limited");
  assertContract(limitedTest, "limited-test");

  // supported hold: clearly flat over a sufficient, complete sample.
  const supportedHold = buildDecision(
    fixture({ adsJudged: 12, winners: [ad("W", 200, 10)], losers: [ad("L", 200, -10)] }),
    "T",
    money
  );
  assert.equal(supportedHold.action, "hold");
  assert.equal(supportedHold.holdReason, "flat_performance");
  assert.equal(supportedHold.evidenceState, "supported");
  assert.equal(supportedHold.evidenceShape, "flatness");
  assertContract(supportedHold, "supported-hold");

  // limited hold: flat but under 10 judged.
  const limitedHold = buildDecision(
    fixture({ adsJudged: 7, winners: [ad("W", 200, 10)], losers: [ad("L", 200, -10)] }),
    "T",
    money
  );
  assert.equal(limitedHold.action, "hold");
  assert.equal(limitedHold.holdReason, "flat_performance");
  assert.equal(limitedHold.evidenceState, "limited");
  assertContract(limitedHold, "limited-hold");

  // insufficient hold: under 5 judged.
  const insufficientHold = buildDecision(
    fixture({ adsJudged: 4, winners: [ad("W", 200, 10)], losers: [ad("L", 200, -10)] }),
    "T",
    money
  );
  assert.equal(insufficientHold.action, "hold");
  assert.equal(insufficientHold.holdReason, "insufficient_data");
  assert.equal(insufficientHold.evidenceState, "insufficient");
  assertContract(insufficientHold, "insufficient-hold");
}

/* Zero winners/losers (every ad equals the median) — a flat RESULT, not
   missing data. Judged count alone moves it across the tiers; it is
   never insufficient unless the count itself is too low. */
{
  const allEqual12 = buildDecision(fixture({ adsJudged: 12, winners: [], losers: [] }), "T", money);
  assert.equal(allEqual12.action, "hold");
  assert.equal(allEqual12.holdReason, "flat_performance");
  assert.equal(allEqual12.evidenceState, "supported", "0/0 + 12 judged = supported flatness");
  assert.equal(allEqual12.evidenceShape, "flatness");

  const allEqual7 = buildDecision(fixture({ adsJudged: 7, winners: [], losers: [] }), "T", money);
  assert.equal(allEqual7.evidenceState, "limited", "0/0 + 7 judged = limited, still not insufficient");

  const allEqual4 = buildDecision(fixture({ adsJudged: 4, winners: [], losers: [] }), "T", money);
  assert.equal(allEqual4.evidenceState, "insufficient", "0/0 + 4 judged = genuinely insufficient");
}

/* Boundaries where evidenceState flips but the ACTION does not. */
{
  const base = {
    winners: [ad("W1", 200, 22), ad("W2", 180, 20), ad("W3", 160, 18)],
    losers: [ad("L1", 120, -18), ad("L2", 110, -17), ad("L3", 100, -16)],
  };
  // 9 vs 10 judged.
  const at9 = buildDecision(fixture({ ...base, adsJudged: 9 }), "T", money);
  const at10 = buildDecision(fixture({ ...base, adsJudged: 10 }), "T", money);
  assert.equal(at9.evidenceState, "limited");
  assert.equal(at10.evidenceState, "supported");
  assert.equal(at9.action, at10.action, "9↔10 judged: action unchanged");

  // 2 vs 3 winners (group balance).
  const g2 = buildDecision(fixture({ ...base, adsJudged: 12, winners: base.winners.slice(0, 2) }), "T", money);
  const g3 = buildDecision(fixture({ ...base, adsJudged: 12 }), "T", money);
  assert.equal(g2.evidenceState, "limited");
  assert.equal(g3.evidenceState, "supported");
  assert.equal(g2.action, g3.action, "2↔3 winners: action unchanged");

  // Missing column: supported → limited.
  const complete = buildDecision(fixture({ ...base, adsJudged: 12 }), "T", money);
  const missing = buildDecision(fixture({ ...base, adsJudged: 12, missingColumns: ["Reporting date range"] }), "T", money);
  assert.equal(complete.evidenceState, "supported");
  assert.equal(missing.evidenceState, "limited");
  assert.equal(complete.action, missing.action, "missing column: action unchanged");
}

/* Additivity invariance: the new nextTestFacts argument never changes any
   pre-existing decision output — only populates nextControlledTest. */
{
  const shape = fixture({
    adsJudged: 12,
    winners: [ad("W1", 200, 22), ad("W2", 180, 20), ad("W3", 160, 18)],
    losers: [ad("L1", 120, -18), ad("L2", 110, -17), ad("L3", 100, -16)],
  });
  const noFacts = buildDecision(shape, "Some test.", money);
  const withFacts = buildDecision(shape, "Some test.", money, { preserve: "P", change: "C" });
  for (const k of ["action", "holdReason", "headline", "clientHeadline", "rationale", "clientRationale"] as const) {
    assert.deepEqual(noFacts[k], withFacts[k], `nextTestFacts must not change ${k}`);
  }
  assert.deepEqual(noFacts.avoidNow, withFacts.avoidNow, "nextTestFacts must not change avoidNow");
  assert.deepEqual(noFacts.reassess, withFacts.reassess, "nextTestFacts must not change reassess");
  assert.deepEqual(noFacts.limits, withFacts.limits, "nextTestFacts must not change limits");
  assert.equal(noFacts.nextControlledTest, undefined, "no facts → no controlled test");
  assert.ok(
    withFacts.nextControlledTest &&
      withFacts.nextControlledTest.preserve === "P" &&
      withFacts.nextControlledTest.change === "C",
    "facts → controlled test populated from the first test"
  );
  assert.equal(withFacts.nextControlledTest!.watch, "ROAS", "watch = active KPI label");
}

console.log("decision (stage 1 — rules): all assertions passed");

/* ===================== Stage 2: sample-dataset pin via the real engine ===================== */

{
  const dist = mkdtempSync(join(tmpdir(), "debrief-decision-"));
  try {
    // memoToText.ts compiles alongside the engine (its Memo import is
    // type-only, so its emitted JS is self-contained); --rootDir keeps
    // the repo-relative layout so both land in predictable paths.
    execSync(
      `npx tsc modules/debrief/*.ts components/debrief/memoToText.ts --outDir ${JSON.stringify(dist)} --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck --rewriteRelativeImportExtensions`,
      { cwd: join(import.meta.dirname, ".."), stdio: "pipe" }
    );
    const { buildSampleMemo } = require(join(dist, "modules/debrief/sample.js"));
    const { memoToText } = require(join(dist, "components/debrief/memoToText.js"));
    const memo = buildSampleMemo();

    // The pin documented in sampleCsv.ts's invariants header.
    assert.equal(memo.decision.action, "budget", "sample decision is a budget move");
    assert.ok(
      memo.decision.headline.startsWith("Shift budget from") &&
        memo.decision.headline.includes('"UGC_MorningRoutine_V1"'),
      "sample decision shifts into the documented leader"
    );
    assert.ok(memo.decision.rationale.includes("100%"), "documented +100% vs median ROAS");
    assert.ok(memo.decision.rationale.includes("35%"), "documented 35% below-benchmark spend share");
    assert.ok(memo.decision.reassess.buyer.includes("$120.91"), "documented spend gate in the reassess trigger");
    assertContract(memo.decision, "sample");

    // Evidence-Explicit Decision V1 — pinned evidence read on the sample:
    // supported by the dataset, materially separated, controlled test and
    // limits both surfaced. Action stays the documented budget shift.
    assert.equal(memo.decision.evidenceState, "supported", "sample is supported by the dataset");
    assert.equal(memo.decision.evidenceShape, "separation", "sample field is materially separated");
    assert.ok(memo.decision.nextControlledTest, "sample surfaces a controlled next test");
    assert.ok(
      memo.decision.limits.buyer.length >= 1 && memo.decision.limits.client.length >= 1,
      "sample carries limits in both registers"
    );
    assert.ok(
      memo.decision.limits.buyer.some((l: string) => l.includes("doesn't guarantee future")),
      "sample limits include the permanent causation/guarantee caveat"
    );

    // Structural additivity: decision aside, the memo's shape is unchanged.
    const keys = Object.keys(memo);
    assert.deepEqual(
      keys.filter((k) => k !== "decision"),
      ["scope", "tldr", "clientSummary", "winners", "losers", "patterns", "marketSignal", "nextTests", "avoid", "confidence"],
      "no pre-existing memo field added, removed, or reordered"
    );

    /* ---- Session 2: memoToText presentation contract ---- */

    const buyerText: string = memoToText(memo, "buyer");
    const clientText: string = memoToText(memo, "client");

    // Exactly one decision block per output, using the active register.
    for (const [label, text] of [["buyer", buyerText], ["client", clientText]] as const) {
      assert.equal(text.split("NEXT MOVE").length - 1, 1, `${label}: exactly one NEXT MOVE block`);
    }
    assert.ok(buyerText.includes(memo.decision.headline), "buyer text carries the buyer headline");
    assert.ok(buyerText.includes(memo.decision.reassess.buyer), "buyer text carries the buyer reassess line");

    // Evidence-Explicit Decision V1 polish: plain-language evidence
    // sentence, no raw evidenceShape enum, relabeled limits header.
    assert.ok(
      buyerText.includes("Evidence: Strong support from this dataset"),
      "buyer text carries the plain-language evidence sentence for the pinned supported/separation sample"
    );
    assert.ok(
      clientText.includes("How sure we are: Strong — the available results show a clear enough difference"),
      "client text carries the plain-language client evidence sentence"
    );
    for (const text of [buyerText, clientText]) {
      assert.ok(!text.includes("(separation)") && !/\bflatness\b/.test(text), "no raw evidenceShape enum anywhere in the serialized output");
    }
    assert.ok(buyerText.includes("Next controlled test:"), "buyer text surfaces the controlled test");
    assert.ok(buyerText.includes(`- Preserve: ${memo.decision.nextControlledTest?.preserve}`), "buyer text export carries the FULL, untruncated preserve wording");
    assert.ok(clientText.includes(`- Keep the same: ${memo.decision.nextControlledTest?.preserve}`), "client text export label is 'Keep the same', full wording");
    assert.ok(buyerText.includes("EVIDENCE LIMITS"), "buyer text has the relabeled limits block");
    assert.ok(clientText.includes("WHAT WE STILL CAN'T CONCLUDE"), "client text has the relabeled limits block");
    assert.ok(clientText.includes(memo.decision.clientHeadline), "client text carries the client headline");
    assert.ok(!clientText.includes(memo.decision.headline), "client text never carries the buyer headline");
    assert.ok(!buyerText.includes(memo.decision.clientHeadline), "buyer text never carries the client headline");

    // The client-rendered CARD block is jargon-clean (sliced from
    // NEXT MOVE to the following blank line — the rest of the client
    // output has its own pre-existing register rules, e.g. the scope
    // line's "Judged:" count, which are out of this card's scope).
    const buyerCardBlock = buyerText.split("NEXT MOVE")[1].split("\n\n")[0];
    const clientCard = clientText.split("NEXT MOVE")[1].split("\n\n")[0].toLowerCase();
    for (const word of ["kill", "gate", "benchmark", "median", "judged"]) {
      assert.ok(!clientCard.includes(word), `client card block must not contain "${word}"`);
    }

    // No duplicate Confidence line inside the card block in either
    // register — the full confidence read (level/reasons/notes) keeps
    // its own separate "CONFIDENCE:" section further down, asserted by
    // the `order` check below; it must not be repeated inside NEXT MOVE.
    assert.ok(!buyerCardBlock.includes("Confidence:"), "buyer NEXT MOVE block carries no duplicate Confidence line");
    assert.ok(!clientCard.includes("confidence"), "client NEXT MOVE block carries no duplicate confidence line");

    // Section order intact: the decision leads, everything else follows
    // in the pre-existing order.
    const order = ["NEXT MOVE", "THE CALL", "WINNERS", "LOSERS / KILL LIST", "PATTERNS", "NEXT 3 TESTS", "CONFIDENCE:"];
    const positions = order.map((h) => buyerText.indexOf(h));
    assert.ok(positions.every((p) => p >= 0), "all buyer section headers present");
    assert.deepEqual([...positions].sort((a, b) => a - b), positions, "buyer section order unchanged, NEXT MOVE first");

    // Empty avoidNow produces no lead-in line (no empty section).
    const noAvoidMemo = {
      ...memo,
      decision: { ...memo.decision, avoidNow: { buyer: [], client: [] } },
    };
    const noAvoidBuyer: string = memoToText(noAvoidMemo, "buyer");
    const noAvoidClient: string = memoToText(noAvoidMemo, "client");
    assert.ok(!noAvoidBuyer.includes("Not yet:"), "empty avoidNow: no buyer lead-in");
    assert.ok(!noAvoidClient.includes("What we're deliberately not doing yet:"), "empty avoidNow: no client lead-in");
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
}

console.log("decision: all assertions passed");
