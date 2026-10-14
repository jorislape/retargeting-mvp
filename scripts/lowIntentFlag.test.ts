/**
 * Attribution & Intent 4 — Low Intent flag (display-only).
 *
 * hook rate = 3s plays ÷ impressions; outbound CTR = outbound clicks ÷
 * impressions; hold rate = ThruPlays ÷ 3s plays. A judged ad in the TOP
 * quartile of hook rate AND the BOTTOM quartile of outbound CTR or hold
 * rate (nearest-rank, judged ads only) gets "Stops the scroll but
 * doesn't drive clicks — high engagement, low purchase intent." Needs
 * ≥ MIN_ADS_FOR_INTENT (8) judged ads with the columns, else skipped
 * silently. Never changes the action; outbound clicks leave the
 * unused-columns list.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_BANNED, ROOT, loadEngine } from "./testerFeedbackEngine.ts";

const SPLIT = readFileSync(join(ROOT, "scripts/fixtures/attribution-split.csv"), "utf8");
const dropCols = (csv: string, re: RegExp) => {
  const rows = csv.trim().split("\n").map((l) => l.split(","));
  const keep = rows[0].map((h, i) => (re.test(h) ? -1 : i)).filter((i) => i >= 0);
  return rows.map((r) => keep.map((i) => r[i]).join(",")).join("\n") + "\n";
};
type Ad = { name: string; impressions: number | null; videoPlays3s: number | null; thruPlays: number | null; outboundClicks: number | null };

const { run, requireCompiled, cleanup } = loadEngine();
try {
  const { detectLowIntent, MIN_ADS_FOR_INTENT } = requireCompiled("modules/debrief/intentFlags.js") as {
    detectLowIntent: (ads: Ad[]) => string[] | null;
    MIN_ADS_FOR_INTENT: number;
  };
  assert.equal(MIN_ADS_FOR_INTENT, 8);
  const mk = (name: string, hook: number, ctr: number, hold: number): Ad => ({
    name, impressions: 10000, videoPlays3s: hook * 10000, thruPlays: hold * hook * 10000, outboundClicks: ctr * 10000,
  });
  /* 8 ads. Hooks sorted .10….45 → top quartile (nearest-rank) = ≥ q75. */
  const base = [
    mk("H1", 0.10, 0.012, 0.30), mk("H2", 0.12, 0.011, 0.31), mk("H3", 0.15, 0.010, 0.32), mk("H4", 0.18, 0.013, 0.30),
    mk("H5", 0.20, 0.012, 0.33), mk("H6", 0.25, 0.014, 0.31),
    mk("TopLowCtr", 0.40, 0.002, 0.30), // top hook, bottom CTR → flagged
    mk("TopLowHold", 0.45, 0.012, 0.05), // top hook, bottom hold → flagged
  ];
  assert.deepEqual(detectLowIntent(base)?.sort(), ["TopLowCtr", "TopLowHold"]);
  // Top hook with healthy CTR and hold → not flagged.
  const healthy = base.map((a) => (a.name === "TopLowCtr" ? mk("TopHealthy", 0.40, 0.015, 0.34) : a));
  assert.deepEqual(detectLowIntent(healthy), ["TopLowHold"]);
  // Bottom CTR but an ordinary hook → not flagged.
  const lowCtrOrdinaryHook = base.map((a) => (a.name === "H3" ? mk("H3", 0.15, 0.001, 0.32) : a));
  assert.ok(!detectLowIntent(lowCtrOrdinaryHook)?.includes("H3"));
  // Fewer than 8 ads with the columns → skipped silently (null).
  assert.equal(detectLowIntent(base.slice(0, 7)), null);
  // No outbound clicks AND no ThruPlays → nothing to compare → null.
  assert.equal(detectLowIntent(base.map((a) => ({ ...a, outboundClicks: null, thruPlays: null }))), null);
  // Only one of the two intent metrics is enough.
  assert.deepEqual(detectLowIntent(base.map((a) => ({ ...a, thruPlays: null }))), ["TopLowCtr"]);

  /* ---- Through the engine (fixture: 10 judged ads) ---- */
  const r = run(SPLIT, "roas");
  assert.deepEqual(r.analysis.lowIntent, ["Meme_G"]);
  const rows = [...r.memo.winners, ...(r.memo.atMedian?.rows ?? []), ...r.memo.losers.rows];
  const meme = rows.find((x) => x.name === "Meme_G");
  assert.equal(meme?.lowIntentNote?.buyer, "Stops the scroll but doesn't drive clicks — high engagement, low purchase intent.");
  assert.ok(meme?.lowIntentNote?.client && !CLIENT_BANNED.some((w) => new RegExp(`\\b${w}\\b`, "i").test(meme.lowIntentNote!.client)));
  assert.equal(rows.filter((x) => x.lowIntentNote).length, 1);
  assert.match(r.buyerText, /Meme_G \|.*Stops the scroll but doesn't drive clicks — high engagement, low purchase intent\./);
  assert.match(r.clientText, /Meme_G \|.*Grabs attention, but few viewers go on to click through/);

  /* Display-only: without the intent columns, the decision is identical. */
  const plain = run(dropCols(SPLIT, /3-second|ThruPlays|Outbound/), "roas");
  assert.equal(plain.analysis.lowIntent, undefined);
  assert.equal(JSON.stringify(plain.memo.decision), JSON.stringify(r.memo.decision));
  /* Fewer than 8 judged ads → skipped silently. */
  const seven = SPLIT.trim().split("\n").slice(0, 8).join("\n") + "\n";
  assert.equal(run(seven, "roas").analysis.lowIntent, undefined);

  /* Outbound clicks (and the other intent columns) leave the unused list. */
  const cols = requireCompiled("modules/debrief/columns.js") as {
    resolveColumns: (h: string[]) => unknown;
    unusedColumns: (h: string[], c: unknown) => { headers: string[] };
  };
  const headers = SPLIT.split("\n")[0].split(",");
  const unused = cols.unusedColumns(headers, cols.resolveColumns(headers)).headers;
  for (const h of ["Outbound clicks", "3-second video plays", "ThruPlays"]) assert.ok(!unused.includes(h), h);
  assert.deepEqual(unused, [], "every fixture column is read");

  /* Isolation: the decision never reads it. */
  assert.ok(!/lowIntent/.test(readFileSync(join(ROOT, "modules/debrief/decision.ts"), "utf8")));
  assert.ok(!/from "\.\/(decision|memo|analysis)/.test(readFileSync(join(ROOT, "modules/debrief/intentFlags.ts"), "utf8")));

  console.log("lowIntentFlag: all assertions passed");
} finally {
  cleanup();
}
