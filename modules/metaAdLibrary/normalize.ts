import type { CompetitorAd } from "./types.ts";
import type { RawArchivedAd } from "./client.ts";

/**
 * CONFIRMED LIVE (2026-07): Meta embeds the CALLER'S OWN ACCESS TOKEN
 * as an `access_token` query param inside `ad_snapshot_url` in every
 * response. A raw snapshot URL is therefore a credential, not a link —
 * it must never be logged, stored, or put in a normalized record.
 * This strips it; rendering the snapshot later requires re-appending
 * a live token server-side at request time.
 */
export function sanitizeSnapshotUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    url.searchParams.delete("access_token");
    return url.toString();
  } catch {
    // A malformed URL can't be proven token-free — drop it entirely.
    return null;
  }
}

/**
 * Raw ads_archive nodes -> the normalized CompetitorAd shape (see
 * types.ts). Deliberately does NOT invent a `cta` value: the confirmed
 * field list for non-political ads has no dedicated CTA/button-type
 * field (see the spike report) — `cta` stays null rather than guessing
 * from ad_creative_link_captions, which is a caption, not a CTA label.
 */
export function normalizeArchivedAd(raw: RawArchivedAd, sourceUrl: string | null): CompetitorAd {
  return {
    source: "meta-ad-library-api",
    advertiserName: raw.page_name ?? null,
    advertiserPageId: raw.page_id ?? null,
    adId: raw.id ?? "",
    body: raw.ad_creative_bodies?.[0] ?? null,
    headline: raw.ad_creative_link_titles?.[0] ?? null,
    cta: null,
    startedAt: raw.ad_delivery_start_time ?? null,
    endedAt: raw.ad_delivery_stop_time ?? null,
    // Always [] on purpose: the confirmed all-ads field list has no
    // per-ad "which countries this reached" field — ad_reached_countries
    // is a REQUEST filter, not a response field, and the per-region
    // breakdown fields (delivery_by_region, age_country_gender_reach_
    // breakdown) are political/issue-ads-only per the spike report.
    // Leaving it empty is honest; echoing the query's own filter back
    // would misrepresent it as observed data.
    countries: [],
    platforms: raw.publisher_platforms ?? [],
    snapshotUrl: sanitizeSnapshotUrl(raw.ad_snapshot_url),
    sourceUrl,
  };
}
