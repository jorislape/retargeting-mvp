/**
 * Bulletproof pass C6 — tidy client names. Untokened names lose file
 * extensions and trailing "- Copy" / "– Copy" / "Copy N" suffixes for
 * the client, only while every displayed name stays distinct; colliding
 * names keep the minimal distinguishing suffix. The buyer keeps raw
 * names.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildClientNames } from "../components/debrief/longNames.ts";
import { ROOT, loadEngine } from "./testerFeedbackEngine.ts";

const show = (names: string[]) => names.map((n) => buildClientNames(names).get(n));

/* ---- Pure ---- */
assert.deepEqual(show(["Hero.jpg", "Promo.png – Copy", "Angle2 - Copy 2", "Reel.mp4 - Copy - Copy"]), ["Hero", "Promo", "Angle2", "Reel"], "no collision ⇒ fully tidied");
assert.deepEqual(show(["X.jpg", "X.jpg – Copy"]), ["X", "X – Copy"], "the copy keeps its Copy suffix (extension still goes)");
assert.deepEqual(show(["D20_TOFU", "D20_TOFU - Copy"]), ["D20_TOFU", "D20_TOFU - Copy"]);
assert.deepEqual(show(["Y.jpg", "Y.png"]), ["Y.jpg", "Y.png"], "only the extension differs ⇒ the extension stays");
assert.deepEqual(show(["Ad Copy", "Report final"]), ["Ad Copy", "Report final"], "a name that merely ends in the word Copy is kept");
assert.equal(buildClientNames(["[FOR]UGC_[AN]QUAL_[SKU]00147_[DTE]250213.mp4 - Copy"]).get("[FOR]UGC_[AN]QUAL_[SKU]00147_[DTE]250213.mp4 - Copy"), "UGC · QUAL · SKU 00147 · 2025-02-13", "tokened ⇒ label");
{
  // A generated export with many twins: every distinct raw name stays distinct.
  const u: string[] = [];
  for (let i = 0; i < 60; i++) {
    const base = `V${i % 20}_Benefits_${i % 3 === 0 ? "Image" : "Video"}_${i % 7}`;
    u.push(base, `${base}.jpg`, `${base} - Copy`, `${base}.jpg – Copy`, `${base} - Copy 2`);
  }
  const m = buildClientNames(u);
  assert.equal(new Set(m.values()).size, new Set(u).size, "collision-safe");
}

/* ---- Engine + TXT ---- */
const { run, cleanup } = loadEngine();
try {
  const rows = [["Hero.jpg – Copy", 600, 40, 3000], ["Demo.mp4 - Copy", 600, 38, 2850], ["Story", 600, 36, 2700],
    ["Story - Copy", 400, 15, 1200], ["M2", 400, 15, 1200], ["M3", 400, 15, 1200], ["M4", 400, 15, 1200],
    ["L1.png", 400, 10, 600], ["L2", 400, 10, 600], ["L3", 400, 10, 600]];
  const r = run("Ad name,Amount spent (EUR),Purchases,Purchases conversion value\n" + rows.map((x) => x.join(",")).join("\n") + "\n", "roas");
  assert.ok(r.clientText.includes('"Hero"') && r.clientText.includes('"Demo"'), "client TXT: tidied");
  assert.ok(r.clientText.includes("- Story - Copy |"), "a twin keeps its Copy suffix (its original \"Story\" is in the export)");
  assert.ok(!/\.(?:jpg|png|mp4)\b/.test(r.clientText), "no file extension in client names");
  assert.ok(!r.clientText.includes("Hero.jpg") && r.clientText.includes("- Hero |"), "table rows tidied too");
  assert.ok(r.buyerText.includes('"Hero.jpg – Copy"'), "buyer TXT keeps raw names");

  const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  assert.match(report, /const tidy = buildClientNames\(universe\);/);
  assert.match(report, /labels\.get\(name\) \?\? \(tidy\.has\(name\) \? tidyShort\(tidy\.get\(name\)!, max\) : shortener\(name, max\)\)/);

  console.log("bulletproof client names: all assertions passed");
} finally {
  cleanup();
}
