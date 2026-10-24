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

const { run, buildSampleMemo, cleanup } = loadEngine();
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
  assert.match(d.rationale, /where the money sits, not the amount to move\./);
  assert.match(r.buyerText, /currently sits on below-median ads — context, not the amount to move\./);
  /* Bulletproof pass A4: HOW to move it — at ad set level, in ≤20% steps. */
  assert.match(d.execution!.buyer, /^Pause or trim the weakest ads \(Meta re-spreads their ad set's budget to the remaining ads\) and raise budget on the ad sets running the scale candidates by ≤20% every 2–3 days, re-reading after each step — larger jumps can restart Meta's learning phase\. Past ROAS doesn't guarantee the same return on extra budget\.$/);
  assert.ok(r.buyerText.includes(`How to execute: ${d.execution!.buyer}`));
  assert.ok(r.clientText.includes(`How we'll do it: ${d.execution!.client}`));

  /* ---- T1, its brief and the Next controlled test build on the
     PRIMARY receiver; the passed-over leader is only a watch note ---- */
  {
    const primary = to[0];
    const t1 = r.memo.nextTests[0];
    assert.ok(t1.test.includes(`"${primary}"`), "T1 builds on the primary receiver");
    assert.ok(!t1.test.includes(leader.name) && !t1.hypothesis.includes(leader.name) && !t1.setup.includes(leader.name));
    assert.ok(!JSON.stringify(t1.brief).includes(leader.name), "the brief never names the passed-over leader");
    assert.ok(!t1.signals.some((x) => x.includes(leader.name)));
    assert.match(t1.why, new RegExp(`Watch: "${leader.name.replace(/[[\]]/g, "\\$&")}" leads at [\\d.]+x ROAS but on 100\\.00 EUR and 8 purchases — under the receiver floor, so it isn't the base for this test\\.$`));
    assert.match(t1.why, /^It's the strongest ad with the evidence to build on: /);
    assert.ok(d.nextControlledTest?.preserve.includes(`"${primary}"`), "Next controlled test preserves the primary receiver");
    assert.ok(!d.nextControlledTest?.preserve.includes(leader.name));
    assert.equal(d.nextControlledTest?.change, "Only the opening 3 seconds / first frame — nothing else.", "UGC receiver ⇒ video wording");
    assert.ok(!(t1.briefReadiness?.buyer ?? "").includes(leader.name), "readiness judges the primary receiver");
    assert.ok(!(t1.evidenceDiagnostic?.buyer ?? "").includes(leader.name));
  }
  /* ---- Confidence "Why" and caveats cite the receivers, never the
     passed-over leader's 8 purchases ---- */
  {
    const counts = to.map((n) => a.rankedAds.find((x) => x.name === n)!.conversions);
    const conf = r.memo.confidence;
    const list = counts.length === 1 ? `${counts[0]}` : `${counts.slice(0, -1).join(", ")} and ${counts[counts.length - 1]}`;
    assert.ok(conf.reasons.includes(`The ${counts.length} scale candidates have ${list} purchases.`), "receivers' counts in the Why");
    for (const line of [...conf.reasons, ...conf.notes, ...d.limits.buyer, ...d.limits.client]) {
      assert.ok(!/(leading ad|top winner) has 8 /i.test(line), `no passed-over-leader volume caveat: ${line}`);
      assert.ok(!/8 recorded results?/.test(line), line);
    }
    assert.ok(!d.limits.buyer.some((l) => l.includes("noise floor this read requires")), "the receivers clear the noise floor");
    /* Confidence follow-up: the WEAKEST receiver sets the label — "high"
       needs every receiver at ≥30 (3× the 10-purchase floor). */
    const weakestCount = Math.min(...(counts as number[]));
    if (weakestCount < 30) {
      assert.equal(d.evidenceState, "limited");
      assert.equal(r.memo.confidence.level, "medium");
      assert.ok(conf.reasons.includes(`The weakest scale candidate has ${weakestCount} purchases. High confidence needs at least 30 on every ad receiving budget.`));
      assert.ok(d.limits.buyer.some((l) => l.startsWith(`The weakest scale candidate has ${weakestCount} purchases — under the 30`)));
    } else {
      assert.notEqual(r.memo.confidence.level, "medium");
    }
    assert.equal(d.action, "budget", "the bar caps the label, never the move");
  }

  /* No passed-over leader ⇒ T1 stays on the leader, no watch note. */
  {
    const e = run(readFileSync(join(ROOT, "scripts/fixtures/ecom-13ads.csv"), "utf8"), "roas").memo;
    assert.match(e.nextTests[0].test, /"Hero_UGC_A"/);
    assert.ok(!e.nextTests[0].why.includes("Watch:"));
  }

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

  /* ---- No receiver + the cut bar clears ⇒ Trim (losers named, no receiver) ---- */
  {
    const thin =
      "Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n" +
      ["Thin,200,6,2000", "A,400,20,800", "B,400,20,800", "C,400,20,760", "D,400,20,720", "E,400,8,200", "F,400,6,150"].join("\n") + "\n";
    const t = run(thin, "roas");
    const td = t.memo.decision;
    assert.equal(td.action, "budget");
    assert.equal(td.budgetVariant, "cut");
    // D (1.8x vs a 2.0x median) is within 15% — a near-median hold, not a trim.
    assert.equal(td.headline, 'Trim "F" and "E"; hold everything else steady.');
    assert.deepEqual(td.budgetMove?.from.map((x) => x.name), ["F", "E"], "the trimmed ads are named in the Pause list");
    assert.deepEqual(td.budgetMove?.to, []);
    assert.match(td.rationale, /No ad qualifies to receive budget — "Thin" leads by \d+% but has 6 purchases, under the receiver floor \(≥10 purchases and ≥ [\d.,]+ EUR spent \(the minimum spend\)\) — so the move is trimming the leak, not scaling\./);
    for (const s of clientStrings(t.memo))
      for (const w of CLIENT_BANNED) assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(s), `client "${w}": ${s}`);
  }
  /* ---- No receiver and no cut ⇒ Test with a one-line reason ---- */
  {
    const neither =
      "Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n" +
      ["Thin,200,6,2000", "A,400,20,800", "B,400,20,800", "C,400,20,780", "D,400,20,760", "E,400,18,700", "F,400,18,690"].join("\n") + "\n";
    const td = run(neither, "roas").memo.decision;
    assert.equal(td.action, "test", "neither bar clears ⇒ test");
    assert.match(td.headline, /No ad has enough evidence to receive budget yet\.$/);
    assert.match(td.rationale, /^No budget move: "Thin" leads by \d+% but has 6 purchases, and no ad past the 30% bar clears the receiver floor/);
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

  /* ---- Client confidence: "most ads had enough spend" only when true ---- */
  {
    const dated = (rows: string[]) =>
      "Ad name,Amount spent (EUR),Purchases,Purchases conversion value,Reporting starts,Reporting ends\n" +
      rows.map((r) => `${r},2026-06-01,2026-06-30`).join("\n") + "\n";
    const judged = ["R1,600,40,3000", "R2,600,36,2700", "R3,600,34,2520", "M1,400,15,1200", "M2,400,15,1200", "M3,400,15,1200", "M4,400,15,1200", "M5,400,15,1200", "L1,400,10,600", "L2,400,10,600", "L3,400,10,600", "L4,400,10,600"];
    const tiny = Array.from({ length: 13 }, (_, i) => `T${i},5,0,0`);
    const few = run(dated([...judged, ...tiny]), "roas").memo; // 12 of 25 judged
    assert.equal(few.confidence.level, "high");
    assert.equal(few.confidence.clientWhy, "Confidence is high because the ads getting more budget each have 30+ sales behind them and the gap to the rest is clear.");
    const most = run(dated(judged), "roas").memo; // 12 of 12 judged
    assert.equal(most.confidence.level, "high");
    assert.match(most.confidence.clientWhy, /^Confidence is high because most ads had enough spend/);
    assert.match(buildSampleMemo().confidence.clientWhy, /^Confidence is high because most ads had enough spend/, "sample: 11 of 14 judged");
  }

  /* ---- Real-account review: which default bars changed the call ----
     The print card shows only these (plus the user's own bars). */
  {
    const H = "Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n";
    const decisive = (m: { decision: { appliedCriteria: { label: string; decisive?: true; source: string }[] } }) =>
      m.decision.appliedCriteria.filter((c) => c.decisive).map((c) => c.label.split(":")[0]);
    assert.deepEqual(decisive(r.memo), ["Budget-move bar", "Receiver floor", "Cut bar"], "shift that passed over the leader");
    assert.deepEqual(decisive(buildSampleMemo()), ["Budget-move bar", "Cut bar"], "plain shift");
    const few = run(H + ["A,400,20,1600", "B,400,20,800", "C,30,1,40"].join("\n") + "\n", "roas").memo;
    assert.equal(few.decision.holdReason, "insufficient_data");
    assert.deepEqual(decisive(few), ["Minimum spend to judge", "Minimum sample"]);
    const flat = run(H + ["A,400,20,820", "B,400,20,800", "C,400,20,800", "D,400,20,790", "E,400,20,780", "F,400,20,800"].join("\n") + "\n", "roas").memo;
    assert.equal(flat.decision.holdReason, "flat_performance");
    assert.deepEqual(decisive(flat), ["Flat-field band"]);
    const neither = run(H + ["Thin,200,6,2000", "A,400,20,800", "B,400,20,800", "C,400,20,780", "D,400,20,760", "E,400,18,700", "F,400,18,690"].join("\n") + "\n", "roas").memo;
    assert.equal(neither.decision.action, "test");
    assert.deepEqual(decisive(neither), ["Receiver floor", "Cut bar"], "the floor withheld the move; the cut bar withheld the trim");
    const u = run(AGENCY, "roas", { minOutcomeCount: 35 }).memo;
    assert.ok(u.decision.appliedCriteria.every((c) => c.source !== "user" || c.decisive === undefined), "user bars print anyway — never flagged");
  }

  console.log("real-account receivers: all assertions passed");
} finally {
  cleanup();
}
