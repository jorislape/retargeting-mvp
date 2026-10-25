/**
 * Bulletproof pass C5 — client jargon.
 *
 * The client never reads an attribution window beside an ad, "below
 * average" (it's "below the middle ad"), "control", or a buyer-shorthand
 * test title: the naming-contrast test reads "Test which message angle
 * works better, using the two angles with the biggest gap (codes X vs Y
 * from the ad names)" and the format challenger "Test a creator-filmed
 * version of the leading ad's message against the original".
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadEngine } from "./testerFeedbackEngine.ts";

const AGENCY = readFileSync(join(ROOT, "scripts/fixtures/agency-naming-convention.csv"), "utf8");
const { run, buildSampleMemo, memoToText, requireCompiled, cleanup } = loadEngine();
try {
  const { clientizeText } = requireCompiled("components/debrief/memoToText.js") as { clientizeText: (s: string) => string };
  assert.equal(clientizeText("136% better than the TOFU median"), "136% better than the middle ad in its audience group");
  assert.equal(clientizeText("Launch the challenger alongside the control at matched budget."), "Launch the challenger alongside the original at matched budget.");
  assert.equal(clientizeText("a structured challenger against it as the control builds"), "a structured challenger against it builds");
  assert.equal(clientizeText("one controlled format-vs-format test"), "one side-by-side format-vs-format test");

  const fixture = run(AGENCY, "roas").memo;
  const sample = buildSampleMemo();
  /* A video receiver on a different window: the buyer sees the window, the client never does. */
  const W = "7-day click, 1-day view or 1-day engaged view";
  const N = "7-day click or 1-day view";
  const video = run(
    "Ad name,Amount spent (EUR),Purchases,Purchases conversion value,Attribution setting\n" +
      [["A_UGC", 600, 40, 3000, W], ["B_UGC", 600, 38, 2850, W], ["C_UGC", 600, 36, 2700, W],
       ...["M1", "M2", "M3", "M4", "M5"].map((n) => [`${n}_UGC`, 400, 15, 1200, N]),
       ...["L1", "L2", "L3"].map((n) => [`${n}_UGC`, 400, 10, 600, N])]
        .map(([n, s, p, v, w]) => `${n},${s},${p},${v},"${w}"`).join("\n") + "\n",
    "roas"
  ).memo;
  assert.ok(memoToText(video, "buyer", 5, []).includes("(€600.00 · 7d click + 1d view + 1d engaged view)"), "buyer keeps the window");

  /* Agency-coded angles with a clear gap and a weak ad too cheap to
     rebuild ⇒ T2 is the naming contrast, T3 a UGC challenger. */
  const coded = run(
    "Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n" +
      [
        ...[1, 2, 3, 4, 5].map((i) => `[FOR]IMG_[AN]QUAL_[FN]0${i},400,6,${1800 - i * 50}`),
        ...[6, 7, 8, 9].map((i) => `[FOR]IMG_[AN]EASE_[FN]0${i},400,5,${900 - i * 20}`),
        "[FOR]IMG_[AN]EASE_[FN]10,400,5,700",
        "[FOR]IMG_[AN]EASE_[FN]11,300,4,150",
      ].join("\n") + "\n",
    "roas"
  ).memo;

  for (const [label, m] of [["fixture", fixture], ["sample", sample], ["video receivers", video], ["coded angles", coded]] as const) {
    const text = memoToText(m, "client", 3, []);
    assert.ok(!/\bcontrol/i.test(text), `${label}: no "control" in the client: ${text.match(/.{0,60}\bcontrol.{0,40}/i)?.[0]}`);
    assert.ok(!/\b(?:below|above) average\b/i.test(text), `${label}: "the middle ad", never "average": ${text.match(/.{0,60}(?:below|above) average.{0,20}/i)?.[0]}`);
    assert.ok(!/\b(?:TOFU|MOFU|BOFU) the middle ad\b/.test(text), `${label}: no garbled stage median`);
    assert.ok(!/· \d+d click|engaged view\)/.test(text), `${label}: no attribution window beside an ad`);
    for (const t of m.nextTests) {
      const title = t.clientTest ?? clientizeText(t.test);
      assert.ok(!/\bcontrol/i.test(title), `${label}: client test title "${title}"`);
    }
  }

  /* The two plain titles, exactly. */
  const contrast = coded.nextTests.find((t) => t.test.startsWith("Test the strongest naming contrast — angle "));
  assert.ok(contrast, "a naming-contrast test on the angle key");
  const [, best, worst] = contrast!.test.match(/angle "([^"]+)" vs "([^"]+)"/)!;
  assert.equal(contrast!.clientTest, `Test which message angle works better, using the two angles with the biggest gap (codes ${best} vs ${worst} from the ad names)`);
  const challenger = [coded, fixture, sample, video].flatMap((m) => m.nextTests).find((t) => /^Test a creator-shot UGC version of the control's message against "/.test(t.test));
  assert.ok(challenger, "a UGC challenger built on the leading ad");
  assert.equal(challenger!.clientTest, "Test a creator-filmed version of the leading ad's message against the original");

  /* Report wiring. */
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  assert.match(report, /\{a\.window && !client \? ` · \$\{a\.window\}` : ""\}/);
  assert.match(report, /<Names text=\{test\.clientTest \?\? clientizeText\(test\.test\)\} \/>/);
  assert.match(report, /\{client \? "Next test" : "Next controlled test"\}/);

  console.log("bulletproof client jargon: all assertions passed");
} finally {
  cleanup();
}
