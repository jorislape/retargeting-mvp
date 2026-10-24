/**
 * Real-account fix 7 — copy that a real agency account showed to be
 * wrong or leftover:
 *  - no "kill list" / "below-benchmark" / "Kill or shrink" wording;
 *  - "Do not move budget into <format> ads" only when no ad of that
 *    format sits in the top half of the judged ranking;
 *  - static/image ads: "headline / first visual", not "opening 3 seconds"
 *    ([FOR]IMG / [FOR]VID tokens are read as static / video);
 *  - the T3 challenger is a format present in the winners or clearly
 *    missing — never a stock "founder/expert explainer video", and never
 *    the control's own family (static ↔ UGC / video);
 *  - report title: product, else the export's account name, else the
 *    file name — "Your account" only when none exists;
 *  - the scale-discipline avoid line names the actual receivers.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadEngine } from "./testerFeedbackEngine.ts";

const AGENCY = readFileSync(join(ROOT, "scripts/fixtures/agency-naming-convention.csv"), "utf8");
const ECOM = readFileSync(join(ROOT, "scripts/fixtures/ecom-13ads.csv"), "utf8");
const LEFTOVER = /kill list|below-benchmark|kill or shrink|below the benchmark/i;

const { run, buildSampleMemo, memoToText, cleanup } = loadEngine();
try {
  /* ---- No leftover kill-list wording, anywhere ---- */
  const sample = buildSampleMemo();
  for (const [label, memo] of [
    ["agency", run(AGENCY, "roas").memo],
    ["ecom", run(ECOM, "roas").memo],
    ["sample", sample],
  ] as const) {
    assert.ok(!LEFTOVER.test(JSON.stringify(memo)), `${label}: memo`);
    for (const view of ["buyer", "client"]) assert.ok(!LEFTOVER.test(memoToText(memo, view, 5, [])), `${label}: ${view} TXT`);
  }
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  assert.ok(!/kill list|Kill \/ reduce/i.test(report.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")), "no kill-list labels in the report UI");

  /* ---- Format avoid line: only when the format never reaches the top half ---- */
  const r = run(AGENCY, "roas");
  assert.ok(r.analysis.rankedAds.some((a) => a.nameTags.includes("static")), "[FOR]IMG reads as static");
  assert.ok(r.analysis.rankedAds.some((a) => a.nameTags.includes("video")), "[FOR]VID reads as video");
  assert.ok(!r.memo.avoid.buyer.some((l) => l.startsWith("Do not move budget into")), "static leads the agency fixture — no format warning");
  {
    const csv =
      "Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n" +
      ["UGC_A,400,30,2400", "UGC_B,400,28,2100", "UGC_C,400,25,1700", "Mid_D,400,20,1000", "Static_E,400,10,400", "Static_F,400,9,300", "Static_G,400,8,250"].join("\n") + "\n";
    const s = run(csv, "roas").memo;
    assert.ok(s.avoid.buyer.some((l) => l.startsWith("Do not move budget into static ads while they hold 3/3 loser slots")), "static never in the top half ⇒ warned");
  }

  /* ---- Static/image openings (format of the ad T1 builds on) ---- */
  {
    const csv =
      "Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n" +
      ["Static_Hero,400,30,2400", "UGC_B,400,22,1200", "UGC_C,400,20,1000", "Video_D,400,20,950", "Video_E,400,18,800", "UGC_F,400,15,600"].join("\n") + "\n";
    const t1 = run(csv, "roas").memo.nextTests[0];
    assert.match(t1.test, /"Static_Hero"/);
    assert.match(t1.setup, /Change only the headline \/ first visual between variants\./);
    assert.equal(t1.brief.change, "Only the headline / first visual — nothing else.");
    assert.ok(!/opening 3 seconds/.test(t1.setup + t1.brief.change));
  }
  {
    // The agency fixture's T1 builds on its primary receiver, a UGC ad
    // (the static leader is passed over) — video wording there.
    const t1 = r.memo.nextTests[0];
    assert.ok(r.analysis.winners[0].nameTags.includes("static"), "fixture: a static ad leads the ranking…");
    assert.match(t1.setup, /opening 3 seconds \/ first frame/, "…but T1's UGC receiver gets the video wording");
  }

  /* ---- T3 challenger grounded in the account ---- */
  for (const m of [r.memo, run(ECOM, "roas").memo, sample])
    assert.ok(!JSON.stringify(m.nextTests).includes("founder/expert explainer video"));
  /* Real-account review: the control is the ad T1 builds on (here a
     UGC receiver), and the challenger never shares its format family —
     static vs UGC / video. */
  const t3 = r.memo.nextTests[2];
  const t1Base = r.memo.decision.budgetMove!.to[0].name;
  assert.equal(t3.test, `Test a static-image version of the control's message against "${t1Base}" (UGC) as the control.`);
  assert.ok(t3.signals.some((x) => /^Challenger: Static already places among your winners \(\d+\/\d+\)\.$/.test(x)));
  {
    // Every winner is UGC/video and nothing judged is static ⇒ the missing format.
    const csv =
      "Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n" +
      ["UGC_A,400,22,1000", "UGC_B,400,21,960", "Video_C,400,20,800", "Video_D,400,20,800", "Video_E,400,19,760", "Carousel_F,400,18,720"].join("\n") + "\n";
    const m = run(csv, "roas").memo;
    const challenger = m.nextTests.find((t) => t.test.includes("version of the control's message"));
    assert.ok(challenger, "a grounded challenger is proposed");
    assert.match(challenger!.test, /static-image version/);
    assert.ok(challenger!.signals.includes("Challenger: the account has no Static ads among the judged ones yet."));
  }
  /* ---- Never the control's format family ---- */
  {
    const H = "Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n";
    const cases: [string, string[], RegExp][] = [
      // Static control; static ads also crowd the winners ⇒ still UGC/video.
      ["static control", ["Static_A,400,30,2400", "Static_B,400,22,1300", "Static_C,400,21,1250", "Video_D,400,20,1000", "Static_E,400,18,800", "Static_F,400,15,500", "Static_G,400,14,450"], /^Test a (video|creator-shot UGC) version of the control's message against "Static_A" \(Static\) as the control\.$/],
      // Video control with UGC winners ⇒ static, not UGC.
      ["video control", ["Video_A,400,30,2400", "UGC_B,400,22,1300", "UGC_C,400,21,1250", "Static_D,400,20,1000", "UGC_E,400,18,800", "UGC_F,400,15,500", "UGC_G,400,14,450"], /^Test a static-image version of the control's message against "Video_A" \(Video\) as the control\.$/],
      // UGC control, no static ad anywhere ⇒ static by default.
      ["ugc control", ["UGC_A,400,30,2400", "UGC_B,400,22,1300", "Video_C,400,21,1250", "UGC_D,400,20,1000", "Video_E,400,18,800", "UGC_F,400,15,500", "UGC_G,400,14,450"], /^Test a static-image version of the control's message against "UGC_A" \(UGC\) as the control\.$/],
    ];
    for (const [label, rows, want] of cases) {
      const tests = run(H + rows.join("\n") + "\n", "roas").memo.nextTests;
      const challenger = tests.find((t) => t.test.includes("version of the control's message"));
      assert.ok(challenger, `${label}: a challenger`);
      assert.match(challenger!.test, want, label);
    }
  }

  /* ---- Report title ---- */
  assert.equal(run(AGENCY, "roas", { sourceName: "Hanzo Ads Apr 2025" }).memo.scope.product, "Hanzo Ads Apr 2025", "file name");
  const withAccount = AGENCY.replace(/^([^\n]*)\n/, "$1,Account name\n").replace(/\n(?=.)/g, "\n").split("\n")
    .map((l, i) => (i === 0 || l === "" ? l : `${l},Studio Account LT`)).join("\n");
  assert.equal(run(withAccount, "roas", { sourceName: "export" }).memo.scope.product, "Studio Account LT", "account name beats the file name");
  assert.equal(run(withAccount, "roas", { sourceName: "export", product: "Serum" }).memo.scope.product, "Serum", "the user's product beats both");
  assert.equal(run(AGENCY, "roas").memo.scope.product, "Your account", "last resort only");
  assert.equal(sample.scope.product, "Lumen Skincare — Vitamin C Serum", "sample title unchanged");
  const route = readFileSync(join(ROOT, "app/api/debrief/route.ts"), "utf8");
  assert.match(route, /const base = file\.name\.replace\(\/\\\.\[A-Za-z0-9\]\{1,5\}\$\/, ""\)/, "route strips the extension");

  /* ---- The avoid line counts the scale candidates (B4: named in full
     once, in the Next move lists) ---- */
  const to = r.memo.decision.budgetMove!.to.map((t) => `"${t.name}"`);
  assert.ok(to.length > 1);
  assert.ok(r.memo.avoid.buyer.some((l) => l.startsWith(`Do not scale anything except the ${to.length} scale candidates yet`) && to.every((t) => !l.includes(t))));
  assert.ok(sample.avoid.buyer.some((l) => l.startsWith("Do not scale anything except the 3 scale candidates yet")));

  console.log("real-account copy: all assertions passed");
} finally {
  cleanup();
}
