import type { RawArchivedAd } from "./client.ts";
import type { CompetitorAd } from "./types.ts";

/**
 * Pure helpers for the "Search advertiser" flow (Meta Ad Library API
 * Integration V1) — no network, no React, no Node APIs, so every
 * trust-rule in this flow is assertable in plain-Node tests
 * (scripts/metaAdLibraryIntegration.test.ts).
 *
 * The two-step trust model these helpers exist to enforce:
 *   1. search_terms is DISCOVERY ONLY (confirmed live: it matches
 *      creative text, not the advertiser) — its results are reduced to
 *      a deduplicated candidate-Page list and never become ad payload;
 *   2. only a search_page_ids query for the user's explicitly chosen
 *      page_id produces ads, and even those are re-validated per ad
 *      against that page_id before anything enters the engine payload.
 */

/** V1 country allowlist: EU members plus the UK. The confirmed API
 *  scoping rule means commercial (non-political) ads only return for
 *  EU-reaching queries; the UK is included per Meta's EU/UK field
 *  scoping but flagged in the UI as part of the beta label. */
export const SUPPORTED_COUNTRIES: ReadonlyArray<{ code: string; label: string }> = [
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "NL", label: "Netherlands" },
  { code: "ES", label: "Spain" },
  { code: "IT", label: "Italy" },
  { code: "IE", label: "Ireland" },
  { code: "BE", label: "Belgium" },
  { code: "AT", label: "Austria" },
  { code: "SE", label: "Sweden" },
  { code: "DK", label: "Denmark" },
  { code: "FI", label: "Finland" },
  { code: "PL", label: "Poland" },
  { code: "PT", label: "Portugal" },
  { code: "GB", label: "United Kingdom" },
];

export function isSupportedCountry(code: string): boolean {
  return SUPPORTED_COUNTRIES.some((c) => c.code === code);
}

/** One candidate advertiser Page distilled from discovery results —
 *  never an ad. `sampleAdCount` is how many ads in the discovery
 *  SAMPLE belonged to this Page (honest wording: it is not the Page's
 *  total ad count). */
export interface PageCandidate {
  pageId: string;
  pageName: string;
  sampleAdCount: number;
}

/**
 * Discovery results -> deduplicated candidate Pages, in first-seen
 * order. Ads with no page_id are dropped entirely (a Page the user
 * can't verify can't be selected). The ads themselves are deliberately
 * NOT returned — only Page identity leaves this step, so discovery
 * results can never be mistaken for (or leak into) the selected
 * competitor's ad payload.
 */
export function dedupePageCandidates(raw: RawArchivedAd[]): PageCandidate[] {
  const byId = new Map<string, PageCandidate>();
  for (const ad of raw) {
    if (!ad.page_id) continue;
    const existing = byId.get(ad.page_id);
    if (existing) {
      existing.sampleAdCount += 1;
    } else {
      byId.set(ad.page_id, {
        pageId: ad.page_id,
        pageName: ad.page_name ?? "(unnamed Page)",
        sampleAdCount: 1,
      });
    }
  }
  return Array.from(byId.values());
}

/**
 * The per-ad attribution gate: even a search_page_ids response is
 * re-validated ad by ad, and anything whose page_id differs from the
 * user's selected Page is excluded (counted, never silently dropped —
 * the route surfaces the count as an internal warning). Live testing
 * showed search_page_ids IS reliably single-advertiser, so a non-zero
 * count here signals something unexpected upstream, which is exactly
 * why it's checked rather than trusted.
 */
export function partitionAdsByPage(
  ads: CompetitorAd[],
  selectedPageId: string
): { matching: CompetitorAd[]; excludedMismatchedCount: number } {
  const matching = ads.filter((a) => a.advertiserPageId === selectedPageId);
  return { matching, excludedMismatchedCount: ads.length - matching.length };
}

/**
 * One normalized ad -> the plain text block the existing engine
 * pipeline consumes (the same `adTexts[]` shape the paste flows
 * produce). Only the ad's own creative fields are used — never the
 * search query, never the Page name, never invented labels — so the
 * engine sees exactly what Meta reported the ad saying, nothing more.
 * Returns "" for an ad with no usable creative text (caller filters).
 */
export function competitorAdToText(ad: CompetitorAd): string {
  const parts = [ad.body?.trim(), ad.headline?.trim()].filter(
    (p): p is string => p !== undefined && p !== ""
  );
  return parts.join("\n");
}

/** Normalized ads -> engine-ready adTexts: serialized, empties dropped.
 *  (Deduplication by normalized text happens client-side at generate
 *  time, through the exact same normalizeForDedupe loop the paste
 *  flows already use — not duplicated here.) */
export function buildEngineAdTexts(ads: CompetitorAd[]): string[] {
  return ads.map(competitorAdToText).filter((t) => t !== "");
}
