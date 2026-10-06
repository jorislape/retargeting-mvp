/**
 * Tester Feedback Fix 6 — Frequency is shown (display-only), plus the
 * tester fixture's end-to-end acceptance checks.
 *
 * Frequency and Reach are parsed like impressions/cpm: never fed to the
 * gate, median, ranking or action. Buyer rows show "Frequency N.N";
 * at or above FREQUENCY_FATIGUE_NOTE_AT (a rule of thumb) a buyer-only
 * "possible fatigue; check the trend in Ads Manager" note is added.
 * The client register shows neither.
 *
 * The second half pins the anonymised tester export
 * (scripts/fixtures/tester-cpa-8ads.csv) against everything the six
 * fixes promise for it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, TESTER_CSV, loadEngine } from "./testerFeedbackEngine.ts";

/** Drops the Frequency/Reach columns — the control for display-only. */
function withoutDelivery(csv: string): string {
  const rows = csv.trim().split("\n").map((l) => l.split(","));
  const drop = new Set(["Reach", "Frequency"].map((h) => rows[0].indexOf(h)));
  return rows.map((r) => r.filter((_, i) => !drop.has(i)).join(",")).join("\n") + "\n";
}

const { run, memoExports, cleanup } = loadEngine();
const FREQUENCY_FATIGUE_NOTE_AT = memoExports.FREQUENCY_FATIGUE_NOTE_AT;
try {
  const t = run(TESTER_CSV, "cpa");
  const m = t.memo;
  const rows = [...m.winners, ...(m.atMedian?.rows ?? []), ...m.losers.rows];

  /* ---- Fix 6: parsing, display, note ---- */
  assert.equal(t.columns.frequency, "Frequency");
  assert.equal(t.columns.reach, "Reach");
  assert.equal(t.ads.find((a) => a.name === "Ad_H")?.frequency, 5.13);
  assert.equal(t.ads.find((a) => a.name === "Ad_H")?.reach, 11986);
  assert.equal(FREQUENCY_FATIGUE_NOTE_AT, 4);
  for (const r of rows)
    assert.match(r.frequencyLabel ?? r.fatigueNote ?? "", /^Frequency \d+\.\d/, `${r.name} shows frequency`);
  const h = rows.find((r) => r.name === "Ad_H");
  // Follow-up: the fatigue note carries the number — no second plain line.
  assert.equal(h?.frequencyLabel, undefined, "no duplicate Frequency line on a fatigue row");
  assert.ok(rows.filter((r) => r !== h).every((r) => r.frequencyLabel && !r.fatigueNote), "below threshold: plain line only");
  assert.equal(h?.fatigueNote, "Frequency 5.1 — possible fatigue; check the trend in Ads Manager.");
  assert.deepEqual(rows.filter((r) => r.fatigueNote).map((r) => r.name), ["Ad_H"], "only ≥4 gets the note");
  assert.match(t.buyerText, /- Ad_H \| 18\.93 EUR \(at median\) \| 548\.99 EUR \| 29 purchases \| Metrics only — angle unknown\. Frequency 5\.1 — possible fatigue; check the trend in Ads Manager\./);
  assert.equal((t.buyerText.match(/Frequency 5\.1/g) ?? []).length, 1, "the number appears once");
  assert.match(t.buyerText, /- Ad_D \| 15\.74 EUR .* \| 53 purchases \| Frequency 3\.2 \|/);
  assert.ok(!/Frequency|fatigue/i.test(t.clientText), "client register shows neither");

  /* Display-only: removing the columns changes nothing but the labels. */
  const c = run(withoutDelivery(TESTER_CSV), "cpa");
  assert.equal(c.columns.frequency, null);
  assert.equal(c.analysis.spendGate, t.analysis.spendGate);
  assert.equal(c.analysis.median, t.analysis.median);
  assert.deepEqual(c.analysis.rankedAds.map((a) => [a.name, a.deltaFromMedian]), t.analysis.rankedAds.map((a) => [a.name, a.deltaFromMedian]));
  assert.deepEqual(c.memo.decision, t.memo.decision, "decision identical with or without Frequency");
  assert.ok([...c.memo.winners, ...c.memo.losers.rows].every((r) => r.frequencyLabel === undefined && r.fatigueNote === undefined));

  /* A "Cost per 1,000 … reached" header is not Reach. */
  const costReach = 'Ad name,Amount spent (EUR),Purchases,"Cost per 1,000 Accounts Center accounts reached (EUR)"\nA,100,5,3\n';
  assert.equal(run(costReach, "cpa").columns.reach, null);
  // …while Meta's newer name for Reach itself still resolves.
  const newName = "Ad name,Amount spent (EUR),Purchases,Accounts Center accounts reached\nA,100,5,900\n";
  assert.equal(run(newName, "cpa").columns.reach, "Accounts Center accounts reached");

  /* Source scans: never read by gate/median/ranking/decision. */
  for (const f of ["analysis.ts", "decision.ts"]) {
    const src = readFileSync(join(ROOT, "modules/debrief", f), "utf8");
    assert.ok(!/frequency|\.reach\b/i.test(src), `${f} must not read frequency/reach`);
  }
  const memoSrc = readFileSync(join(ROOT, "modules/debrief/memo.ts"), "utf8");
  assert.match(memoSrc, /rule of thumb[\s\S]{0,300}export const FREQUENCY_FATIGUE_NOTE_AT = 4;/, "named constant, documented as a rule of thumb");
  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  assert.match(report, /view !== "client" && ad\.frequencyLabel/);
  assert.match(report, /!client && ad\.fatigueNote/);

  /* ---- Tester fixture: end-to-end acceptance ---- */
  assert.ok(Math.abs(t.analysis.spendGate - 164.03) < 0.01, `gate ≈ 164.03 (got ${t.analysis.spendGate})`);
  assert.equal(t.analysis.adsJudged, 5);
  assert.ok(Math.abs((t.analysis.median ?? 0) - 18.93) < 0.01, `median ≈ 18.93 (got ${t.analysis.median})`);
  assert.equal(m.atMedian?.rows[0].name, "Ad_H", "the 548.99 ad is shown at the benchmark");
  assert.equal(m.atMedian?.rows[0].spendLabel, "548.99 EUR");
  assert.match(t.buyerText, /At the median — this ad is the benchmark:/);
  for (const txt of [t.buyerText, t.clientText])
    for (const re of [/ceiling before fatigue/i, /hook problem/i, /or just the hook/i, /keep the angle, change the hook/i])
      assert.ok(!re.test(txt), `no hook-causal wording: ${re}`);
  assert.ok(m.decision.limits.buyer.some((l) => l.startsWith("No target CPA set — ads are ranked against this account's median CPA")));
  assert.ok(m.decision.limits.client.some((l) => l.startsWith("No cost target was set")));
  assert.match(t.buyerText, /164\.03 EUR per ad \(half this export's average spend per ad\)/);

  console.log("tester frequency + fixture acceptance: all assertions passed");
} finally {
  cleanup();
}
