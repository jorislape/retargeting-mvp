/**
 * Next Tests Setup/Signals Progressive Disclosure V1 — proofs.
 *
 * Presentation-only milestone: Buyer TestRow's Setup and Signals used
 * fields are screen-collapsed by default behind a real button with
 * aria-expanded, per-row local state (useState/useId declared inside
 * TestRow, so each row instance is independent by construction — no
 * lifted state, no report customization, no Memo/DebriefProvider/URL/
 * storage). Why/Hypothesis/Win/Brief Readiness/Evidence Diagnostic stay
 * unconditionally visible. Setup and Signals stay mounted in the DOM at
 * ALL times — collapsing is a CSS `hidden` class toggle, never a
 * conditional render — and a new .print-force-block rule (globals.css)
 * forces them visible in print regardless of on-screen state. A native
 * closed <details> was deliberately NOT used: the research milestone
 * this implements empirically proved (via real PDF text extraction on
 * the pre-existing DecisionCard "Decision bars applied" block) that
 * Chrome omits closed-<details> content from printed/exported PDFs.
 *
 * This codebase has no component-render harness and no headless-browser
 * dependency in the test suite (see CLAUDE.md: behavioral verification
 * is manual against the dev server) — so items 1-13 of the required
 * regression list are proven here via source-scan (mirroring
 * reportDecisionPrimacy.test.ts's JSX-structure-scan pattern) plus a
 * real compiled-engine run for Copy/TXT (item 13). Item 14 (print/PDF
 * content survival) is NOT automatable here — it was verified manually
 * via a real PDF export + pdftotext extraction during this milestone's
 * browser QA, the same empirical method the source research used, and
 * is reported separately, not asserted in this file.
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

const testRowStart = reportSrc.indexOf("function TestRow(");
const testRowEnd = reportSrc.indexOf("\n/* A generated creative brief");
assert.ok(testRowStart > 0 && testRowEnd > testRowStart, "TestRow function located in Report.tsx");
const testRowSrc = reportSrc.slice(testRowStart, testRowEnd);

/* ===================== Structural split: before vs inside the collapsible wrapper ===================== */
const wrapperIdx = testRowSrc.indexOf("<div id={setupDetailsId}");
assert.ok(wrapperIdx > 0, "the setupDetailsId wrapper div is found in TestRow");
const beforeWrapper = testRowSrc.slice(0, wrapperIdx);
const wrapperAndAfter = testRowSrc.slice(wrapperIdx);

/* ===== 1 & 2. Setup and Signals used stay mounted — never conditionally rendered ===== */
{
  assert.ok(!/\{setupExpanded\s*&&/.test(testRowSrc), "no {setupExpanded && ...} conditional-render gate anywhere in TestRow");
  assert.ok(!/\{!setupExpanded\s*&&/.test(testRowSrc), "no inverse conditional-render gate either");
  assert.match(wrapperAndAfter, /test\.setup/, "Setup content is present inside the wrapper");
  assert.match(wrapperAndAfter, /test\.signals/, "Signals used content is present inside the wrapper");
  // Moved, not duplicated: Setup/Signals must not ALSO appear before the wrapper.
  assert.ok(!beforeWrapper.includes("test.setup"), "Setup is not duplicated outside the wrapper");
  assert.ok(!beforeWrapper.includes("test.signals"), "Signals used is not duplicated outside the wrapper");
  console.log("nextTestsProgressiveDisclosure: 1-2. Setup/Signals stay in the DOM, never conditionally unmounted, not duplicated");
}

/* ===== 3. Screen-hidden by default ===== */
{
  assert.match(testRowSrc, /const \[setupExpanded, setSetupExpanded\] = useState\(false\)/, "setupExpanded initializes to false (collapsed)");
  const wrapperDivMatch = wrapperAndAfter.match(/<div id=\{setupDetailsId\} className=\{`print-force-block \$\{setupExpanded \? "block" : "hidden"\}`\}>/);
  assert.ok(wrapperDivMatch, "wrapper className renders 'hidden' when setupExpanded is false, 'block' when true — same state driving both");
  console.log("nextTestsProgressiveDisclosure: 3. collapsed by default, driven by the same setupExpanded state");
}

/* ===== 4 & 5. Clicking the button exposes the content; aria-expanded is correct ===== */
{
  const buttonMatch = testRowSrc.match(/<button\s+type="button"\s+aria-expanded=\{setupExpanded\}\s+aria-controls=\{setupDetailsId\}\s+onClick=\{\(\) => setSetupExpanded\(\(v\) => !v\)\}/);
  assert.ok(buttonMatch, "the disclosure button toggles the exact same setupExpanded state that drives the wrapper's visibility, and exposes aria-expanded tied to it");
  assert.match(testRowSrc, /\{setupExpanded \? "Hide setup details" : "Show setup details"\}/, "button label inverts correctly");
  console.log("nextTestsProgressiveDisclosure: 4-5. click toggles the same state; aria-expanded reflects it; label inverts");
}

/* ===== 6. T1/T2/T3 disclosure states are independent ===== */
{
  // useState/useId are declared INSIDE the TestRow function body (not
  // passed as a prop, not module-level) — React gives every component
  // INSTANCE its own state, and Report.tsx renders one TestRow instance
  // per test (memo.nextTests.map(...) => <TestRow key={i} .../>), so
  // this is sufficient to guarantee independence by construction.
  const useStateIdx = testRowSrc.indexOf("const [setupExpanded, setSetupExpanded] = useState(false)");
  const functionBodyStart = testRowSrc.indexOf("{", testRowSrc.indexOf(") {"));
  assert.ok(useStateIdx > functionBodyStart, "setupExpanded's useState call is inside TestRow's own function body, not lifted or passed as a prop");
  assert.ok(!/setupExpanded\s*[,:]\s*.*\}\s*:\s*\{/.test(reportSrc.slice(reportSrc.indexOf("function TestRow("), reportSrc.indexOf("function TestRow(") + 400)), "setupExpanded is not a TestRow prop");
  const mapCallSrc = reportSrc.slice(reportSrc.indexOf("memo.nextTests.map((test, i) =>"), reportSrc.indexOf("memo.nextTests.map((test, i) =>") + 400);
  assert.match(mapCallSrc, /<TestRow\s+key=\{i\}/, "one TestRow instance is mounted per test, each keyed independently");
  console.log("nextTestsProgressiveDisclosure: 6. T1/T2/T3 disclosure state is independent by construction (per-instance React state)");
}

/* ===== 7-11. Why/Hypothesis/Win/Brief Readiness/Evidence Diagnostic stay unconditionally visible ===== */
{
  assert.match(beforeWrapper, /test\.why/, "Why is rendered before the collapsible wrapper");
  assert.match(beforeWrapper, /test\.hypothesis/, "Hypothesis is rendered before the collapsible wrapper");
  assert.match(beforeWrapper, /test\.winningLooksLike/, "Win/Success is rendered before the collapsible wrapper");
  assert.match(beforeWrapper, /test\.briefReadiness/, "Brief Readiness badge is rendered before the collapsible wrapper");
  assert.match(beforeWrapper, /test\.evidenceDiagnostic/, "Evidence Diagnostic is rendered before the collapsible wrapper");
  // None of these five are gated on setupExpanded anywhere in the file.
  for (const field of ["test.why", "test.hypothesis", "test.winningLooksLike", "test.briefReadiness", "test.evidenceDiagnostic"]) {
    const idx = testRowSrc.indexOf(field);
    assert.ok(idx > -1 && idx < wrapperIdx, `${field}'s first reference precedes the collapsible wrapper`);
  }
  console.log("nextTestsProgressiveDisclosure: 7-11. Why/Hypothesis/Win/Readiness/Diagnostic remain unconditionally visible");
}

/* ===== The toggle button itself never appears in print ===== */
{
  const buttonStart = testRowSrc.indexOf("aria-controls={setupDetailsId}");
  assert.ok(buttonStart > -1, "the disclosure button's aria-controls attribute is found");
  const buttonBlock = testRowSrc.slice(buttonStart, testRowSrc.indexOf("</button>", buttonStart));
  assert.match(buttonBlock, /className="print-hidden/, "the disclosure button carries print-hidden — never rendered in print/PDF output");
  console.log("nextTestsProgressiveDisclosure: disclosure button is print-hidden");
}

/* ===== .print-force-block: additive, does not touch existing print rules ===== */
{
  assert.match(cssSrc, /\.print-force-block\s*\{\s*display:\s*block\s*!important;\s*\}/, "print-force-block rule exists and forces display:block");
  const printBlockStart = cssSrc.indexOf("@media print {");
  const printForceIdx = cssSrc.indexOf(".print-force-block");
  assert.ok(printForceIdx > printBlockStart, "print-force-block lives inside the existing @media print block, not a new one");
  assert.equal((cssSrc.match(/@media print \{/g) ?? []).length, 1, "still exactly one @media print block — not split around the new rule");
  // The pre-existing .print-hidden/.print-only rules are untouched (still present, unchanged text).
  assert.match(cssSrc, /\.print-hidden \{\s*display:\s*none\s*!important;\s*\}/);
  assert.match(cssSrc, /\.print-only \{\s*display:\s*block\s*!important;\s*\}/);
  // This milestone must not touch <details>/<summary> print behavior at
  // all — scoped to the new rule's own block (globals.css already has
  // an unrelated, pre-existing `summary` reference in a general
  // focus-visible selector list elsewhere in the file).
  const newRuleBlock = cssSrc.slice(cssSrc.indexOf(".print-force-block"), cssSrc.indexOf(".print-force-block") + 400);
  assert.ok(!/details|summary/i.test(newRuleBlock), "the new print-force-block rule and its surrounding comment never mention details/summary");
  console.log("nextTestsProgressiveDisclosure: print-force-block is additive, does not touch existing print rules or details/summary");
}

/* ===== 12. ClientTestCards is structurally unchanged ===== */
{
  const clientCardsStart = reportSrc.indexOf("function ClientTestCards(");
  const clientCardsEnd = reportSrc.indexOf("\n/* One run-list entry");
  assert.ok(clientCardsStart > 0 && clientCardsEnd > clientCardsStart, "ClientTestCards function located");
  const clientCardsSrc = reportSrc.slice(clientCardsStart, clientCardsEnd);

  assert.ok(!clientCardsSrc.includes("setupExpanded"), "ClientTestCards has no reference to the new disclosure state");
  assert.ok(!clientCardsSrc.includes("print-force-block"), "ClientTestCards has no reference to the new print rule");
  assert.ok(!clientCardsSrc.includes("test.setup"), "ClientTestCards still never renders Setup (unchanged)");
  assert.ok(!clientCardsSrc.includes("test.hypothesis"), "ClientTestCards still never renders Hypothesis (unchanged)");
  assert.ok(!clientCardsSrc.includes("test.signals"), "ClientTestCards still never renders Signals used (unchanged)");
  // Its own 4-field structure is exactly what it was before this milestone.
  assert.match(clientCardsSrc, /clientizeText\(test\.test\)/);
  assert.match(clientCardsSrc, /test\.briefReadiness && test\.briefReadiness\.state !== "ready"/);
  assert.match(clientCardsSrc, /clientizeText\(test\.why\)/);
  assert.match(clientCardsSrc, /clientizeText\(test\.winningLooksLike\)/);

  console.log("nextTestsProgressiveDisclosure: 12. ClientTestCards is structurally unchanged");
}

/* ===== 13. Copy/Export TXT still contains Setup and Signals — real engine ===== */
{
  assert.ok(!memoToTextSrc.includes("setupExpanded"), "memoToText.ts has no reference to the new screen-only disclosure state");
  assert.match(memoToTextSrc, /\$\{view === "client" \? "How" : "Setup"\}: \$\{c\(t\.setup\)\}/, "Setup line is unconditional on any disclosure state");
  assert.match(memoToTextSrc, /if \(t\.signals\.length > 0\) \{/, "Signals used gating is unchanged (only on signal count, never on screen state)");

  const dist = mkdtempSync(join(tmpdir(), "debrief-next-tests-disclosure-"));
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
    const { memoToText } = require(join(dist, "components/debrief/memoToText.js"));

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
    const memo = generateMemo(analysis, ctx);

    assert.ok(memo.nextTests.length > 0, "fixture produces at least one next test");
    const buyerText = memoToText(memo, "buyer");
    assert.match(buyerText, /   Setup: /, "buyer Copy/TXT output contains a Setup line");
    assert.match(buyerText, /   Signals used:/, "buyer Copy/TXT output contains a Signals used line (this fixture's tests have signals)");
    // The real Setup sentence text for T1 must appear verbatim.
    assert.ok(buyerText.includes(memo.nextTests[0].setup), "the exact Setup sentence text appears verbatim in Copy/TXT output");

    console.log("nextTestsProgressiveDisclosure: 13. Copy/Export TXT contains Setup and Signals via the real compiled engine — screen state has no input to memoToText at all");
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
}

/* ===== Engine isolation: this milestone touches presentation only ===== */
{
  // TestRow itself introduces no new imports (the file already imports
  // types from modules/debrief elsewhere — pre-existing, unrelated to
  // this change; TestRow's own function body has none at all).
  assert.ok(!testRowSrc.includes("require(") && !testRowSrc.includes("import "), "TestRow itself contains no new imports");
  console.log("nextTestsProgressiveDisclosure: engine isolation reconfirmed — no new imports introduced in TestRow");
}

console.log("nextTestsProgressiveDisclosure: all assertions passed (item 14 — print/PDF — verified separately via real PDF export + pdftotext, see browser QA)");
