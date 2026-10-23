/**
 * Real-account fix 6 — the PDF of a real agency account ran to 25 pages
 * (buyer) / 15 (client): every collapsed row printed, every test printed
 * its full reasoning, and 160-char names wrapped across lines.
 *
 * Page counts need a real browser (measured manually, TESTING.md: the
 * agency fixture prints at 6 buyer / 4 client pages in Chromium). This
 * pins the print rules that produce them: "+N more" lists stay
 * collapsed with a print-only "+N more — see full list online / TXT";
 * names are middle-truncated tighter in print; tests print title +
 * Hypothesis + Win only; limits print a capped list; the client PDF
 * names its ads once (Summary split) instead of three times.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NAME_DISPLAY_MAX, NAME_PRINT_MAX, middleTruncate } from "../components/debrief/longNames.ts";

const ROOT = join(import.meta.dirname, "..");
const report = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");
const chart = readFileSync(join(ROOT, "components/debrief/PerformanceRankingChart.tsx"), "utf8");
const between = (from: string, to: string) => report.slice(report.indexOf(from), report.indexOf(to, report.indexOf(from)));

/* ---- "+N more" stays collapsed in print, with a pointer ---- */
assert.ok(!/\? "hidden print:(table-row|flex|inline)"/.test(report), "no collapsed row is forced back into print");
assert.match(report, /const text = `\+\$\{count\} more — see full list online \/ TXT`;/);
assert.equal((report.match(/<PrintMore count=\{expanded \? 0 : rows\.length - topAdsShown\} \/>/g) ?? []).length, 1, "ad table");
assert.match(report, /\{ads\.length > SHOWN && !expanded && <PrintMore inline count=\{ads\.length - SHOWN\} \/>\}/, "Pause / Receives lists");
assert.match(css, /\.print-only-inline \{\s*display: none;\s*\}/);
assert.match(css, /\.print-only-inline \{\s*display: inline !important;\s*\}/);

/* ---- Names: tighter truncation in print ---- */
assert.ok(NAME_PRINT_MAX < NAME_DISPLAY_MAX);
assert.equal(middleTruncate("x".repeat(160), NAME_PRINT_MAX).length, NAME_PRINT_MAX);
assert.match(report, /<span className="hidden print:inline">\{middleTruncate\(part\.name, NAME_PRINT_MAX\)\}<\/span>/, "names in sentences");
assert.match(between("function FullAdName(", "function safeFilenamePart("), /middleTruncate\(name, NAME_PRINT_MAX\)/, "table names");
assert.match(chart, /middleTruncate\(chartRow\.row\.name, NAME_PRINT_MAX\)/, "ranking chart labels");

/* ---- Tests print title + Hypothesis + Win only ---- */
const testRow = between("function TestRow(", "function BriefCard(");
assert.match(testRow, /<dl className="print-hidden mt-2\.5[^"]*">\s*<div>\s*<dt[^>]*>\s*Why\{" "\}/, "Why is screen/TXT only");
assert.match(testRow, /<div className="print-hidden print-accent-border mt-2\.5[^"]*">\s*<p[^>]*>\s*Evidence/, "Evidence is screen/TXT only");
assert.match(testRow, /<div id=\{setupDetailsId\} className=\{`print-hidden /, "Setup + Signals are screen/TXT only");
assert.ok(!/print-hidden[^"]*">\s*<div>\s*<dt[^>]*>\s*Hypothesis/.test(testRow), "Hypothesis prints");
const clientCards = between("function ClientTestCards(", "/* One run-list entry");
assert.match(clientCards, /print:grid-cols-1/);
assert.match(clientCards, /<p className="print-hidden mt-1 text-xs leading-relaxed text-zinc-400">\s*<Names text=\{clientizeText\(test\.why\)\} \/>/);
assert.ok(!/print-hidden[^"]*">\s*<Names text=\{clientizeText\(test\.winningLooksLike\)\}/.test(clientCards), "Success prints");

/* ---- Rows print name + numbers only ---- */
const adTable = between("function AdTable(", "function ClientAdList(");
assert.match(adTable, /<p className="print-hidden mt-0\.5 text-xs leading-relaxed text-zinc-400">\s*\{ad\.reason\}/);

/* ---- Limits: capped in print (4 buyer, 2 client) ---- */
assert.match(report, /const PRINT_LIMITS_SHOWN = \{ buyer: 4, client: 2 \} as const;/);
assert.match(report, /\{limitsList\}\s*<PrintMore count=\{limits\.length - printLimits\} \/>/);

/* ---- Client PDF names its ads once ---- */
assert.match(between("function ClientAdList(", "function AtMedianRows("), /ad\{rows\.length === 1 \? "" : "s"\} — see full list online \/ TXT/);
assert.match(report, /\{sections\.executiveSummary && !client && <ExecutiveSummary/);
assert.match(report, /<div className=\{client \? "print:hidden" : undefined\}>\s*<PerformanceRankingChart/);

console.log("real-account print: all assertions passed");
