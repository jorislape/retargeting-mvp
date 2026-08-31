import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildMovementChartRows,
  maxMovementMagnitude,
  movementBarWidth,
} from "../components/debrief/movementChartMath.ts";

/* better -> "better" direction (renders right); worse -> "worse"
   direction (renders left). No third "unchanged"/"none" direction
   exists — compare.ts never hands this module an unchanged row. */
{
  const rows = buildMovementChartRows([
    { name: "Up", pct: 35, better: true },
    { name: "Down", pct: -22, better: false },
  ]);
  assert.equal(rows[0].direction, "better", "an improved row renders right");
  assert.equal(rows[1].direction, "worse", "a declined row renders left");
  assert.ok(
    rows.every((r) => r.direction === "better" || r.direction === "worse"),
    "direction is always exactly better or worse — no third state"
  );
}

/* Row order is preserved exactly as supplied — this module never
   sorts (compare.ts already sorted improved/declined by magnitude). */
{
  const rows = buildMovementChartRows([
    { name: "C", pct: 5, better: true },
    { name: "A", pct: 50, better: true },
    { name: "B", pct: 20, better: true },
  ]);
  assert.deepEqual(rows.map((r) => r.name), ["C", "A", "B"], "supplied order is never re-sorted");
}

/* One shared absolute scale across both sides. */
{
  const rows = buildMovementChartRows([
    { name: "Big win", pct: 80, better: true },
    { name: "Small win", pct: 10, better: true },
    { name: "Big loss", pct: -60, better: false },
  ]);
  const max = maxMovementMagnitude(rows);
  assert.equal(max, 80, "the scale is the single largest magnitude across all rows, both directions");
  assert.equal(movementBarWidth(rows[0], max), 100, "the largest row fills the scale");
  assert.equal(movementBarWidth(rows[2], max), 75, "a smaller-magnitude row scales proportionally against the same max");
}

/* Visibility floor affects width only — never the displayed value
   (callers render the true magnitude separately) and never ordering
   (proven above: this module doesn't sort at all). */
{
  const rows = buildMovementChartRows([
    { name: "Huge", pct: 95, better: true },
    { name: "Tiny", pct: 2, better: true },
  ]);
  const max = maxMovementMagnitude(rows);
  const tinyWidth = movementBarWidth(rows[1], max);
  assert.ok(tinyWidth >= 8, "a very small row is still visible (floored), never invisible");
  assert.equal(rows[1].magnitude, 2, "the row's own true magnitude is untouched by the floor — floor affects width only");
}

/* pct === null (zero-baseline) -> no bar, no invented geometry, no
   fake 0%. */
{
  const rows = buildMovementChartRows([
    { name: "NewBaseline", pct: null, better: true },
    { name: "Normal", pct: 40, better: true },
  ]);
  assert.equal(rows[0].magnitude, null, "zero-baseline row carries no magnitude");
  const max = maxMovementMagnitude(rows);
  assert.equal(movementBarWidth(rows[0], max), 0, "zero-baseline row renders no bar");
  assert.equal(rows[0].direction, "better", "zero-baseline row still carries its known, polarity-correct direction");
}

/* All rows zero-baseline -> max magnitude defaults to 1 (no division
   by zero), and every row still renders no bar. */
{
  const rows = buildMovementChartRows([
    { name: "A", pct: null, better: true },
    { name: "B", pct: null, better: false },
  ]);
  const max = maxMovementMagnitude(rows);
  assert.equal(max, 1);
  assert.ok(rows.every((r) => movementBarWidth(r, max) === 0));
}

/* Structural isolation: no KPI-aware logic, no action/decision field. */
{
  const src = readFileSync(
    new URL("../components/debrief/movementChartMath.ts", import.meta.url),
    "utf8"
  );
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.ok(!/\bkpi\b/i.test(code), "movementChartMath.ts must contain no KPI-aware logic");
  assert.ok(!/\baction\b/i.test(code), "movementChartMath.ts must contain no action field");
  assert.ok(!/\bdecision\b/i.test(code), "movementChartMath.ts must contain no decision field");
  assert.ok(!/\bevidenceState\b/i.test(code), "movementChartMath.ts must not read evidenceState");
  // Independence from rankingChartMath.ts — no shared import/coupling.
  assert.ok(!/rankingChartMath/.test(code), "movementChartMath.ts imports nothing from rankingChartMath.ts");
}

console.log("movementChartMath: all pure-logic proofs passed");
