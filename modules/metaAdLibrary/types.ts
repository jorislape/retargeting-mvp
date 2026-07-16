/**
 * Meta Ad Library API spike — normalized record shape.
 *
 * This module is a research/feasibility SPIKE (see
 * scripts/metaAdLibraryProbe.ts), not a wired-in data source. Nothing
 * here is imported by modules/competitorDebrief, the engine, or any
 * route — the existing manual-paste flow is completely untouched.
 *
 * `CompetitorAd` is the shape a future API-backed source would need to
 * produce so it could feed the SAME inputs the engine already accepts
 * (CompetitorDebriefInput.adTexts: string[] / observations: string) —
 * see the architecture recommendation in the spike report for why no
 * deeper integration exists yet.
 */

export type CompetitorAdSource = "meta-ad-library-api" | "manual-paste";

export interface CompetitorAd {
  source: CompetitorAdSource;
  /** The advertiser/Page name as Meta reports it — not user-typed. */
  advertiserName: string | null;
  /** Meta's ad_archive_id (or archive-equivalent id) for this ad. */
  adId: string;
  /** Creative body text, when the API exposes it directly (never
   *  scraped from a snapshot render). */
  body: string | null;
  headline: string | null;
  cta: string | null;
  startedAt: string | null;
  endedAt: string | null;
  /** ISO country codes the ad was configured to reach, when reported. */
  countries: string[];
  /** e.g. "facebook", "instagram". */
  platforms: string[];
  /** Meta's rendered ad-preview link (an iframe/image render of the
   *  creative) — present even when structured fields are sparse. */
  snapshotUrl: string | null;
  /** The Ads Library page URL this record was found through, for
   *  reference/citation in the debrief UI. */
  sourceUrl: string | null;
}
