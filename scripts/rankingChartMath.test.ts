import assert from "node:assert/strict";
import {
  buildRankingChartRows,
  maxRankingMagnitude,
  rankingBarWidth,
} from "../components/debrief/rankingChartMath.ts";
import type { MemoWinnerLoserRow } from "../modules/debrief/types.ts";

function row(name: string, deltaPct: number | null): MemoWinnerLoserRow {
  return {
    name,
    valueLabel: "2.00×",
    vsMedianLabel: deltaPct == null ? "better" : `${Math.abs(deltaPct)}% better than median`,
    spendLabel: "$100.00",
    reason: "Metrics only — angle unknown.",
    deltaPct,
  };
}

{
  const rows = buildRankingChartRows([row("positive", 25)], [row("negative", -10)]);
  assert.equal(rows[0].direction, "better", "positive upstream delta points right");
  assert.equal(rows[1].direction, "worse", "negative upstream delta points left");
  assert.deepEqual(rows.map((item) => item.row.name), ["positive", "negative"]);
  assert.equal(maxRankingMagnitude(rows), 25, "both sides use one absolute scale");
  assert.equal(rankingBarWidth(rows[0], 25), 100);
  assert.equal(rankingBarWidth(rows[1], 25), 40);
}

{
  const rows = buildRankingChartRows([row("CPA winner", 15)], [row("CPA loser", -20)]);
  assert.equal(rows[0].direction, "better");
  assert.equal(rows[1].direction, "worse");
  // No KPI enters the function: lower-is-better correctness is inherited
  // from analysis.ts's already polarity-corrected signed delta.
  assert.equal("kpi" in rows[0], false);
  assert.equal("action" in rows[0], false, "math has no action inference surface");
}

{
  const supplied = buildRankingChartRows([row("visible winner", 5)], []);
  assert.deepEqual(supplied.map((item) => item.row.name), ["visible winner"]);
  assert.equal(supplied.some((item) => item.row.name === "absent row"), false);
}

{
  const rows = buildRankingChartRows([row("unknown", null), row("zero", 0)], []);
  assert.equal(maxRankingMagnitude(rows), 1);
  assert.equal(rows[0].direction, "none");
  assert.equal(rows[1].direction, "none");
  assert.equal(rankingBarWidth(rows[0], 1), 0, "null invents no geometry");
  assert.equal(rankingBarWidth(rows[1], 1), 0, "zero invents no direction");
}

console.log("rankingChartMath: all pure-logic proofs passed");
