/**
 * Real-account fix 6 — the PDF of a real agency account ran to 25 pages
 * (buyer) / 15 (client): every collapsed row printed, every test printed
 * its full reasoning, and 160-char names wrapped across lines.
 *
 * Page counts need a real browser (measured manually, TESTING.md: the
 * agency fixture prints at 7 buyer / 4 client pages in Chromium, the
 * last buyer page(s) being the appendix). This
 * pins the print rules that produce them: "+N more" lists stay
 * collapsed with a print-only "+N more — full list in the appendix"
 * (a PDF has no "online" version) and the appendix lists them;
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
assert.match(report, /const text = inAppendix \? `\+\$\{count\} more — full list in the appendix` : `\+\$\{count\} more`;/);
assert.ok(!/online/i.test(report.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "")), "no print text points 'online'");
assert.equal((report.match(/<PrintMore count=\{expanded \? 0 : rows\.length - Math\.min\(topAdsShown, PRINT_TABLE_ROWS\)\} \/>/g) ?? []).length, 1, "ad table");
assert.match(report, /const PRINT_TABLE_ROWS = 3;/, "tables print their top 3 rows");
assert.match(report, /i >= PRINT_TABLE_ROWS && !expanded \? "print:hidden" : ""/);
/* Real-account review: decision bars print only when they changed the
   call (decision.ts marks them `decisive`) or the user set them. */
assert.match(report, /const criterionPrinted = \(c: Memo\["decision"\]\["appliedCriteria"\]\[number\]\) =>\s*c\.decisive === true \|\| c\.source === "user";/);
assert.match(report, /criterionPrinted\(criterion\) \? "" : "print:hidden"/);
assert.ok(!report.includes("PRINT_CRITERIA_SHOWN"), "no positional cap on bars");
assert.match(report, /\{ads\.length > SHOWN && !expanded && <PrintMore inline count=\{ads\.length - SHOWN\} inAppendix=\{!client\} \/>\}/, "Pause / Receives lists");

/* ---- The appendix: what print collapses, listed on the last page(s) ---- */
{
  const app = between("function PrintAppendix(", "/* Client view: the top N");
  assert.match(report, /const APPENDIX_NAME_MAX = 50;/);
  assert.match(app, /middleTruncate\(r\.name, APPENDIX_NAME_MAX\)/);
  // Every judged ad once, in the role the report gives it.
  assert.match(app, /memo\.winners\.map\(\(r\) => \(\{ r, group: to\.has\(r\.name\) \? label\.receives : label\.above \}\)\)/);
  assert.match(app, /\(memo\.atMedian\?\.rows \?\? \[\]\)\.map\(\(r\) => \(\{ r, group: label\.at \}\)\)/);
  assert.match(app, /memo\.losers\.rows\.map\(\(r\) => \(\{ r, group: from\.has\(r\.name\) \? label\.trim : r\.holdNote \? label\.hold : label\.below \}\)\)/);
  assert.match(app, /trim: client \? "Reduce \/ pause" : "Pause \/ trim"/);
  // Columns: name, role, spend, outcomes, KPI.
  for (const col of [/r\.spendLabel/, /appendixOutcomes\(r\)/, /r\.valueLabel/]) assert.match(app, col);
  // A judged zero-purchase ad reads 0 (as in the tables), never "—".
  assert.match(report, /if \(r\.conversionLabel\) return r\.conversionLabel\.replace\(\/\\s\.\*\$\/, ""\);\s*return \/\^0 \(purchases\|leads\)\\b\/\.test\(r\.vsMedianLabel\) \|\| \/\^0 \(purchases\|leads\)\$\/\.test\(r\.valueLabel\) \? "0" : "—";/);
  // Exactly the rest of what the body collapses — the same predicates.
  assert.match(app, /const moreLimits = .*\.slice\(PRINT_LIMITS_SHOWN\[client \? "client" : "buyer"\]\)/);
  assert.match(app, /d\.appliedCriteria\.filter\(\(c\) => !criterionPrinted\(c\)\)/);
  assert.match(app, /k\.rows\.filter\(\(_, ri\) => !namingRowPrinted\(ki, ri\)\)/);
  assert.match(report, /className=\{`border-b border-white\/\[0\.06\] last:border-0 \$\{namingRowPrinted\(ki, ri\) \? "" : "print:hidden"\}`\}/);
  // Buyer only lists every ad; the client PDF stays top-performers-only.
  assert.match(report, /<PrintAppendix\s+memo=\{memo\}\s+view=\{view\}\s+showAds=\{!client && \(sections\.winners \|\| sections\.underperformers\)\}\s+showNaming=\{sections\.patterns && !client\}/);
  assert.ok(report.indexOf("<PrintAppendix") > report.indexOf("</footer>"), "after the sign-off");
  /* Flows on after the sign-off: a forced page break cost a real
     account a whole extra page. */
  assert.match(app, /className=\{`print-only \$\{rows\.length > 0 \? "mt-6 border-t border-white\/\[0\.08\] pt-1" : "mt-3"\}`\}/);
  assert.ok(!/break-before: page/.test(css), "no forced page break");
}
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
assert.match(report, /const PRINT_LIMITS_SHOWN = \{ buyer: 2, client: 2 \} as const;/, "first 2 limits on paper");
assert.match(report, /\{limitsList\}\s*<PrintMore count=\{limits\.length - printLimits\} \/>/);

/* ---- Client PDF names its ads once ---- */
assert.match(between("function ClientAdList(", "function AtMedianRows("), /ad\{rows\.length === 1 \? "" : "s"\} in this group — the \{tone === "win" \? "strongest" : "weakest"\} are named in the Summary\./);
assert.match(report, /\{sections\.executiveSummary && !client && <ExecutiveSummary/);
/* Real-account review: the summary is page 1 — in the masthead, right
   after the stat row — and its labels never break mid-word. */
{
  const statRow = report.indexOf('["Analyzed", String(memo.scope.adsAnalyzed)]');
  const mount = report.indexOf("<ExecutiveSummary memo=");
  assert.ok(statRow > 0 && mount > statRow && mount < report.indexOf("Minimum spend to judge (evidence gate):"), "directly under the stat row");
  const exec = between("function ExecutiveSummary(", "/* Period Comparison V2");
  assert.match(exec, /grid-cols-\[max-content_minmax\(0,1fr\)\]/);
  assert.match(exec, /<dt className="print-kv-label whitespace-nowrap/);
}
assert.match(report, /<div className=\{client \? "print:hidden" : undefined\}>\s*<PerformanceRankingChart/);

/* ---- Patterns by naming (on by default with tokens): every key, top 4 values ---- */
assert.match(report, /const PRINT_NAMING_ROWS = 4;\s*const namingRowPrinted = \(_ki: number, ri: number\) => ri < PRINT_NAMING_ROWS;/);
const naming = between("function NamingPatternsTable(", "/* Trust Pass");
assert.ok(!report.includes("PRINT_NAMING_KEYS"), "no key is hidden in print");
assert.match(naming, /<div key=\{k\.key\} className="print-avoid-break min-w-0 overflow-x-auto">/);
assert.match(naming, /namingRowPrinted\(ki, ri\) \? "" : "print:hidden"/);
assert.match(naming, /<PrintMore count=\{k\.rows\.length - PRINT_NAMING_ROWS\} \/>/);
assert.match(report, /sm:grid-cols-2 \$\{memo\.namingPatterns \? "print:hidden" : ""\}/, "share lists screen-only beside the table");

/* ---- Real-account review: no dev badge on paper; a tip for browser chrome ---- */
assert.match(css, /@media print \{[\s\S]*?nextjs-portal \{\s*display: none !important;\s*\}/, "Next.js dev indicator hidden in print");
{
  const toolbar = between("{/* ---- Toolbar: view tabs + actions. Never prints. ---- */}", "<article");
  assert.match(toolbar, /Print \/ Save PDF/);
  assert.match(toolbar, /Tip: turn off &lsquo;Headers and footers&rsquo; in the print dialog\./);
  assert.ok(toolbar.indexOf("Tip: turn off") > toolbar.indexOf("Print / Save PDF"), "beside the print action, in the print-hidden toolbar");
}

console.log("real-account print: all assertions passed");
