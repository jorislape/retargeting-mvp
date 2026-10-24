/**
 * Bulletproof pass A5 — test rules. Every test states Hypothesis /
 * Variable / Success / Decision rule. Success needs all three: ≥7 days;
 * ≥10 purchases per variant OR spend ≥ 10× the account's cost per
 * purchase (shown in money); and a lift beyond the 15% flat band over the
 * control — never "beats the median". Decision rule: win → scale in
 * steps; lose → retire; inconclusive → extend once, then stop. No
 * "~gate of fresh spend" anywhere (Not yet, Reassess, tests, client).
 * T1 follows the ad's format; T2 rebuilds a loser only past 5× the cost
 * per purchase, else tests the strongest naming contrast (≥20 purchases
 * each side), else there is no T2.
 */
import assert from "node:assert/strict";
import { CLIENT_BANNED, clientStrings, loadEngine } from "./testerFeedbackEngine.ts";

const H = "Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n";
const csv = (rows: string[]) => H + rows.join("\n") + "\n";
const RULE = "Win → scale the winner in ≤20% budget steps every 2–3 days; lose → retire it; inconclusive → extend once (7 more days), then stop and keep the control.";

const { run, requireCompiled, cleanup } = loadEngine();
try {
  const { REBUILD_MIN_CPP_MULTIPLE, CONTRAST_MIN_OUTCOMES } = requireCompiled("modules/debrief/memo.js") as Record<string, number>;
  assert.equal(REBUILD_MIN_CPP_MULTIPLE, 5);
  assert.equal(CONTRAST_MIN_OUTCOMES, 20);

  /* ---- Success bars + decision rule on every test ---- */
  const r = run(csv(["Static_Hero,400,30,2400", "UGC_B,400,22,1200", "UGC_C,400,20,1000", "Video_D,400,20,950", "Video_E,400,18,800", "UGC_F,400,15,600", "Bad_G,400,8,240"]), "roas");
  const cpp = 2800 / (30 + 22 + 20 + 20 + 18 + 15 + 8);
  const SUCCESS = `Success needs all three: ≥7 days; ≥10 purchases per variant or ≥ €${(10 * cpp).toFixed(2)} spend each (10× the account's €${cpp.toFixed(2)} cost per purchase); and a lift of more than 15% over the control.`;
  for (const t of r.memo.nextTests) {
    if (t.test.startsWith("Raise the budget on the ad set running ")) continue;
    assert.equal(t.winningLooksLike, SUCCESS, t.test);
    assert.equal(t.brief.successMetric, SUCCESS);
    assert.equal(t.decisionRule, RULE);
    assert.equal(t.variable, t.brief.change, "the variable is the brief's one change");
    const claim = t.hypothesis.split(" — because")[0];
    assert.ok(!/beats? (the )?[\d.]+x|median/.test(claim), `no "beat the median" in: ${claim}`);
    assert.match(t.hypothesis, /by more than 15%/);
  }
  const json = JSON.stringify(r.memo);
  assert.ok(!/fresh spend|of new spend|reaches the minimum spend|reach the minimum spend/.test(json), "no gate-sized bars anywhere");
  assert.ok(r.buyerText.includes(`   Success: ${SUCCESS}`) && r.buyerText.includes(`   Decision rule: ${RULE}`) && r.buyerText.includes("   Variable: "));
  assert.ok(r.clientText.includes("   What happens next: If it wins, we add budget in small steps; if it loses, we retire it; if it's unclear, we run it one more week, then stop."));

  /* ---- T1 follows the format: a static has no "opening" ---- */
  assert.match(r.memo.nextTests[0].test, /"Static_Hero" — vary only the headline \/ first visual to test/);
  const video = run(csv(["Video_Hero,400,30,2400", "UGC_B,400,22,1200", "UGC_C,400,20,1000", "Video_D,400,20,950", "Video_E,400,18,800", "UGC_F,400,15,600", "Bad_G,400,8,240"]), "roas").memo;
  assert.match(video.nextTests[0].test, /vary only the opening to test/);

  /* ---- Not yet / Reassess use the bars ---- */
  assert.match(r.memo.decision.reassess.buyer, /^Reassess once the move has run ≥7 days with ≥10 purchases \(or ≥ €[\d.]+ spend\) on the changed ad sets\.$/);

  /* ---- T2: a loser spent past 5× the cost per purchase ⇒ rebuild ---- */
  assert.ok(400 >= 5 * cpp);
  assert.match(r.memo.nextTests[1].test, /"Bad_G"/, "rebuilt");

  /* ---- Under 5× ⇒ the strongest naming contrast (≥20 purchases each) ---- */
  const tokened = [
    ...[1, 2, 3, 4].map((i) => `[FOR]IMG_[AN]QUAL_[N]${i},400,6,1600`),
    ...[1, 2, 3, 4].map((i) => `[FOR]IMG_[AN]SALE_[N]${i},400,5,640`),
    ...[1, 2].map((i) => `[FOR]VID_[AN]EASE_[N]${i},400,2,1040`),
  ];
  const c = run(csv(tokened), "roas").memo;
  const cpp2 = 4000 / 48;
  assert.ok(400 < 5 * cpp2, "the weakest ad is under 5× the cost per purchase");
  const t2 = c.nextTests.find((t) => t.test.startsWith("Test the strongest naming contrast"));
  assert.ok(t2, "naming contrast replaces the rebuild");
  assert.equal(t2!.test, 'Test the strongest naming contrast — angle "QUAL" vs "SALE": matched ads that differ only in the angle.');
  assert.equal(t2!.variable, 'The angle only — "QUAL" vs "SALE".');
  assert.ok(!c.nextTests.some((t) => /^(Test one rebuilt|Rebuild|Reshoot)/.test(t.test)), "no rebuild of a thin loser");

  /* ---- Under 5× and no naming table ⇒ no T2 at all ---- */
  const plain = run(csv(tokened.map((x, i) => x.replace(/^[^,]+/, `Ad${i}`))), "roas").memo;
  assert.ok(!plain.nextTests.some((t) => /^(Test one rebuilt|Rebuild|Reshoot|Test the strongest naming)/.test(t.test)));

  /* ---- The scale test has its own success (budget is the variable) ---- */
  const scale = run(csv(["A,400,30,1600", "B,400,20,1200", "C,400,20,1220", "D,400,20,1180", "E,400,20,1150", "F,400,20,1100"]), "roas").memo;
  const st = scale.nextTests.find((t) => t.test.startsWith("Raise the budget on the ad set running "))!;
  assert.match(st.winningLooksLike, /^Success needs all three: ≥7 days at each new budget level; ≥10 purchases or ≥ €[\d.]+ spend \([^)]*\) at it; and ROAS within 15% of 4\.00x\.$/);
  assert.match(st.decisionRule!, /^Holds → take the next ≤20% step; drops more than 15% → step back/);

  /* ---- Client wording ---- */
  for (const memo of [r.memo, c, scale])
    for (const s of [...clientStrings(memo), ...memo.nextTests.flatMap((t) => [t.clientSuccess ?? "", t.clientDecisionRule ?? ""])])
      for (const w of CLIENT_BANNED) assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(s), `client "${w}": ${s}`);

  console.log("bulletproof test rules: all assertions passed");
} finally {
  cleanup();
}
