/**
 * Evidence Sufficiency + Brief Readiness V1 — plain-Node proofs.
 *
 * Stage 1 (pure, fast): briefReadiness.ts depends only on decision.ts
 * and types.ts, both already directly Node-loadable (explicit ".ts"
 * extension imports) — same pattern decision.test.ts's Stage 1 uses.
 * Hand-built AnalysisResult fixtures exercise every state on both
 * sides, provenance, missing-data honesty, and the isolation contract.
 *
 * Stage 2 (compiled): the sample-dataset pin, exercised through the
 * REAL memo.ts pipeline (which IS extensionless-import and therefore
 * not plain-Node loadable) via the same tsc-to-temp-dir approach
 * decision.test.ts's own Stage 2 and spendAllocation.test.ts/
 * movementChart.test.ts already established.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BRIEF_READY_MIN_OUTCOMES,
  deriveLossConfidenceReadiness,
  deriveSignalVolumeReadiness,
  LOSS_CONFIDENT_SPEND_MULTIPLE,
} from "../modules/debrief/briefReadiness.ts";
import { MIN_OUTCOMES_FOR_SUPPORTED } from "../modules/debrief/decision.ts";
import type { AnalysisResult, DecisionCriteria, RankedAd } from "../modules/debrief/types.ts";

const money = (v: number) => `$${v.toFixed(2)}`;

function ad(name: string, spend: number, deltaPct: number | null, conversions: number | null = null): RankedAd {
  return {
    name,
    spend,
    kpiValue: 1,
    nameTags: [],
    gate: "judged",
    deltaFromMedian: deltaPct ?? 0,
    deltaPct,
    conversions,
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
    rankedAds: [],
    belowBenchmarkSpend: 0,
    belowBenchmarkCount: 0,
    aboveBenchmarkSpend: 0,
    aboveBenchmarkCount: 0,
    atBenchmarkSpend: 0,
    atBenchmarkCount: 0,
    hasNameSignal: false,
    hasCreativeNotes: false,
    missingColumns: [],
    duplicateAdNames: [],
    ...overrides,
  };
}

/* ===================== Winner side: Signal Volume ===================== */

{
  // Below decision.ts's own noise floor -> insufficient.
  const r = deriveSignalVolumeReadiness(
    fixture({ winners: [ad("W", 100, 40, 3)] }),
    undefined,
    "purchase",
    "purchases"
  );
  assert.equal(r?.state, "insufficient");
  assert.ok(r!.buyer.includes("3"));
  assert.ok(r!.criterion.source === "debrief_default");
}
{
  // The two defaults are genuinely different numbers, sourced from
  // different concerns (decision.ts's minimal noise floor vs Debrief's
  // own, higher, practitioner-informed brief-ready bar) — never
  // accidentally collapsed into one shared constant.
  assert.equal(MIN_OUTCOMES_FOR_SUPPORTED, 10);
  assert.equal(BRIEF_READY_MIN_OUTCOMES, 50);
  assert.ok(BRIEF_READY_MIN_OUTCOMES > MIN_OUTCOMES_FOR_SUPPORTED, "the brief-ready bar is strictly stricter than the noise floor");
  assert.equal(LOSS_CONFIDENT_SPEND_MULTIPLE, 2);
}
{
  // Right at the noise floor boundary itself -> still insufficient
  // (the floor excludes its own value; only counts strictly above it
  // clear the boundary).
  const r = deriveSignalVolumeReadiness(
    fixture({ winners: [ad("W", 100, 40, MIN_OUTCOMES_FOR_SUPPORTED - 1)] }),
    undefined,
    "purchase",
    "purchases"
  );
  assert.equal(r?.state, "insufficient");
}
{
  // Above the noise floor, below Debrief's brief-ready default (50) -> directional.
  const r = deriveSignalVolumeReadiness(
    fixture({ winners: [ad("W", 100, 40, 34)] }),
    undefined,
    "purchase",
    "purchases"
  );
  assert.equal(r?.state, "directional");
  assert.ok(r!.buyer.includes("34"));
  assert.ok(r!.buyer.includes(String(BRIEF_READY_MIN_OUTCOMES)));
}
{
  // At/above the default -> ready.
  const r = deriveSignalVolumeReadiness(
    fixture({ winners: [ad("W", 100, 40, 50)] }),
    undefined,
    "purchase",
    "purchases"
  );
  assert.equal(r?.state, "ready");
}
{
  // 4. Missing conversions NEVER become zero: null count -> directional
  // with an honest "can't verify" line, never "insufficient".
  const r = deriveSignalVolumeReadiness(
    fixture({ winners: [ad("W", 100, 40, null)] }),
    undefined,
    "purchase",
    "purchases"
  );
  assert.equal(r?.state, "directional");
  assert.ok(/can't be verified|couldn't verify|can't verify/i.test(r!.buyer));
  assert.ok(!/\b0\b/.test(r!.buyer), "an unverifiable count is never rendered as the literal number 0");
}
{
  // Not applicable to CTR/CPC — no outcome concept, no claim either way.
  const r = deriveSignalVolumeReadiness(
    fixture({ kpi: "ctr", winners: [ad("W", 100, 40, null)] }),
    undefined,
    "purchase",
    "purchases"
  );
  assert.equal(r, null);
}
{
  // No winner at all -> null.
  const r = deriveSignalVolumeReadiness(fixture({ winners: [] }), undefined, "purchase", "purchases");
  assert.equal(r, null);
}
{
  // 7. User-set criterion overrides the Debrief default correctly, and
  // provenance reflects it.
  const criteria: DecisionCriteria = { minBriefOutcomeCount: 20 };
  const r = deriveSignalVolumeReadiness(
    fixture({ winners: [ad("W", 100, 40, 25)] }),
    criteria,
    "purchase",
    "purchases"
  );
  assert.equal(r?.state, "ready", "25 clears the user's own 20-outcome bar, even though it's under Debrief's 50 default");
  assert.equal(r!.criterion.source, "user");
  assert.ok(r!.criterion.label.includes("20"));
}

/* ===================== Loser side: Loss Confidence ===================== */

{
  // True target-CPA multiple, clears the default 2x bar -> ready.
  const r = deriveLossConfidenceReadiness(
    fixture({ losers: [ad("L", 250, -40)] }),
    100,
    undefined,
    money
  );
  assert.equal(r?.state, "ready");
  assert.ok(r!.buyer.includes("2.5"));
}
{
  // True target-CPA multiple, under the bar -> insufficient.
  const r = deriveLossConfidenceReadiness(
    fixture({ losers: [ad("L", 120, -40)] }),
    100,
    undefined,
    money
  );
  assert.equal(r?.state, "insufficient");
}
{
  // 6. When the spend gate basis IS target_cpa, the gate already
  // guarantees >= 3x — the copy must say so explicitly rather than
  // silently presenting an already-assured number as new evidence.
  const r = deriveLossConfidenceReadiness(
    fixture({ losers: [ad("L", 300, -40)], spendGateBasis: "target_cpa", spendGate: 300 }),
    100,
    undefined,
    money
  );
  assert.equal(r?.state, "ready");
  assert.ok(/already (requires|assured)/i.test(r!.buyer), "explicitly discloses the gate already assures this multiple");
  // The disclosure must also be exposed as its own field — Report.tsx's
  // "ready" tests are otherwise terse-badge-only, so without a distinct
  // field this exact caveat (the one case where "ready" is automatic by
  // construction, not earned) would never reach the rendered report.
  assert.ok(r!.disclosureNote && /already (requires|assured)/i.test(r!.disclosureNote));
}
{
  // Same target-CPA-basis "ready" case, but the bar was cleared by
  // genuinely high spend rather than gate construction (spendGateBasis
  // stays the account default) -> no disclosure needed, none present.
  const r = deriveLossConfidenceReadiness(
    fixture({ losers: [ad("L", 500, -40)] }),
    100,
    undefined,
    money
  );
  assert.equal(r?.state, "ready");
  assert.equal(r!.disclosureNote, undefined);
}
{
  // No target CPA: proxy basis (spend / spendGate), capped at
  // "directional" even when it clears the bar — never "ready" without
  // a true cost target.
  const r = deriveLossConfidenceReadiness(
    fixture({ losers: [ad("L", 300, -40)], spendGate: 100 }),
    null,
    undefined,
    money
  );
  assert.equal(r?.state, "directional", "proxy basis never reaches ready, even at 3x the gate");
  assert.ok(r!.buyer.includes("stand-in") || r!.buyer.includes("no target CPA"));
}
{
  // No target CPA, proxy below the bar -> insufficient.
  const r = deriveLossConfidenceReadiness(
    fixture({ losers: [ad("L", 120, -40)], spendGate: 100 }),
    null,
    undefined,
    money
  );
  assert.equal(r?.state, "insufficient");
}
{
  // No loser at all -> null.
  const r = deriveLossConfidenceReadiness(fixture({ losers: [] }), null, undefined, money);
  assert.equal(r, null);
}
{
  // 7. User-set spend-multiple criterion overrides the default.
  const criteria: DecisionCriteria = { minLossSpendMultiple: 5 };
  const r = deriveLossConfidenceReadiness(
    fixture({ losers: [ad("L", 250, -40)] }),
    100,
    criteria,
    money
  );
  assert.equal(r?.state, "insufficient", "2.5x clears Debrief's default (2x) but not the user's own 5x bar");
  assert.equal(r!.criterion.source, "user");
}

/* ===================== 5. Winner vs loser semantics are genuinely
   different, not the same rule in disguise ===================== */
{
  // A "winner" with a huge spend multiple but thin outcome count must
  // NOT read ready under signal-volume rules.
  const r = deriveSignalVolumeReadiness(
    fixture({ winners: [ad("W", 10000, 40, 5)] }),
    undefined,
    "purchase",
    "purchases"
  );
  assert.equal(r?.state, "insufficient", "spend alone never substitutes for outcome count on the winner side");
}
{
  // A "loser" with plenty of conversions but thin spend multiple must
  // NOT read ready under loss-confidence rules (loss confidence never
  // reads conversions at all).
  const r = deriveLossConfidenceReadiness(
    fixture({ losers: [ad("L", 105, -40, 200)] }),
    100,
    undefined,
    money
  );
  assert.equal(r?.state, "insufficient", "outcome count never substitutes for spend multiple on the loser side");
}

/* ===================== 3/9/12: isolation + banned jargon ===================== */

{
  // 2. decision.ts must never import briefReadiness.ts.
  const decisionSrc = readFileSync(new URL("../modules/debrief/decision.ts", import.meta.url), "utf-8");
  assert.ok(!/from\s+"\.\/briefReadiness/.test(decisionSrc), "decision.ts never imports briefReadiness.ts");
  assert.ok(
    !decisionSrc.includes("BriefReadiness") && !decisionSrc.includes("deriveSignalVolumeReadiness") && !decisionSrc.includes("deriveLossConfidenceReadiness"),
    "decision.ts references no brief-readiness type or function"
  );
}
{
  // briefReadiness.ts's own import surface stays exactly what it
  // claims: decision.ts (one constant) + types.ts. No memo.ts, no
  // compare.ts, no comparison type anywhere.
  const src = readFileSync(new URL("../modules/debrief/briefReadiness.ts", import.meta.url), "utf-8");
  assert.ok(!/from\s+"\.\/memo/.test(src), "briefReadiness.ts never imports memo.ts");
  assert.ok(!/from\s+"\.\/compare/.test(src), "briefReadiness.ts never imports compare.ts");
  assert.ok(!src.includes("MemoComparison"), "briefReadiness.ts references no comparison type");
}
{
  // 3 (structural half): neither function accepts a comparison
  // argument at all — presence/absence of comparison data cannot
  // possibly change the result, by signature, not just by convention.
  assert.equal(deriveSignalVolumeReadiness.length, 4, "deriveSignalVolumeReadiness takes exactly (analysis, criteria, nounOne, nounMany) — no comparison parameter");
  assert.equal(deriveLossConfidenceReadiness.length, 4, "deriveLossConfidenceReadiness takes exactly (analysis, targetCpa, criteria, money) — no comparison parameter");
}
{
  // 9. Client copy never leaks buyer/technical jargon.
  const banned = ["benchmark", "gate", "judged", "matched", "criterion", "noise floor", "target cpa"];
  const samples = [
    deriveSignalVolumeReadiness(fixture({ winners: [ad("W", 100, 40, 3)] }), undefined, "purchase", "purchases"),
    deriveSignalVolumeReadiness(fixture({ winners: [ad("W", 100, 40, 34)] }), undefined, "purchase", "purchases"),
    deriveSignalVolumeReadiness(fixture({ winners: [ad("W", 100, 40, 50)] }), undefined, "purchase", "purchases"),
    deriveSignalVolumeReadiness(fixture({ winners: [ad("W", 100, 40, null)] }), undefined, "purchase", "purchases"),
    deriveLossConfidenceReadiness(fixture({ losers: [ad("L", 250, -40)] }), 100, undefined, money),
    deriveLossConfidenceReadiness(fixture({ losers: [ad("L", 120, -40)] }), 100, undefined, money),
    deriveLossConfidenceReadiness(fixture({ losers: [ad("L", 300, -40)], spendGate: 100 }), null, undefined, money),
    deriveLossConfidenceReadiness(fixture({ losers: [ad("L", 120, -40)], spendGate: 100 }), null, undefined, money),
  ];
  for (const r of samples) {
    if (!r) continue;
    const lower = r.client.toLowerCase();
    for (const word of banned) {
      assert.ok(!lower.includes(word), `client copy must not contain "${word}": "${r.client}"`);
    }
  }
}

console.log("briefReadiness Stage 1: all pure-logic proofs passed");

/* ===================== Stage 2: sample-dataset pin via the real engine ===================== */

{
  const require = createRequire(import.meta.url);
  const dist = mkdtempSync(join(tmpdir(), "debrief-brief-readiness-"));
  try {
    execSync(
      `npx tsc modules/debrief/*.ts components/debrief/memoToText.ts --outDir ${JSON.stringify(dist)} --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck --rewriteRelativeImportExtensions`,
      { cwd: join(import.meta.dirname, ".."), stdio: "pipe" }
    );
    const { buildSampleMemo } = require(join(dist, "modules/debrief/sample.js"));
    const memo = buildSampleMemo();

    // 10. Sample report receives an explicitly asserted readiness state.
    // Hand-computed: the sample's top winner (UGC_MorningRoutine_V1) has
    // 34 purchases — past decision.ts's own 10-outcome noise floor, but
    // under Debrief's 50-outcome brief-ready default -> directional.
    assert.ok(memo.nextTests[0].briefReadiness, "T1 carries a brief-readiness read on the sample");
    assert.equal(memo.nextTests[0].briefReadiness.state, "directional");
    assert.ok(memo.nextTests[0].briefReadiness.buyer.includes("34"));

    // The sample's worst loser (Static_StockPhoto_Generic_V1, $198.20
    // spend) with no target CPA set: proxy multiple against the
    // ~$120.91 spend gate is ~1.64x — under Debrief's 2x default ->
    // insufficient (capped there anyway since there's no true target).
    assert.ok(memo.nextTests[1].briefReadiness, "T2 carries a brief-readiness read on the sample");
    assert.equal(memo.nextTests[1].briefReadiness.state, "insufficient");

    // T3 (scale-readiness) never carries brief readiness — it's a
    // budget-elasticity test, not a creative-pattern claim.
    assert.equal(memo.nextTests[2].briefReadiness, undefined);

    // 11. hypothesis -> variable -> controls -> success criterion are
    // all present on every test.
    for (const t of memo.nextTests) {
      assert.ok(typeof t.hypothesis === "string" && t.hypothesis.length > 0, "every test carries a hypothesis");
      assert.ok(typeof t.brief.change === "string" && t.brief.change.length > 0, "variable changed");
      assert.ok(typeof t.brief.keepConstant === "string" && t.brief.keepConstant.length > 0, "controls");
      assert.ok(typeof t.brief.successMetric === "string" && t.brief.successMetric.length > 0, "success criterion");
      assert.ok(t.signals.length > 0, "observed signal");
    }

    // The known duplicated-wording bug is gone from T3's rationale.
    assert.ok(
      !memo.nextTests[2].why.includes("median vs median"),
      "T3's why text no longer duplicates 'median' (fmtDeltaVsMedian already says '...than median')"
    );

    // 1. Decision output is structurally unchanged when ONLY brief-
    // readiness criteria change (minBriefOutcomeCount/minLossSpendMultiple
    // are never read by decision.ts at all — proven by the isolation
    // scans above; this proves it end-to-end too).
    const { parseCsv, toTable } = require(join(dist, "modules/debrief/csv.js"));
    const { resolveColumns } = require(join(dist, "modules/debrief/columns.js"));
    const { extractAds } = require(join(dist, "modules/debrief/extract.js"));
    const { analyze } = require(join(dist, "modules/debrief/analysis.js"));
    const { generateMemo } = require(join(dist, "modules/debrief/memo.js"));
    const { SAMPLE_CSV_TEXT, SAMPLE_CONTEXT } = require(join(dist, "modules/debrief/sampleCsv.js"));
    const runWith = (overrides: Record<string, unknown>) => {
      const { headers, rows } = toTable(parseCsv(SAMPLE_CSV_TEXT));
      const columns = resolveColumns(headers);
      const ads = extractAds(rows, columns, SAMPLE_CONTEXT.kpi);
      const ctx = { ...SAMPLE_CONTEXT, ...overrides };
      return generateMemo(analyze(ads, rows, columns, ctx), ctx);
    };
    const baseline = runWith({});
    assert.equal(baseline.nextTests[0].briefReadiness.state, "directional", "baseline: 34 purchases, Debrief's default 50-bar");
    assert.equal(baseline.nextTests[1].briefReadiness.state, "insufficient", "baseline: 1.6x proxy, Debrief's default 2x-bar");

    // A MUCH stricter winner bar (500) leaves the state unchanged
    // (34 is still above the 10-outcome noise floor, just far below
    // 500 either way — "insufficient" is anchored to that floor, not
    // to however high the user's own bar is set).
    const withStricterCriteria = runWith({ minBriefOutcomeCount: 500, minLossSpendMultiple: 50 });
    assert.deepEqual(
      withStricterCriteria.decision,
      baseline.decision,
      "decision is byte-identical when only brief-readiness criteria change, however strict"
    );
    assert.equal(withStricterCriteria.nextTests[0].briefReadiness.state, "directional");

    // A LOOSER bar than Debrief's default visibly flips both states —
    // proving the user's own criteria genuinely override the defaults,
    // not just get silently accepted without effect.
    const withLooserCriteria = runWith({ minBriefOutcomeCount: 20, minLossSpendMultiple: 1 });
    assert.deepEqual(
      withLooserCriteria.decision,
      baseline.decision,
      "decision remains byte-identical even when brief-readiness criteria loosen"
    );
    assert.equal(withLooserCriteria.nextTests[0].briefReadiness.state, "ready", "34 >= the user's own 20-outcome bar");
    assert.equal(withLooserCriteria.nextTests[0].briefReadiness.criterion.source, "user");
    assert.equal(withLooserCriteria.nextTests[1].briefReadiness.state, "directional", "1.6x proxy clears the user's own 1x bar (still capped at directional — no target CPA)");
    assert.equal(withLooserCriteria.nextTests[1].briefReadiness.criterion.source, "user");
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
}

console.log("briefReadiness Stage 2: sample-dataset pin passed");
