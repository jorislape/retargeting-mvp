/**
 * Batch D6 — static format default. A tester saw "rebuild with a new
 * opening hook" on a static ad. The hook is worded in the ad's own
 * format: a static's "headline / first visual", a video's "opening", and
 * — when the name and columns don't show the format — the neutral "the
 * hook (opening seconds or headline/first visual)". Never a video
 * assumption, in the test, its hypothesis, or its brief.
 */
import assert from "node:assert/strict";
import { loadEngine } from "./testerFeedbackEngine.ts";

const H = "Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n";
/* Six winners, a big weak ad (≥ 5× cost per purchase ⇒ T2 rebuilds it). */
const rows = (weak: string) =>
  H + ["W1,600,30,2400", "W2,500,25,1500", "W3,400,15,900", "W4,300,10,500", "W5,300,8,400", `${weak},900,6,300`].join("\n") + "\n";

const { run, cleanup } = loadEngine();
try {
  const rebuild = (weak: string) => run(rows(weak), "roas").memo.nextTests.find((t) => t.test.startsWith(`Rebuild "${weak}"`))!;

  for (const name of ["Static_Offer", "Offer_banner.jpg", "[FOR]IMG_[AN]QUAL", "Carousel_Bundle"]) {
    const t = rebuild(name);
    assert.ok(t, `${name}: a rebuild test`);
    assert.equal(t.test, `Rebuild "${name}" with a new headline / first visual before writing the angle off.`, name);
    assert.ok(!/opening hook|opening 3 seconds|before any footage/.test(JSON.stringify(t)), `${name}: no video wording`);
    assert.equal(t.brief.change, "Only the headline / first visual.");
  }
  for (const name of ["Video_Demo", "UGC_Review", "Clip.mp4"]) {
    assert.equal(rebuild(name).test, `Rebuild "${name}" with a new opening hook before writing the angle off.`, name);
  }
  const unknown = rebuild("Spring_Offer_V2");
  assert.equal(unknown.test, 'Rebuild "Spring_Offer_V2" with a new hook (opening seconds or headline/first visual) before writing the angle off.');
  assert.match(unknown.hypothesis, /^If we change only the hook \(opening seconds or headline\/first visual\) while/);
  assert.ok(!unknown.brief.assetDirection.some((d) => /no logo or title card in the first 3 seconds/.test(d)), "unknown format: no video-only asset direction");
  assert.ok(unknown.brief.assetDirection.some((d) => /If it's video: .* If it's static:/.test(d)), "neutral direction covers both");

  console.log("batch D hook wording: all assertions passed");
} finally {
  cleanup();
}
