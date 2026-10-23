/**
 * Real-account fix 2 — budget receiver evidence floor.
 *
 * A real agency export shifted "7,889 EUR from 43 ads" into ONE ad with
 * 68 EUR / 8 purchases. Proves: an ad receives budget only with ≥10
 * outcomes (or the user's own scaling minimum) AND spend ≥ the minimum
 * spend (1× — follow-up; 2× was too strict for evenly-spent accounts); a leader that fails is passed over for the best ad that
 * passes (up to 3 receivers); none passing ⇒ a test with a one-line
 * reason; the below-median total is descriptive only; the "Ready" brief
 * badge respects the same floor.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_BANNED, ROOT, clientStrings, loadEngine } from "./testerFeedbackEngine.ts";
import {
  MAX_BUDGET_RECEIVERS,
  RECEIVER_MIN_GATE_MULTIPLE,
  SCALE_TEST_MIN_DELTA_PCT,
  MIN_OUTCOMES_FOR_SUPPORTED,
} from "../modules/debrief/decision.ts";

const AGENCY = readFileSync(join(ROOT, "scripts/fixtures/agency-naming-convention.csv"), "utf8");
const THIN_LEADER = "[SKU]00229_";

const { run, cleanup } = loadEngine();
try {
  /* ---- The fixture reproduces the real failure: a thin leader ---- */
  const r = run(AGENCY, "roas");
  const a = r.analysis;
  const d = r.memo.decision;
  const leader = a.winners[0];
  assert.ok(leader.name.includes(THIN_LEADER), "fixture: the thin ad leads the ranking");
  assert.equal(leader.conversions, 8, "…on 8 purchases, under the 10-purchase floor");
  assert.equal(RECEIVER_MIN_GATE_MULTIPLE, 1);

  /* ---- It is passed over; the best ads that clear the floor receive ---- */
  assert.equal(d.action, "budget");
  assert.equal(d.budgetVariant, "shift");
  const to = d.budgetMove!.to.map((x) => x.name);
  assert.ok(!to.some((n) => n.includes(THIN_LEADER)), "thin leader never receives budget");
  assert.ok(to.length >= 1 && to.length <= MAX_BUDGET_RECEIVERS);
  const ranked = new Map(a.rankedAds.map((x) => [x.name, x]));
  for (const n of to) {
    const ad = ranked.get(n)!;
    assert.ok((ad.conversions ?? 0) >= MIN_OUTCOMES_FOR_SUPPORTED, `${n}: ≥10 purchases`);
    assert.ok(ad.spend >= RECEIVER_MIN_GATE_MULTIPLE * a.spendGate, `${n}: ≥ the minimum spend`);
    assert.ok((ad.deltaPct ?? 0) >= SCALE_TEST_MIN_DELTA_PCT, `${n}: past the scale bar`);
  }
  // Best first: receivers are the top passing ads in ranking order.
  const passing = a.winners.filter(
    (w) =>
      (w.deltaPct ?? 0) >= SCALE_TEST_MIN_DELTA_PCT &&
      (w.conversions ?? 0) >= MIN_OUTCOMES_FOR_SUPPORTED &&
      w.spend >= RECEIVER_MIN_GATE_MULTIPLE * a.spendGate
  );
  assert.deepEqual(to, passing.slice(0, MAX_BUDGET_RECEIVERS).map((w) => w.name));
  assert.match(d.headline, /^Shift budget in steps from /);
  assert.ok(
    d.limits.buyer.some((l) => l.includes(`leads by ${Math.round(leader.deltaPct!)}% but has 8 purchases — under the receiver floor`)),
    "the passed-over leader is explained"
  );
  assert.ok(
    d.appliedCriteria.some((c) => c.label.startsWith("Receiver floor: ≥10 purchases and ≥") && c.source === "debrief_default")
  );

  /* ---- The below-median total is descriptive, never "move it all" ---- */
  assert.match(d.rationale, /where the money sits, not the amount to move: trim the weakest first and raise the receivers? in steps/);
  assert.match(r.buyerText, /currently sits on below-median ads — context, not the amount to move: trim the weakest and raise the receivers in steps\./);
  assert.match(r.clientText, /we trim the weakest and add budget to the leaders in steps, not all at once\./);

  /* ---- "Ready" never outruns the floor ---- */
  const t1 = r.memo.nextTests[0];
  assert.ok(t1.briefReadiness == null || t1.briefReadiness.state !== "ready");

  /* ---- Up to 3 receivers, best first ---- */
  {
    const many =
      "Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n" +
      ["R1,500,50,3000", "R2,500,48,2800", "R3,500,45,2600", "R4,500,44,2500", "M1,500,30,1000", "M2,500,30,1000", "M3,500,30,1000", "L1,500,10,300", "L2,500,8,200"].join("\n") + "\n";
    const m = run(many, "roas").memo.decision;
    assert.deepEqual(m.budgetMove!.to.map((x) => x.name), ["R1", "R2", "R3"], "capped at 3, best first");
  }

  /* ---- None passes ⇒ Test with a one-line reason (even if a cut would clear) ---- */
  {
    const thin =
      "Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n" +
      ["Thin,200,6,2000", "A,400,20,800", "B,400,20,800", "C,400,20,760", "D,400,20,720", "E,400,8,200", "F,400,6,150"].join("\n") + "\n";
    const t = run(thin, "roas");
    const td = t.memo.decision;
    assert.equal(td.action, "test", "no receiver ⇒ no budget move");
    assert.match(td.headline, /No ad has enough evidence to receive budget yet\.$/);
    assert.match(td.rationale, /^No budget move: "Thin" leads by \d+% but has 6 purchases, and no ad past the 30% bar clears the receiver floor \(≥10 purchases and ≥ [\d.,]+ EUR spent \(the minimum spend\)\)\./);
    assert.equal(td.rationale.split(". ").length <= 2, true, "one line of reason + the closing sentence");
    for (const s of clientStrings(t.memo))
      for (const w of CLIENT_BANNED) assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(s), `client "${w}": ${s}`);
  }

  /* ---- The user's own scaling minimum replaces the default 10 ---- */
  {
    const u = run(AGENCY, "roas", { minOutcomeCount: 35 });
    const to35 = u.memo.decision.budgetMove?.to ?? [];
    for (const x of to35) assert.ok((u.analysis.rankedAds.find((y) => y.name === x.name)!.conversions ?? 0) >= 35);
    assert.ok(
      u.memo.decision.appliedCriteria.some((c) => c.label.startsWith("Scaling minimum: ≥35 purchases") && c.source === "user")
    );
  }

  console.log("real-account receivers: all assertions passed");
} finally {
  cleanup();
}
