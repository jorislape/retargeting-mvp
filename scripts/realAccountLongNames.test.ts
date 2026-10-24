/**
 * Real-account fix 5 — long ad names on screen.
 *
 * Agency naming conventions produce 120–200-char names with no break
 * points; they swamped the Next move headline and pushed cards past the
 * viewport. Proves: middleTruncate keeps start + end at exactly 60
 * chars; splitLongNames round-trips and touches only long quoted names;
 * the report wires the truncation into the headline, budget lists, test
 * titles and client cards with the full name in a tooltip; the report
 * article wraps anywhere (no `break-words`, which doesn't shrink
 * min-content); Copy/TXT keep full names. Browser overflow at
 * 375–1920px was checked manually (TESTING.md) — not runnable here.
 * Quotes are read in pairs, so text between two names is never cut.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NAME_DISPLAY_MAX, middleTruncate, splitLongNames } from "../components/debrief/longNames.ts";
import { ROOT, loadEngine } from "./testerFeedbackEngine.ts";

const LONG =
  "[VAR]ORG_[SKU]00229_[FOR]IMG_[AN]QUAL_[STG]TOFU_[HK]01_[PR]AGL_[CN]SEASONAL_OFFER_FLATLAY_WITH_PRICE_[FN]05_[PLT]FB_[DTE]250402_[AUD]BROAD";

/* ---- middleTruncate ---- */
assert.equal(middleTruncate("Short_name"), "Short_name");
assert.equal(middleTruncate("x".repeat(60)), "x".repeat(60), "exactly 60 stays whole");
const t = middleTruncate(LONG);
assert.equal(t.length, NAME_DISPLAY_MAX);
assert.ok(t.startsWith("[VAR]ORG_[SKU]00229_[FOR]IMG_"), "keeps the start");
assert.ok(t.endsWith("[AUD]BROAD"), "keeps the end");
assert.equal((t.match(/…/g) ?? []).length, 1);

/* ---- splitLongNames ---- */
const sentence = `Shift budget in steps from "${LONG}" and "Short_ad" into "${LONG}".`;
const parts = splitLongNames(sentence);
assert.equal(parts.filter((p) => "name" in p).length, 2, "only the long names");
assert.equal(
  parts.map((p) => ("name" in p ? `"${p.name}"` : p.text)).join(""),
  sentence,
  "round-trips exactly"
);
assert.deepEqual(splitLongNames("No names here."), [{ text: "No names here." }]);

/* Regression (real CSV, "What we know"): a SHORT name before a long one
   once made the scan pair the short name's closing quote with the long
   name's opening quote, truncating the sentence between them. Quotes
   are read in pairs: only names are ever truncated. */
const rationale = `"Short_ad" is 132% better than the median ROAS on €481.44 with 31 purchases; "${LONG}" is 86% better than the median ROAS on €474.14 with 27 purchases.`;
const rp = splitLongNames(rationale);
assert.deepEqual(rp.filter((p) => "name" in p).map((p) => ("name" in p ? p.name : "")), [LONG], "only the long name is a name");
assert.ok(rp.some((p) => "text" in p && p.text.includes("is 132% better than the median ROAS on €481.44 with 31 purchases; ")), "sentence intact");
assert.equal(rp.map((p) => ("name" in p ? `"${p.name}"` : p.text)).join(""), rationale);
const odd = `Unpaired "quote ${LONG}`;
assert.deepEqual(splitLongNames(odd), [{ text: odd }], "an unpaired quote is plain text");

/* ---- Report wiring (source scan) ---- */
const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
assert.match(report, /<Names text=\{client \? d\.clientHeadline : d\.headline\} \/>/, "Next move headline");
assert.match(report, /&ldquo;<AdName name=\{a\.name\} \/>&rdquo;/, "Pause / Receives lists");
assert.match(report, /<Names text=\{c\(test\.test\)\} \/>/, "buyer test titles");
assert.match(report, /<Names text=\{clientizeText\(test\.test\)\} \/>/, "client test cards");
assert.match(report, /<span key=\{i\} title=\{part\.name\}>/, "full name in a tooltip");
assert.match(report, /<article className="\[overflow-wrap:anywhere\]">/, "report text wraps anywhere");
assert.ok(!/\bbreak-words\b/.test(report), "no break-words left: it doesn't shrink min-content");
assert.ok(!/className="truncate /.test(report), "no end-truncation of names via CSS");

/* ---- Copy / TXT keep full names ---- */
const { run, cleanup } = loadEngine();
try {
  const r = run(readFileSync(join(ROOT, "scripts/fixtures/agency-naming-convention.csv"), "utf8"), "roas");
  const longNames = r.ads.map((a) => a.name).filter((n) => n.length > NAME_DISPLAY_MAX);
  assert.ok(longNames.length > 10, "fixture: long agency names");
  assert.ok(!r.buyerText.includes("…") && !r.clientText.includes("…"), "TXT never truncates");
  assert.ok(longNames.some((n) => r.buyerText.includes(n)), "full names in buyer TXT");
  console.log("real-account long names: all assertions passed");
} finally {
  cleanup();
}
