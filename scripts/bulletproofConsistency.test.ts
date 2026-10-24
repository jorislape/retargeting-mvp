/**
 * Bulletproof pass B9 — one set of numbers.
 *
 * The status counts (scale candidate / keep / wait / reduce / hold), the
 * reduce group's amount and the primary scale candidate are identical
 * across the exec summary, the Next move, the client Summary, the client
 * cards and TXT (both views). Hold = every Hold-status ad — the
 * near-median ones left off the trim list AND the ad at the median.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadEngine } from "./testerFeedbackEngine.ts";
import type { Memo } from "../modules/debrief/types.ts";

const AGENCY = readFileSync(join(ROOT, "scripts/fixtures/agency-naming-convention.csv"), "utf8");
const { run, buildSampleMemo, memoToText, cleanup } = loadEngine();
try {
  const cases: [string, Memo][] = [
    ["fixture", run(AGENCY, "roas").memo],
    ["fixture + breakeven", run(AGENCY, "roas", { targetRoas: 2.5 }).memo],
    ["sample", buildSampleMemo()],
  ];
  for (const [label, m] of cases) {
    const rows = [...m.winners, ...(m.atMedian?.rows ?? []), ...m.losers.rows];
    const count = (k: string) => rows.filter((r) => r.status?.key === k).length;
    const move = m.decision.budgetMove!;
    assert.ok(move && move.to.length > 0 && move.from.length > 0, `${label}: a shift`);
    const [scale, reduceGroup, hold] = [count("scale"), move.from.length, count("hold")];
    const primary = move.to[0].name;
    const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;

    /* Next move ⇔ statuses */
    assert.equal(move.to.length, scale, `${label}: receivers = Scale candidates`);
    assert.deepEqual(move.to.map((t) => t.name).sort(), rows.filter((r) => r.status?.key === "scale").map((r) => r.name).sort());
    assert.equal(move.holdCount, hold, `${label}: Next move hold count = Hold statuses`);
    assert.equal(reduceGroup, m.losers.rows.filter((r) => !r.holdNote).length, `${label}: the reduce group = the trim rows`);
    assert.equal(count("reduce") + count("maintain"), reduceGroup, `${label}: trims are Reduce (or Maintain with a breakeven)`);

    /* Exec summary */
    assert.ok(m.tldr[0].startsWith(scale === 1 ? `"${primary}"` : `"${primary}" and ${scale - 1} more scale candidate`), `${label}: ${m.tldr[0].slice(0, 90)}`);
    const trimLine = m.tldr.find((l) => l.startsWith("Trim or pause "))!;
    assert.ok(trimLine.includes(`and ${reduceGroup - 1} other ads well below the median — combined ${move.trimSpendLabel}`), `${label}: ${trimLine}`);
    if (hold > 0) assert.ok(trimLine.endsWith(`plus ${n(hold, "near-median hold")}.`), `${label}: ${trimLine}`);

    /* Client Summary */
    const lead = m.clientSummary[0];
    assert.ok(scale === 1 ? lead.includes(`"${primary}"`) : lead.startsWith(`${scale} ads were clearly ahead`) && lead.includes(`led by "${primary}"`), `${label}: ${lead}`);
    const reduceLine = m.clientSummary.find((l) => l.startsWith(`${move.trimSpendLabel} went to ads that trailed`))!;
    assert.ok(reduceLine, `${label}: the client reduce amount = the Next move's`);
    assert.ok(reduceLine.includes(`those ${reduceGroup} ads`), reduceLine);
    if (hold > 0) assert.ok(reduceLine.includes(hold === 1 ? "1 more sits close" : `${hold} more sit close`), reduceLine);

    /* TXT, both views */
    const buyer = memoToText(m, "buyer", 5, []);
    const client = memoToText(m, "client", 3, []);
    for (const l of [m.tldr[0], trimLine]) assert.ok(buyer.includes(l), `${label}: buyer TXT carries the exec summary`);
    const receives = buyer.split("\n").find((l) => l.startsWith("Receives the budget:"))!;
    assert.equal((receives.match(/"[^"]+" \(/g) ?? []).length, scale, `${label}: buyer TXT receivers`);
    assert.ok(receives.startsWith(`Receives the budget: "${primary}"`), `${label}: primary first`);
    assert.ok(client.includes(`About ${move.trimSpendLabel} is going to the ${reduceGroup} ads we're reducing${hold > 0 ? `; ${hold} more sit` : ""}`), `${label}: client TXT below line`);
    assert.ok(client.includes(reduceLine), `${label}: client TXT carries the client Summary`);
    for (const k of ["scale", "keep", "wait", "reduce", "hold"]) {
      const labels = new Set(rows.filter((r) => r.status?.key === k).map((r) => r.status!.buyer));
      const inTxt = buyer.split("\n").filter((l) => l.startsWith("- ") && [...labels].some((s) => l.endsWith(`| ${s}`) || l.includes(`| ${s}`))).length;
      assert.equal(inTxt, count(k), `${label}: buyer TXT rows with status ${k}`);
    }
  }

  /* Client cards: the same hold total (at-median included). */
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  assert.match(report, /const held = memo\.losers\.rows\.length - trims\.length \+ \(memo\.atMedian\?\.rows\.length \?\? 0\);/);
  const f = cases[0][1];
  const cardHeld = f.losers.rows.filter((r) => r.holdNote).length + (f.atMedian?.rows.length ?? 0);
  assert.equal(cardHeld, f.decision.budgetMove!.holdCount, "client card hold count = Next move's");
  assert.ok((f.atMedian?.rows.length ?? 0) > 0, "fixture: an at-median ad exercises the total");

  console.log("bulletproof consistency: all assertions passed");
} finally {
  cleanup();
}
