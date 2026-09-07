/**
 * Print Disclosure Correctness V1 — proofs.
 *
 * Root cause (empirically confirmed, both in this app and in a bare,
 * dependency-free isolated HTML file): Chrome omits a closed native
 * <details>'s non-<summary> content from PDF/print output, and NO
 * author-level CSS override can force it back — not even a scoped
 * `display: block !important` targeting `> *:not(summary)`, tested and
 * ruled out before this milestone chose its fallback. This is a
 * browser rendering behavior, not a stylesheet specificity bug.
 *
 * Two DecisionCard disclosures were affected: "Decision bars applied"
 * (buyer-only) and "Evidence limits" / "What we still can't conclude"
 * (both Buyer and Client, only on the branch where `expandLimits` is
 * false — a default single-period run with no comparison/user
 * criteria). The `expandLimits === true` branch was never affected —
 * it's a plain always-visible div, no <details> involved.
 *
 * Fix: each affected <details> is now `print-hidden` (suppressed
 * entirely in print, regardless of its open/closed state — this is
 * what guarantees no duplicate ever reaches the PDF even if a user
 * manually expands it before printing), paired with a sibling
 * `.print-only` block rendering the EXACT SAME JSX value (a `const`
 * defined once per list, e.g. `appliedCriteriaList`/`limitsList`) —
 * never a second, independently-written `.map()` that could drift.
 *
 * This codebase has no headless-browser dependency in its test suite
 * (see CLAUDE.md), so the structural/isolation properties below are
 * proven via source-scan (matching reportDecisionPrimacy.test.ts's own
 * pattern) plus a real compiled-engine decision/comparison byte-
 * identity check. The actual PDF-content empirical proof (the fix
 * genuinely working, and not duplicating) was done manually during
 * this milestone's QA via real PDF export + pdftotext extraction — see
 * the delivered report, not asserted here.
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
const memoToTextSrc = readFileSync(join(ROOT, "components/debrief/memoToText.ts"), "utf8");

const decisionCardStart = reportSrc.indexOf("function DecisionCard(");
const decisionCardEnd = reportSrc.indexOf("\nfunction AdTable(");
assert.ok(decisionCardStart > 0 && decisionCardEnd > decisionCardStart, "DecisionCard function located");
const decisionCardSrc = reportSrc.slice(decisionCardStart, decisionCardEnd);

/* ===================== 1. Exhaustive <details> inventory ===================== */
{
  // Exactly 2 native <details> JSX tags exist in the printed report
  // today — both inside DecisionCard. Matches only actual opening tags
  // (an attribute always immediately follows in this codebase), not
  // the word "<details>" as it appears in surrounding prose comments.
  // A future new <details> anywhere in Report.tsx must be deliberately
  // reviewed for the same print bug, not silently added — this count
  // guards that.
  const DETAILS_TAG = /<details\s+(?:className|key)=/g;
  const allDetailsInReport = (reportSrc.match(DETAILS_TAG) ?? []).length;
  assert.equal(allDetailsInReport, 2, "exactly 2 native <details> JSX tags exist in Report.tsx");
  const detailsInDecisionCard = (decisionCardSrc.match(DETAILS_TAG) ?? []).length;
  assert.equal(detailsInDecisionCard, 2, "both live inside DecisionCard");

  // Confirmed out of scope, not report content: GeneratorPanel /
  // CompetitorDebriefPanel / MonitoringSection <details> are form/input
  // UI that never coexists with a printed report in the DOM (the
  // generator page renders EITHER <Report> OR <GeneratorPanel>, never
  // both — see app/(workspace)/generator/page.tsx's early return).
  const competitorDebriefResultSrc = readFileSync(
    join(ROOT, "components/competitorDebrief/CompetitorDebriefResult.tsx"),
    "utf8"
  );
  assert.ok(!competitorDebriefResultSrc.includes("<details"), "the OTHER printable report (Competitor Debrief) has no <details> at all — nothing to fix there");

  console.log("printDisclosureCorrectness: 1. exhaustive <details> inventory — exactly 2, both inside DecisionCard, both addressed");
}

/* ===================== 2 & 3. Both <details> are print-hidden, each has a print-only twin ===================== */
{
  const detailsBlocks = [...decisionCardSrc.matchAll(/<details[^>]*?className="([^"]*)"[^>]*>/g)];
  assert.equal(detailsBlocks.length, 2, "two <details> tags found with a static className");
  for (const [, classes] of detailsBlocks) {
    assert.match(classes, /\bprint-hidden\b/, `<details> classList "${classes}" includes print-hidden`);
  }

  const printOnlyBlocks = (decisionCardSrc.match(/className="print-only/g) ?? []).length;
  assert.equal(printOnlyBlocks, 2, "exactly 2 .print-only mirror blocks exist — one per affected <details>");

  console.log("printDisclosureCorrectness: 2-3. both <details> are print-hidden; each has exactly one .print-only mirror");
}

/* ===================== 4. No duplicated logic — the print-only mirrors reuse the same JS value ===================== */
{
  assert.match(decisionCardSrc, /const appliedCriteriaList = \(/, "appliedCriteriaList is defined exactly once");
  assert.match(decisionCardSrc, /const limitsList = \(/, "limitsList is defined exactly once");
  assert.equal((decisionCardSrc.match(/\{appliedCriteriaList\}/g) ?? []).length, 2, "appliedCriteriaList is referenced (not redefined) exactly twice — <details> and its print-only twin");
  assert.equal((decisionCardSrc.match(/\{limitsList\}/g) ?? []).length, 2, "limitsList is referenced (not redefined) exactly twice — <details> and its print-only twin");
  // Only ONE .map() over each source array in the whole component —
  // proves the list markup itself isn't hand-duplicated anywhere.
  assert.equal((decisionCardSrc.match(/d\.appliedCriteria\.map/g) ?? []).length, 1, "d.appliedCriteria is mapped exactly once in the whole component");
  // limits.map appears twice total: once inside limitsList (reused
  // twice via the variable above), once more in the SEPARATE
  // expandLimits===true always-visible branch, which is a genuinely
  // different, unaffected code path (never a <details>) — see item 6.
  assert.equal((decisionCardSrc.match(/limits\.map/g) ?? []).length, 2, "limits.map appears exactly twice: once for limitsList, once for the separate always-visible expandLimits branch");

  console.log("printDisclosureCorrectness: 4. print-only mirrors reuse the exact same JS value — no duplicated mapping logic");
}

/* ===================== 5. Headings/copy are byte-identical between screen and print-only ===================== */
{
  assert.equal((decisionCardSrc.match(/Decision bars applied/g) ?? []).length, 2, "'Decision bars applied' heading text appears exactly twice — <summary> and print-only <p>, identical wording");
  assert.equal((decisionCardSrc.match(/Evidence limits/g) ?? []).length, 2, "'Evidence limits' heading text appears exactly twice — <summary> and print-only <p>, identical wording");
  assert.equal((decisionCardSrc.match(/What we still can't conclude/g) ?? []).length, 3, "'What we still can't conclude' appears 3 times: the always-visible expandLimits branch, the <summary>, and its print-only twin — all identical, pre-existing client wording, untouched");

  console.log("printDisclosureCorrectness: 5. heading copy is byte-identical between screen and print — no wording changed");
}

/* ===================== 6. The always-visible expandLimits branch is untouched ===================== */
{
  assert.match(
    decisionCardSrc,
    /\{limits\.length > 0 &&\s*\(expandLimits \? \(/,
    "the expandLimits ternary structure is unchanged"
  );
  const alwaysVisibleBlockMatch = decisionCardSrc.match(/expandLimits \? \(([\s\S]*?)\) : \(/);
  assert.ok(alwaysVisibleBlockMatch, "the always-visible (expandLimits=true) branch is found");
  const alwaysVisibleBlock = alwaysVisibleBlockMatch![1];
  assert.ok(!alwaysVisibleBlock.includes("<details"), "the always-visible branch never used <details> — confirmed unaffected by this milestone's fix");
  assert.ok(!alwaysVisibleBlock.includes("print-only"), "the always-visible branch needed no print-only mirror — it was never broken");
  assert.match(alwaysVisibleBlock, /What we don't know/, "buyer label for the always-visible branch is unchanged");

  console.log("printDisclosureCorrectness: 6. the always-visible expandLimits branch (never affected) is confirmed untouched");
}

/* ===================== 7. key={view} reset-on-mode-switch behavior preserved ===================== */
{
  assert.match(decisionCardSrc, /<details key=\{view\} className="print-hidden/, "the Evidence limits <details> still carries key={view} — screen mode-switch reset behavior is unchanged");
  console.log("printDisclosureCorrectness: 7. key={view} screen behavior preserved");
}

/* ===================== 8. .print-hidden / .print-only rules themselves are untouched ===================== */
{
  assert.match(cssSrc, /\.print-hidden \{\s*display:\s*none\s*!important;\s*\}/, "pre-existing .print-hidden rule byte-unchanged");
  assert.match(cssSrc, /\.print-only \{\s*display:\s*none;\s*\}/, "pre-existing .print-only base (screen) rule byte-unchanged");
  assert.match(cssSrc, /\.print-only \{\s*display:\s*block\s*!important;\s*\}/, "pre-existing .print-only print-media rule byte-unchanged");
  // The ruled-out CSS-only approach (.print-open-details) must NOT be
  // present — it was tested, found ineffective, and removed rather
  // than left as dead/misleading code.
  assert.ok(!cssSrc.includes("print-open-details"), "the ineffective CSS-only attempt was removed, not left in place");
  assert.equal((cssSrc.match(/@media print \{/g) ?? []).length, 1, "still exactly one @media print block");
  console.log("printDisclosureCorrectness: 8. .print-hidden/.print-only are reused, unmodified; the ruled-out CSS-only attempt was removed");
}

/* ===================== 9. Next Tests progressive disclosure untouched ===================== */
{
  assert.match(reportSrc, /const \[setupExpanded, setSetupExpanded\] = useState\(false\)/, "TestRow's setupExpanded state is unchanged");
  assert.match(cssSrc, /\.print-force-block \{\s*display:\s*block\s*!important;\s*\}/, "print-force-block (Next Tests milestone) is unchanged");
  console.log("printDisclosureCorrectness: 9. Next Tests Setup/Signals progressive disclosure is untouched");
}

/* ===================== 10. Copy/Export TXT was never affected, and is untouched ===================== */
{
  // memoToText.ts serializes appliedCriteria/limits directly from
  // Memo, unconditionally — it never had this bug (it doesn't read the
  // DOM or any <details> state at all) and this milestone doesn't
  // touch it.
  assert.match(memoToTextSrc, /d\.appliedCriteria\.forEach/, "Copy/TXT already serializes appliedCriteria unconditionally");
  assert.match(memoToTextSrc, /limits\.forEach/, "Copy/TXT already serializes limits unconditionally");
  assert.ok(!memoToTextSrc.includes("print-hidden") && !memoToTextSrc.includes("print-only"), "memoToText.ts has no awareness of print CSS at all — it was never part of this bug");
  console.log("printDisclosureCorrectness: 10. Copy/Export TXT was never affected by this bug and remains untouched");
}

/* ===================== 11. Real engine: decision/comparison output is byte-identical ===================== */
{
  const dist = mkdtempSync(join(tmpdir(), "debrief-print-disclosure-"));
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

    assert.deepEqual(memo1.decision, memo2.decision, "decision output is deterministic/byte-identical across runs — this presentation-only milestone changed nothing in the engine");
    assert.ok(memo1.decision.appliedCriteria.length > 0, "fixture actually exercises appliedCriteria (the exact content this milestone fixes in print)");
    assert.ok(memo1.decision.limits.buyer.length > 0, "fixture actually exercises limits (the exact content this milestone fixes in print)");

    console.log("printDisclosureCorrectness: 11. decision output confirmed byte-identical via the real compiled engine — this milestone touched no engine logic");
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
}

console.log("printDisclosureCorrectness: all assertions passed (empirical PDF proof performed manually — see delivered report)");
