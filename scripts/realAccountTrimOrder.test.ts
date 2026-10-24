/**
 * Real-account review — trim candidates by money at stake.
 *
 * On a real export the below-median list (and the Pause / trim line)
 * opened with three ads of 47–71 EUR and 0 purchases, while a 1,017 EUR
 * ad 30% under the median sat far down the list. Proves: below-median
 * rows, the decision's Pause / trim list, the verdict's named ad and the
 * short-form headline all follow spend × gap to the median (a
 * zero-purchase ad stakes its whole spend); the ROAS column stays; the
 * cut bar still reads the worst ad by the KPI; the losers instruction
 * says how the list is ordered.
 *
 * Trim candidates vs profitability: with no target, a candidate at ≥
 * min(1.5x, 50% of the median) is flagged "not necessarily unprofitable"
 * in its row and in Pause / trim, and the card asks for a breakeven
 * target when one sits in the top 3; with a target, candidates that beat
 * it read "above target — reduce, don't pause". The order never changes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_BANNED, ROOT, clientStrings, loadEngine } from "./testerFeedbackEngine.ts";
import { moneyAtStake } from "../modules/debrief/decision.ts";
import type { RankedAd } from "../modules/debrief/types.ts";

const H = "Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n";
const ad = (spend: number, deltaPct: number | null, zeroConversions?: boolean) =>
  ({ spend, deltaPct, zeroConversions }) as unknown as RankedAd;

/* ---- The measure ---- */
assert.equal(moneyAtStake(ad(1000, -30)), 300, "spend × gap");
assert.equal(moneyAtStake(ad(70, -100)), 70, "0x ROAS: the whole spend");
assert.equal(moneyAtStake(ad(70, null, true)), 70, "a zero-conversion CPA ad (no value): the whole spend");
assert.equal(moneyAtStake(ad(500, null)), 500);
assert.equal(moneyAtStake(ad(500, 10)), 0, "never negative");

const { run, buildSampleMemo, cleanup } = loadEngine();
try {
  // Median 3.0x. Big_Mild: 1,000 EUR at 2.1x (−30% → 300 at stake);
  // Zero_Big: 400 EUR, 0 purchases (400); Tiny_Bad: 250 EUR at 0.6x
  // (−80% → 200); Zero_Small: 230 EUR, 0 purchases (230).
  const csv =
    H +
    [
      "Top_A,400,30,1600", "Top_B,400,28,1500", "Top_C,400,25,1400", "Mid_D,400,20,1200", "Mid_E,400,20,1200",
      "Big_Mild,1000,30,2100", "Zero_Big,400,0,0", "Tiny_Bad,250,2,150", "Zero_Small,230,0,0",
    ].join("\n") + "\n";
  const r = run(csv, "roas");
  const m = r.memo;
  const order = ["Zero_Big", "Big_Mild", "Zero_Small", "Tiny_Bad"];
  assert.deepEqual(m.losers.rows.map((x) => x.name), order, "below-median rows by money at stake");
  assert.deepEqual(m.decision.budgetMove?.from.map((x) => x.name), order, "Pause / trim in the same order");
  assert.ok(m.tldr[1].startsWith('Trim or pause "Zero_Big" and 3 other below-median ads'), "the verdict names the most at stake");
  assert.deepEqual(m.losers.rows.map((x) => x.valueLabel), ["0.00x", "2.10x", "0.00x", "0.60x"], "the ROAS column stays");
  assert.ok(m.losers.killInstruction.endsWith("Listed by money at stake — spend × gap to the median."));

  // The KPI order is untouched underneath: the cut bar reads the worst ad.
  const kpiOrder = r.analysis.losers.map((x) => x.kpiValue ?? 0);
  assert.deepEqual(kpiOrder, [...kpiOrder].sort((a, b) => a - b), "analysis.losers stays worst-first by ROAS");

  /* ---- Short-form headline (≤2 below-median ads) follows the same order ---- */
  // Tiny (0.2x) is worse by ROAS; Big (1.67x on 900 EUR) has more at stake.
  const two = run(H + ["A,400,30,1600", "B,400,20,1200", "C,400,20,1200", "D,400,20,1220", "Tiny,250,1,50", "Big,900,20,1500"].join("\n") + "\n", "roas").memo;
  assert.equal(two.decision.headline, 'Shift budget in steps from "Big" and "Tiny" into "A".', "most at stake first");

  /* ---- The real-account shape is reproduced by the fixture ---- */
  const f = run(readFileSync(join(ROOT, "scripts/fixtures/agency-naming-convention.csv"), "utf8"), "roas");
  const stakes = f.memo.losers.rows.map((row) => moneyAtStake(f.analysis.losers.find((x) => x.name === row.name)!));
  assert.deepEqual(stakes, [...stakes].sort((a, b) => b - a), "fixture rows descend by money at stake");

  /* ---- Sample: already in this order; only the instruction gains the note ---- */
  const s = buildSampleMemo();
  assert.deepEqual(s.losers.rows.map((x) => x.name), [
    "Static_StockPhoto_Generic_V1", "Static_MemeStyle_V1", "Comparison_CompetitorAngle_V1", "Discount_Generic_20Off", "ProductShot_Static_V1",
  ]);

  /* ---- Below median ≠ unprofitable ---- */
  {
    const NOTE = "Below median, not necessarily unprofitable — check against your breakeven ROAS before cutting.";
    const HINT = "Set a target ROAS (your breakeven) for a profit-based trim list.";
    // Median 3.0x: the bar is min(1.5, 1.5) = 1.5x. Big_Mild (2.1x) is
    // flagged; Tiny_Bad (0.6x) and the zero-purchase ads aren't.
    const byName = (memo: typeof m) => Object.fromEntries(memo.losers.rows.map((x) => [x.name, x.trimNote?.buyer]));
    assert.deepEqual(byName(m), { Zero_Big: undefined, Big_Mild: NOTE, Zero_Small: undefined, Tiny_Bad: undefined });
    const pause = m.decision.budgetMove!.from;
    assert.deepEqual(pause.map((x) => x.note?.buyer), [undefined, "below median, not necessarily unprofitable", undefined, undefined], "Pause / trim carries it too");
    // Bulletproof pass A1: the hint is part of the profit-basis line,
    // present on every budget move without a breakeven.
    assert.ok(m.decision.profitBasisNote?.buyer.endsWith(HINT), "no breakeven ⇒ relative-move line ending in the hint");
    assert.ok(r.buyerText.includes(HINT) && r.buyerText.includes(NOTE));
    assert.ok(r.buyerText.includes(`"Big_Mild" (€1,000.00 — below median, not necessarily unprofitable)`));

    // The bar is the LOWER of 1.5x and half the median: median ≈ 2.0x ⇒ 1.0x.
    const low = run(H + ["A,400,30,1200", "B,400,28,1000", "C,400,25,900", "D,400,20,800", "E,400,20,800", "F,400,20,780", "Ok_1x,400,20,420", "Bad,400,10,300"].join("\n") + "\n", "roas").memo;
    assert.equal(low.losers.rows.find((x) => x.name === "Ok_1x")?.trimNote?.buyer, NOTE, "1.05x ≥ 50% of a ~2x median");
    assert.equal(low.losers.rows.find((x) => x.name === "Bad")?.trimNote, undefined, "0.75x stays a plain trim candidate");

    // Flagged ads only outside the top 3 ⇒ notes, but no hint.
    const deep = run(H + ["A,500,30,2000", "B,500,28,1800", "C,500,25,1700", "D,500,20,1600", "E,500,20,1550", "Z1,500,0,0", "Z2,480,0,0", "Z3,460,0,0", "Mild,240,10,380"].join("\n") + "\n", "roas").memo;
    assert.ok(deep.losers.rows.slice(3).some((x) => x.trimNote) && !deep.losers.rows.slice(0, 3).some((x) => x.trimNote));
    assert.ok(deep.decision.profitBasisNote?.buyer.endsWith(HINT), "still stated: the move is relative, not profit-based");

    // With a target: beat it ⇒ "above target — reduce, don't pause"; no hint.
    const t = run(csv, "roas", { targetRoas: 2 });
    assert.deepEqual(t.memo.losers.rows.map((x) => x.name), order, "the order never changes");
    assert.deepEqual(Object.fromEntries(t.memo.losers.rows.map((x) => [x.name, x.trimNote?.buyer])), { Zero_Big: undefined, Big_Mild: "Above target — reduce, don't pause.", Zero_Small: undefined, Tiny_Bad: undefined });
    assert.equal(t.memo.decision.budgetMove!.from[1].note?.buyer, "above target — reduce, don't pause");
    assert.equal(t.memo.decision.profitBasisNote, undefined, "a target is already set");
    assert.equal(t.memo.decision.action, m.decision.action);
    assert.equal(t.memo.decision.headline, m.decision.headline, "the call is the same");

    // Target CPA: the same rule in CPA terms.
    const cpaCsv = "Ad name,Amount spent (EUR),Purchases,Cost per purchase (EUR)\n" +
      ["A,400,40,10", "B,400,36,11.11", "C,400,33,12.12", "D,400,30,13.33", "E,400,28,14.29", "Slow,400,20,20", "Slower,400,10,40"].join("\n") + "\n";
    const c = run(cpaCsv, "cpa", { targetCpa: 25 }).memo;
    assert.equal(c.losers.rows.find((x) => x.name === "Slow")?.trimNote?.buyer, "Beats your target CPA — reduce, don't pause.");
    assert.equal(c.losers.rows.find((x) => x.name === "Slower")?.trimNote, undefined);
    assert.equal(run(cpaCsv, "cpa").memo.losers.rows.some((x) => x.trimNote), false, "no ROAS rule for CPA without a target");

    // Client: plain words, no buyer jargon.
    for (const memo of [m, t.memo]) {
      for (const str of [...clientStrings(memo), ...memo.losers.rows.flatMap((x) => (x.trimNote ? [x.trimNote.client, x.trimNote.short.client] : [])), memo.decision.profitBasisNote?.client ?? ""])
        for (const w of CLIENT_BANNED) assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(str), `client "${w}": ${str}`);
    }

    // Sample: the 1.28x row gains the note (2.12x is a near-median hold);
    // nothing in the top 3 ⇒ no hint.
    const sample = buildSampleMemo();
    assert.deepEqual(sample.losers.rows.map((x) => Boolean(x.trimNote)), [false, false, false, true, false]);
    assert.ok(sample.decision.profitBasisNote, "the sample has no breakeven either");

    // Report renders all three surfaces.
    const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
    assert.match(report, /\{a\.note \? <span className="text-amber-300\/80"> — \{client \? a\.note\.client : a\.note\.buyer\}<\/span> : null\}/);
    assert.match(report, /\{client \? d\.profitBasisNote\.client : d\.profitBasisNote\.buyer\}/);
    assert.match(report, /\{view === "client" \? ad\.trimNote\.client : ad\.trimNote\.buyer\}/);
  }

  /* ---- Near median (within 15%) is a hold, not a trim ---- */
  {
    // Median 3.0x: Near_A 2.7x (−10%) and Near_B 2.6x (−13%) hold;
    // Far_C 2.4x (−20%) and the rest are trims.
    const csv2 =
      H +
      ["Top_A,400,30,1600", "Top_B,400,28,1500", "Top_C,400,25,1400", "Mid_D,400,20,1200", "Mid_E,400,20,1200", "Mid_F,400,20,1200",
       "Near_A,900,20,2430", "Near_B,800,20,2080", "Far_C,400,10,960", "Bad_D,400,5,400", "Bad_E,400,4,300"].join("\n") + "\n";
    const n = run(csv2, "roas");
    const d = n.memo.decision;
    assert.equal(n.analysis.median, 3);
    assert.deepEqual(d.budgetMove!.from.map((x) => x.name).sort(), ["Bad_D", "Bad_E", "Far_C"], "holds are not in Pause / trim");
    assert.match(d.headline, /^Shift budget in steps from 3 ads well below the median into /, "the count leaves the holds out");
    assert.match(d.rationale, / 2 of them sit within 15% of the median — near-median holds, not trims\.$/);
    const holds = n.memo.losers.rows.filter((x) => x.holdNote).map((x) => x.name).sort();
    assert.deepEqual(holds, ["Near_A", "Near_B"]);
    for (const h of n.memo.losers.rows.filter((x) => x.holdNote)) {
      assert.equal(h.holdNote!.buyer, "Near median — hold (within 15% of the median; not a trim).");
      assert.equal(h.trimNote, undefined, "a hold carries no trim note");
    }
    assert.match(n.memo.tldr[1], /^Trim or pause "[^"]+" and 2 other ads well below the median — combined €[\d,.]+, plus 2 near-median holds\.$/);
    /* Every trim-context count is the trim count, holds mentioned
       (exec-summary Trim line / below-median intro, client Summary,
       client section 03); the spend-allocation bar keeps every
       below-median ad. */
    assert.match(n.memo.losers.killInstruction, /Combined €1,200\.00 sits on 3 ads well below the median, plus 2 near-median holds — context, not the amount to move\./);
    // Bulletproof pass B5: the reduce-group sentence — relative, not a loss.
    assert.match(n.memo.clientSummary[1], /^€1,200\.00 went to ads that trailed the middle ad — an area to optimise, not money lost; without a breakeven we can't say how much of it lost money\. We're reducing or pausing those 3 ads\. 2 more sit close to the middle ad and stay as they are\.$/);
    assert.match(n.memo.losers.clientInstruction, /^€1,200\.00 went to ads that trailed the middle ad — .* We're reducing or pausing spend on 3 of the ads below .* 2 more sit close to the middle ad and stay as they are\.$/);
    assert.equal(n.memo.spendAllocation?.segments.find((s) => s.id === "below")?.count, 5, "the bar keeps every below-median ad");
    for (const s of clientStrings(n.memo)) for (const w of CLIENT_BANNED) assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(s), `client "${w}": ${s}`);
    assert.ok(n.buyerText.includes("Hold — near median"), "the near-median status (replaces the hold note)");
    // The cut bar still reads every below-median ad (the decision is unchanged).
    assert.equal(d.budgetVariant, "shift");
    // No hold ⇒ the old wording, unchanged.
    assert.match(m.decision.headline, /from 4 below-median ads/);

    // The appendix labels them; the report renders the note.
    const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
    assert.match(report, /hold: client \? "Close to the middle ad" : "Near median — hold"/);
    // The row shows the business status ("Hold — near median" for these).
    assert.match(report, /\{ad\.status && <StatusLine status=\{ad\.status\} client=\{view === "client"\} \/>\}/);
    // Client split + per-section list: trims counted, holds one clause.
    assert.match(report, /const trims = memo\.losers\.rows\.filter\(\(r\) => !r\.holdNote\);/);
    assert.match(report, /count: trims\.length,\s*names: trims\.slice\(0, 3\)/);
    assert.match(report, /ads well below the middle ad, plus \$\{rows\.filter\(\(r\) => r\.holdNote\)\.length\} close to it/);
  }

  console.log("real-account trim order: all assertions passed");
} finally {
  cleanup();
}
