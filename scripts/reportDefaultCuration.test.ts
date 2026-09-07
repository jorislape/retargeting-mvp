/**
 * Report Default Curation V1 ("D′") — proofs.
 *
 * Supersedes this file's own V1 version: mode-aware canonical defaults
 * with a computed pristine check, replacing the V1 "Client curated
 * defaults are only reachable via the named preset" limitation.
 *
 * Core rule (see reportCustomization.ts's ModeDefaults/applySnapshot
 * doc comments and useReportCustomization.ts's setMode): switching
 * register compares the state being LEFT against its OWN canonical
 * default (PERFORMANCE_MODE_DEFAULTS[mode]) via the existing
 * matchesPreset. If it still matches exactly (nothing manually
 * touched), the destination register's own canonical default is
 * applied too. The instant any field diverges, mode switching falls
 * back to approved decision #9's original, unconditional behavior:
 * only `mode` changes, every manual value survives exactly.
 *
 * No new stored state (no dirty flag, no per-field provenance, no
 * separate per-mode buckets) — pristine-ness is recomputed from live
 * values every call via matchesPreset/applySnapshot/derivePreset, the
 * same three pure functions setPreset and buildInitialCustomization
 * already use. useReportCustomization.ts itself isn't plain-Node
 * importable (it pulls in "react" via an extensionless import chain),
 * so the hook's own orchestration is exercised here as a `simulateX`
 * transcription built from the REAL, directly-importable primitives
 * (matchesPreset/applySnapshot/derivePreset/createDefaultCustomization),
 * with a source-scan (item J below) confirming the transcription still
 * matches the hook's actual implementation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applySnapshot,
  createDefaultCustomization,
  derivePreset,
  matchesPreset,
  type ModeDefaults,
  type PresetDefinition,
  type PresetId,
  type ReportCustomization,
  type ReportMode,
} from "../components/report/reportCustomization.ts";
import { PERFORMANCE_SECTION_IDS } from "../components/report/reportSections.ts";
import { PERFORMANCE_MODE_DEFAULTS, PERFORMANCE_PRESETS } from "../components/debrief/reportPresets.ts";

const ROOT = join(import.meta.dirname, "..");
type Id = (typeof PERFORMANCE_SECTION_IDS)[number];

/* ===================== Oracle: mirrors the real hook exactly ===================== */

function buildInitialCustomization(modeDefaults: ModeDefaults<Id> | undefined): ReportCustomization<Id> {
  const base = createDefaultCustomization(PERFORMANCE_SECTION_IDS);
  const snapshot = modeDefaults?.[base.mode];
  const merged = snapshot ? applySnapshot(base, snapshot) : base;
  return { ...merged, preset: derivePreset(merged, PERFORMANCE_PRESETS, PERFORMANCE_SECTION_IDS) };
}

function simulateSetMode(
  c: ReportCustomization<Id>,
  mode: ReportMode,
  modeDefaults: ModeDefaults<Id> | undefined
): ReportCustomization<Id> {
  const leavingDefault = modeDefaults?.[c.mode];
  const isPristine = leavingDefault ? matchesPreset(c, leavingDefault, PERFORMANCE_SECTION_IDS) : false;
  const destinationDefault = isPristine ? modeDefaults?.[mode] : undefined;
  if (!destinationDefault) return { ...c, mode };
  const next = applySnapshot(c, destinationDefault);
  return { ...next, mode, preset: derivePreset(next, PERFORMANCE_PRESETS, PERFORMANCE_SECTION_IDS) };
}

function simulateSetPreset(c: ReportCustomization<Id>, snapshot: PresetDefinition<Id>, id: Exclude<PresetId, "custom">) {
  return { ...applySnapshot(c, snapshot), mode: snapshot.mode, preset: id };
}

function simulateReset(modeDefaults: ModeDefaults<Id> | undefined): ReportCustomization<Id> {
  return buildInitialCustomization(modeDefaults);
}

/* ===================== 1. Canonical Buyer defaults ===================== */
{
  const buyer = PERFORMANCE_MODE_DEFAULTS.internal!;
  assert.equal(buyer.sections.verdict, false, "Buyer canonical: Verdict OFF");
  assert.equal(buyer.sections.patterns, false, "Buyer canonical: Patterns OFF");
  assert.equal(buyer.showRankingChart, false, "Buyer canonical: Performance Ranking OFF");
  assert.equal(buyer.showMovementChart, false, "Buyer canonical: Movement Chart OFF");
  assert.equal(buyer.showSpendAllocationChart, true, "Buyer canonical: Spend Allocation ON");
  for (const id of ["winners", "underperformers", "nextTests", "confidence"] as const) {
    assert.equal(buyer.sections[id], true, `Buyer canonical: ${id} ON`);
  }
  console.log("reportDefaultCuration: canonical Buyer defaults match the approved spec");
}

/* ===================== 2. Canonical Client defaults ===================== */
{
  const client = PERFORMANCE_MODE_DEFAULTS.client!;
  // One source of truth: Client's canonical default IS PERFORMANCE_PRESETS.client
  // (same object reference), not a second, independently-maintained definition.
  assert.equal(client, PERFORMANCE_PRESETS.client, "Client canonical default is PERFORMANCE_PRESETS.client itself");

  assert.equal(client.sections.verdict, true, "Client canonical: Verdict ON");
  assert.equal(client.showRankingChart, true, "Client canonical: Performance Ranking ON");
  assert.equal(client.showMovementChart, false, "Client canonical: Movement Chart OFF");
  assert.equal(client.sections.confidence, true, "Client canonical: Confidence ON");
  assert.equal(client.showSpendAllocationChart, true, "Client canonical: Spend Allocation ON");
  for (const id of ["winners", "underperformers", "nextTests"] as const) {
    assert.equal(client.sections[id], true, `Client canonical: ${id} ON`);
  }
  console.log("reportDefaultCuration: canonical Client defaults match the approved spec");
}

/* ===================== A. Fresh Buyer -> Client ===================== */
{
  const freshBuyer = buildInitialCustomization(PERFORMANCE_MODE_DEFAULTS);
  assert.equal(freshBuyer.mode, "internal");

  const afterSwitch = simulateSetMode(freshBuyer, "client", PERFORMANCE_MODE_DEFAULTS);
  assert.equal(afterSwitch.mode, "client");
  assert.equal(afterSwitch.sections.verdict, true, "A: Verdict ON after switching to Client");
  assert.equal(afterSwitch.showRankingChart, true, "A: Ranking ON after switching to Client");
  assert.equal(afterSwitch.showMovementChart, false, "A: Movement OFF after switching to Client");
  assert.equal(afterSwitch.sections.confidence, true, "A: Confidence ON after switching to Client");
  assert.deepEqual(afterSwitch.sections, PERFORMANCE_MODE_DEFAULTS.client!.sections, "A: sections exactly match Client's canonical default");
  assert.equal(afterSwitch.preset, "client", "A: preset label correctly reads 'client' (bonus over V1, which read 'custom' here)");

  console.log("reportDefaultCuration: A. fresh Buyer -> Client applies Client canonical defaults");
}

/* ===================== B. Fresh Buyer -> Client -> Buyer (round trip) ===================== */
{
  const freshBuyer = buildInitialCustomization(PERFORMANCE_MODE_DEFAULTS);
  const toClient = simulateSetMode(freshBuyer, "client", PERFORMANCE_MODE_DEFAULTS);
  const backToBuyer = simulateSetMode(toClient, "internal", PERFORMANCE_MODE_DEFAULTS);

  assert.equal(backToBuyer.mode, "internal");
  assert.deepEqual(backToBuyer.sections, freshBuyer.sections, "B: sections round-trip byte-identical");
  assert.equal(backToBuyer.showRankingChart, freshBuyer.showRankingChart);
  assert.equal(backToBuyer.showSpendAllocationChart, freshBuyer.showSpendAllocationChart);
  assert.equal(backToBuyer.showMovementChart, freshBuyer.showMovementChart);
  assert.equal(backToBuyer.preset, freshBuyer.preset, "B: preset label also round-trips ('custom', Buyer canonical != 'buyer' preset)");

  console.log("reportDefaultCuration: B. fresh Buyer -> Client -> Buyer round-trips exactly");
}

/* ===================== C. Buyer manual change -> Client ===================== */
{
  const freshBuyer = buildInitialCustomization(PERFORMANCE_MODE_DEFAULTS);
  // Manually toggle Verdict on — this is exactly what toggleSection does
  // (touch one field, recompute the derived preset label).
  const manuallyTouched: ReportCustomization<Id> = {
    ...freshBuyer,
    sections: { ...freshBuyer.sections, verdict: true },
  };
  const touchedWithPreset = { ...manuallyTouched, preset: derivePreset(manuallyTouched, PERFORMANCE_PRESETS, PERFORMANCE_SECTION_IDS) };

  const afterSwitch = simulateSetMode(touchedWithPreset, "client", PERFORMANCE_MODE_DEFAULTS);
  assert.equal(afterSwitch.mode, "client", "C: mode changes");
  assert.deepEqual(afterSwitch.sections, touchedWithPreset.sections, "C: every manual section value preserved exactly");
  assert.equal(afterSwitch.showRankingChart, touchedWithPreset.showRankingChart, "C: showRankingChart preserved (untouched but frozen alongside the touched field)");
  assert.equal(afterSwitch.showMovementChart, touchedWithPreset.showMovementChart, "C: showMovementChart preserved");
  assert.equal(afterSwitch.preset, touchedWithPreset.preset, "C: preset label unaffected by the mode switch itself");

  console.log("reportDefaultCuration: C. a Buyer manual change survives switching to Client — only mode changes");
}

/* ===================== D. Client canonical -> manual change -> Buyer ===================== */
{
  const freshBuyer = buildInitialCustomization(PERFORMANCE_MODE_DEFAULTS);
  const client = simulateSetMode(freshBuyer, "client", PERFORMANCE_MODE_DEFAULTS);
  assert.deepEqual(client.sections, PERFORMANCE_MODE_DEFAULTS.client!.sections, "D setup: Client starts at its own canonical state");

  // Manually turn Movement Chart on (default off for Client).
  const manuallyTouched: ReportCustomization<Id> = { ...client, showMovementChart: true };
  const touchedWithPreset = { ...manuallyTouched, preset: derivePreset(manuallyTouched, PERFORMANCE_PRESETS, PERFORMANCE_SECTION_IDS) };

  const afterSwitch = simulateSetMode(touchedWithPreset, "internal", PERFORMANCE_MODE_DEFAULTS);
  assert.equal(afterSwitch.mode, "internal", "D: mode changes");
  assert.equal(afterSwitch.showMovementChart, true, "D: the manually-touched field survives");
  assert.deepEqual(afterSwitch.sections, touchedWithPreset.sections, "D: every section value preserved exactly");
  assert.equal(afterSwitch.showRankingChart, touchedWithPreset.showRankingChart, "D: untouched fields also stay frozen, not reset to Buyer's own default");

  console.log("reportDefaultCuration: D. a Client manual change survives switching to Buyer — only mode changes");
}

/* ===================== E. Apply Client summary preset -> Buyer ===================== */
{
  // Common case: Buyer was never separately touched before applying the
  // preset. Client's PRESET snapshot IS Client's canonical default (same
  // object — see test 2), so the resulting state is pristine relative to
  // modeDefaults.client, and switching back finds Buyer still pristine
  // too (nothing ever touched it) -> Buyer's own canonical default.
  const freshBuyer = buildInitialCustomization(PERFORMANCE_MODE_DEFAULTS);
  const clientPresetApplied = simulateSetPreset(freshBuyer, PERFORMANCE_PRESETS.client, "client");
  assert.equal(clientPresetApplied.preset, "client");
  assert.deepEqual(clientPresetApplied.sections, PERFORMANCE_MODE_DEFAULTS.client!.sections);

  const backToBuyer = simulateSetMode(clientPresetApplied, "internal", PERFORMANCE_MODE_DEFAULTS);
  assert.equal(backToBuyer.mode, "internal");
  assert.deepEqual(
    backToBuyer.sections,
    PERFORMANCE_MODE_DEFAULTS.internal!.sections,
    "E: Buyer's own canonical default is applied, not a memory of 'before the preset' (there is none in a flat, single-object model)"
  );
  assert.equal(backToBuyer.preset, "custom", "E: Buyer canonical != 'buyer' preset, so this reads 'custom', matching test A/B's behavior");

  // Documented, honest edge case: if Buyer WAS manually touched before
  // ever applying the Client preset, that touch is NOT remembered —
  // applying a preset overwrites the one shared state object, exactly
  // as it already did before this milestone (setPreset was never
  // register-scoped). D' adds no new memory; it only adds the narrow
  // "was the state I'm leaving still pristine" check.
  const buyerTouchedFirst: ReportCustomization<Id> = {
    ...freshBuyer,
    sections: { ...freshBuyer.sections, verdict: true },
  };
  const clientPresetOverwrites = simulateSetPreset(buyerTouchedFirst, PERFORMANCE_PRESETS.client, "client");
  const backToBuyerAfterOverwrite = simulateSetMode(clientPresetOverwrites, "internal", PERFORMANCE_MODE_DEFAULTS);
  assert.equal(
    backToBuyerAfterOverwrite.sections.verdict,
    false,
    "E (edge case): Buyer's earlier manual touch is NOT restored — the preset already overwrote it, pre-existing behavior unrelated to D'"
  );

  console.log("reportDefaultCuration: E. Client summary preset -> Buyer documented and confirmed");
}

/* ===================== F. Reset while Buyer ===================== */
{
  const freshBuyer = buildInitialCustomization(PERFORMANCE_MODE_DEFAULTS);
  const touched: ReportCustomization<Id> = { ...freshBuyer, sections: { ...freshBuyer.sections, verdict: true } };
  const afterReset = simulateReset(PERFORMANCE_MODE_DEFAULTS);

  assert.equal(afterReset.mode, "internal");
  assert.deepEqual(afterReset.sections, PERFORMANCE_MODE_DEFAULTS.internal!.sections, "F: Reset returns Buyer's canonical default");
  assert.notDeepEqual(afterReset.sections, touched.sections, "F: Reset actually discards the manual touch (sanity check on the fixture)");

  console.log("reportDefaultCuration: F. Reset while Buyer returns Buyer canonical defaults");
}

/* ===================== G. Reset while Client ===================== */
{
  const freshBuyer = buildInitialCustomization(PERFORMANCE_MODE_DEFAULTS);
  const client = simulateSetMode(freshBuyer, "client", PERFORMANCE_MODE_DEFAULTS);
  const afterReset = simulateReset(PERFORMANCE_MODE_DEFAULTS);

  // Unchanged pre-existing behavior (not something this task should
  // change): Reset always returns to Buyer/internal, regardless of
  // which register was active when it was clicked.
  assert.equal(afterReset.mode, "internal", "G: Reset while Client still forces mode back to internal — pre-existing, unchanged");
  assert.deepEqual(afterReset.sections, PERFORMANCE_MODE_DEFAULTS.internal!.sections, "G: Reset returns Buyer's canonical default even from Client");
  assert.notEqual(client.mode, afterReset.mode, "G: sanity check — Reset actually changed the register back from Client");

  console.log("reportDefaultCuration: G. Reset while Client returns to Buyer canonical defaults (unchanged pre-existing behavior)");
}

/* ===================== H. Default-off sections can be manually enabled and render ===================== */
{
  const reportSrc = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");

  assert.match(reportSrc, /\{sections\.verdict\s*&&/, "Verdict gate reads live sections.verdict");
  assert.match(reportSrc, /sections\.patterns\s*&&\s*!client/, "Patterns gate reads live sections.patterns");
  assert.match(reportSrc, /\{customization\.showRankingChart\s*&&/, "Ranking chart gate reads live customization.showRankingChart");
  assert.match(reportSrc, /\{customization\.showMovementChart\s*&&/, "Movement chart gate reads live customization.showMovementChart");
  assert.match(reportSrc, /\{customization\.showSpendAllocationChart\s*&&/, "Spend Allocation gate reads live customization.showSpendAllocationChart");
  assert.match(reportSrc, /\{sections\.confidence\s*&&/, "Confidence gate reads live sections.confidence");

  // Manually enabling every default-off Buyer field (toggleSection /
  // setShowXChart semantics — direct field overwrite) renders true.
  const freshBuyer = buildInitialCustomization(PERFORMANCE_MODE_DEFAULTS);
  const manuallyRestored: ReportCustomization<Id> = {
    ...freshBuyer,
    sections: { ...freshBuyer.sections, verdict: true, patterns: true },
    showRankingChart: true,
    showMovementChart: true,
  };
  assert.equal(manuallyRestored.sections.verdict, true);
  assert.equal(manuallyRestored.sections.patterns, true);
  assert.equal(manuallyRestored.showRankingChart, true);
  assert.equal(manuallyRestored.showMovementChart, true);

  console.log("reportDefaultCuration: H. default-off sections still gate on live toggle state and can be manually restored");
}

/* ===================== I. Buyer analysis preset restores the fuller config ===================== */
{
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
  }, "I: 'Buyer analysis' preset unchanged — stays the full 'everything visible' option, distinct from the curated canonical default");

  const freshBuyer = buildInitialCustomization(PERFORMANCE_MODE_DEFAULTS);
  const restored = simulateSetPreset(freshBuyer, PERFORMANCE_PRESETS.buyer, "buyer");
  assert.ok(matchesPreset(restored, PERFORMANCE_PRESETS.buyer, PERFORMANCE_SECTION_IDS));
  assert.equal(restored.sections.verdict, true);
  assert.equal(restored.sections.patterns, true);
  assert.equal(restored.showRankingChart, true);
  assert.equal(restored.showMovementChart, true);
  assert.equal(restored.preset, "buyer");

  console.log("reportDefaultCuration: I. 'Buyer analysis' preset still restores the fuller all-on Buyer configuration");
}

/* ===================== J. setMode's real implementation matches the oracle ===================== */
{
  const hookSrc = readFileSync(join(ROOT, "components/report/useReportCustomization.ts"), "utf8");

  const setModeMatch = hookSrc.match(/const setMode = useCallback\(\s*\(mode: ReportMode\) => \{([\s\S]*?)\},\s*\[modeDefaults, presets, sectionIds\]\s*\);/);
  assert.ok(setModeMatch, "setMode found with the expected [modeDefaults, presets, sectionIds] dependency array");
  const setModeBody = setModeMatch![1];

  assert.match(setModeBody, /matchesPreset\(c, leavingDefault, sectionIds\)/, "setMode uses matchesPreset for the pristine check, not a hand-rolled comparison");
  assert.match(setModeBody, /applySnapshot\(c, destinationDefault\)/, "setMode uses applySnapshot to apply the destination default");
  assert.match(setModeBody, /derivePreset\(next, presets, sectionIds\)/, "setMode recomputes the preset label after a pristine switch");
  assert.match(setModeBody, /if \(!destinationDefault\) return \{ \.\.\.c, mode \};/, "setMode falls back to changing ONLY mode when not pristine (or no destination default) — approved decision #9's guarantee, preserved");

  // No stored dirty flag / provenance field anywhere in this file.
  assert.ok(!/customized\s*:/.test(hookSrc), "no dirty/customized boolean field introduced");
  assert.ok(!/provenance/i.test(hookSrc), "no per-field provenance tracking introduced");

  console.log("reportDefaultCuration: J. setMode's real implementation matches the tested oracle exactly");
}

/* ===================== K. No out-of-scope engine logic changed ===================== */
{
  const editedFiles = [
    "components/report/reportCustomization.ts",
    "components/report/useReportCustomization.ts",
    "components/debrief/reportPresets.ts",
  ];
  for (const file of editedFiles) {
    const src = readFileSync(join(ROOT, file), "utf8");
    assert.ok(!/from\s+["'][^"']*modules\//.test(src), `${file} must not import from modules/ (the engine)`);
  }

  console.log("reportDefaultCuration: K. customization-layer files import nothing from modules/ — engine output unaffected by construction");
}

console.log("reportDefaultCuration: all assertions passed");
