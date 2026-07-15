/**
 * White-label Report Customization V1A — pure-logic proofs (plain
 * Node, no framework, no DOM). Covers reportSections.ts,
 * reportCustomization.ts, reportNumbering.ts, and logoValidation.ts.
 *
 * The centerpiece is the numbering cross-check: Report.tsx's OLD
 * numbering formula (secNum + marketShift + avoidShift, transcribed
 * verbatim below as an independent oracle) is compared against the
 * NEW computePerformanceSectionNumbers() across every
 * (view × hasMarket × hasAvoidBullets) combination, with every
 * section visible (the default/no-customization case) — proving the
 * refactor is byte-identical to today's shipped behavior BEFORE any
 * toggle capability is added on top of it.
 */
import assert from "node:assert/strict";
import {
  COMPETITOR_CLIENT_MODE_HIDDEN,
  COMPETITOR_SECTIONS,
  COMPETITOR_SECTION_IDS,
  PERFORMANCE_CLIENT_MODE_HIDDEN,
  PERFORMANCE_SECTIONS,
  PERFORMANCE_SECTION_IDS,
} from "../components/report/reportSections.ts";
import {
  ACCENT_PALETTE,
  DEFAULT_ACCENT_ID,
  accentCssVars,
  applyModeDefaults,
  createDefaultCustomization,
  createDefaultSections,
  getAccentById,
} from "../components/report/reportCustomization.ts";
import {
  PERFORMANCE_NUMBERED_ORDER,
  computePerformanceSectionNumbers,
  type PerformanceSectionVisibility,
} from "../components/report/reportNumbering.ts";
import { MAX_LOGO_BYTES, validateLogoFile } from "../components/report/logoValidation.ts";

/* ============================== reportSections.ts ========================== */

{
  // Exact task-specified lists, in the exact order given — order
  // matters for the checklist UI and, for Performance, for numbering.
  assert.deepEqual(PERFORMANCE_SECTION_IDS, [
    "executiveSummary",
    "verdict",
    "winners",
    "underperformers",
    "patterns",
    "nextTests",
    "creativeBriefs",
    "confidence",
    "signOff",
  ]);
  assert.deepEqual(COMPETITOR_SECTION_IDS, [
    "executiveSummary",
    "observedEvidence",
    "strategicPatterns",
    "strategicSummary",
    "whatStandsOut",
    "internalLearnings",
    "nextTests",
    "whatToMonitor",
    "sources",
    "footer",
  ]);
  assert.equal(PERFORMANCE_SECTIONS.length, 9);
  assert.equal(COMPETITOR_SECTIONS.length, 10);
  // Every descriptor has a non-empty, human-readable label.
  for (const s of [...PERFORMANCE_SECTIONS, ...COMPETITOR_SECTIONS]) {
    assert.ok(s.label.trim().length > 0, `${s.id} must have a label`);
  }
}

{
  // Client-mode-hidden lists only ever reference real section ids.
  for (const id of PERFORMANCE_CLIENT_MODE_HIDDEN) {
    assert.ok(PERFORMANCE_SECTION_IDS.includes(id), `${id} must be a real Performance section id`);
  }
  for (const id of COMPETITOR_CLIENT_MODE_HIDDEN) {
    assert.ok(COMPETITOR_SECTION_IDS.includes(id), `${id} must be a real Competitor section id`);
  }
}

/* ========================== reportCustomization.ts ========================= */

{
  // Exactly 4 curated options, no more, no fewer.
  assert.equal(ACCENT_PALETTE.length, 4);
  assert.deepEqual(
    ACCENT_PALETTE.map((a) => a.id),
    ["cyan", "cobalt", "violet", "slate"]
  );
}

{
  // "cyan" must stay byte-identical to today's existing hardcoded
  // values (globals.css --color-accent/--color-accent-soft and the
  // print-accent #0e7490) — the default/no-customization case must
  // never diverge from what's already shipped.
  const cyan = getAccentById("cyan");
  assert.equal(cyan.screen, "#38bdf8");
  assert.equal(cyan.screenSoft, "#7dd3fc");
  assert.equal(cyan.print, "#0e7490");
  assert.equal(DEFAULT_ACCENT_ID, "cyan");
}

{
  // No accent in the palette collides with win (emerald)/loss (red)/
  // warning (amber) semantics — a hard requirement, checked
  // programmatically rather than just by eye.
  const FORBIDDEN_HUE_FRAGMENTS = ["10b981", "059669", "047857", "ef4444", "dc2626", "b91c1c", "f59e0b", "d97706"];
  for (const accent of ACCENT_PALETTE) {
    for (const hex of [accent.screen, accent.screenSoft, accent.print]) {
      const normalized = hex.toLowerCase().replace("#", "");
      assert.ok(
        !FORBIDDEN_HUE_FRAGMENTS.includes(normalized),
        `${accent.id}'s ${hex} must not collide with a reserved win/loss/warning color`
      );
    }
  }
}

{
  // getAccentById falls back to the first (default) entry for an
  // unknown id rather than throwing or returning undefined — exercised
  // via a runtime-only value (e.g. malformed state) rather than a type
  // hole, so this stays valid TypeScript.
  const unknownId = "not-a-real-id" as unknown as import("../components/report/reportCustomization.ts").AccentId;
  const fallback = getAccentById(unknownId);
  assert.equal(fallback.id, "cyan");
}

{
  const vars = accentCssVars(getAccentById("violet"));
  assert.deepEqual(vars, {
    "--color-accent": "#a78bfa",
    "--color-accent-soft": "#c4b5fd",
    "--report-accent-print": "#6d28d9",
  });
}

{
  const sections = createDefaultSections(["a", "b", "c"] as const);
  assert.deepEqual(sections, { a: true, b: true, c: true });
}

{
  // The default customization object matches today's shipped
  // behavior exactly: no overrides, no logo, default accent, no date
  // override, "internal" mode (Report.tsx's existing `useState<ReportView>("buyer")`
  // default), every section visible.
  const def = createDefaultCustomization(PERFORMANCE_SECTION_IDS);
  assert.equal(def.agencyName, "");
  assert.equal(def.clientName, "");
  assert.equal(def.reportTitle, "");
  assert.equal(def.agencyLogo, null);
  assert.equal(def.accentId, "cyan");
  assert.equal(def.dateOverride, null);
  assert.equal(def.mode, "internal");
  assert.ok(Object.values(def.sections).every((v) => v === true));
  assert.equal(Object.keys(def.sections).length, 9);
}

{
  // "Internal buyer" mode -> every section visible (the all-visible
  // default). "Client-ready" -> the recommended-hidden set is hidden,
  // everything else stays visible.
  const internal = applyModeDefaults(PERFORMANCE_SECTION_IDS, "internal", PERFORMANCE_CLIENT_MODE_HIDDEN);
  assert.ok(Object.values(internal).every((v) => v === true));

  const client = applyModeDefaults(PERFORMANCE_SECTION_IDS, "client", PERFORMANCE_CLIENT_MODE_HIDDEN);
  assert.equal(client.patterns, false);
  assert.equal(client.confidence, false);
  for (const id of PERFORMANCE_SECTION_IDS) {
    if (!PERFORMANCE_CLIENT_MODE_HIDDEN.includes(id)) assert.equal(client[id], true, `${id} must stay visible`);
  }

  const competitorClient = applyModeDefaults(COMPETITOR_SECTION_IDS, "client", COMPETITOR_CLIENT_MODE_HIDDEN);
  assert.equal(competitorClient.internalLearnings, false);
  assert.equal(competitorClient.strategicPatterns, false);
  assert.equal(competitorClient.sources, false);
}

/* ============================== reportNumbering.ts ========================== */

/**
 * The OLD formula, transcribed verbatim from Report.tsx (pre-refactor)
 * as an independent oracle — NOT calling the new implementation. This
 * is what actually proves the refactor, rather than just re-asserting
 * the new function against itself.
 *   secNum(buyerN, clientN) = client ? clientN : buyerN, zero-padded
 *   marketShift = hasMarket ? 1 : 0
 *   avoidShift  = hasAvoid  ? 1 : 0
 *   verdict           = "01"                                   (always)
 *   winners           = "02"                                   (always)
 *   underperformers   = "03"                                   (always)
 *   market            = hasMarket ? "04" : null
 *   patterns          = client ? null : secNum(4+marketShift, 0)
 *   nextTests         = secNum(5+marketShift, 4+marketShift)
 *   whatNotToDo       = hasAvoid ? secNum(6+marketShift, 5+marketShift) : null
 *   confidence        = secNum(6+marketShift+avoidShift, 5+marketShift+avoidShift)
 */
function oldFormula(client: boolean, hasMarket: boolean, hasAvoid: boolean) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const secNum = (buyerN: number, clientN: number) => pad(client ? clientN : buyerN);
  const marketShift = hasMarket ? 1 : 0;
  const avoidShift = hasAvoid ? 1 : 0;
  return {
    verdict: "01",
    winners: "02",
    underperformers: "03",
    market: hasMarket ? "04" : null,
    patterns: client ? null : secNum(4 + marketShift, 0),
    nextTests: secNum(5 + marketShift, 4 + marketShift),
    whatNotToDo: hasAvoid ? secNum(6 + marketShift, 5 + marketShift) : null,
    confidence: secNum(6 + marketShift + avoidShift, 5 + marketShift + avoidShift),
  };
}

{
  // Exhaustive: all 8 (client × hasMarket × hasAvoid) combinations,
  // every toggleable section left at its default (visible) — this IS
  // the "no customization touched" case the regression test plan
  // calls for.
  for (const client of [false, true]) {
    for (const hasMarket of [false, true]) {
      for (const hasAvoid of [false, true]) {
        const expected = oldFormula(client, hasMarket, hasAvoid);
        const visibility: PerformanceSectionVisibility = {
          verdict: true,
          winners: true,
          underperformers: true,
          market: hasMarket,
          patterns: !client, // the existing view-gate, applied by the caller before calling the new function
          nextTests: true,
          whatNotToDo: hasAvoid,
          confidence: true,
        };
        const actual = computePerformanceSectionNumbers(visibility);
        assert.deepEqual(
          actual,
          expected,
          `mismatch for client=${client} hasMarket=${hasMarket} hasAvoid=${hasAvoid}`
        );
      }
    }
  }
  console.log("reportCustomization: numbering cross-check passed for all 8 default-state combinations");
}

{
  // New capability the old system couldn't do: hiding an
  // always-shown-before section (e.g. Winners) closes the gap instead
  // of leaving a hole.
  const visibility: PerformanceSectionVisibility = {
    verdict: true,
    winners: false, // hidden
    underperformers: true,
    market: false,
    patterns: false,
    nextTests: true,
    whatNotToDo: false,
    confidence: true,
  };
  const numbers = computePerformanceSectionNumbers(visibility);
  assert.equal(numbers.verdict, "01");
  assert.equal(numbers.winners, null);
  assert.equal(numbers.underperformers, "02", "closes the gap Winners left behind");
  assert.equal(numbers.nextTests, "03");
  assert.equal(numbers.confidence, "04");
}

{
  // All numbered sections hidden -> every value is null, no crash.
  const visibility: PerformanceSectionVisibility = {
    verdict: false,
    winners: false,
    underperformers: false,
    market: false,
    patterns: false,
    nextTests: false,
    whatNotToDo: false,
    confidence: false,
  };
  const numbers = computePerformanceSectionNumbers(visibility);
  assert.ok(Object.values(numbers).every((v) => v === null));
}

{
  // Order is fixed and matches Report.tsx's existing JSX order.
  assert.deepEqual(PERFORMANCE_NUMBERED_ORDER, [
    "verdict",
    "winners",
    "underperformers",
    "market",
    "patterns",
    "nextTests",
    "whatNotToDo",
    "confidence",
  ]);
}

/* ============================== logoValidation.ts ============================ */

{
  for (const type of ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]) {
    const result = validateLogoFile({ type, size: 1024, name: "logo.file" });
    assert.equal(result.ok, true, `${type} must be accepted`);
  }
}

{
  for (const type of ["application/pdf", "image/gif", "video/mp4", "text/plain", ""]) {
    const result = validateLogoFile({ type, size: 1024, name: "logo.file" });
    assert.equal(result.ok, false, `${type} must be rejected`);
    if (!result.ok) assert.ok(result.error.includes("logo.file"));
  }
}

{
  const atLimit = validateLogoFile({ type: "image/png", size: MAX_LOGO_BYTES, name: "a.png" });
  assert.equal(atLimit.ok, true, "exactly at the limit must be accepted");

  const overLimit = validateLogoFile({ type: "image/png", size: MAX_LOGO_BYTES + 1, name: "a.png" });
  assert.equal(overLimit.ok, false);
  if (!overLimit.ok) assert.ok(overLimit.error.includes("2.0 MB") || overLimit.error.includes("MB"));
}

{
  // Type is checked before size — a huge file with a bad type reports
  // the type problem, not a confusing size-only message.
  const result = validateLogoFile({ type: "application/pdf", size: MAX_LOGO_BYTES + 1000, name: "huge.pdf" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.error.includes("supported image type"));
}

console.log("reportCustomization: all assertions passed");
