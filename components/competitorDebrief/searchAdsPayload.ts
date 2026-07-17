// Relative, explicit-extension import (not the "@/modules/..." alias,
// and not the barrel) on purpose: this file is directly imported by a
// plain-Node test script (scripts/metaAdLibraryIntegration.test.ts),
// which can't resolve the webpack path alias — same reason
// pageDumpReview.ts imports this way.
import { normalizeForDedupe } from "../../modules/competitorDebrief/adParser.ts";
import type { CompetitorAd } from "../../modules/metaAdLibrary/types.ts";
import type { PageCandidate } from "../../modules/metaAdLibrary/discovery.ts";

/**
 * Pure payload/state logic for the "Search advertiser" mode — split out
 * of CompetitorDebriefPanel.tsx (a "use client" .tsx file plain Node
 * can't import) so the exact bytes the Generate request sends are
 * regression-testable, the same pattern as ./pageDumpReview.ts.
 *
 * THE rule this file exists to enforce: the character-budget readout,
 * the over-budget Generate block, and the request body all read the
 * SAME buildSearchPayload output — never a second, drifting estimate.
 */

/** One fetched-and-verified ad in the review list. `text` is the
 *  engine-ready serialization (competitorAdToText — already per-ad
 *  capped), computed once at fetch time. */
export interface ApiAd {
  ad: CompetitorAd;
  text: string;
  included: boolean;
}

/** Mirrors MAX_OBSERVATIONS_CHARS in app/api/competitor-debrief/
 *  route.ts — the server stays the source of truth and still enforces
 *  it; this constant only lets the UI show the budget and refuse to
 *  send a payload the server would reject anyway. */
export const SEARCH_OBSERVATIONS_LIMIT = 20_000;

export interface SearchPayload {
  /** Distinct (normalizeForDedupe), included, non-empty ad texts — the
   *  request's `adTexts` field, and the count the UI must display. */
  adTexts: string[];
  /** The exact `observations` string the request sends — the readout's
   *  character count and the over-budget check both measure THIS. */
  observations: string;
}

/**
 * Included ads -> the exact generate payload. Selection is applied
 * here (not by the caller pre-filtering) so tests exercise the same
 * include/exclude semantics the UI relies on: an unchecked ad can
 * never reach observations or adTexts, and re-checking it brings it
 * back. Dedupe uses the same normalizeForDedupe key the paste flows
 * use, so identical creative variants can't inflate recurrence counts.
 */
export function buildSearchPayload(ads: ApiAd[], advancedNotes: string): SearchPayload {
  const seen = new Set<string>();
  const adTexts: string[] = [];
  for (const a of ads) {
    if (!a.included || a.text === "") continue;
    const key = normalizeForDedupe(a.text);
    if (seen.has(key)) continue;
    seen.add(key);
    adTexts.push(a.text);
  }
  const observations = [adTexts.join("\n\n"), advancedNotes.trim()].filter((part) => part !== "").join("\n\n");
  return { adTexts, observations };
}

/**
 * Merges a fetch response into the current review list.
 *
 * The ONE documented default: a newly fetched ad (an adId not already
 * in the list) starts `included: true` — it has already passed the
 * server-side page_id attribution gate, so inclusion is the honest
 * default and the checkbox is the opt-out.
 *
 * Everything already in the list is preserved EXACTLY as the user left
 * it: a "Load more" response that re-delivers an existing adId (cursor
 * overlap) is dropped, never re-adopted — so it can neither duplicate
 * the entry nor silently re-check an ad the user deselected. A fresh
 * fetch (isLoadMore=false) discards the previous list entirely; a
 * fresh list has no prior selections to preserve.
 */
export function mergeFetchedAds(prev: ApiAd[], fetched: ApiAd[], isLoadMore: boolean): ApiAd[] {
  const base = isLoadMore ? prev : [];
  const seenIds = new Set(base.map((a) => a.ad.adId));
  return [...base, ...fetched.filter((a) => !seenIds.has(a.ad.adId))];
}

/**
 * Splits discovery candidates into "Exact Page match" vs "Other Pages
 * found from matching ad text" for the result hierarchy — because
 * search_terms matches ad TEXT, a "Nike" search returns Pages that
 * merely mention Nike, which reads as a broken advertiser search
 * without this separation. Matching is the same exact, normalized
 * (case/whitespace) comparison used everywhere else in this repo
 * (normalizeForDedupe) — deliberately NO fuzzy/substring/semantic
 * matching, so "Nike Store DE" is an "other", never an "exact".
 * Every candidate lands in exactly one group; nothing is hidden and
 * nothing is auto-selected.
 */
export function partitionPageCandidates(
  candidates: PageCandidate[],
  query: string
): { exactMatches: PageCandidate[]; others: PageCandidate[] } {
  const normalizedQuery = normalizeForDedupe(query);
  const exactMatches: PageCandidate[] = [];
  const others: PageCandidate[] = [];
  for (const c of candidates) {
    (normalizedQuery !== "" && normalizeForDedupe(c.pageName) === normalizedQuery ? exactMatches : others).push(c);
  }
  return { exactMatches, others };
}
