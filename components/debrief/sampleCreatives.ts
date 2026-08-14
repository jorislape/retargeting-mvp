import type { CreativeAssetRef } from "@/components/workspace/DebriefProvider";

/**
 * Creative Evidence V1 — the sample dataset's bundled demo creatives.
 *
 * Three clearly-synthetic SVG mockups (each is watermarked "SAMPLE
 * CREATIVE — DEMO ASSET · not a real ad or result" in the artwork
 * itself) so "Load sample data" and /sample demonstrate the Creative
 * Evidence strip without Meta OAuth or manual uploads. Keys are the
 * sample ads' names (already normalized — no stray whitespace), and
 * the mapping deliberately covers the two ads the sample's evidence
 * spotlights (top winner + worst loser on every KPI — see
 * sampleCsv.ts's invariants) plus one extra so the Verify stage shows
 * the attached state on a non-spotlighted row too.
 *
 * Same-origin public paths, not object URLs — the provider's revoker
 * skips non-blob: URLs by design.
 */
export const SAMPLE_CREATIVE_ASSETS: Record<string, CreativeAssetRef> = {
  UGC_MorningRoutine_V1: {
    url: "/sample-creatives/ugc-morning-routine.svg",
    name: "Demo creative (synthetic) — UGC-style still",
  },
  Static_StockPhoto_Generic_V1: {
    url: "/sample-creatives/static-stock-photo.svg",
    name: "Demo creative (synthetic) — generic static",
  },
  Testimonial_CustomerReview_V3: {
    url: "/sample-creatives/testimonial-review.svg",
    name: "Demo creative (synthetic) — testimonial",
  },
};
