import type { DebriefContext } from "./types";

/**
 * The synthetic sample dataset — one source of truth for both the
 * /sample page (server-rendered memo) and the "Use sample data" button
 * in the generator (loaded as a virtual CSV File client-side). No
 * engine imports here, so pulling it into a client bundle costs only
 * the string.
 *
 * Shaped like a real Ads Manager export (column names resolve through
 * columns.ts like any upload) and tuned against the rules engine —
 * keep these invariants if you edit rows:
 *   - 14 ads; mean spend ≈ $242 → spend gate ≈ $121 (no target CPA):
 *     11 ads judged, 3 set aside. The set-asides include a great ROAS
 *     on tiny spend (UGC_TikTokRemix_V1 — the "don't crown it yet"
 *     honesty case) and a dud with zero purchases (empty ROAS/CPP
 *     cells, like a real export).
 *   - Every KPI has a clean median over the 11 judged ads with 5 ads
 *     above and 5 below, in BOTH polarities: higher-is-better (ROAS
 *     4.62→0.62, CTR, Purchases, Leads) and lower-is-better (CPA
 *     $12.61→$99.10, CPC $0.30→$1.30).
 *   - Derived columns are arithmetically consistent (CTR =
 *     clicks/impressions, CPC = spend/clicks, CPP = spend/purchases),
 *     so recomputed and exported values agree whichever path the
 *     engine takes.
 *   - Loser group carries a "static" name tag on ≥ half its ads (ROAS
 *     view), so the tentative name-signal hint fires.
 */

export const SAMPLE_CSV_FILENAME =
  "Sample — Lumen Skincare — 2026-06-01 to 2026-06-30.csv";

export const SAMPLE_CSV_TEXT = `Ad name,Campaign name,Ad set name,Amount spent (USD),Impressions,Link clicks,CTR (link click-through rate),CPC (cost per link click) (USD),Purchases,Leads,Cost per purchase (USD),Cost per lead (USD),Purchase ROAS (return on ad spend),Reporting starts,Reporting ends
UGC_MorningRoutine_V1,Q2 Scaling — Purchase,Prospecting — Broad,428.60,61200,1450,2.37,0.30,34,61,12.61,7.03,4.62,2026-06-01,2026-06-30
Testimonial_CustomerReview_V3,Q2 Scaling — Purchase,Retargeting — 30d engagers,391.25,48900,1108,2.27,0.35,29,52,13.49,7.52,4.18,2026-06-01,2026-06-30
UGC_UnboxingReaction_V2,Creative Testing — June,Prospecting — Broad,355.40,45100,964,2.14,0.37,24,44,14.81,8.08,3.71,2026-06-01,2026-06-30
BeforeAfter_Static_8Weeks,Q2 Scaling — Purchase,Prospecting — Interests,340.10,39800,812,2.04,0.42,21,38,16.20,8.95,3.40,2026-06-01,2026-06-30
FounderStory_Video_V2,Creative Testing — June,Prospecting — Broad,302.80,33500,590,1.76,0.51,14,27,21.63,11.21,2.55,2026-06-01,2026-06-30
Lifestyle_BrandVideo_V2,Q2 Scaling — Purchase,Prospecting — Interests,288.40,30100,505,1.68,0.57,12,22,24.03,13.11,2.31,2026-06-01,2026-06-30
ProductShot_Static_V1,Creative Testing — June,Prospecting — Interests,259.95,26400,402,1.52,0.65,9,15,28.88,17.33,2.12,2026-06-01,2026-06-30
Discount_Generic_20Off,Q2 Scaling — Purchase,Retargeting — 30d engagers,246.30,28800,259,0.90,0.95,6,11,41.05,22.39,1.28,2026-06-01,2026-06-30
Comparison_CompetitorAngle_V1,Creative Testing — June,Prospecting — Broad,231.70,21500,238,1.11,0.97,5,9,46.34,25.74,1.05,2026-06-01,2026-06-30
Static_MemeStyle_V1,Creative Testing — June,Prospecting — Broad,214.50,24700,205,0.83,1.05,4,7,53.63,30.64,0.84,2026-06-01,2026-06-30
Static_StockPhoto_Generic_V1,Q2 Scaling — Purchase,Prospecting — Interests,198.20,19300,152,0.79,1.30,2,4,99.10,49.55,0.62,2026-06-01,2026-06-30
UGC_TikTokRemix_V1,Creative Testing — June,Prospecting — Broad,62.35,7400,189,2.55,0.33,6,9,10.39,6.93,5.90,2026-06-01,2026-06-30
Carousel_IngredientBreakdown_V1,Creative Testing — June,Prospecting — Interests,41.80,4900,96,1.96,0.44,1,3,41.80,13.93,1.43,2026-06-01,2026-06-30
Video_Hook_FastCut_V4,Creative Testing — June,Prospecting — Broad,24.15,3100,41,1.32,0.59,0,1,,24.15,,2026-06-01,2026-06-30`;

/** Context the sample was written for — used verbatim by /sample and
 *  as prefill for still-empty fields when the generator loads the
 *  sample (the user's own typed values are never overwritten). */
export const SAMPLE_CONTEXT: DebriefContext = {
  kpi: "roas",
  product: "Lumen Skincare — Vitamin C Serum",
  offer: "20% off first order",
  goal: "Scale past $500/day profitably",
  targetCpa: null,
  creativeNotes:
    "UGC_* and Testimonial_* ads are creator-shot; Static_* and ProductShot_* are designed statics; *_Video_* are edited brand cuts.",
  marketContext:
    "Competitor serums in the Ads Library lean on founder-led videos, problem-first hooks, and UGC testimonials; bundle offers around first-order discounts keep reappearing.",
};
