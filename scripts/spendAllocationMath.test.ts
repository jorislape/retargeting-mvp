import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildSpendAllocationSegments,
  SPEND_ALLOCATION_SEGMENT_ORDER,
} from "../components/debrief/spendAllocationMath.ts";

/* Segment order is fixed: below -> at -> above, regardless of input order. */
{
  const geometry = buildSpendAllocationSegments(
    [
      { id: "above", spend: 50, count: 2 },
      { id: "below", spend: 30, count: 1 },
      { id: "at", spend: 20, count: 1 },
    ],
    100
  );
  assert.deepEqual(
    geometry.map((s) => s.id),
    ["below", "at", "above"],
    "output order is always below -> at -> above, independent of input order"
  );
  assert.deepEqual([...SPEND_ALLOCATION_SEGMENT_ORDER], ["below", "at", "above"]);
}

/* Widths are the TRUE proportional share — no minimum-visibility floor. */
{
  const geometry = buildSpendAllocationSegments(
    [
      { id: "below", spend: 5, count: 1 },
      { id: "above", spend: 95, count: 4 },
    ],
    100
  );
  const below = geometry.find((s) => s.id === "below")!;
  const above = geometry.find((s) => s.id === "above")!;
  assert.equal(below.widthPercent, 5, "a 5% segment renders at true 5% width, never floored");
  assert.equal(above.widthPercent, 95);
}
{
  const geometry = buildSpendAllocationSegments(
    [
      { id: "below", spend: 1, count: 1 },
      { id: "above", spend: 99, count: 4 },
    ],
    100
  );
  assert.equal(geometry.find((s) => s.id === "below")!.widthPercent, 1, "a 1% segment stays true to 1%");
  assert.equal(geometry.find((s) => s.id === "above")!.widthPercent, 99);
}

/* Zero (or negative) judgedSpend produces no geometry at all. */
{
  assert.deepEqual(buildSpendAllocationSegments([{ id: "above", spend: 10, count: 1 }], 0), []);
  assert.deepEqual(buildSpendAllocationSegments([{ id: "above", spend: 10, count: 1 }], -5), []);
}

/* Absent / zero-count categories are omitted entirely — never a fake
   zero-width semantic segment. */
{
  const geometry = buildSpendAllocationSegments(
    [
      { id: "below", spend: 0, count: 0 },
      { id: "above", spend: 100, count: 3 },
    ],
    100
  );
  assert.equal(geometry.length, 1, "a zero-count segment is dropped, not rendered at 0%");
  assert.equal(geometry[0].id, "above");

  const onlyAbove = buildSpendAllocationSegments([{ id: "above", spend: 100, count: 3 }], 100);
  assert.equal(onlyAbove.length, 1);
}

/* Set-aside structurally cannot enter the 100% bar: SpendAllocationSegmentId
   is a closed "below" | "at" | "above" union, so there is no id a caller
   could pass that would put set-aside spend into this geometry — the
   type system is the proof at compile time. The runtime counterpart —
   that above + at + below sums to judgedSpend, excluding setAsideSpend
   entirely — is proven against the real engine in
   scripts/spendAllocation.test.ts. */

/* Structural isolation: the math module contains no KPI-aware logic and
   no action/decision field — its only concerns are id/spend/count.
   Comments are stripped first so the doc comment that DESCRIBES this
   invariant (which necessarily contains the word "KPI") doesn't trip
   its own scan — only actual code is checked. */
{
  const src = readFileSync(
    new URL("../components/debrief/spendAllocationMath.ts", import.meta.url),
    "utf8"
  );
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.ok(!/\bkpi\b/i.test(code), "spendAllocationMath.ts must contain no KPI-aware logic");
  assert.ok(!/\baction\b/i.test(code), "spendAllocationMath.ts must contain no action field");
  assert.ok(!/\bdecision\b/i.test(code), "spendAllocationMath.ts must contain no decision field");
  assert.ok(!/\bevidenceState\b/i.test(code), "spendAllocationMath.ts must not read evidenceState");
}

console.log("spendAllocationMath: all pure-logic proofs passed");
