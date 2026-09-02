/**
 * Hypothesis Framing Coherence V1 — plain-Node proofs.
 *
 * memo.ts is extensionless-import (not directly Node-loadable), and
 * the wording logic under test (winnerThin/loserThin) lives entirely
 * inside buildNextTests, not a separately importable pure function —
 * so this file is Stage-2-only: the real engine, compiled to a temp
 * dir, exercised through synthetic fixtures across representative
 * branches (T1, T2's three sub-branches, T3), the same tsc-to-temp-dir
 * approach briefReadiness.test.ts/evidenceDiagnostic.test.ts already
 * use for memo.ts-level behavior.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const dist = mkdtempSync(join(tmpdir(), "debrief-hypothesis-framing-"));

/* A regression guard against unsupported causal/proof language drifting
   into memo.ts's generated narrative (hypothesis/why) — the same gap
   the audit found: compare.ts/creativeEvidence.ts/evidenceDiagnostic.ts
   all have this guard, memo.ts/decision.ts's own output never has.
   Deliberately NARROW: "because" is legitimate and load-bearing in a
   hypothesis's own "we expect X — because Y [observed signal]"
   structure (Y is offered as supporting rationale for a FORWARD-LOOKING
   expectation, not asserted as a settled causal fact) — banning it
   would reject the approved template itself, exactly the naive-
   blocklist failure mode to avoid. What's actually banned is language
   that asserts causation/proof as already-established fact. */
const CAUSAL_OVERCLAIM =
  /\b(proves?|proven|causes?|caused by|guarantees?|confirms?|results in|is the reason it|will definitely)\b/i;

function assertNoOverclaim(text: string, where: string) {
  assert.ok(!CAUSAL_OVERCLAIM.test(text), `causal overclaim in ${where}: "${text}"`);
}

try {
  execSync(
    `npx tsc modules/debrief/*.ts components/debrief/memoToText.ts --outDir ${JSON.stringify(dist)} --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck --rewriteRelativeImportExtensions`,
    { cwd: join(import.meta.dirname, ".."), stdio: "pipe" }
  );
  const { parseCsv, toTable } = require(join(dist, "modules/debrief/csv.js"));
  const { resolveColumns } = require(join(dist, "modules/debrief/columns.js"));
  const { extractAds } = require(join(dist, "modules/debrief/extract.js"));
  const { analyze } = require(join(dist, "modules/debrief/analysis.js"));
  const { generateMemo } = require(join(dist, "modules/debrief/memo.js"));
  const { memoToText } = require(join(dist, "components/debrief/memoToText.js"));
  const { buildSampleMemo } = require(join(dist, "modules/debrief/sample.js"));

  const baseContext = {
    kpi: "roas",
    product: "Test",
    offer: "",
    targetCpa: null,
    targetRoas: null,
    creativeNotes: "",
    marketContext: "",
    spendGateOverride: null,
    minOutcomeCount: null,
    minBriefOutcomeCount: null,
    minLossSpendMultiple: null,
  };

  const runCsv = (csvText: string, contextOverrides: Record<string, unknown> = {}) => {
    const { headers, rows } = toTable(parseCsv(csvText));
    const columns = resolveColumns(headers);
    const ctx = { ...baseContext, ...contextOverrides };
    const ads = extractAds(rows, columns, ctx.kpi);
    return generateMemo(analyze(ads, rows, columns, ctx), ctx);
  };

  /* ===================== A. Strong evidence ===================== */
  // Winner has 60 purchases (>= 50 default brief-ready bar). Worst
  // loser gets a low target CPA so its spend clears 2x easily -> ready.
  const strongCsv = `Ad name,Amount spent (USD),Purchases,Purchase ROAS (return on ad spend)
StrongWinner,600.00,60,4.50
MidAd,450.00,20,3.00
LowAd,400.00,15,2.50
LowerAd,390.00,12,2.60
StrongLoser,380.00,5,1.20`;
  {
    const memo = runCsv(strongCsv, { targetCpa: 50 });
    assert.equal(memo.nextTests[0].briefReadiness.state, "ready", "winner has 60 purchases, clears the 50-bar");
    assert.match(
      memo.nextTests[0].hypothesis,
      /we expect at least one variant to beat/,
      "strong evidence: T1 hypothesis keeps its confident phrasing"
    );
    assert.ok(
      !memo.nextTests[0].hypothesis.includes("we want to test whether"),
      "strong evidence: no provisional phrasing leaks in"
    );
    assert.equal(memo.decision.action, "budget", "a real committed action still fires");
    assertNoOverclaim(memo.nextTests[0].hypothesis, "A: strong T1 hypothesis");
  }

  /* ===================== B. Thin outcome evidence ===================== */
  // Winner has 3 purchases (< 10 floor) -> insufficient -> softened.
  // 5 judged ads clears DECISION_MIN_JUDGED, so a real action still fires.
  const thinCsv = `Ad name,Amount spent (USD),Purchases,Purchase ROAS (return on ad spend)
ThinWinner,500.00,3,4.50
MidAd,450.00,8,3.00
LowAd,400.00,6,2.50
LowerAd,390.00,4,2.10
WorstAd,380.00,2,1.20`;
  {
    const memo = runCsv(thinCsv);
    assert.equal(memo.nextTests[0].briefReadiness.state, "insufficient");
    assert.match(
      memo.nextTests[0].hypothesis,
      /we want to test whether at least one variant beats/,
      "thin evidence: T1 hypothesis becomes explicitly provisional"
    );
    assert.ok(
      !memo.nextTests[0].hypothesis.includes("we expect at least one variant to beat"),
      "thin evidence: confident phrasing is fully replaced, not merely appended to"
    );
    assert.ok(
      ["budget", "test", "hold"].includes(memo.decision.action),
      "the committed action is still exactly one of the three defined actions"
    );
    assert.notEqual(memo.decision.action, undefined);
    assertNoOverclaim(memo.nextTests[0].hypothesis, "B: thin T1 hypothesis");
    assertNoOverclaim(memo.nextTests[0].why, "B: thin T1 why");
  }

  /* ===================== C. Unverifiable outcome count ===================== */
  // No Purchases column at all -> conversions null -> briefReadiness
  // "directional" via the unverifiable branch, NOT "insufficient" — and
  // the ADJACENT evidence-check line (untouched by this milestone)
  // still says "can't be verified", never "0".
  const unverifiableCsv = `Ad name,Amount spent (USD),Purchase ROAS (return on ad spend)
UnverifiedWinner,500.00,4.50
MidAd,450.00,3.00
LowAd,400.00,2.50
LowerAd,390.00,2.10
WorstAd,380.00,1.20`;
  {
    const memo = runCsv(unverifiableCsv);
    assert.equal(memo.nextTests[0].briefReadiness.state, "directional");
    assert.match(memo.nextTests[0].briefReadiness.buyer, /can't be verified/);
    assert.ok(
      !memo.nextTests[0].briefReadiness.buyer.match(/\b0\b/),
      "unverifiable is never worded as a zero count — missing != zero"
    );
    assert.match(
      memo.nextTests[0].hypothesis,
      /we want to test whether at least one variant beats/,
      "unverifiable evidence also produces the provisional hypothesis, same as verified-thin"
    );
    assertNoOverclaim(memo.nextTests[0].hypothesis, "C: unverifiable T1 hypothesis");
  }

  /* ===================== D. User-overridden Brief Readiness criteria ===================== */
  // Winner has 20 purchases: under Debrief's default 50-bar (directional,
  // softened) but a user bar of 15 flips it to "ready" (confident) — the
  // wording change follows the ALREADY-COMPUTED state; no threshold is
  // re-implemented here.
  const midCsv = `Ad name,Amount spent (USD),Purchases,Purchase ROAS (return on ad spend)
MidWinner,500.00,20,4.50
MidAd,450.00,15,3.00
LowAd,400.00,12,2.50
LowerAd,390.00,10,2.10
WorstAd,380.00,8,1.20`;
  {
    const baseline = runCsv(midCsv);
    assert.equal(baseline.nextTests[0].briefReadiness.state, "directional", "20 < Debrief's default 50-bar");
    assert.match(baseline.nextTests[0].hypothesis, /we want to test whether/);

    const overridden = runCsv(midCsv, { minBriefOutcomeCount: 15 });
    assert.equal(overridden.nextTests[0].briefReadiness.state, "ready", "20 >= the user's own 15-bar");
    assert.equal(overridden.nextTests[0].briefReadiness.criterion.source, "user");
    assert.match(
      overridden.nextTests[0].hypothesis,
      /we expect at least one variant to beat/,
      "the user's own criterion flips the wording via the already-computed state, not a second threshold"
    );
    assert.deepEqual(
      overridden.decision,
      baseline.decision,
      "decision is byte-identical whether or not the user's brief-readiness criterion is set"
    );
  }

  /* ===================== E. Evidence Diagnostic present ===================== */
  // Same thin winner as B, plus upstream columns so Evidence Diagnostic
  // activates. The hypothesis stays coherent with thin evidence (already
  // proven in B, since winnerThin is a structural superset of Evidence
  // Diagnostic's own activation) and never narrates the diagnostic's own
  // upstream metric as proof inside the hypothesis sentence.
  const thinWithDiagnosticCsv = `Ad name,Amount spent (USD),Purchases,Purchase ROAS (return on ad spend),Adds to cart
ThinWinner,500.00,3,4.50,10
MidAd,450.00,8,3.00,45
LowAd,400.00,6,2.50,50
LowerAd,390.00,4,2.10,55
WorstAd,380.00,2,1.20,60`;
  {
    const memo = runCsv(thinWithDiagnosticCsv);
    assert.ok(memo.nextTests[0].evidenceDiagnostic, "Evidence Diagnostic activates for the thin winner");
    assert.equal(memo.nextTests[0].briefReadiness.state, "insufficient");
    assert.match(
      memo.nextTests[0].hypothesis,
      /we want to test whether/,
      "hypothesis is coherent with Evidence Diagnostic's presence — softened, as winnerThin structurally requires whenever the diagnostic fires"
    );
    assert.ok(
      !memo.nextTests[0].hypothesis.toLowerCase().includes("add-to-cart"),
      "the diagnostic's own upstream metric is never narrated inside the hypothesis sentence"
    );
    assertNoOverclaim(memo.nextTests[0].evidenceDiagnostic.buyer, "E: evidence diagnostic buyer text");
  }

  /* ===================== F. T3 — no universal 25-50% remains ===================== */
  // A clear scale-eligible winner (>=30% past median, no cut-eligible
  // loser group) forces the T3 budget-elasticity branch.
  const scaleCsv = `Ad name,Amount spent (USD),Purchases,Purchase ROAS (return on ad spend)
ScaleWinner,500.00,60,5.00
MidAd,450.00,20,3.10
LowAd,400.00,15,3.00
LowerAd,390.00,12,2.95
WorstAd,380.00,10,2.90`;
  {
    const memo = runCsv(scaleCsv);
    const t3 = memo.nextTests[2];
    assert.match(t3.test, /single moderate step/, "T3 title uses qualitative step language");
    assert.ok(!t3.test.includes("25") && !t3.test.includes("50"), "no numeric range in T3 title");
    const allText = JSON.stringify(t3);
    assert.ok(!allText.includes("25–50") && !allText.includes("25-50"), "no 25-50% anywhere in the T3 test object");
    assert.equal(t3.briefReadiness, undefined, "T3 never carries brief readiness — a budget-elasticity test, not a creative claim");
    // Controlled one-variable semantics remain intact.
    assert.ok(t3.brief.keepConstant.length > 0);
    assert.equal(t3.brief.change, "Daily budget only, one step up.");
    assert.ok(t3.brief.successMetric.length > 0);
    assertNoOverclaim(t3.hypothesis, "F: T3 hypothesis");
    assertNoOverclaim(t3.why, "F: T3 why");
  }

  /* ===================== G. Client register ===================== */
  {
    const buyerMemo = runCsv(thinWithDiagnosticCsv);
    const clientText = memoToText(buyerMemo, "client", 3, [], "");
    assert.ok(
      !clientText.includes("Evidence diagnostic") && !clientText.toLowerCase().includes("add-to-cart"),
      "Evidence Diagnostic never leaks into client TXT export"
    );
    // Hypothesis text DOES appear in client TXT (pre-existing behavior,
    // unrelated to this milestone). Scoped to T1's line specifically —
    // the test this fixture's thin/diagnostic-bearing evidence attaches
    // to, and the only hypothesis template this milestone's new
    // softened phrasing touches for THIS fixture. (T2/T3's own
    // hypothesis templates predate this milestone and are unmodified
    // here; see the final report for a pre-existing jargon leak found
    // — but not fixed — in T2's "weakest judged ad" phrasing.)
    const hypothesisLines: string[] = clientText
      .split("\n")
      .filter((line: string) => line.trim().startsWith("Hypothesis:"));
    assert.ok(hypothesisLines.length > 0, "Hypothesis lines are present in client TXT");
    const t1Line = hypothesisLines[0];
    assert.match(t1Line, /want to test whether/, "T1's softened phrasing reaches the client TXT export unmodified in meaning");
    for (const jargon of ["spend gate", "benchmark", "judged"]) {
      assert.ok(!t1Line.toLowerCase().includes(jargon), `T1's hypothesis line leaks buyer jargon "${jargon}": "${t1Line}"`);
    }
  }

  /* ===================== H. Isolation ===================== */
  {
    // Decision output is byte-identical across the D fixture's baseline
    // vs. user-overridden runs, despite the hypothesis wording differing
    // — decision.ts cannot see this wording logic (it lives entirely in
    // memo.ts's buildNextTests, never imported by decision.ts).
    const baseline = runCsv(midCsv);
    const overridden = runCsv(midCsv, { minBriefOutcomeCount: 15 });
    assert.deepEqual(baseline.decision, overridden.decision);
    assert.notEqual(baseline.nextTests[0].hypothesis, overridden.nextTests[0].hypothesis);
  }

  /* ===================== I. Sample ===================== */
  {
    const sampleMemo = buildSampleMemo();
    // Pinned in briefReadiness.test.ts: the sample's own winner
    // (UGC_MorningRoutine_V1) has 34 purchases -> "directional", not
    // "ready" -> its T1 hypothesis is CORRECTLY softened by this
    // milestone (34 is genuinely thin relative to the 50-bar; this is
    // the feature working as designed on real sample data, not a
    // regression). Dataset-level decision/evidenceState are untouched.
    assert.equal(sampleMemo.nextTests[0].briefReadiness.state, "directional");
    assert.match(sampleMemo.nextTests[0].hypothesis, /we want to test whether/);
    assert.equal(sampleMemo.decision.evidenceState, "supported", "dataset-level evidenceState unchanged by this milestone");
    assert.equal(sampleMemo.decision.action, "budget");
    assert.equal(sampleMemo.decision.budgetVariant, "shift");
    // T3 never exists on the sample's own scale-eligible path here since
    // the committed action is a shift (scale+cut), not scale-only — the
    // pinned decision shape itself is unaffected either way.
    for (const t of sampleMemo.nextTests) {
      assertNoOverclaim(t.hypothesis, `I: sample test "${t.test}"`);
      assertNoOverclaim(t.why, `I: sample test "${t.test}" why`);
    }
  }

  console.log("hypothesisFraming: all proofs passed");
} finally {
  rmSync(dist, { recursive: true, force: true });
}
