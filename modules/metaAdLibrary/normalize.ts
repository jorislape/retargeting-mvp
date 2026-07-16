import type { CompetitorAd } from "./types.ts";
import type { RawArchivedAd } from "./client.ts";

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
    snapshotUrl: raw.ad_snapshot_url ?? null,
    sourceUrl,
  };
}
