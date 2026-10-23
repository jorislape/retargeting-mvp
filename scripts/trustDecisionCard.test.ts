/**
 * Trust Pass 3 — one coherent decision card.
 *
 * (a) When the card surfaces a "Next controlled test", the Not-yet line
 *     never says "don't pair this with a new creative test" — it
 *     sequences the test after the budget move instead.
 * (b) One confidence scale: the card's strength label is evidenceState;
 *     confidence.level is mapped from it (supported→high, limited→
 *     medium, insufficient→low); Brief readiness lives in the tests.
 * (c) A test built on an ad that doesn't clear the +30% scale bar is
 *     never badged "Ready" — capped at Early signal (directional).
 * (d) The budget move is concrete: ads to pause/trim, the ad receiving
 *     budget, and "about $X currently sits on below-median ads" (the
 *     already-computed figure — nothing invented).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, TESTER_CSV, loadEngine } from "./testerFeedbackEngine.ts";
import type { Memo } from "../modules/debrief/types.ts";

const ECOM = readFileSync(join(ROOT, "scripts/fixtures/ecom-13ads.csv"), "utf8");
const NINE_ZERO = "Ad name,Amount spent (USD),Purchases,Cost per purchase (USD)\n" +
  [["A", 400, 8], ["B", 380, 0], ["C", 360, 6], ["D", 340, 0], ["E", 320, 0], ["F", 300, 4], ["G", 280, 0], ["H", 260, 3], ["I", 50, 1]]
    .map(([n, s, p]) => `${n},${s},${p},${p ? ((s as number) / (p as number)).toFixed(2) : ""}`).join("\n") + "\n";
const PAIR_BAN = /pair this with a new creative test|No new creative test alongside|into a new test yet|anything new with the freed budget/i;

const { run, buildSampleMemo, memoToText, requireCompiled, cleanup } = loadEngine();
try {
  const { CONFIDENCE_FROM_EVIDENCE } = requireCompiled("modules/debrief/memo.js") as {
    CONFIDENCE_FROM_EVIDENCE: Record<string, string>;
  };
  assert.deepEqual(CONFIDENCE_FROM_EVIDENCE, { supported: "high", limited: "medium", insufficient: "low" });

  const sample = buildSampleMemo();
  const runs: [string, Memo, string, string][] = [
    ["sample", sample, memoToText(sample, "buyer", 5, []), memoToText(sample, "client", 3, [])],
    ...[["ecom roas", ECOM, "roas"], ["ecom cpa", ECOM, "cpa"], ["tester", TESTER_CSV, "cpa"], ["nine-zero cut", NINE_ZERO, "cpa"]].map(
      ([label, csv, kpi]): [string, Memo, string, string] => {
        const r = run(csv, kpi);
        return [label, r.memo, r.buyerText, r.clientText];
      }
    ),
  ];

  for (const [label, m, buyer, client] of runs) {
    const d = m.decision;
    /* (a) no contradiction between "Not yet" and the surfaced test */
    if (d.nextControlledTest) {
      for (const l of [...d.avoidNow.buyer, ...d.avoidNow.client]) assert.ok(!PAIR_BAN.test(l), `${label}: avoid contradicts the card's test: ${l}`);
      if (d.action === "budget")
        assert.ok(d.avoidNow.buyer.some((l) => /test below only after|start the test below only after/.test(l)), `${label}: test sequenced after the move`);
    }
    /* (b) one scale */
    assert.equal(m.confidence.level, CONFIDENCE_FROM_EVIDENCE[d.evidenceState], `${label}: confidence mirrors evidenceState`);
    /* (c) no "Ready" badge under the scale bar */
    const t1 = m.nextTests[0];
    if (t1?.briefReadiness?.state === "ready") {
      const top = m.winners[0];
      assert.ok(top && top.deltaPct != null && top.deltaPct >= 30, `${label}: Ready only past the +30% bar`);
    }
    /* (d) concrete budget move */
    if (d.action === "budget") {
      assert.ok(d.budgetMove);
      if (d.budgetVariant !== "scale") {
        assert.match(buyer, new RegExp(`About ${d.budgetMove!.belowSpendLabel!.replace(/[$.]/g, "\\$&")} currently sits on below-median ads — context, not the amount to ${d.budgetVariant === "cut" ? "cut" : "move"}`));
        assert.match(buyer, /\nPause or trim: /);
        assert.match(client, /\nPausing or reducing: /);
      }
      if (d.budgetVariant !== "cut") assert.match(buyer, /\n(Receives the budget|Gets more budget): /);
    }
  }

  /* Specific cases. */
  const tester = run(TESTER_CSV, "cpa");
  assert.equal(tester.memo.winners[0].deltaPct != null && tester.memo.winners[0].deltaPct < 30, true);
  assert.equal(tester.memo.nextTests[0].briefReadiness?.state, "directional", "+17% lead, 53 purchases → Early signal, not Ready");
  assert.match(tester.buyerText, /Brief readiness: Early signal/);
  assert.match(tester.memo.nextTests[0].briefReadiness?.buyer ?? "", /under the 30% bar/);

  const ecom = run(ECOM, "roas").memo;
  assert.equal(ecom.decision.budgetMove?.belowSpendLabel, "$2,109.00", "= belowBenchmarkSpend, formatted");
  assert.ok(ecom.decision.avoidNow.buyer.includes("Run the test below only after the budget move has ~$171.00 of fresh spend — one variable at a time."));

  const cut = run(NINE_ZERO, "cpa").memo;
  assert.equal(cut.decision.budgetVariant, "cut");
  assert.ok(cut.decision.avoidNow.buyer.some((l) => l.startsWith("Park the freed budget behind current ads; start the test below only after")));
  assert.deepEqual(cut.decision.budgetMove?.to, []);

  /* Card source: evidence line is the only strength label; readiness moved. */
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  const card = report.slice(report.indexOf("function DecisionCard("), report.indexOf("\nfunction AdTable("));
  assert.ok(!/briefReadiness/.test(card.replace(/\/\*[\s\S]*?\*\//g, "")), "no Brief readiness on the card");
  assert.ok(!/memo\.confidence/.test(card), "no confidence.level on the card");
  assert.match(report, /<Term tip=\{TIP_BRIEF_READINESS\}>Brief readiness<\/Term>:/, "explained in the tests section");

  console.log("trustDecisionCard: all assertions passed");
} finally {
  cleanup();
}
