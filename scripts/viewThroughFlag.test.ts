/**
 * Attribution & Intent 3 — View-Through Dependency flag (display-only).
 *
 * When both a click-only and a view-through column exist, each judged
 * ad's viewShare = view ÷ (click + view); above VIEW_THROUGH_FLAG_SHARE
 * (0.25, strictly greater) the row gets a buyer note ("N% of
 * conversions are view-through — likely passive credit
 * (retargeting/branded demand).") and a plain client note. Never changes
 * the action, ranking, or any number.
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

const { run, memoExports, cleanup } = loadEngine();
try {
  assert.equal(memoExports.VIEW_THROUGH_FLAG_SHARE, 0.25);
  const r = run(SPLIT, "roas");
  const rows = [...r.memo.winners, ...(r.memo.atMedian?.rows ?? []), ...r.memo.losers.rows];
  const note = (n: string) => rows.find((x) => x.name === n)?.viewThroughNote;
  assert.equal(note("Static_Retarget")?.buyer, "83% of conversions are view-through — likely passive credit (retargeting/branded demand).");
  assert.equal(note("Static_Retarget")?.client, "83% of this ad's purchases came from people who saw it without clicking — some of that credit may be for purchases that would have happened anyway.");
  assert.ok(note("Static_F")?.buyer.startsWith("50% "));
  assert.ok(note("Review_D")?.buyer.startsWith("29% "), "5 ÷ 17 = 29.4% > 25%");
  assert.equal(note("Boundary_I"), undefined, "exactly 25% (3 ÷ 12) is NOT flagged");
  assert.equal(note("UGC_A"), undefined, "13%");
  for (const s of rows.flatMap((x) => (x.viewThroughNote ? [x.viewThroughNote.client] : [])))
    for (const w of CLIENT_BANNED) assert.ok(!new RegExp(`\\b${w}\\b`, "i").test(s), s);
  assert.match(r.buyerText, /Static_Retarget \|.* 83% of conversions are view-through — likely passive credit/);
  assert.match(r.clientText, /Static_Retarget \|.* 83% of this ad's purchases came from people who saw it without clicking/);

  /* Boundary just above 25%: 100 ÷ 399 = 25.06% ⇒ flagged. */
  const edge = "Ad name,Amount spent (USD),Purchases,Purchases (7-day click),Purchases (1-day view)\n" +
    ["Over,300,399,299,100", "Exact,300,400,300,100", "B,300,200,200,0", "C,300,150,150,0", "D,300,180,180,0", "E,300,170,170,0"].join("\n") + "\n";
  const e = run(edge, "cpa");
  const all = [...e.memo.winners, ...(e.memo.atMedian?.rows ?? []), ...e.memo.losers.rows];
  assert.ok(all.find((x) => x.name === "Over")?.viewThroughNote, "25.06% flagged");
  assert.equal(all.find((x) => x.name === "Exact")?.viewThroughNote, undefined, "25.00% not flagged");

  /* Display-only: removing the view columns changes no decision/number. */
  const noView = run(dropCols(SPLIT, /\(1-day view\)/), "roas");
  assert.equal(JSON.stringify(noView.memo.decision), JSON.stringify(r.memo.decision), "decision identical");
  assert.deepEqual(noView.analysis.rankedAds.map((x) => [x.name, x.kpiValue]), r.analysis.rankedAds.map((x) => [x.name, x.kpiValue]));
  assert.ok([...noView.memo.winners, ...noView.memo.losers.rows].every((x) => x.viewThroughNote === undefined), "no view column ⇒ no flag");

  /* Source scan: the decision never reads it. */
  assert.ok(!/viewThrough/.test(readFileSync(join(ROOT, "modules/debrief/decision.ts"), "utf8")));
  assert.ok(!/viewThrough/.test(readFileSync(join(ROOT, "modules/debrief/analysis.ts"), "utf8")));

  console.log("viewThroughFlag: all assertions passed");
} finally {
  cleanup();
}
