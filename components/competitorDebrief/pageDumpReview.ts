import type { BoundaryConfidence, ParsedAdExample } from "@/modules/competitorDebrief";

/**
 * Pure state-derivation logic for CompetitorDebriefPanel.tsx's page-dump
 * review UI — split into a plain (non-JSX) file specifically so it's
 * unit-testable in plain Node (this repo's script tests can't import a
 * "use client" .tsx file: Node's type-stripping mode strips TypeScript
 * types but doesn't transform JSX). Everything here is a pure function
 * over an AdBlock[] snapshot — no React, no state, no side effects.
 */

/** Present only on blocks produced by the "Paste full page dump" flow
 *  (Input Automation V1, modules/competitorDebrief/pageDump.ts) —
 *  absent (undefined) for the original "Paste ads" flow, which keeps
 *  that flow's data shape and rendering exactly as they were before
 *  this feature existed. `included` is the ONLY thing that changes
 *  what reaches the generate payload; `variantGroupId`/
 *  `boundaryConfidence` are display-only, read back from the same
 *  values processPageDump() already computed once. */
export interface PageDumpBlockMeta {
  boundaryConfidence: BoundaryConfidence;
  variantGroupId: number | null;
  included: boolean;
}

export interface AdBlock {
  id: number;
  parsed: ParsedAdExample;
  pageDumpMeta?: PageDumpBlockMeta;
}

/** Single source of truth for "does this block count toward the
 *  generate payload" — shared by the eligibility count
 *  (usableAdCount) and the actual submit filter (handleGenerate), so
 *  they can never drift apart. A no-op for the manual "Paste ads"
 *  flow, whose blocks never carry pageDumpMeta. */
export function isBlockIncludedForGenerate(block: AdBlock): boolean {
  return block.pageDumpMeta?.included !== false;
}

export type RenderItem =
  | { type: "single"; block: AdBlock }
  | { type: "group"; groupId: number; members: AdBlock[] };

/**
 * Grouped rendering plan: blocks sharing a non-null
 * pageDumpMeta.variantGroupId render together, once, at the position
 * of the FIRST member in `blocks` — every other member is skipped in
 * the top-level pass and carried inside that group's `members`
 * instead. Manual-flow blocks (no pageDumpMeta, or a null group id)
 * always render as "single" — as does a group whose membership has
 * dropped to 1 (e.g. the user removed every other variant), since a
 * "group" of one is no longer a group; it demotes to a plain single
 * rather than showing a pointless "show all 1" affordance. Pure
 * function of `blocks` alone, so removing or editing a block can never
 * leave a stale group behind.
 */
export function computeRenderItems(blocks: AdBlock[]): RenderItem[] {
  const items: RenderItem[] = [];
  const seenGroups = new Set<number>();
  for (const b of blocks) {
    const groupId = b.pageDumpMeta?.variantGroupId;
    if (groupId === null || groupId === undefined) {
      items.push({ type: "single", block: b });
    } else if (!seenGroups.has(groupId)) {
      seenGroups.add(groupId);
      const members = blocks.filter((x) => x.pageDumpMeta?.variantGroupId === groupId);
      if (members.length < 2) {
        items.push({ type: "single", block: b });
      } else {
        items.push({ type: "group", groupId, members });
      }
    }
  }
  return items;
}

/** "Ad N" labels (and the existing "Duplicate of Ad N" badge) stay
 *  anchored to each block's position in the OVERALL list regardless of
 *  where it renders (inside a collapsed/expanded group or as a
 *  single) — one index source of truth. */
export function computeBlockIndexById(blocks: AdBlock[]): Map<number, number> {
  const map = new Map<number, number>();
  blocks.forEach((b, i) => map.set(b.id, i));
  return map;
}

export interface PageDumpLiveStats {
  exactDuplicateCount: number;
  variantGroupCount: number;
  confidenceCounts: Record<BoundaryConfidence, number>;
  includedCount: number;
}

/**
 * Live figures for the page-dump summary bar — always reflect the
 * CURRENT block list (after any Remove/edit/checkbox change), never a
 * frozen snapshot from when "Process page" was last clicked.
 * `duplicateIndices` is expected to be the same array
 * findDuplicateIndices() already produces for the existing "Duplicate
 * of Ad N" badge — reused, not recomputed.
 */
export function computePageDumpLiveStats(
  blocks: AdBlock[],
  blockIndexById: Map<number, number>,
  duplicateIndices: (number | null)[],
  renderItems: RenderItem[]
): PageDumpLiveStats {
  const pageDumpBlocks = blocks.filter((b) => b.pageDumpMeta);
  const exactDuplicateCount = pageDumpBlocks.filter((b) => {
    const idx = blockIndexById.get(b.id);
    return idx !== undefined && duplicateIndices[idx] !== null;
  }).length;
  const variantGroupCount = renderItems.filter((item) => item.type === "group").length;
  const confidenceCounts: Record<BoundaryConfidence, number> = { high: 0, medium: 0, low: 0 };
  for (const b of pageDumpBlocks) {
    if (b.pageDumpMeta) confidenceCounts[b.pageDumpMeta.boundaryConfidence]++;
  }
  const includedCount = pageDumpBlocks.filter((b) => b.pageDumpMeta?.included).length;
  return { exactDuplicateCount, variantGroupCount, confidenceCounts, includedCount };
}
