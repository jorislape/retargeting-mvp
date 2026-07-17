/**
 * Focused UI/state-derivation proofs for CompetitorDebriefPanel.tsx's
 * page-dump review UI (plain Node, no framework, no DOM). The panel
 * itself is a "use client" .tsx component and can't be imported by
 * Node's type-stripping test runner (JSX isn't stripped, only types) —
 * so the logic that actually decides what renders and what reaches the
 * generate payload was factored into components/competitorDebrief/
 * pageDumpReview.ts specifically so it has real regression coverage
 * here, not just manual dev-server verification.
 */
import assert from "node:assert/strict";
import {
  blocksGenerateForAttribution,
  computeAdvertiserSummary,
  computeBlockIndexById,
  computePageDumpLiveStats,
  computeRenderItems,
  countManuallyIncludedNonMatches,
  hasAnyCapturedPageName,
  hasMatchingAdvertiser,
  hasPageDumpBlocks,
  isBlockIncludedForGenerate,
  recomputeLiveAttribution,
  type AdBlock,
} from "../components/competitorDebrief/pageDumpReview.ts";
import { parseAdExample } from "../modules/competitorDebrief/adParser.ts";

let id = 1;
function manualBlock(raw: string): AdBlock {
  return { id: id++, parsed: parseAdExample(raw) };
}
function pageDumpBlock(
  raw: string,
  opts: {
    included: boolean;
    variantGroupId?: number | null;
    boundaryConfidence?: "high" | "medium" | "low";
    pageName?: string | null;
    advertiserAttribution?: "match" | "mismatch" | "unknown";
  }
): AdBlock {
  return {
    id: id++,
    parsed: parseAdExample(raw),
    pageDumpMeta: {
      boundaryConfidence: opts.boundaryConfidence ?? "high",
      variantGroupId: opts.variantGroupId ?? null,
      included: opts.included,
      pageName: opts.pageName ?? null,
      advertiserAttribution: opts.advertiserAttribution ?? "unknown",
    },
  };
}

/* ========================= isBlockIncludedForGenerate ===================== */

{
  // Manual-flow blocks (no pageDumpMeta at all) are always included —
  // this is the "no-op for the manual flow" guarantee handleGenerate
  // and usableAdCount both depend on.
  const manual = manualBlock("Some ad.\nShop Now");
  assert.equal(isBlockIncludedForGenerate(manual), true);
}

{
  const included = pageDumpBlock("Ad A.\nShop Now", { included: true });
  const excluded = pageDumpBlock("Ad B.\nShop Now", { included: false });
  assert.equal(isBlockIncludedForGenerate(included), true);
  assert.equal(isBlockIncludedForGenerate(excluded), false);
}

/* ============================== computeRenderItems ========================= */

{
  // No groups at all: every block renders as its own "single" item, in
  // original order — this must hold for the untouched manual flow too.
  const blocks = [manualBlock("Ad one.\nShop Now"), manualBlock("Ad two.\nLearn More")];
  const items = computeRenderItems(blocks);
  assert.equal(items.length, 2);
  assert.ok(items.every((i) => i.type === "single"));
}

{
  // A variant group renders ONCE, at the position of its first member —
  // later members are absorbed into that group, not rendered again as
  // their own top-level item.
  const a = pageDumpBlock("Variant A.\nShop Now", { included: true, variantGroupId: 5 });
  const b = manualBlock("Unrelated single ad.\nLearn More");
  const c = pageDumpBlock("Variant C.\nShop Now", { included: false, variantGroupId: 5 });
  const items = computeRenderItems([a, b, c]);
  assert.equal(items.length, 2, "the group counts as one item, not two");
  assert.equal(items[0].type, "group");
  if (items[0].type === "group") {
    assert.equal(items[0].groupId, 5);
    assert.deepEqual(
      items[0].members.map((m) => m.id),
      [a.id, c.id],
      "both group members are carried inside the group, in original order"
    );
  }
  assert.equal(items[1].type, "single");
  if (items[1].type === "single") assert.equal(items[1].block.id, b.id);
}

{
  // Two DIFFERENT groups stay separate, each rendered once.
  const a1 = pageDumpBlock("A1.\nShop Now", { included: true, variantGroupId: 1 });
  const a2 = pageDumpBlock("A2.\nShop Now", { included: false, variantGroupId: 1 });
  const b1 = pageDumpBlock("B1.\nLearn More", { included: true, variantGroupId: 2 });
  const b2 = pageDumpBlock("B2.\nLearn More", { included: false, variantGroupId: 2 });
  const items = computeRenderItems([a1, b1, a2, b2]); // interleaved on purpose
  assert.equal(items.length, 2);
  assert.ok(items.every((i) => i.type === "group"));
}

{
  // Removing a block (simulating the "Remove" button) never leaves a
  // stale/ghost group behind — recomputing from the new list is enough.
  const a = pageDumpBlock("A.\nShop Now", { included: true, variantGroupId: 9 });
  // b (also variantGroupId 9) has already been "removed" — never added
  // to the list passed below — simulating the Remove button.
  const afterRemovingB = computeRenderItems([a]);
  assert.equal(afterRemovingB.length, 1);
  assert.equal(afterRemovingB[0].type, "single", "a lone remaining group member renders as a plain single, not a 1-member group");
}

/* ============================== computeBlockIndexById ======================= */

{
  const blocks = [manualBlock("One.\nShop Now"), manualBlock("Two.\nLearn More"), manualBlock("Three.\nGet Started")];
  const indexById = computeBlockIndexById(blocks);
  blocks.forEach((b, i) => assert.equal(indexById.get(b.id), i));
}

/* =========================== computePageDumpLiveStats ======================= */

{
  // Live stats reflect CURRENT state, not a frozen "at processing time"
  // snapshot — this is what lets the summary bar update as the user
  // checks/unchecks boxes or removes a block.
  const a = pageDumpBlock("A.\nShop Now", { included: true, variantGroupId: 1, boundaryConfidence: "high" });
  const b = pageDumpBlock("B.\nShop Now", { included: false, variantGroupId: 1, boundaryConfidence: "high" });
  const c = pageDumpBlock("C entirely different ad.\nLearn More", { included: true, boundaryConfidence: "medium" });
  const d = pageDumpBlock("D another different ad again.\nGet Started", { included: true, boundaryConfidence: "low" });
  const blocks = [a, b, c, d];
  const indexById = computeBlockIndexById(blocks);
  const renderItems = computeRenderItems(blocks);
  const duplicateIndices: (number | null)[] = [null, null, null, null]; // no exact dupes in this fixture

  const stats = computePageDumpLiveStats(blocks, indexById, duplicateIndices, renderItems);
  assert.equal(stats.variantGroupCount, 1);
  assert.equal(stats.includedCount, 3, "a, c, d are included; b is not");
  assert.deepEqual(stats.confidenceCounts, { high: 2, medium: 1, low: 1 });
  assert.equal(stats.exactDuplicateCount, 0);
}

{
  // Exact-duplicate count is read from the SAME duplicateIndices array
  // the existing "Duplicate of Ad N" badge uses — not recomputed here —
  // so the two can never disagree.
  const a = pageDumpBlock("Same text.\nShop Now", { included: true });
  const b = pageDumpBlock("Same text.\nShop Now", { included: false });
  const blocks = [a, b];
  const indexById = computeBlockIndexById(blocks);
  const renderItems = computeRenderItems(blocks);
  const duplicateIndices: (number | null)[] = [null, 0]; // b duplicates a (index 0)
  const stats = computePageDumpLiveStats(blocks, indexById, duplicateIndices, renderItems);
  assert.equal(stats.exactDuplicateCount, 1);
}

{
  // Manual-flow-only blocks (no pageDumpMeta at all) contribute nothing
  // to the page-dump stats — the summary bar only describes page-dump
  // candidates, even if a manual block happens to be present too.
  const manual = manualBlock("Manually typed ad.\nShop Now");
  const dumped = pageDumpBlock("Dumped ad.\nLearn More", { included: true, boundaryConfidence: "medium" });
  const blocks = [manual, dumped];
  const indexById = computeBlockIndexById(blocks);
  const renderItems = computeRenderItems(blocks);
  const stats = computePageDumpLiveStats(blocks, indexById, [null, null], renderItems);
  assert.equal(stats.includedCount, 1);
  assert.deepEqual(stats.confidenceCounts, { high: 0, medium: 1, low: 0 });
}

/* =============== end-to-end state shape: raw dump -> review -> generate payload ============= */

{
  // Simulates the exact sequence handleProcessPageDump ->
  // toggleBlockIncluded -> handleGenerate's activeBlocks filter go
  // through, without React: candidates arrive with a default selection,
  // the user re-includes one non-default variant and excludes a
  // default one, and only the FINAL included set would reach the
  // generate payload.
  const representative = pageDumpBlock("Struggling with dry skin? Our balm fixes that.\nShop Now", {
    included: true,
    variantGroupId: 1,
  });
  const variant = pageDumpBlock("Struggling with dry skin? Our balm fixes it fast.\nShop Now", {
    included: false,
    variantGroupId: 1,
  });
  const distinctAd = pageDumpBlock("New to skincare? Start simple.\nLearn More", { included: true });
  let blocks: AdBlock[] = [representative, variant, distinctAd];

  // Default state: 2 included (representative + distinctAd), 1 excluded (variant).
  assert.deepEqual(blocks.filter(isBlockIncludedForGenerate).map((b) => b.id), [representative.id, distinctAd.id]);

  // User expands the group and re-includes the variant, and separately
  // excludes the original representative.
  blocks = blocks.map((b) =>
    b.id === variant.id && b.pageDumpMeta
      ? { ...b, pageDumpMeta: { ...b.pageDumpMeta, included: true } }
      : b.id === representative.id && b.pageDumpMeta
        ? { ...b, pageDumpMeta: { ...b.pageDumpMeta, included: false } }
        : b
  );

  const finalIncluded = blocks.filter(isBlockIncludedForGenerate).map((b) => b.id);
  assert.deepEqual(finalIncluded, [variant.id, distinctAd.id], "the user's manual re-inclusion/exclusion is respected exactly");
}

/* ========== Competitor Input Trust V2 Checkpoint 2: attribution gating (review state) ======== */

/* ---- hasPageDumpBlocks / hasMatchingAdvertiser / blocksGenerateForAttribution ---- */

{
  // (12) Individual-ad mode remains byte-for-byte behaviorally
  // unchanged: an all-manual block list never carries pageDumpMeta, so
  // none of the three new helpers can ever fire for it — the
  // attribution-blocking rule is a true no-op for the manual flow.
  const blocks = [manualBlock("Ad one.\nShop Now"), manualBlock("Ad two.\nLearn More")];
  assert.equal(hasPageDumpBlocks(blocks), false);
  assert.equal(hasMatchingAdvertiser(blocks), false);
  assert.equal(blocksGenerateForAttribution(blocks), false, "manual flow never gets blocked by attribution");
}

{
  // A page-dump session with at least one match: not blocked.
  const match = pageDumpBlock("Matching ad.\nShop Now", { included: true, advertiserAttribution: "match" });
  const mismatch = pageDumpBlock("Foreign ad.\nLearn More", { included: false, advertiserAttribution: "mismatch" });
  const blocks = [match, mismatch];
  assert.equal(hasPageDumpBlocks(blocks), true);
  assert.equal(hasMatchingAdvertiser(blocks), true);
  assert.equal(blocksGenerateForAttribution(blocks), false, "at least one match exists — Generate is not blocked");
}

{
  // A page-dump session with zero matches (all mismatch/unknown):
  // blocked, regardless of each block's CURRENT included state — this
  // is what makes rule B unconditional rather than something a manual
  // checkbox toggle can route around.
  const mismatch = pageDumpBlock("Foreign ad.\nLearn More", { included: true, advertiserAttribution: "mismatch" });
  const unknown = pageDumpBlock("Unattributed ad.\nGet Started", { included: true, advertiserAttribution: "unknown" });
  const blocks = [mismatch, unknown];
  assert.equal(hasMatchingAdvertiser(blocks), false);
  assert.equal(
    blocksGenerateForAttribution(blocks),
    true,
    "zero match candidates — blocked even though both are currently manually included"
  );
}

/* ---- (10)/(11) default payload never contains mismatch/unknown; manual re-inclusion works ---- */

{
  // Simulates the exact sequence handleProcessPageDump ->
  // (Checkpoint 2 default selection) -> handleGenerate's activeBlocks
  // filter, without React. Mirrors the manual-toggle simulation already
  // proven above for variant groups, now for attribution.
  const match = pageDumpBlock("Tired of dull skin? Our Vitamin C serum brightens in 2 weeks.\nShop Now", {
    included: true, // Checkpoint 2 default: match candidates start included
    advertiserAttribution: "match",
  });
  const mismatch = pageDumpBlock("Ditch the sticky serums. Our lightweight oil absorbs instantly.\nLearn More", {
    included: false, // Checkpoint 2 default: mismatch candidates start excluded
    advertiserAttribution: "mismatch",
  });
  const unknown = pageDumpBlock("Some ad with no recognizable advertiser line at all.\nGet Started", {
    included: false, // Checkpoint 2 default: unknown candidates start excluded
    advertiserAttribution: "unknown",
  });
  let blocks: AdBlock[] = [match, mismatch, unknown];

  // (11) Default payload proof: only the match candidate is included —
  // mismatch and unknown never appear in the derived payload by default.
  const defaultIncluded = blocks.filter(isBlockIncludedForGenerate).map((b) => b.id);
  assert.deepEqual(defaultIncluded, [match.id], "default payload contains only the match candidate");

  // (10) User manually checks the mismatch candidate's box.
  blocks = blocks.map((b) =>
    b.id === mismatch.id && b.pageDumpMeta ? { ...b, pageDumpMeta: { ...b.pageDumpMeta, included: true } } : b
  );
  const afterManualInclude = blocks.filter(isBlockIncludedForGenerate).map((b) => b.id);
  assert.deepEqual(
    afterManualInclude,
    [match.id, mismatch.id],
    "manually checking a mismatch candidate causes it to enter the derived payload — explicit user action, not a default"
  );
  // The still-excluded unknown candidate proves this was a targeted,
  // per-block change, not a blanket re-inclusion of everything.
  assert.ok(!afterManualInclude.includes(unknown.id), "the untouched unknown candidate remains excluded");
}

/* ================= Competitor Input Trust V2 Checkpoint 3 ================= */

/* ---- computeAdvertiserSummary ---- */

{
  // (13) Summary counts for match/mismatch/unknown, including
  // includedCount reflecting current (not default) inclusion, and
  // pageNames deduped per group. Always returns all three groups, even
  // when a group's count is 0 (unknown, here) — the panel filters
  // zero-count groups at render time, not this helper.
  const match1 = pageDumpBlock("Match one.\nShop Now", {
    included: true,
    advertiserAttribution: "match",
    pageName: "Brand Name",
  });
  const match2 = pageDumpBlock("Match two.\nShop Now", {
    included: true,
    advertiserAttribution: "match",
    pageName: "Brand Name",
  });
  const mismatch = pageDumpBlock("Foreign ad.\nLearn More", {
    included: false,
    advertiserAttribution: "mismatch",
    pageName: "Some Other Brand",
  });
  const blocks = [match1, match2, mismatch];
  const summary = computeAdvertiserSummary(blocks);
  const byStatus = new Map(summary.map((g) => [g.status, g]));
  assert.equal(byStatus.get("match")?.count, 2);
  assert.equal(byStatus.get("match")?.includedCount, 2);
  assert.deepEqual(byStatus.get("match")?.pageNames, ["Brand Name"]);
  assert.equal(byStatus.get("mismatch")?.count, 1);
  assert.equal(byStatus.get("mismatch")?.includedCount, 0);
  assert.deepEqual(byStatus.get("mismatch")?.pageNames, ["Some Other Brand"]);
  assert.equal(byStatus.get("unknown")?.count, 0, "unknown group still present, just empty");
  assert.deepEqual(byStatus.get("unknown")?.pageNames, []);
}

/* ---- countManuallyIncludedNonMatches ---- */

{
  // (14) Only counts CURRENTLY included mismatch/unknown blocks — a
  // match candidate being included doesn't count, and a mismatch/unknown
  // candidate left at its default excluded state doesn't count either.
  const match = pageDumpBlock("Match ad.\nShop Now", { included: true, advertiserAttribution: "match" });
  const mismatchIncluded = pageDumpBlock("Foreign ad, manually included.\nLearn More", {
    included: true,
    advertiserAttribution: "mismatch",
  });
  const mismatchExcluded = pageDumpBlock("Foreign ad, left excluded.\nLearn More", {
    included: false,
    advertiserAttribution: "mismatch",
  });
  const unknownIncluded = pageDumpBlock("Unattributed ad, manually included.\nGet Started", {
    included: true,
    advertiserAttribution: "unknown",
  });
  const blocks = [match, mismatchIncluded, mismatchExcluded, unknownIncluded];
  assert.equal(countManuallyIncludedNonMatches(blocks), 2);

  // Manual flow: always 0, since manual blocks never carry pageDumpMeta.
  assert.equal(countManuallyIncludedNonMatches([manualBlock("Ad.\nShop Now")]), 0);
}

/* ---- hasAnyCapturedPageName ---- */

{
  // (15) No page names captured at all — every page-dump block has a
  // null pageName (the paste had no recognizable Ads Library chrome at
  // all), distinguishing this from "some names captured, none matched."
  const noNamesBlocks = [
    pageDumpBlock("Ad with no chrome.\nShop Now", { included: true, advertiserAttribution: "unknown", pageName: null }),
    pageDumpBlock("Another ad with no chrome.\nLearn More", {
      included: true,
      advertiserAttribution: "unknown",
      pageName: null,
    }),
  ];
  assert.equal(hasAnyCapturedPageName(noNamesBlocks), false);

  const someNamesBlocks = [
    ...noNamesBlocks,
    pageDumpBlock("Ad with chrome.\nGet Started", {
      included: false,
      advertiserAttribution: "mismatch",
      pageName: "Some Other Brand",
    }),
  ];
  assert.equal(hasAnyCapturedPageName(someNamesBlocks), true);

  // Manual flow: always false.
  assert.equal(hasAnyCapturedPageName([manualBlock("Ad.\nShop Now")]), false);
}

/* ---- recomputeLiveAttribution + blocksGenerateForAttribution together ---- */

{
  // (16) Alias change recomputes match and unblocks: a candidate whose
  // frozen pageName is "lululemon Europe" was classified "mismatch" at
  // extraction time (competitorName was just "Lululemon"). Adding the
  // alias "lululemon Europe" and recomputing must flip it live to
  // "match" and unblock Generate — without needing to re-extract.
  const regional = pageDumpBlock("Euro-exclusive drop.\nShop Now", {
    included: false,
    advertiserAttribution: "mismatch",
    pageName: "lululemon Europe",
  });
  let blocks: AdBlock[] = [regional];

  assert.equal(blocksGenerateForAttribution(blocks), true, "no alias yet — still blocked");

  blocks = recomputeLiveAttribution(blocks, "Lululemon", []);
  assert.equal(
    blocks[0].pageDumpMeta?.advertiserAttribution,
    "mismatch",
    "recompute with no alias yet leaves it a mismatch"
  );
  assert.equal(blocksGenerateForAttribution(blocks), true, "still blocked before the alias is added");

  blocks = recomputeLiveAttribution(blocks, "Lululemon", ["lululemon Europe"]);
  assert.equal(blocks[0].pageDumpMeta?.advertiserAttribution, "match", "alias resolves the regional page to a match");
  assert.equal(blocksGenerateForAttribution(blocks), false, "alias resolves the match — Generate unblocks immediately");

  // included (the checkbox state) is deliberately untouched by the
  // recompute — only re-running "Extract ads" changes default selection.
  assert.equal(blocks[0].pageDumpMeta?.included, false, "recompute never auto-checks a box");

  // Recompute is a no-op (same reference) when attribution hasn't
  // actually changed, and a true no-op for manual-flow blocks.
  const stable = recomputeLiveAttribution(blocks, "Lululemon", ["lululemon Europe"]);
  assert.equal(stable[0], blocks[0], "recompute returns the same object reference when nothing changed");
  const manual = [manualBlock("Ad.\nShop Now")];
  assert.equal(recomputeLiveAttribution(manual, "Anything", [])[0], manual[0]);
}

/* ---- default individual-ad mode remains unchanged ---- */

{
  // (17) A purely manual session run through every Checkpoint 3 helper:
  // none of them can produce a non-default/non-empty result, proving
  // the new logic is a true no-op for the pre-existing "Paste ads" flow.
  const blocks = [manualBlock("Manual ad one.\nShop Now"), manualBlock("Manual ad two.\nLearn More")];
  assert.equal(hasAnyCapturedPageName(blocks), false);
  assert.equal(countManuallyIncludedNonMatches(blocks), 0);
  const summary = computeAdvertiserSummary(blocks);
  assert.ok(summary.every((g) => g.count === 0), "no page-dump blocks — every summary group is empty");
  const recomputed = recomputeLiveAttribution(blocks, "Some Competitor", ["Some Alias"]);
  assert.deepEqual(recomputed, blocks, "recompute leaves a manual-only block list byte-for-byte unchanged");
}

console.log("pageDumpReview: all assertions passed");
