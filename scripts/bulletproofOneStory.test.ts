/**
 * Bulletproof pass B4 — one story, no repetition.
 *
 * The scale candidates are named in full once — the Next move lists. The
 * exec summary names the primary + "and N more"; What we know, What not
 * to do and Confidence say "the N scale candidates" without names. The
 * client uses one "below" figure — the reduce group's spend plus the
 * hold count; the below-median total appears only in spend allocation,
 * labelled as a total.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadEngine } from "./testerFeedbackEngine.ts";

const { run, buildSampleMemo, memoToText, cleanup } = loadEngine();
try {
  const fixture = run(readFileSync(join(ROOT, "scripts/fixtures/agency-naming-convention.csv"), "utf8"), "roas");
  const sample = buildSampleMemo();
  for (const [label, memo] of [["fixture", fixture.memo], ["sample", sample]] as const) {
    const d = memo.decision;
    const to = d.budgetMove!.to.map((t) => t.name);
    assert.ok(to.length > 1, `${label}: several scale candidates`);
    const [primary, ...rest] = to;
    // Exec summary: the primary + "and N more".
    assert.ok(memo.tldr[0].startsWith(`"${primary}" and ${rest.length} more scale candidate`), `${label}: ${memo.tldr[0]}`);
    for (const n of rest) assert.ok(!memo.tldr[0].includes(`"${n}"`), `${label}: only the primary is named in the verdict`);
    // What we know / What not to do / Confidence: counted, never named.
    // (The duplicate-rows disclosure names merged ads, not scale candidates.)
    const counted = [d.rationale, ...memo.avoid.buyer, ...memo.confidence.reasons, ...d.limits.buyer.filter((l) => !/appeared on several rows/.test(l))];
    for (const n of to) for (const line of counted) assert.ok(!line.includes(`"${n}"`), `${label}: "${n}" repeated in: ${line.slice(0, 80)}`);
    assert.match(d.rationale, new RegExp(`^The ${to.length} scale candidates are `));
    assert.ok(memo.avoid.buyer.some((l) => l.startsWith(`Do not scale anything except the ${to.length} scale candidates`)));
    // The Next move lists name every scale candidate (buyer TXT shows them all).
    const text = memoToText(memo, "buyer", 5, []);
    const receivesLine = text.split("\n").find((l) => l.startsWith("Receives the budget:"))!;
    for (const n of to) assert.ok(receivesLine.includes(`"${n}"`), `${label}: listed in full in the Next move`);
  }

  /* ---- Client: one "below" figure — the reduce group + holds ---- */
  const move = fixture.memo.decision.budgetMove!;
  assert.ok((move.holdCount ?? 0) > 0, "fixture has near-median holds");
  assert.notEqual(move.trimSpendLabel, move.belowSpendLabel, "so the two figures differ");
  const clientText = memoToText(fixture.memo, "client", 5, []);
  assert.ok(clientText.includes(`About ${move.trimSpendLabel} is going to the ${move.from.length} ads we're reducing; ${move.holdCount} more sit close to the middle ad and stay as they are.`));
  assert.ok(!clientText.includes(move.belowSpendLabel!), "the below-median total never appears in client text");
  const buyerText = memoToText(fixture.memo, "buyer", 5, []);
  assert.ok(buyerText.includes(move.belowSpendLabel!), "the buyer keeps the below-median context");
  const chart = readFileSync(join(ROOT, "components/debrief/SpendAllocationChart.tsx"), "utf8");
  assert.match(chart, /below: \{ buyer: "Below median", client: "Below the middle ad — total" \}/, "spend allocation labels the total");

  console.log("bulletproof one story: all assertions passed");
} finally {
  cleanup();
}
