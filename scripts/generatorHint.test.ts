/**
 * Attribution & Intent 5 — the generator's collapsed "stricter read"
 * hint sits under the upload, before the optional previous-period
 * section, with the exact copy.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const gen = readFileSync(join(import.meta.dirname, "..", "components/debrief/GeneratorPanel.tsx"), "utf8");
const text = gen.replace(/\s+/g, " ");
assert.ok(
  text.includes(
    "For a stricter read, add Compare attribution settings (7-day click + 1-day view), 3-second video plays, ThruPlays and Outbound clicks to your export."
  ),
  "exact hint copy"
);
const iHint = gen.indexOf("Want a stricter read?");
const iDetails = gen.lastIndexOf("<details", iHint);
assert.ok(iDetails > 0 && iHint - iDetails < 400, "inside a <details> (collapsed by default — no open attribute)");
assert.ok(!/<details[^>]*\bopen\b/.test(gen.slice(iDetails, iHint)), "collapsed by default");
const iUpload = gen.indexOf("Drop your Ads Manager export");
const iPrev = gen.indexOf("Period Comparison V2 — optional previous-period export.");
assert.ok(iUpload > 0 && iHint > iUpload && iHint < iPrev, "under the upload, before the previous-period section");
console.log("generatorHint: all assertions passed");
