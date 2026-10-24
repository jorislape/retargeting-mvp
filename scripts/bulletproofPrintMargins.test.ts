/**
 * Bulletproof pass B8 — no browser header/footer in print.
 *
 * A zero page margin leaves the browser no room for its own header/footer
 * (URL, date, title, page number); the 12mm margin moves inside the
 * printed content and repeats per page via box-decoration-break: clone.
 * WebKit can't clone padding across pages, so it keeps the 12mm @page
 * margin — excluded explicitly, since the build widens the support test
 * to the -webkit- prefix WebKit does match. Verified by PDF export: no
 * header/footer text in Chromium with headers/footers enabled.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./testerFeedbackEngine.ts";

const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");
assert.match(css, /^@page \{[\s\S]*?margin: 12mm;\s*\}/m, "fallback margin (WebKit) stays 12mm");
const gate = css.indexOf("@supports (box-decoration-break: clone) and (not (font: -apple-system-body)) {");
assert.ok(gate > 0, "the zero-margin rule is gated on clone support, WebKit excluded");
assert.ok(gate > css.indexOf("@media print {"), "inside @media print");
const block = css.slice(gate, css.indexOf("\n  }\n", css.indexOf(".report-print-page", gate)) + 4);
assert.match(block, /@page \{\s*margin: 0;\s*\}/);
assert.match(block, /max-width: 204mm !important;/, "180mm + 2 × 12mm: same column as the 12mm-margin layout");
assert.match(block, /padding: 12mm 16mm !important;/, "12mm page margin + the 4mm gutter");
assert.match(block, /box-decoration-break: clone;/, "the margin repeats on every page");

console.log("bulletproof print margins: all assertions passed");
