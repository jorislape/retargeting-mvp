/**
 * Creative Grouping V1 — integration proofs: the real compiled engine
 * end to end (CSV -> extractAds -> analyze -> summarizeCreativeGroups),
 * decision-blindness (byte-identical decision with/without declared
 * groups), and source-scans of the Report/Generator/memoToText wiring
 * — matching the established two-pronged pattern this codebase already
 * uses (e.g. reportDecisionPrimacy.test.ts) since there is no
 * component-render harness here.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const ROOT = join(import.meta.dirname, "..");

/* ===================== Real engine: end-to-end + decision byte-identity ===================== */
{
  const dist = mkdtempSync(join(tmpdir(), "debrief-creative-groups-"));
  try {
    execSync(
      `npx tsc modules/debrief/*.ts components/debrief/memoToText.ts --outDir ${JSON.stringify(dist)} --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck --rewriteRelativeImportExtensions`,
      { cwd: ROOT, stdio: "pipe" }
    );
    const { parseCsv, toTable } = require(join(dist, "modules/debrief/csv.js"));
    const { resolveColumns } = require(join(dist, "modules/debrief/columns.js"));
    const { extractAds, applyFormatOverrides } = require(join(dist, "modules/debrief/extract.js"));
    const { analyze } = require(join(dist, "modules/debrief/analysis.js"));
    const { generateMemo } = require(join(dist, "modules/debrief/memo.js"));
    const { summarizeCreativeGroups } = require(join(dist, "modules/debrief/creativeGroups.js"));
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
    // 6 judged ads (spend well past a 0.5x-mean-of-$300-ish floor) +
    // 1 thin-spend ad that should be set aside (never judged, so a
    // stray label on it must never inflate a group's tally).
    const csvText = `Ad name,Amount spent (USD),Purchases,Purchase ROAS (return on ad spend)
MorningA,400.00,10,4.00
MorningB,380.00,9,3.80
MorningC,360.00,8,1.00
TestimonialA,350.00,7,3.50
TestimonialB,340.00,6,1.20
Standalone,330.00,6,2.00
ThinSpendAd,5.00,1,9.00`;
    const { headers, rows } = toTable(parseCsv(csvText));
    const columns = resolveColumns(headers);
    const ads = extractAds(rows, columns, ctx.kpi);
    const analysis = analyze(ads, rows, columns, ctx);

    const declared = {
      MorningA: ["Morning routine"],
      MorningB: ["Morning routine"],
      MorningC: ["Morning routine"],
      TestimonialA: ["Testimonial"],
      // TestimonialB deliberately undeclared as "Testimonial" — only
      // TestimonialA carries it, so Testimonial must NOT repeat.
      ThinSpendAd: ["Morning routine"], // must be inert — never judged
    };

    const creativeGroups = summarizeCreativeGroups(analysis.rankedAds, declared);
    assert.ok(creativeGroups, "repeated-group evidence exists for this fixture");
    assert.equal(creativeGroups.groups.length, 1, "only 'Morning routine' repeats — 'Testimonial' has just 1 judged execution");
    const morning = creativeGroups.groups[0];
    assert.equal(morning.label, "Morning routine");
    assert.equal(morning.judgedCount, 3, "exactly 3 — the thin-spend ad's label never counts");
    assert.equal(morning.aboveCount + morning.atCount + morning.belowCount, 3, "tally sums to judgedCount");

    // Decision-blindness: build the memo/decision WITH and WITHOUT
    // creativeGroups attached — byte-identical either way, since
    // generateMemo already ran (and the decision was already
    // committed) before creativeGroups is ever computed, exactly
    // mirroring how `comparison` is proven decision-blind.
    const memoWithout = generateMemo(analysis, ctx);
    const memoWith = { ...generateMemo(analysis, ctx), creativeGroups };
    assert.deepEqual(memoWithout.decision, memoWith.decision, "decision is byte-identical whether or not creativeGroups is attached");
    assert.deepEqual(memoWithout.winners, memoWith.winners, "winners unaffected");
    assert.deepEqual(memoWithout.losers, memoWith.losers, "losers unaffected");
    assert.equal(memoWithout.creativeGroups, null, "generateMemo always sets creativeGroups: null on its own");

    // Copy/TXT: present when groups exist, absent when they don't —
    // and every judged member is listed (no "collapsed" concept in
    // plain text).
    const textWith = memoToText(memoWith, "buyer");
    assert.match(textWith, /CREATIVE GROUPS/);
    assert.match(textWith, /Morning routine/);
    assert.match(textWith, /3 judged executions/);
    for (const name of ["MorningA", "MorningB", "MorningC"]) {
      assert.ok(textWith.includes(name), `${name} is listed in the Copy/TXT member list`);
    }
    assert.ok(!textWith.includes("ThinSpendAd"), "the set-aside ad's label never appears in the group's member list");

    const textWithout = memoToText(memoWithout, "buyer");
    assert.ok(!textWithout.includes("CREATIVE GROUPS"), "no groups declared -> section omitted entirely from Copy/TXT, not an empty header");

    const clientText = memoToText(memoWith, "client");
    assert.match(clientText, /CREATIVE GROUPS/, "Client Copy/TXT also includes creative groups (Buyer+Client inclusion decision)");
    assert.match(clientText, /typical result/i, "Client register uses plain-language benchmark wording, not 'median'");

    console.log("creativeGroupsIntegration: real-engine end-to-end + decision byte-identity + Copy/TXT confirmed");

    /* ===== Identity-fix regression: real CSV, duplicate raw names, Ad ID present ===== */
    // Two rows share the raw name "UGC_V1" but carry distinct Ad IDs —
    // exactly the milestone's own example (same raw name, different
    // executions/results). Also proves the CSV path resolves an Ad ID
    // through the real columns.ts/extractAds pipeline, not a hand-built
    // fixture.
    const dupCsvText = `Ad name,Ad ID,Amount spent (USD),Purchases,Purchase ROAS (return on ad spend)
UGC_V1,ad_1,400.00,10,4.00
UGC_V1,ad_2,350.00,6,1.00
Solo,ad_3,330.00,6,2.00
SoloTwo,ad_4,320.00,5,1.10
ThinSpendAd,ad_5,5.00,1,9.00`;
    const dupTable = toTable(parseCsv(dupCsvText));
    const dupColumns = resolveColumns(dupTable.headers);
    const dupAds = extractAds(dupTable.rows, dupColumns, "roas");

    const ugc1 = dupAds.find((a: { sourceName?: string; name: string }) => a.sourceName === "UGC_V1" && a.name.endsWith("(row 2)"));
    const ugc2 = dupAds.find((a: { sourceName?: string; name: string }) => a.sourceName === "UGC_V1" && a.name.endsWith("(row 3)"));
    assert.ok(ugc1 && ugc2, "extract.ts's Duplicate Identity fix disambiguates both UGC_V1 rows");
    assert.equal(ugc1.id, "ad_1", "Ad ID survives disambiguation for the first duplicate row");
    assert.equal(ugc2.id, "ad_2", "Ad ID survives disambiguation for the second duplicate row");

    const dupAnalysis = analyze(dupAds, dupTable.rows, dupColumns, ctx);
    const dupDeclared = {
      // Keyed by Ad ID (the real, resolved identity) — different groups
      // for the two same-named executions, plus a second execution in
      // each group so both clear the repetition floor.
      ad_1: ["Morning routine"],
      ad_3: ["Morning routine"],
      ad_2: ["Testimonial"],
      ad_4: ["Testimonial"],
    };
    const dupGroups = summarizeCreativeGroups(dupAnalysis.rankedAds, dupDeclared);
    assert.equal(dupGroups.groups.length, 2, "two same-named executions correctly land in two different, independently-tallied groups via their real Ad IDs");
    const dupMorning = dupGroups.groups.find((g: { label: string }) => g.label === "Morning routine");
    const dupTestimonial = dupGroups.groups.find((g: { label: string }) => g.label === "Testimonial");
    assert.ok(dupMorning.members.some((m: { name: string }) => m.name === ugc1.name));
    assert.ok(!dupMorning.members.some((m: { name: string }) => m.name === ugc2.name), "the sibling same-named execution never leaks in via the real pipeline");
    assert.ok(dupTestimonial.members.some((m: { name: string }) => m.name === ugc2.name));

    console.log("creativeGroupsIntegration: real CSV with duplicate raw names + Ad IDs — independent group attachment confirmed end to end");

    /* ===== creativeFormatOverrides regression: duplicate-name behavior UNCHANGED ===== */
    // applyFormatOverrides is explicitly out of scope for this fix — it
    // must keep matching on sourceName ?? name (the raw, shared name),
    // so one override still applies to every row sharing that name.
    const overridden = applyFormatOverrides(dupAds, { UGC_V1: "video" });
    const ov1 = overridden.find((a: { name: string }) => a.name === ugc1.name);
    const ov2 = overridden.find((a: { name: string }) => a.name === ugc2.name);
    assert.deepEqual(ov1.nameTags, ["video"], "one raw-name-keyed override still applies to the first duplicate row");
    assert.deepEqual(ov2.nameTags, ["video"], "...and to the second duplicate row too — unchanged, sourceName-shared behavior");
    assert.equal(ov1.formatConfirmed, true);
    assert.equal(ov2.formatConfirmed, true);
    const soloOverridden = overridden.find((a: { name: string }) => a.name === "Solo");
    assert.equal(soloOverridden.formatConfirmed, undefined, "an unrelated ad is untouched");

    console.log("creativeGroupsIntegration: creativeFormatOverrides duplicate-name behavior confirmed unchanged (still keyed by sourceName ?? name)");
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
}

/* ===================== Report.tsx wiring ===================== */
{
  const reportSrc = readFileSync(join(ROOT, "components/debrief/Report.tsx"), "utf8");
  const evidenceIdx = reportSrc.indexOf("<CreativeEvidenceStrip");
  const groupsIdx = reportSrc.indexOf("<CreativeGroupsSection");
  const expertIdx = reportSrc.indexOf("<ExpertTakeBlock");
  assert.ok(evidenceIdx > 0 && groupsIdx > 0 && expertIdx > 0, "all three mount points found");
  assert.ok(evidenceIdx < groupsIdx, "CreativeGroupsSection mounts after CreativeEvidenceStrip");
  assert.ok(groupsIdx < expertIdx, "CreativeGroupsSection mounts before ExpertTakeBlock");
  assert.equal((reportSrc.match(/<CreativeGroupsSection/g) ?? []).length, 1, "mounted exactly once");

  // Not part of the Customize/report-numbering surface.
  const sectionsSrc = readFileSync(join(ROOT, "components/report/reportSections.ts"), "utf8");
  assert.ok(!sectionsSrc.includes("creativeGroups") && !sectionsSrc.includes("CreativeGroups"), "not added to PERFORMANCE_SECTION_IDS / the Customize toggle surface");
  const customizationSrc = readFileSync(join(ROOT, "components/report/reportCustomization.ts"), "utf8");
  assert.ok(!customizationSrc.toLowerCase().includes("creativegroup"), "reportCustomization.ts untouched by this milestone");
  const presetsSrc = readFileSync(join(ROOT, "components/debrief/reportPresets.ts"), "utf8");
  assert.ok(!presetsSrc.toLowerCase().includes("creativegroup"), "reportPresets.ts (Report Default Curation) untouched by this milestone");
  const numberingSrc = readFileSync(join(ROOT, "components/report/reportNumbering.ts"), "utf8");
  assert.ok(!numberingSrc.toLowerCase().includes("creativegroup"), "reportNumbering.ts untouched — the section is unnumbered, like Creative Evidence");

  console.log("creativeGroupsIntegration: Report.tsx mounts CreativeGroupsSection correctly, isolated from Customize/curation/numbering");
}

/* ===================== CreativeGroupsSection print/screen structure ===================== */
{
  const sectionSrc = readFileSync(join(ROOT, "components/debrief/CreativeGroupsSection.tsx"), "utf8");
  assert.match(sectionSrc, /print-avoid-break/, "the outer section (and each card) guards against ugly print splits");
  assert.match(sectionSrc, /print-hidden/, "the per-card disclosure toggle is print-hidden");
  assert.match(sectionSrc, /print-force-block/, "member execution lists reuse the established always-print-visible pattern (Next Tests Setup/Signals)");
  assert.match(sectionSrc, /useState\(false\)/, "each card's disclosure defaults to collapsed on screen");
  assert.ok(!sectionSrc.includes("<details"), "no native <details> — the empirically-confirmed print-omission bug is never reintroduced");
  assert.ok(!/\bwinning\b|\bcaused\b|\bproves\b/i.test(sectionSrc.replace(/\/\*[\s\S]*?\*\//g, "")), "no causal vocabulary in the component's own rendered strings (comments excluded)");

  console.log("creativeGroupsIntegration: CreativeGroupsSection's print/screen structure matches established, tested patterns");
}

/* ===================== Engine isolation: creativeGroups.ts imports nothing from decision.ts ===================== */
{
  const moduleSrc = readFileSync(join(ROOT, "modules/debrief/creativeGroups.ts"), "utf8");
  // Check actual import statements only — the module's own doc comment
  // legitimately DISCUSSES decision.ts/compare.ts/briefReadiness.ts/
  // evidenceDiagnostic.ts in prose to explain the isolation, which
  // would otherwise false-positive a bare substring check.
  const importLines = moduleSrc
    .split("\n")
    .filter((line) => /^\s*import\b/.test(line))
    .join("\n");
  assert.ok(!importLines.includes("decision"), "creativeGroups.ts never imports decision.ts");
  assert.ok(!importLines.includes("compare"), "creativeGroups.ts never imports compare.ts");
  assert.ok(!importLines.includes("briefReadiness") && !importLines.includes("evidenceDiagnostic"), "creativeGroups.ts never imports briefReadiness.ts/evidenceDiagnostic.ts");
  assert.match(importLines, /from "\.\/types"/, "the only import is the shared types module");

  const memoSrc = readFileSync(join(ROOT, "modules/debrief/memo.ts"), "utf8");
  assert.match(memoSrc, /creativeGroups: null/, "generateMemo sets creativeGroups: null unconditionally, exactly like comparison");
  assert.ok(!memoSrc.includes("summarizeCreativeGroups"), "generateMemo itself never calls the summarizer — the route attaches it afterward, same as comparison");

  const routeSrc = readFileSync(join(ROOT, "app/api/debrief/route.ts"), "utf8");
  const genMemoIdx = routeSrc.indexOf("generateMemo(analysis, context)");
  const summarizeIdx = routeSrc.indexOf("summarizeCreativeGroups(");
  assert.ok(genMemoIdx > 0 && summarizeIdx > genMemoIdx, "the route computes creativeGroups strictly AFTER generateMemo has already returned — the decision is committed first, by construction");

  console.log("creativeGroupsIntegration: engine isolation confirmed — creativeGroups.ts and its route wiring never touch decision.ts/compare.ts, and the decision is committed before creativeGroups exists");
}

/* ===================== GeneratorPanel / DebriefProvider wiring ===================== */
{
  const providerSrc = readFileSync(join(ROOT, "components/workspace/DebriefProvider.tsx"), "utf8");
  assert.match(providerSrc, /setCreativeGroups\(\{\}\)/, "creativeGroups is cleared somewhere (file change / reset)");
  assert.equal((providerSrc.match(/setCreativeGroups\(\{\}\)/g) ?? []).length, 2, "cleared in exactly two places: setFile and reset");
  // The word "localStorage" legitimately appears in comments explicitly
  // disclaiming its use (both pre-existing and this milestone's own) —
  // check for actual API usage instead.
  assert.ok(!/localStorage\.(setItem|getItem)/.test(providerSrc), "no localStorage read/write introduced by this milestone");
  assert.match(providerSrc, /body\.append\("creativeGroups"/, "creativeGroups is sent to the API only when non-empty, same contract as creativeFormatOverrides");

  const panelSrc = readFileSync(join(ROOT, "components/debrief/GeneratorPanel.tsx"), "utf8");
  assert.match(panelSrc, /function CreativeGroupsCell/, "the tagging widget exists");
  assert.match(panelSrc, /Creative groups \(optional\)/, "the column is clearly marked optional, matching the existing 'Creative image (optional)' convention");
  // GeneratorPanel.tsx already legitimately uses localStorage for the
  // separate, pre-existing, approved Competitor Watchlist V1 feature —
  // scope this check to the Creative Groups code specifically.
  const groupsCellSrc = panelSrc.slice(
    panelSrc.indexOf("function CreativeGroupsCell"),
    panelSrc.indexOf("function fmtBytes")
  );
  assert.ok(!groupsCellSrc.includes("localStorage"), "CreativeGroupsCell introduces no localStorage for group data");

  console.log("creativeGroupsIntegration: GeneratorPanel/DebriefProvider wiring confirmed, session-only (no localStorage)");
}

console.log("creativeGroupsIntegration: all assertions passed");
