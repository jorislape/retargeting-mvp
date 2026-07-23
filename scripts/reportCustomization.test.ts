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
  derivePreset,
  getAccentById,
  matchesPreset,
  type ReportCustomization,
} from "../components/report/reportCustomization.ts";
import {
  PERFORMANCE_NUMBERED_ORDER,
  computePerformanceSectionNumbers,
  type PerformanceSectionVisibility,
} from "../components/report/reportNumbering.ts";
import { MAX_LOGO_BYTES, validateLogoFile } from "../components/report/logoValidation.ts";
import { readFileSync } from "node:fs";
import {
  PERFORMANCE_PRESET_OPTIONS,
  PERFORMANCE_PRESETS,
} from "../components/debrief/reportPresets.ts";

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
  // Report Foundation V1: the new fields, still matching today's shipped
  // behavior with zero divergence.
  assert.equal(def.topAdsShown, 5);
  assert.equal(def.density, "standard");
  assert.equal(def.colorMode, "color");
}

/* ======================= Report Foundation V1 ======================= */

{
  // The 4 named presets are EXACT, approved snapshots — every field,
  // not just a sample. This is the literal spec, byte for byte.
  const p = PERFORMANCE_PRESETS;

  assert.deepEqual(p.buyer, {
    mode: "internal",
    topAdsShown: 5,
    density: "standard",
    colorMode: "color",
    sections: {
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
  });

  assert.deepEqual(p.client, {
    mode: "client",
    topAdsShown: 3,
    density: "standard",
    colorMode: "color",
    sections: {
      executiveSummary: true,
      verdict: true,
      winners: true,
      underperformers: true,
      patterns: false,
      nextTests: true,
      creativeBriefs: false,
      confidence: false,
      signOff: true,
    },
  });

  assert.deepEqual(p.executive, {
    mode: "client",
    topAdsShown: 3,
    density: "compact",
    colorMode: "color",
    sections: {
      executiveSummary: true,
      verdict: true,
      winners: true,
      underperformers: false,
      patterns: false,
      nextTests: true,
      creativeBriefs: false,
      confidence: false,
      signOff: true,
    },
  });

  assert.deepEqual(p.print, {
    mode: "internal",
    topAdsShown: 5,
    density: "compact",
    colorMode: "grayscale",
    sections: {
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
  });

  // Test req #7 / #8, called out explicitly since they're the one
  // section-level difference that justifies Executive existing as its
  // own preset rather than "Client summary + compact":
  assert.equal(p.executive.sections.underperformers, false, "Executive hides underperformers");
  assert.equal(p.client.sections.underperformers, true, "Client summary shows underperformers");

  assert.equal(PERFORMANCE_PRESET_OPTIONS.length, 4);
  assert.deepEqual(
    PERFORMANCE_PRESET_OPTIONS.map((o) => o.id),
    ["buyer", "client", "executive", "print"]
  );
}

/** Builds a full ReportCustomization for the tests below — deliberately
 *  NOT createDefaultCustomization, so identity-field values are
 *  distinctive (not empty-string) and any accidental dependency on them
 *  would be obvious rather than silently passing. */
function customization(
  overrides: Partial<ReportCustomization<PerformanceIdForTests>> = {}
): ReportCustomization<PerformanceIdForTests> {
  return {
    agencyName: "Acme Agency",
    clientName: "Acme Client",
    reportTitle: "Q2 Report",
    agencyLogo: { url: "blob:x", name: "logo.png" },
    accentId: "violet",
    dateOverride: "2026-01-01",
    mode: "internal",
    sections: createDefaultSections(PERFORMANCE_SECTION_IDS),
    topAdsShown: 5,
    density: "standard",
    colorMode: "color",
    preset: "buyer",
    ...overrides,
  };
}
type PerformanceIdForTests = (typeof PERFORMANCE_SECTION_IDS)[number];

{
  // matchesPreset: every presentation field independently gates the
  // match; mode and every identity field are NEVER read.
  const base = customization();
  assert.ok(matchesPreset(base, PERFORMANCE_PRESETS.buyer, PERFORMANCE_SECTION_IDS), "default state matches Buyer analysis");

  assert.ok(!matchesPreset(customization({ topAdsShown: 3 }), PERFORMANCE_PRESETS.buyer, PERFORMANCE_SECTION_IDS), "topAdsShown divergence breaks the match");
  assert.ok(!matchesPreset(customization({ density: "compact" }), PERFORMANCE_PRESETS.buyer, PERFORMANCE_SECTION_IDS), "density divergence breaks the match");
  assert.ok(!matchesPreset(customization({ colorMode: "grayscale" }), PERFORMANCE_PRESETS.buyer, PERFORMANCE_SECTION_IDS), "colorMode divergence breaks the match");
  assert.ok(
    !matchesPreset(
      customization({ sections: { ...base.sections, patterns: false } }),
      PERFORMANCE_PRESETS.buyer,
      PERFORMANCE_SECTION_IDS
    ),
    "a single section toggle breaks the match"
  );

  // Test req #4 & approved decision #9: mode is NEVER part of the check.
  assert.ok(
    matchesPreset(customization({ mode: "client" }), PERFORMANCE_PRESETS.buyer, PERFORMANCE_SECTION_IDS),
    "mode alone never breaks a preset match"
  );

  // Test req #5: identity/branding fields are NEVER part of the check.
  assert.ok(
    matchesPreset(
      customization({ agencyName: "Someone Else", clientName: "Other Client", reportTitle: "Different Title", accentId: "slate", dateOverride: "2030-12-31" }),
      PERFORMANCE_PRESETS.buyer,
      PERFORMANCE_SECTION_IDS
    ),
    "identity/branding fields never break a preset match"
  );
}

{
  // derivePreset: the single source of truth, fixed order, "custom"
  // fallback. Exercised against the real PERFORMANCE_PRESETS table.
  assert.equal(derivePreset(customization(), PERFORMANCE_PRESETS, PERFORMANCE_SECTION_IDS), "buyer");
  assert.equal(
    derivePreset(
      customization({ mode: "client", topAdsShown: 3, sections: PERFORMANCE_PRESETS.client.sections }),
      PERFORMANCE_PRESETS,
      PERFORMANCE_SECTION_IDS
    ),
    "client"
  );
  assert.equal(
    derivePreset(
      customization({ mode: "client", topAdsShown: 3, density: "compact", sections: PERFORMANCE_PRESETS.executive.sections }),
      PERFORMANCE_PRESETS,
      PERFORMANCE_SECTION_IDS
    ),
    "executive"
  );
  assert.equal(
    derivePreset(
      customization({ density: "compact", colorMode: "grayscale" }),
      PERFORMANCE_PRESETS,
      PERFORMANCE_SECTION_IDS
    ),
    "print"
  );

  // Test req #2: any one field change from a named preset -> "custom".
  assert.equal(
    derivePreset(customization({ topAdsShown: 3 }), PERFORMANCE_PRESETS, PERFORMANCE_SECTION_IDS),
    "custom",
    "topAdsShown divergence -> custom"
  );
  assert.equal(
    derivePreset(customization({ density: "compact" }), PERFORMANCE_PRESETS, PERFORMANCE_SECTION_IDS),
    "custom",
    "density divergence -> custom"
  );
  assert.equal(
    derivePreset(customization({ colorMode: "grayscale" }), PERFORMANCE_PRESETS, PERFORMANCE_SECTION_IDS),
    "custom",
    "colorMode divergence -> custom"
  );
  assert.equal(
    derivePreset(
      customization({ sections: { ...customization().sections, confidence: false } }),
      PERFORMANCE_PRESETS,
      PERFORMANCE_SECTION_IDS
    ),
    "custom",
    "a section toggle -> custom"
  );

  // Test req #3: returning the exact snapshot restores the named preset
  // — proven by going custom, then back, in one sequence.
  const drifted = customization({ topAdsShown: 3 });
  assert.equal(derivePreset(drifted, PERFORMANCE_PRESETS, PERFORMANCE_SECTION_IDS), "custom");
  const restored = { ...drifted, topAdsShown: 5 as const };
  assert.equal(derivePreset(restored, PERFORMANCE_PRESETS, PERFORMANCE_SECTION_IDS), "buyer", "returning to the exact snapshot restores the preset name");

  // Test req #4: mode switching alone never changes the preset name.
  const clientPreviewOfBuyer = customization({ mode: "client" });
  assert.equal(
    derivePreset(clientPreviewOfBuyer, PERFORMANCE_PRESETS, PERFORMANCE_SECTION_IDS),
    "buyer",
    "previewing Client register while Buyer analysis is active stays named 'buyer'"
  );

  // Test req #5: branding/date changes never change the preset name.
  const rebranded = customization({ agencyName: "New Agency", clientName: "New Client", reportTitle: "New Title", accentId: "cobalt", dateOverride: "2027-06-15" });
  assert.equal(
    derivePreset(rebranded, PERFORMANCE_PRESETS, PERFORMANCE_SECTION_IDS),
    "buyer",
    "identity/branding changes never change the preset name"
  );

  // Test req #12: no presets table (Competitor Debrief's call site) ->
  // always "custom", regardless of state — never throws.
  assert.equal(derivePreset(customization(), undefined, PERFORMANCE_SECTION_IDS), "custom");
  assert.equal(derivePreset(customization({ mode: "client" }), {}, PERFORMANCE_SECTION_IDS), "custom");

  // createDefaultCustomization + a Competitor Debrief-shaped id set still
  // produces a complete, valid object — the same generic function both
  // report types call, unaffected by Performance-only preset knowledge.
  const competitorDefault = createDefaultCustomization(COMPETITOR_SECTION_IDS);
  assert.equal(Object.keys(competitorDefault.sections).length, 10);
  assert.equal(competitorDefault.topAdsShown, 5);
  assert.equal(competitorDefault.density, "standard");
  assert.equal(competitorDefault.colorMode, "color");
}

{
  // Grayscale correction: the on-screen preview was removed (it read as
  // an unfinished print-CSS mirror, not a polished theme) — .report-
  // grayscale must be gone from globals.css entirely, and the existing
  // @media print stylesheet must be provably unchanged (colorMode still
  // exists as an internal, preset-scoped field — Print-friendly still
  // sets it "grayscale" for preset matching — but nothing renders it).
  // Textual/structural, matching how the rest of this print system has
  // no rendered-DOM test anywhere in this repo.
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf-8");
  assert.ok(!css.includes("report-grayscale"), "the on-screen grayscale preview class must not exist");
  assert.ok(css.includes("@media print"), "the print stylesheet still exists");
  assert.ok(css.includes("body .print-win"), "print stylesheet's own win rule is untouched");
  assert.equal((css.match(/@media print/g) ?? []).length, 1, "exactly one @media print block — not split around a since-removed insertion");

  // The panel must not expose a Color/Grayscale control or any call
  // into a setColorMode action — colorMode is preset-internal only now.
  const panelSrc = readFileSync(
    new URL("../components/report/ReportCustomizationPanel.tsx", import.meta.url),
    "utf-8"
  );
  assert.ok(!panelSrc.includes("setColorMode"), "the panel must not call setColorMode");
  assert.ok(!/color\s*mode/i.test(panelSrc), "the panel must not label a Color mode control");

  const hookSrc = readFileSync(
    new URL("../components/report/useReportCustomization.ts", import.meta.url),
    "utf-8"
  );
  assert.ok(!/\bsetColorMode\b/.test(hookSrc.replace(/\/\*[\s\S]*?\*\//g, "")), "no setColorMode implementation or export (comments excluded)");
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
