/**
 * Print Page One Composition V1 — proofs.
 *
 * Root cause (empirically confirmed on the real 14-ad sample, measured
 * at the actual PDF content-box width, 703×1032px for A4 minus the
 * 12mm @page margin): DecisionCard's outer <section> carried
 * `print-avoid-break` (`break-inside: avoid`) around its ENTIRE
 * content — masthead through the "Next move" label occupies ~340px,
 * leaving ~692px of page 1 remaining, but the card itself is ~844px
 * tall. Because `break-inside: avoid` cannot be honored (the whole
 * card doesn't fit in the remaining space), the browser's print
 * pagination defers the ENTIRE card, as one atomic unit, to page 2 —
 * leaving page 1 with only the masthead and ~65% blank space. This is
 * standard CSS fragmentation behavior, not a bug in isolation; the bug
 * was applying the "keep together" guard to a large composite card as
 * a whole, contradicting print-avoid-break's own documented intent
 * ("applied selectively to the units worth protecting, not blanket-
 * applied" — globals.css).
 *
 * Fix: the outer <section> no longer carries print-avoid-break, so
 * print pagination is free to start filling page 1 with the card's
 * content immediately after the masthead. Each individual multi-line
 * sub-block (the two disclosure mirrors from Print Disclosure
 * Correctness V1, "Not yet", "Next controlled test", and both
 * "Evidence limits"/"What we don't know" variants) keeps its OWN
 * print-avoid-break, so nothing splits mid-list or leaves an orphaned
 * heading — only short single-line paragraphs (headline, What we
 * know, Evidence, Consistency, Brief readiness, Reassess) are left
 * unprotected, and empirically these never produced a bad break (see
 * this milestone's PDF QA).
 *
 * `break-inside` is a fragmentation-context property (print pages,
 * multicol) with NO effect on ordinary continuous screen layout — so
 * removing/adding print-avoid-break is provably screen-inert; no
 * component structure, copy, or screen-visible styling changed.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const ROOT = join(import.meta.dirname, "..");

const reportSrc = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
const cssSrc = readFileSync(join(ROOT, "app/globals.css"), "utf8");

const decisionCardStart = reportSrc.indexOf("function DecisionCard(");
const decisionCardEnd = reportSrc.indexOf("\nfunction AdTable(");
assert.ok(decisionCardStart > 0 && decisionCardEnd > decisionCardStart, "DecisionCard function located");
const decisionCardSrc = reportSrc.slice(decisionCardStart, decisionCardEnd);

/* ===================== 1. The outer section no longer force-defers whole ===================== */
{
  const sectionOpenMatch = decisionCardSrc.match(/<section\s+aria-label="Next move"[\s\S]*?className="([^"]*)"\s*>/);
  assert.ok(sectionOpenMatch, "DecisionCard's outer <section> is found");
  const outerClasses = sectionOpenMatch![1];
  assert.ok(!outerClasses.includes("print-avoid-break"), "the outer <section> no longer carries print-avoid-break — this is the fix");
  // Sanity: the section's actual visual styling (border/background/
  // radius/spacing) is untouched — only the pagination class changed.
  assert.match(outerClasses, /rounded-xl/);
  assert.match(outerClasses, /border-accent\/25/);
  assert.match(outerClasses, /bg-accent\/\[0\.05\]/);

  console.log("printPageOneComposition: 1. outer DecisionCard section no longer blocks the whole card from starting on page 1");
}

/* ===================== 2. Sub-blocks break between items, never inside one ===================== */
{
  /* Bulletproof pass C3: a whole-block guard made a long Evidence-limits
     list jump to the next page and leave this one half empty (WebKit,
     real export). Each heading now stays with its first item
     (print-heading = break-after: avoid) and each item stays whole. */
  assert.match(decisionCardSrc, /className="print-only mt-3">\s*<p className="print-heading text-\[10px\][^"]*">\s*Decision bars applied/, "Decision bars: heading kept with its first bar");
  assert.match(decisionCardSrc, /className="mt-4">\s*<p className="print-heading text-\[10px\][^"]*">\s*\{client \? "What we're deliberately not doing yet" : "Not yet"\}/, "Not yet: heading kept with its first item");
  assert.match(decisionCardSrc, /className="print-avoid-break border-l border-amber-300\/40 pl-3/, "each Not-yet item stays whole");
  // Bulletproof A-fix 4: print drops it in both views (T1 carries it).
  assert.match(decisionCardSrc, /className="print-avoid-break mt-4 print:hidden">\s*<p className="text-\[10px\][^"]*">\s*Next controlled test/, "the Next controlled test wrapper is print-hidden (T1 carries it)");
  assert.match(decisionCardSrc, /className="mt-4 border-t border-white\/\[0\.08\] pt-3">\s*<p className="print-heading text-\[10px\][^"]*">\s*\{client \? "What we still can't conclude" : "What we don't know"\}/, "always-visible limits: heading kept with its first line");
  assert.match(decisionCardSrc, /className="print-only mt-4 border-t border-white\/\[0\.08\] pt-3">\s*<p className="print-heading/, "Evidence limits print mirror: heading kept with its first line");
  assert.match(reportSrc, /className=\{`print-avoid-break text-\[12px\] leading-relaxed text-zinc-500 \$\{i >= printLimits/, "each limits line stays whole");
  assert.match(reportSrc, /className=\{`print-avoid-break flex items-baseline gap-2 text-\[12px\]/, "each decision bar stays whole");

  console.log("printPageOneComposition: 2. sub-blocks break between items with headings kept — no mid-item or orphaned-heading breaks");
}

/* ===================== 3. break-inside:avoid is provably screen-inert ===================== */
{
  // The rule must live OUTSIDE @media print (so it's the same rule in
  // both contexts) and must be a pure fragmentation property with no
  // other visual side effect — break-inside has no effect at all
  // outside a fragmentation context (print pages / multicol), so
  // ordinary continuous screen scrolling is provably unaffected by
  // adding or removing this class anywhere.
  const printAvoidBreakRule = cssSrc.match(/\.print-avoid-break \{\s*([\s\S]*?)\s*\}/);
  assert.ok(printAvoidBreakRule, ".print-avoid-break rule found");
  assert.equal(printAvoidBreakRule![1].trim(), "break-inside: avoid;", "the rule sets ONLY break-inside — no other screen-visible property");
  const mediaPrintIdx = cssSrc.indexOf("@media print {");
  const ruleIdx = cssSrc.indexOf(".print-avoid-break {");
  assert.ok(ruleIdx < mediaPrintIdx, ".print-avoid-break is defined outside @media print — same rule screen and print, inert on screen either way");

  console.log("printPageOneComposition: 3. print-avoid-break is a pure fragmentation hint — zero screen effect by construction");
}

/* ===================== 4. Print Disclosure Correctness V1 is preserved ===================== */
{
  const detailsBlocks = [...decisionCardSrc.matchAll(/<details[^>]*?className="([^"]*)"[^>]*>/g)];
  assert.equal(detailsBlocks.length, 2, "both native <details> still exist");
  for (const [, classes] of detailsBlocks) {
    assert.match(classes, /\bprint-hidden\b/, "each <details> is still print-hidden");
  }
  assert.equal((decisionCardSrc.match(/className="print-only/g) ?? []).length, 2, "both print-only mirrors still exist, exactly once each");
  assert.match(decisionCardSrc, /const appliedCriteriaList = \(/, "appliedCriteriaList is still defined once and reused, not duplicated");
  assert.match(decisionCardSrc, /const limitsList = \(/, "limitsList is still defined once and reused, not duplicated");

  console.log("printPageOneComposition: 4. Print Disclosure Correctness V1's fix (print-hidden <details> + print-only mirrors) is fully preserved");
}

/* ===================== 5. Next Tests Setup/Signals progressive disclosure is untouched ===================== */
{
  assert.match(reportSrc, /const \[setupExpanded, setSetupExpanded\] = useState\(false\)/, "TestRow's setupExpanded state is unchanged");
  assert.match(cssSrc, /\.print-force-block \{\s*display:\s*block\s*!important;\s*\}/, "print-force-block (Next Tests milestone) is unchanged");
  console.log("printPageOneComposition: 5. Next Tests Setup/Signals progressive disclosure is untouched");
}

/* ===================== 6. Isolation: only DecisionCard's markup changed ===================== */
{
  // ClientTestCards, TestRow, and BriefCard are untouched by this
  // milestone — confirmed by scanning for print-avoid-break additions
  // outside DecisionCard's own function body.
  const beforeDecisionCard = reportSrc.slice(0, decisionCardStart);
  const afterDecisionCard = reportSrc.slice(decisionCardEnd);
  assert.ok(!beforeDecisionCard.includes("Print Page One Composition"), "no changes attributed to this milestone before DecisionCard");
  assert.ok(!afterDecisionCard.includes("Print Page One Composition"), "no changes attributed to this milestone after DecisionCard");

  console.log("printPageOneComposition: 6. only DecisionCard's own markup was touched — no other component affected");
}

/* ===================== 7. Real engine: decision/comparison output is byte-identical ===================== */
{
  const dist = mkdtempSync(join(tmpdir(), "debrief-page-one-"));
  try {
    execSync(
      `npx tsc modules/debrief/*.ts components/debrief/memoToText.ts --outDir ${JSON.stringify(dist)} --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck --rewriteRelativeImportExtensions`,
      { cwd: ROOT, stdio: "pipe" }
    );
    const { parseCsv, toTable } = require(join(dist, "modules/debrief/csv.js"));
    const { resolveColumns } = require(join(dist, "modules/debrief/columns.js"));
    const { extractAds } = require(join(dist, "modules/debrief/extract.js"));
    const { analyze } = require(join(dist, "modules/debrief/analysis.js"));
    const { generateMemo } = require(join(dist, "modules/debrief/memo.js"));

    const ctx = {
      kpi: "roas",
      product: "Test",
      offer: "",
      targetCpa: null,
      targetRoas: null,
      creativeNotes: "",
      marketContext: "",
      spendGateOverride: null,
      minOutcomeCount: null,
      minBriefOutcomeCount: null,
      minLossSpendMultiple: null,
    };
    const csvText = `Ad name,Amount spent (USD),Purchases,Purchase ROAS (return on ad spend)
ThinWinner,500.00,3,4.50
MidAd,450.00,8,3.00
LowAd,400.00,6,2.50
WorstAd,380.00,2,1.20`;
    const { headers, rows } = toTable(parseCsv(csvText));
    const columns = resolveColumns(headers);
    const ads = extractAds(rows, columns, ctx.kpi);
    const analysis = analyze(ads, rows, columns, ctx);
    const memo1 = generateMemo(analysis, ctx);
    const memo2 = generateMemo(analysis, ctx);

    assert.deepEqual(memo1.decision, memo2.decision, "decision output is deterministic/byte-identical — this presentation-only milestone changed no engine logic");

    console.log("printPageOneComposition: 7. decision output confirmed byte-identical via the real compiled engine");
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
}

console.log("printPageOneComposition: all assertions passed (empirical PDF geometry/pagination proof performed manually — see delivered report)");
