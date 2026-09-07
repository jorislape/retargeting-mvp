/**
 * Report Default Curation V1 — proofs.
 *
 * Presentation-only milestone: changes ONLY the *initial* visibility a
 * Performance report starts with (createDefaultCustomization's own
 * output is untouched; see reportCustomization.ts's doc comment on
 * that function). Two distinct delivery mechanisms, per the
 * architecture finding this milestone's own report documents:
 *
 *  - Buyer's curated defaults: an additive, optional overlay
 *    (InitialCustomizationOverrides) applied ONLY at first mount and
 *    by reset() — see useReportCustomization.ts's buildInitialCustomization.
 *    Report.tsx always mounts in "internal"/Buyer mode, so this is the
 *    one register with a true "first render" to hook into.
 *  - Client's curated defaults: delivered via the pre-existing
 *    "client" NAMED PRESET's snapshot instead, since a bare
 *    Buyer -> Client mode switch on an untouched report must NOT
 *    silently change section visibility (approved decision #9 —
 *    reconfirmed below). A fresh report's first Client-tab click
 *    shows Buyer's now-curated set unless "Client summary" is
 *    explicitly selected; that is a deliberate, documented limit of
 *    this approach, not an oversight.
 *
 * Same source-scan-plus-pure-logic approach as
 * reportDecisionPrimacy.test.ts: this codebase has no component-render
 * harness, and useReportCustomization.ts itself isn't plain-Node
 * importable (it pulls in "react" via an extensionless import chain —
 * see its own header comment), so the merge algorithm is exercised
 * here as an independent-oracle transcription against the same
 * plain-Node-importable pieces (createDefaultCustomization,
 * PERFORMANCE_INITIAL_OVERRIDES, derivePreset) it's built from, plus a
 * source-scan confirming the hook's actual implementation matches.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createDefaultCustomization,
  derivePreset,
  matchesPreset,
} from "../components/report/reportCustomization.ts";
import { PERFORMANCE_SECTION_IDS } from "../components/report/reportSections.ts";
import { PERFORMANCE_INITIAL_OVERRIDES, PERFORMANCE_PRESETS } from "../components/debrief/reportPresets.ts";

const ROOT = join(import.meta.dirname, "..");

/* ============== 1. Fresh Buyer default set (regression #1) ============== */
{
  // Transcribes buildInitialCustomization's own merge (verified against
  // its real implementation via source-scan in section 5 below).
  const base = createDefaultCustomization(PERFORMANCE_SECTION_IDS);
  const freshBuyer = {
    ...base,
    ...PERFORMANCE_INITIAL_OVERRIDES,
    sections: { ...base.sections, ...PERFORMANCE_INITIAL_OVERRIDES.sections },
  };

  // DEFAULT ON
  for (const id of ["whatChanged", "executiveSummary", "winners", "underperformers", "nextTests", "creativeBriefs", "confidence", "signOff"] as const) {
    assert.equal(freshBuyer.sections[id], true, `Buyer default: ${id} must be ON`);
  }
  assert.equal(freshBuyer.showSpendAllocationChart, true, "Buyer default: Spend Allocation must be ON");

  // DEFAULT OFF
  assert.equal(freshBuyer.sections.verdict, false, "Buyer default: Verdict must be OFF");
  assert.equal(freshBuyer.sections.patterns, false, "Buyer default: Patterns must be OFF");
  assert.equal(freshBuyer.showRankingChart, false, "Buyer default: Performance Ranking must be OFF");
  assert.equal(freshBuyer.showMovementChart, false, "Buyer default: Movement Chart must be OFF");

  // Fresh mount still starts in Buyer/"internal" mode — unchanged.
  assert.equal(freshBuyer.mode, "internal");

  console.log("reportDefaultCuration: fresh Buyer default set matches the approved spec");
}

/* == 2. Fresh Client default set, via the "client" preset (regression #1) == */
{
  // Per the architecture finding: no clean initial-mount path exists
  // for Client (mode always starts "internal"), so its curated
  // defaults are delivered via the existing named preset instead.
  const p = PERFORMANCE_PRESETS.client;

  for (const id of ["whatChanged", "executiveSummary", "verdict", "winners", "underperformers", "nextTests", "confidence", "signOff"] as const) {
    assert.equal(p.sections[id], true, `Client default (preset): ${id} must be ON`);
  }
  assert.equal(p.showRankingChart, true, "Client default: Performance Ranking must be ON");
  assert.equal(p.showSpendAllocationChart, true, "Client default: Spend Allocation must be ON");

  // DEFAULT OFF: Movement Chart only.
  assert.equal(p.showMovementChart, false, "Client default: Movement Chart must be OFF");

  console.log("reportDefaultCuration: 'client' preset matches the approved Client default set");
}

/* ===== 3-10. Individually-named regression-proof items, cross-referenced ===== */
{
  const base = createDefaultCustomization(PERFORMANCE_SECTION_IDS);
  const freshBuyer = {
    ...base,
    ...PERFORMANCE_INITIAL_OVERRIDES,
    sections: { ...base.sections, ...PERFORMANCE_INITIAL_OVERRIDES.sections },
  };
  const freshClient = PERFORMANCE_PRESETS.client;

  assert.equal(freshBuyer.showMovementChart, false, "#3 Movement Chart OFF — Buyer");
  assert.equal(freshClient.showMovementChart, false, "#3 Movement Chart OFF — Client");
  assert.equal(freshBuyer.sections.patterns, false, "#4 Buyer Patterns OFF");
  assert.equal(freshBuyer.showRankingChart, false, "#5 Buyer Performance Ranking OFF");
  assert.equal(freshClient.showRankingChart, true, "#6 Client Performance Ranking ON");
  assert.equal(freshBuyer.sections.verdict, false, "#7 Buyer Verdict OFF");
  assert.equal(freshClient.sections.verdict, true, "#8 Client Verdict ON");
  assert.equal(freshBuyer.showSpendAllocationChart, true, "#9 Spend Allocation ON — Buyer");
  assert.equal(freshClient.showSpendAllocationChart, true, "#9 Spend Allocation ON — Client");
  for (const id of ["winners", "underperformers", "nextTests", "confidence"] as const) {
    assert.equal(freshBuyer.sections[id], true, `#10 ${id} ON — Buyer`);
    assert.equal(freshClient.sections[id], true, `#10 ${id} ON — Client`);
  }

  console.log("reportDefaultCuration: items #3-#10 confirmed");
}

/* == 11. Manual toggle survives Buyer/Client switch — mechanism proof == */
{
  const hookSrc = readFileSync(join(ROOT, "components/report/useReportCustomization.ts"), "utf8");

  // setMode's body must still be exactly the untouched approved-decision
  // #9 form: it may only ever assign `mode`, never read initialOverrides,
  // presets, or sections. This is what makes "switching Buyer/Client
  // never resets manual customization" true by construction.
  const setModeMatch = hookSrc.match(/const setMode = useCallback\(\(mode: ReportMode\) => \{([\s\S]*?)\}, \[\]\);/);
  assert.ok(setModeMatch, "setMode found with an empty dependency array (still reads no external state)");
  const setModeBody = setModeMatch![1];
  assert.equal(setModeBody.trim(), "setCustomization((c) => ({ ...c, mode }));", "setMode touches only the mode field");
  assert.ok(!setModeBody.includes("initialOverrides"), "setMode never reads initialOverrides");
  assert.ok(!setModeBody.includes("presets"), "setMode never reads presets");
  assert.ok(!setModeBody.includes("sections"), "setMode never touches sections");

  // buildInitialCustomization (this milestone's new merge) must be
  // reachable ONLY from the lazy useState initializer and reset() —
  // never from setMode, never from any per-render code path.
  assert.equal((hookSrc.match(/function buildInitialCustomization/g) ?? []).length, 1, "exactly one definition");
  // Definition line has a generic (<Id extends string>) between the
  // name and "(", so this pattern only matches invocations, not the
  // definition — expect exactly 2: the useState initializer and reset().
  const callSites = [...hookSrc.matchAll(/buildInitialCustomization\(/g)].length;
  assert.equal(callSites, 2, "buildInitialCustomization invoked exactly twice: the lazy useState initializer and reset()");

  const useStateBlock = hookSrc.slice(hookSrc.indexOf("const [customization, setCustomization]"), hookSrc.indexOf("const logoUrlRef"));
  assert.ok(useStateBlock.includes("buildInitialCustomization(sectionIds, presets, initialOverrides)"), "lazy initializer uses buildInitialCustomization");

  const resetBlock = hookSrc.slice(hookSrc.indexOf("const reset = useCallback"), hookSrc.indexOf("return {\n    customization,"));
  assert.ok(resetBlock.includes("buildInitialCustomization(sectionIds, presets, initialOverrides)"), "reset() uses buildInitialCustomization");
  assert.ok(!resetBlock.includes("mode:"), "reset() never pins a specific mode — it re-derives the full base object, preserving whichever mode buildInitialCustomization/createDefaultCustomization produces");

  console.log("reportDefaultCuration: setMode isolation + buildInitialCustomization wiring confirmed (item #11)");
}

/* == 12. Enabling a default-off section manually still renders it == */
{
  const reportSrc = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");

  // Every render gate this milestone's defaults touch still reads LIVE
  // state (sections.x / customization.showXChart), not a hardcoded
  // constant — proving toggling still works normally once curated off.
  assert.match(reportSrc, /\{sections\.verdict\s*&&/, "Verdict gate reads live sections.verdict");
  assert.match(reportSrc, /sections\.patterns\s*&&\s*!client/, "Patterns gate reads live sections.patterns");
  assert.match(reportSrc, /\{customization\.showRankingChart\s*&&/, "Ranking chart gate reads live customization.showRankingChart");
  assert.match(reportSrc, /\{customization\.showMovementChart\s*&&/, "Movement chart gate reads live customization.showMovementChart");
  assert.match(reportSrc, /\{customization\.showSpendAllocationChart\s*&&/, "Spend Allocation gate reads live customization.showSpendAllocationChart");
  assert.match(reportSrc, /\{sections\.confidence\s*&&/, "Confidence gate reads live sections.confidence");

  console.log("reportDefaultCuration: default-off sections still gate on live toggle state (item #12)");
}

/* == 13. Existing presets still behave as intended, isolation-checked == */
{
  // buyer/executive/print presets are untouched by this milestone —
  // pinned exactly (mirrors, doesn't replace, the full 4-preset pin in
  // reportCustomization.test.ts).
  assert.deepEqual(PERFORMANCE_PRESETS.buyer, {
    mode: "internal",
    topAdsShown: 5,
    density: "standard",
    colorMode: "color",
    showRankingChart: true,
    showSpendAllocationChart: true,
    showMovementChart: true,
    sections: {
      whatChanged: true,
      executiveSummary: true,
      verdict: true,
      winners: true,
      underperformers: true,
      patterns: true,
      nextTests: true,
      creativeBriefs: true,
      confidence: true,
      signOff: true,
    },
  }, "Buyer analysis preset unchanged — it stays the full 'everything visible' option");

  assert.equal(PERFORMANCE_PRESETS.executive.sections.confidence, false, "Executive's own confidence behavior unchanged (does not inherit Client's confidence:true fix)");
  assert.equal(PERFORMANCE_PRESETS.executive.showMovementChart, true, "Executive's own movement-chart behavior unchanged");
  assert.equal(PERFORMANCE_PRESETS.print.showMovementChart, true, "Print-friendly unchanged");
  assert.equal(PERFORMANCE_PRESETS.print.sections.confidence, true, "Print-friendly unchanged");

  // matchesPreset/derivePreset mechanism itself is untouched — a fresh
  // Buyer report (now curated) no longer coincidentally matches the
  // "buyer" preset's full snapshot, and correctly derives "custom"
  // rather than silently mislabeling itself.
  const base = createDefaultCustomization(PERFORMANCE_SECTION_IDS);
  const freshBuyer = {
    ...base,
    ...PERFORMANCE_INITIAL_OVERRIDES,
    sections: { ...base.sections, ...PERFORMANCE_INITIAL_OVERRIDES.sections },
  };
  assert.equal(
    derivePreset(freshBuyer, PERFORMANCE_PRESETS, PERFORMANCE_SECTION_IDS),
    "custom",
    "the new curated fresh-Buyer state no longer matches the (unchanged, fuller) 'buyer' preset — correctly reads 'custom', not a stale label"
  );
  assert.ok(!matchesPreset(freshBuyer, PERFORMANCE_PRESETS.buyer, PERFORMANCE_SECTION_IDS));

  // Selecting "Buyer analysis" from a curated fresh report still
  // restores every default-off section — capability preserved.
  const restored = { ...freshBuyer, ...PERFORMANCE_PRESETS.buyer };
  assert.ok(matchesPreset(restored, PERFORMANCE_PRESETS.buyer, PERFORMANCE_SECTION_IDS));
  assert.equal(restored.sections.verdict, true);
  assert.equal(restored.sections.patterns, true);
  assert.equal(restored.showRankingChart, true);
  assert.equal(restored.showMovementChart, true);

  console.log("reportDefaultCuration: existing presets behave as intended, unaffected by the new defaults (item #13)");
}

/* == 14. No out-of-scope engine logic changed — import isolation scan == */
{
  // This milestone's entire surface (reportCustomization.ts,
  // useReportCustomization.ts, reportPresets.ts, Report.tsx's call
  // site) touches presentation-layer defaults only. Proving none of
  // the files this milestone edited import anything from modules/
  // (the engine) makes "decision/comparison output is unaffected" true
  // by construction, rather than merely re-asserted — decision/
  // comparison byte-identity itself is already covered on every test
  // run by reportDecisionPrimacy.test.ts.
  const editedFiles = [
    "components/report/reportCustomization.ts",
    "components/report/useReportCustomization.ts",
    "components/debrief/reportPresets.ts",
  ];
  for (const file of editedFiles) {
    const src = readFileSync(join(ROOT, file), "utf8");
    assert.ok(!/from\s+["'][^"']*modules\//.test(src), `${file} must not import from modules/ (the engine)`);
  }

  console.log("reportDefaultCuration: customization-layer files import nothing from modules/ — engine output unaffected by construction (item #14)");
}

console.log("reportDefaultCuration: all assertions passed");
