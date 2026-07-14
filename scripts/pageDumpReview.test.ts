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
  computeBlockIndexById,
  computePageDumpLiveStats,
  computeRenderItems,
  isBlockIncludedForGenerate,
  type AdBlock,
} from "../components/competitorDebrief/pageDumpReview.ts";
import { parseAdExample } from "../modules/competitorDebrief/adParser.ts";

let id = 1;
function manualBlock(raw: string): AdBlock {
  return { id: id++, parsed: parseAdExample(raw) };
}
function pageDumpBlock(
  raw: string,
  opts: { included: boolean; variantGroupId?: number | null; boundaryConfidence?: "high" | "medium" | "low" }
): AdBlock {
  return {
    id: id++,
    parsed: parseAdExample(raw),
    pageDumpMeta: {
      boundaryConfidence: opts.boundaryConfidence ?? "high",
      variantGroupId: opts.variantGroupId ?? null,
      included: opts.included,
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

console.log("pageDumpReview: all assertions passed");
