/**
 * Bulletproof pass A3 — per-stage benchmark.
 *
 * When ads carry a funnel stage (name tokens, else campaign / ad set
 * names) and a stage has ≥ 5 judged ads, each of its ads is compared with
 * that stage's own median; unstaged ads and smaller stages keep the
 * overall median, with a visible note. Receivers and trims follow the
 * stage-relative scores. Proves the split, the fallback, the copy ("than
 * the TOFU median"), the stat-row medians and note, that the decision
 * confidence is no longer capped for mixed stages once split, and that
 * exports without stages are untouched.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadEngine } from "./testerFeedbackEngine.ts";
import { STAGE_MIN_JUDGED } from "../modules/debrief/funnelStages.ts";

const dated = (rows: string[]) =>
  "Ad name,Amount spent (EUR),Purchases,Purchases conversion value,Reporting starts,Reporting ends\n" +
  rows.map((r) => `${r},2026-06-01,2026-06-30`).join("\n") + "\n";
const row = (name: string, purchases: number, roas: number) => `${name},400,${purchases},${roas * 400}`;
// TOFU median 2.0x, BOFU median 4.0x; three unstaged ads.
const TOFU = [row("T1_TOFU", 30, 3.2), row("T2_TOFU", 20, 2.4), row("T3_TOFU", 20, 2.1), row("T4_TOFU", 20, 1.9), row("T5_TOFU", 15, 1.6), row("T6_TOFU", 10, 1.0)];
const BOFU = [row("B1_BOFU", 40, 6.0), row("B2_BOFU", 30, 4.6), row("B3_BOFU", 25, 4.2), row("B4_BOFU", 25, 3.8), row("B5_BOFU", 20, 3.2), row("B6_BOFU", 10, 2.0)];
const PLAIN = [row("U1", 20, 3.0), row("U2", 20, 2.5), row("U3", 20, 2.8)];

const { run, cleanup } = loadEngine();
try {
  assert.equal(STAGE_MIN_JUDGED, 5);
  const r = run(dated([...TOFU, ...BOFU, ...PLAIN]), "roas", { targetRoas: 1.5 });
  const a = r.analysis;
  assert.deepEqual(a.stageBenchmark, {
    stages: [
      { stage: "TOFU", judged: 6, median: 2, medianLabel: "2.00x" },
      { stage: "BOFU", judged: 6, median: 4, medianLabel: "4.00x" },
    ],
    fallback: 3,
  });
  const ad = (n: string) => a.rankedAds.find((x) => x.name === n)!;
  assert.deepEqual(ad("T1_TOFU").stageBenchmark, { stage: "TOFU", median: 2 });
  assert.ok(Math.abs(ad("T1_TOFU").deltaPct! - 60) < 1e-9, "3.2x vs the TOFU 2.0x median");
  assert.ok(Math.abs(ad("B5_BOFU").deltaPct! + 20) < 1e-9, "3.2x is 20% BELOW the BOFU median");
  assert.equal(ad("U1").stageBenchmark, undefined, "unstaged ⇒ the overall median");
  assert.ok(Math.abs(ad("U1").deltaPct! - ((3.0 - a.median!) / a.median!) * 100) < 1e-9);
  assert.ok(a.losers.some((x) => x.name === "B5_BOFU"), "below its own stage ⇒ a loser, though above the overall median");
  assert.ok(a.winners.some((x) => x.name === "T1_TOFU"));

  /* ---- Receivers and trims come from the stage-relative scores ---- */
  const d = r.memo.decision;
  assert.ok(d.budgetMove!.to.some((x) => x.name === "T1_TOFU"), "a TOFU ad 60% over its stage receives");
  assert.ok(d.budgetMove!.from.some((x) => x.name === "B5_BOFU"), "a BOFU ad 20% under its stage is trimmed");
  assert.match(d.rationale, /^The 2 scale candidates are 50% and 60% better than their own median ROAS \(BOFU, TOFU\)/);
  const t1 = r.memo.winners.find((x) => x.name === "T1_TOFU")!;
  assert.equal(t1.vsMedianLabel, "60% better than the TOFU median");

  /* ---- Visible: stat-row medians, the note, the limits line ---- */
  assert.deepEqual(r.memo.scope.stageMedians, [{ stage: "TOFU", label: "2.00x" }, { stage: "BOFU", label: "4.00x" }]);
  assert.equal(
    r.memo.scope.stageNote?.buyer,
    `Each ad is compared with its own funnel stage's median (TOFU 2.00x, BOFU 4.00x); 3 ads with no stage (or in a stage with under 5 judged ads) use the overall ${r.memo.scope.medianLabel} median.`
  );
  assert.ok(r.buyerText.includes(r.memo.scope.stageNote!.buyer), "TXT");
  // Bulletproof pass C4: 3 ads use the overall median, so the client note
  // never claims every ad is compared within its group.
  assert.equal(r.memo.scope.stageNote?.client, "Ads are compared with their own audience group where the data allows.");
  assert.ok(d.limits.client.some((l) => l.startsWith("Where the data allows, ads aimed at new audiences")));
  assert.ok(r.clientText.includes(`Notes: ${r.memo.scope.stageNote!.client}`), "client TXT: the Notes line under the Next move");
  assert.ok(d.limits.buyer.some((l) => l.startsWith("Each ad is compared with its own funnel stage's median (TOFU 2.00x across 6 ads and BOFU 4.00x across 6 ads); 3 ads with no stage")));
  assert.equal(r.memo.scope.stageWarning, undefined, "split ⇒ no mixed-stage warning");
  /* Split and every receiver read within its own stage ⇒ no stage cap. */
  assert.ok(d.budgetMove!.to.every((t) => a.rankedAds.find((x) => x.name === t.name)?.stageBenchmark), "all receivers staged");
  assert.ok(!r.memo.confidence.decision.caps.buyer.some((c) => c.includes("funnel stages")));

  /* ---- A-fix 3: an UNSTAGED receiver keeps the mixed-stage cap ---- */
  {
    const withPlain = run(dated([...TOFU, ...BOFU, ...PLAIN, row("U9", 40, 5.5)]), "roas", { targetRoas: 1.5 }).memo;
    const plainReceivers = withPlain.decision.budgetMove!.to.filter((t) => !/_(TOFU|BOFU)$/.test(t.name));
    assert.ok(plainReceivers.length > 0, "an unstaged ad receives budget");
    const n = withPlain.decision.budgetMove!.to.length;
    assert.ok(
      withPlain.confidence.decision.caps.buyer.includes(
        `${plainReceivers.length} of ${n} receiver${n === 1 ? " is" : "s are"} judged against the overall median, not ${plainReceivers.length === 1 ? "its" : "their"} own stage's (funnel stages are mixed)`
      )
    );
    assert.notEqual(withPlain.confidence.decision.level, "high");
  }

  /* ---- A stage under 5 judged ads falls back to the overall median ---- */
  const small = run(dated([...TOFU, ...BOFU.slice(0, 4), ...PLAIN]), "roas").analysis;
  assert.deepEqual(small.stageBenchmark?.stages.map((s) => s.stage), ["TOFU"], "BOFU (4) isn't split");
  assert.equal(small.stageBenchmark?.fallback, 7, "4 BOFU + 3 unstaged");
  assert.equal(small.rankedAds.find((x) => x.name === "B1_BOFU")?.stageBenchmark, undefined);

  /* ---- No stages: one median, byte-identical shape ---- */
  const plain = run(dated([...TOFU, ...BOFU, ...PLAIN].map((x) => x.replace(/_(TOFU|BOFU)/, ""))), "roas");
  assert.equal(plain.analysis.stageBenchmark, undefined);
  assert.ok(plain.analysis.rankedAds.every((x) => x.stageBenchmark === undefined));
  assert.equal(plain.memo.scope.stageMedians, undefined);

  /* ---- Report: stage medians in the stat row, the note under it ---- */
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  assert.match(report, /\.\.\.\(memo\.scope\.stageMedians \?\? \[\]\)\.map\(\(s\) => \[`\$\{s\.stage\} median`, s\.label\]\)/);
  assert.match(report, /\{!client && memo\.scope\.stageNote && \(\s*<p[^>]*>\{memo\.scope\.stageNote\.buyer\}<\/p>/, "buyer: the note under the stat row");
  // Pass C4: client page 1 = masthead → stat cards → Next move → one Notes line.
  const card = report.indexOf("<DecisionCard\n");
  const notesAt = report.indexOf("{client && clientNotes(memo).length > 0 && (");
  assert.ok(card > 0 && notesAt > card, "the client Notes line renders after the Next move card");
  assert.ok(!/client && memo\.spreadThinPlan && \(|client && memo\.scope\.attributionClientLine && \(/.test(report), "no client notes above the card");
  assert.match(report, /\{ label: "Mixed stages", value: memo\.scope\.stageWarning \}/, "unsplittable mix ⇒ exec summary");

  console.log("bulletproof stage benchmark: all assertions passed");
} finally {
  cleanup();
}
