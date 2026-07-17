// Relative, explicit-extension imports (not the "@/modules/..." alias,
// and not the barrel) on purpose: this file is directly imported by a
// plain-Node test script (scripts/pageDumpReview.test.ts), which can't
// resolve either the webpack path alias or the barrel's own
// extensionless internal imports — same reason pageDump.ts itself
// imports adsLibraryParser.ts this way.
import { classifyAdvertiserAttribution, type AdvertiserAttribution, type BoundaryConfidence } from "../../modules/competitorDebrief/pageDump.ts";
import type { ParsedAdExample } from "../../modules/competitorDebrief/adParser.ts";

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
  /** Competitor Input Trust V2: the advertiser/page name
   *  processPageDump() captured for this block, or null when
   *  attribution was impossible — read back, never recomputed here. */
  pageName: string | null;
  /** Checkpoint 2: processPageDump()'s classifyAdvertiserAttribution
   *  result for this block, read back — never recomputed here. Drives
   *  the Generate-blocking rule below (blocksGenerateForAttribution)
   *  and the new default-inclusion behavior baked into
   *  processPageDump()'s own selectRepresentatives call; this file
   *  only reads the already-computed value. */
  advertiserAttribution: AdvertiserAttribution;
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

/** True when at least one block in the current review state came from
 *  the Ads Library page-dump flow at all (carries pageDumpMeta) —
 *  scopes the attribution-blocking rule below to that flow only. The
 *  manual "Paste ads" flow's blocks never carry pageDumpMeta, so this
 *  is always false for a purely-manual session. */
export function hasPageDumpBlocks(blocks: AdBlock[]): boolean {
  return blocks.some((b) => b.pageDumpMeta !== undefined);
}

/** True when at least one extracted candidate was attributed
 *  ("match") to the typed competitor name — independent of its
 *  CURRENT included/excluded state, since Generate must stay blocked
 *  even if a user manually checked a mismatched/unknown candidate when
 *  nothing in the paste ever matched the name they typed. */
export function hasMatchingAdvertiser(blocks: AdBlock[]): boolean {
  return blocks.some((b) => b.pageDumpMeta?.advertiserAttribution === "match");
}

/**
 * Checkpoint 2 Generate-blocking rule B: the Ads Library page flow was
 * used, but not one extracted candidate matched the typed competitor
 * name. Always false (never blocks) for a purely manual "Paste ads"
 * session, whose blocks never carry pageDumpMeta — attribution gating
 * applies to the page-dump flow only.
 */
export function blocksGenerateForAttribution(blocks: AdBlock[]): boolean {
  return hasPageDumpBlocks(blocks) && !hasMatchingAdvertiser(blocks);
}

/** True when at least one page-dump block captured a real advertiser
 *  name at all — distinguishes "nothing in this paste matched" (a
 *  competitor-name problem) from "nothing here could be attributed to
 *  ANY advertiser" (a parsing/paste-shape problem), which get
 *  different blocking copy in the panel. Always false when there are
 *  no page-dump blocks at all. */
export function hasAnyCapturedPageName(blocks: AdBlock[]): boolean {
  return blocks.some((b) => b.pageDumpMeta?.pageName !== null && b.pageDumpMeta?.pageName !== undefined);
}

/**
 * Checkpoint 3: re-derives every page-dump block's advertiserAttribution
 * from its own frozen, structural pageName plus the CURRENT
 * competitorName/aliases — never the stale snapshot processPageDump
 * computed at extraction time. This is what makes typing a new alias
 * (or editing the competitor name) after extraction take effect
 * immediately everywhere attribution is read (badges, the advertiser
 * summary, and the Generate-blocking rule) without requiring the user
 * to re-click "Extract ads".
 *
 * Deliberately does NOT touch `included` — a block's checked/unchecked
 * state is never silently flipped by an alias edit, so a user's own
 * manual choices are always preserved. Re-running "Extract ads"
 * remains the only way to get a fresh DEFAULT selection that accounts
 * for the new alias (processPageDump already threads aliases into
 * selectRepresentatives for that path). A no-op for manual-flow blocks
 * (no pageDumpMeta) and for any block whose live attribution hasn't
 * actually changed (returns the same object reference in that case, so
 * this is cheap to call on every render).
 */
export function recomputeLiveAttribution(blocks: AdBlock[], competitorName: string, aliases: string[]): AdBlock[] {
  return blocks.map((b) => {
    if (!b.pageDumpMeta) return b;
    const liveAttribution = classifyAdvertiserAttribution(b.pageDumpMeta.pageName, competitorName, aliases);
    if (liveAttribution === b.pageDumpMeta.advertiserAttribution) return b;
    return { ...b, pageDumpMeta: { ...b.pageDumpMeta, advertiserAttribution: liveAttribution } };
  });
}

/** Live count of candidates the user has manually included despite a
 *  mismatch/unknown attribution — since both classifications default
 *  to excluded (Checkpoint 2), the only way one is `included` is an
 *  explicit checkbox click. Drives the panel's manual-inclusion
 *  warning banner. Always 0 for the manual "Paste ads" flow. */
export function countManuallyIncludedNonMatches(blocks: AdBlock[]): number {
  return blocks.filter(
    (b) =>
      b.pageDumpMeta?.included === true &&
      (b.pageDumpMeta.advertiserAttribution === "mismatch" || b.pageDumpMeta.advertiserAttribution === "unknown")
  ).length;
}

export interface AdvertiserSummaryGroup {
  status: AdvertiserAttribution;
  /** Total candidates currently classified with this status. */
  count: number;
  /** How many of those are CURRENTLY included (reflects manual
   *  toggles, unlike the panel's fixed "included"/"excluded" copy per
   *  group, which describes the DEFAULT disposition). */
  includedCount: number;
  /** Distinct captured Page names within this group, where available
   *  — always empty for the "unknown" group, since by definition none
   *  of its members captured a name. */
  pageNames: string[];
}

/**
 * Checkpoint 3: groups the CURRENT page-dump blocks (attribution
 * already live-recomputed by the caller — see recomputeLiveAttribution)
 * into the three advertiser-summary buckets the panel renders, in a
 * fixed order (match, mismatch, unknown) so the UI never has to
 * re-sort. Manual-flow blocks contribute nothing (filtered out first,
 * same as computePageDumpLiveStats above). A caller renders only the
 * groups with count > 0 — this function always returns all three so
 * it's fully testable without relying on the render layer's filter.
 */
export function computeAdvertiserSummary(blocks: AdBlock[]): AdvertiserSummaryGroup[] {
  const pageDumpBlocks = blocks.filter((b) => b.pageDumpMeta);
  const statuses: AdvertiserAttribution[] = ["match", "mismatch", "unknown"];
  return statuses.map((status) => {
    const members = pageDumpBlocks.filter((b) => b.pageDumpMeta?.advertiserAttribution === status);
    const pageNames = Array.from(
      new Set(
        members
          .map((b) => b.pageDumpMeta?.pageName)
          .filter((n): n is string => n !== null && n !== undefined)
      )
    );
    return {
      status,
      count: members.length,
      includedCount: members.filter((b) => b.pageDumpMeta?.included).length,
      pageNames,
    };
  });
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
