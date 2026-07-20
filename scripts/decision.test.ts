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
  CONCENTRATION_GUARDRAIL_PCT,
  CUT_MIN_SPEND_SHARE_PCT,
  DECISION_MIN_JUDGED,
  FLAT_FIELD_DELTA_PCT,
  SCALE_TEST_MIN_DELTA_PCT,
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
    assert.ok(clientText.includes(memo.decision.clientHeadline), "client text carries the client headline");
    assert.ok(!clientText.includes(memo.decision.headline), "client text never carries the buyer headline");
    assert.ok(!buyerText.includes(memo.decision.clientHeadline), "buyer text never carries the client headline");

    // The client-rendered CARD block is jargon-clean (sliced from
    // NEXT MOVE to the following blank line — the rest of the client
    // output has its own pre-existing register rules, e.g. the scope
    // line's "Judged:" count, which are out of this card's scope).
    const clientCard = clientText.split("NEXT MOVE")[1].split("\n\n")[0].toLowerCase();
    for (const word of ["kill", "gate", "benchmark", "median", "judged"]) {
      assert.ok(!clientCard.includes(word), `client card block must not contain "${word}"`);
    }

    // Confidence line is derived from memo.confidence per register.
    assert.ok(buyerText.includes(`Confidence: ${memo.confidence.level} — ${memo.confidence.reasons[0]}`), "buyer confidence line derived from reasons[0]");
    assert.ok(clientText.includes(`Confidence: ${memo.confidence.level} — ${memo.confidence.clientWhy}`), "client confidence line derived from clientWhy");

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
