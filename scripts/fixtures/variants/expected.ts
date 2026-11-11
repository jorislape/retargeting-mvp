/**
 * Robustness Sweep — what each export in this folder must produce.
 *
 * HAND-WRITTEN from the generator's known inputs (generate.ts), never
 * computed by it: per ad the spend, the purchase count and the ROAS a
 * buyer would read off Ads Manager for that ad. null = "not in this
 * export" (missing is never zero). scripts/robustnessVariants.test.ts
 * runs every file through the real upload check + engine and asserts
 * the parsed ads AND the analysis agree with these numbers within 0.01.
 *
 * A file Debrief can't read correctly must be refused with a clear
 * reason (`refused`) — never turned into a report.
 */

export interface AdExpect {
  spend: number;
  /** Purchases counted for the ad (null = the export has no count). */
  purchases?: number | null;
  /** Messaging conversations (the Cost-per-conversation run only). */
  conversations?: number | null;
  /** value ÷ spend, as Ads Manager shows it. */
  roas?: number | null;
  /** spend ÷ outcomes (CPA runs only). */
  cpa?: number | null;
}

export type Expectation =
  | {
      kpi?: "roas" | "cpa";
      cpaOutcome?: "conversation";
      ads: Record<string, AdExpect>;
      totalSpend: number;
      /** Median ROAS of the judged ads, where worth pinning. */
      median?: number;
      /** Lines the file card must show (source column / disclosures). */
      card?: RegExp[];
    }
  | { refused: RegExp; message?: RegExp };

/* ------------------------------------------------------------------ */
/* The base account — seven ads                                        */
/*                                                                     */
/*   ad                 spend     purchases  value     ROAS            */
/*   Hero_UGC_V1        1,200.00  40         4,800.00  4.00            */
/*   Review_Static_V2     950.50  25         2,376.25  2.50            */
/*   Founder_Video_V3   2,345.67  30         1,993.82  0.85            */
/*   Carousel_Sale_V4   1,820.00  12         1,219.40  0.67            */
/*   Demo_Video_V5        640.25   0             0.00  0.00            */
/*   Testimonial_V6     1,410.00  21         3,525.00  2.50            */
/*   Promo_Static_V7    1,035.40  16         1,752.00  1.69            */
/*   total              9,401.82                                       */
/*                                                                     */
/* Minimum spend = half the mean spend = 671.56, so Demo_Video_V5 is   */
/* set aside; median ROAS of the other six = (1.69 + 2.50) ÷ 2 = 2.10. */
/* ------------------------------------------------------------------ */
const BASE: Record<string, AdExpect> = {
  Hero_UGC_V1: { spend: 1200.0, purchases: 40, roas: 4.0 },
  Review_Static_V2: { spend: 950.5, purchases: 25, roas: 2.5 },
  Founder_Video_V3: { spend: 2345.67, purchases: 30, roas: 0.85 },
  Carousel_Sale_V4: { spend: 1820.0, purchases: 12, roas: 0.67 },
  Demo_Video_V5: { spend: 640.25, purchases: 0, roas: 0 },
  Testimonial_V6: { spend: 1410.0, purchases: 21, roas: 2.5 },
  Promo_Static_V7: { spend: 1035.4, purchases: 16, roas: 1.69 },
};
const BASE_TOTAL = 9401.82;
const base: Expectation = { ads: BASE, totalSpend: BASE_TOTAL, median: 2.096 };

/** The base ads when the export has no purchase-count column: the count
 *  is unknown (null) — except the ad with no purchase value at all,
 *  which is a 0-purchase ad. */
const BASE_NO_COUNT: Record<string, AdExpect> = {
  Hero_UGC_V1: { spend: 1200.0, purchases: null, roas: 4.0 },
  Review_Static_V2: { spend: 950.5, purchases: null, roas: 2.5 },
  Founder_Video_V3: { spend: 2345.67, purchases: null, roas: 0.85 },
  Carousel_Sale_V4: { spend: 1820.0, purchases: null, roas: 0.67 },
  Demo_Video_V5: { spend: 640.25, purchases: 0, roas: 0 },
  Testimonial_V6: { spend: 1410.0, purchases: null, roas: 2.5 },
  Promo_Static_V7: { spend: 1035.4, purchases: null, roas: 1.69 },
};

/** 7-day click part of the base ads (the attribution-split files):
 *    Hero 36 / 4,320.00 · Review 22 / 2,091.10 · Founder 27 / 1,829.62 ·
 *    Carousel 11 / 1,128.40 · Demo 0 · Testimonial 18 / 3,031.50 ·
 *    Promo 14 / 1,532.39 — each ÷ the ad's spend. */
const CLICK_7_DAY: Record<string, AdExpect> = {
  Hero_UGC_V1: { spend: 1200.0, purchases: 36, roas: 3.6 },
  Review_Static_V2: { spend: 950.5, purchases: 22, roas: 2.2 },
  Founder_Video_V3: { spend: 2345.67, purchases: 27, roas: 0.78 },
  Carousel_Sale_V4: { spend: 1820.0, purchases: 11, roas: 0.62 },
  Demo_Video_V5: { spend: 640.25, purchases: 0, roas: 0 },
  Testimonial_V6: { spend: 1410.0, purchases: 18, roas: 2.15 },
  Promo_Static_V7: { spend: 1035.4, purchases: 14, roas: 1.48 },
};

/** Whole-number account (files with no decimals anywhere):
 *    Hero 1,200 / 40 / 4,800 · Founder 2,346 / 30 / 1,994 ·
 *    Carousel 1,820 / 12 / 1,219 · Review 951 / 25 / 2,376. */
const INTS: Expectation = {
  ads: {
    Hero_UGC_V1: { spend: 1200, purchases: 40, roas: 4.0 },
    Founder_Video_V3: { spend: 2346, purchases: 30, roas: 0.85 },
    Carousel_Sale_V4: { spend: 1820, purchases: 12, roas: 0.67 },
    Review_Static_V2: { spend: 951, purchases: 25, roas: 2.5 },
  },
  totalSpend: 6317,
};

/** The four purchase ads + two lead ads + one messaging ad of the
 *  "Results" files. Results counts whatever each row's Result indicator
 *  says, so only the purchase rows have purchases, a ROAS or a purchase
 *  CPA; the lead and messaging rows are unknown, never 120 "purchases".
 *    LeadForm_Guide_V8  1,500.00 · 120 leads
 *    LeadForm_Quiz_V9     900.00 ·  45 leads
 *    WhatsApp_Offer_V10   800.00 ·  64 conversations (12.50 each)
 *    total 6,316.17 + 3,200.00 = 9,516.17 */
const MIXED_TOTAL = 9516.17;
const MIXED_ROAS: Record<string, AdExpect> = {
  Hero_UGC_V1: { spend: 1200.0, purchases: 40, roas: 4.0 },
  Review_Static_V2: { spend: 950.5, purchases: 25, roas: 2.5 },
  Founder_Video_V3: { spend: 2345.67, purchases: 30, roas: 0.85 },
  Carousel_Sale_V4: { spend: 1820.0, purchases: 12, roas: 0.67 },
  LeadForm_Guide_V8: { spend: 1500.0, purchases: null, roas: null },
  LeadForm_Quiz_V9: { spend: 900.0, purchases: null, roas: null },
  WhatsApp_Offer_V10: { spend: 800.0, purchases: null, roas: null },
};

const REFUSED_LANGUAGE: Expectation = { refused: /^Column names not recognised$/, message: /English/ };

export const EXPECTED: Record<string, Expectation> = {
  /* --- ROAS and value columns --- */
  "01-roas-purchase-standard": { ...base, card: [/ROAS from column 'Purchase ROAS \(return on ad spend\)'/] },
  "02-roas-website-only": { ...base, card: [/ROAS from column 'Website purchase ROAS \(return on ad spend\)'/] },
  "03-roas-results-columns": { ...base, card: [/ROAS from column 'Results ROAS'/, /Purchases from column 'Results'/] },
  /* Two ROAS families with different numbers: Ads Manager's Purchase
     ROAS (0.85 / 0.67) is the one shown, and the card says which. */
  "04-roas-purchase-and-website-differ": {
    ...base,
    card: [/ROAS from column 'Purchase ROAS \(return on ad spend\)'/, /'Website purchase ROAS \(return on ad spend\)' also found, not used/],
  },
  "05-roas-website-columns-first": {
    ...base,
    card: [/ROAS from column 'Purchase ROAS \(return on ad spend\)'/, /Purchases from column 'Purchases'/],
  },
  "06-roas-purchase-and-results-roas": { ...base, card: [/ROAS from column 'Purchase ROAS \(return on ad spend\)'/] },
  "07-roas-without-value-column": base,
  /* Only a ROAS column: counts unknown, and a blank ROAS stays unknown. */
  "08-roas-column-only": {
    ads: {
      Hero_UGC_V1: { spend: 1200.0, purchases: null, roas: 4.0 },
      Review_Static_V2: { spend: 950.5, purchases: null, roas: 2.5 },
      Founder_Video_V3: { spend: 2345.67, purchases: null, roas: 0.85 },
      Carousel_Sale_V4: { spend: 1820.0, purchases: null, roas: 0.67 },
      Demo_Video_V5: { spend: 640.25, purchases: null, roas: null },
      Testimonial_V6: { spend: 1410.0, purchases: null, roas: 2.5 },
      Promo_Static_V7: { spend: 1035.4, purchases: null, roas: 1.69 },
    },
    totalSpend: BASE_TOTAL,
  },
  "09-value-without-roas-column": { ...base, card: [/Purchase value from column 'Purchases conversion value'/] },
  /* No purchase-count column: the count is unknown — never the value. */
  "10-value-and-roas-without-count": { ads: BASE_NO_COUNT, totalSpend: BASE_TOTAL },
  "11-website-value-and-roas-without-count": { ads: BASE_NO_COUNT, totalSpend: BASE_TOTAL },
  "12-value-present-roas-blank": base,
  "13-roas-present-value-blank": base,
  "14-zero-purchases-explicit-zeros": base,

  /* --- Results + Result indicator --- */
  "15-results-mixed-indicator": { ads: MIXED_ROAS, totalSpend: MIXED_TOTAL, card: [/Result indicator/] },
  /* Explicit Purchases columns beside Results: they are read, and a
     blank Purchases cell on a lead / messaging ad is 0 purchases. */
  "16-results-mixed-with-purchase-columns": {
    ads: {
      ...MIXED_ROAS,
      LeadForm_Guide_V8: { spend: 1500.0, purchases: 0, roas: 0 },
      LeadForm_Quiz_V9: { spend: 900.0, purchases: 0, roas: 0 },
      WhatsApp_Offer_V10: { spend: 800.0, purchases: 0, roas: 0 },
    },
    totalSpend: MIXED_TOTAL,
    card: [/Purchases from column 'Purchases'/],
  },
  /* CPA: 1,200 ÷ 40 = 30.00 · 950.50 ÷ 25 = 38.02 · 2,345.67 ÷ 30 =
     78.19 · 1,820 ÷ 12 = 151.67. A cost per lead is not a purchase CPA. */
  "17-results-cpa-mixed-indicator": {
    kpi: "cpa",
    ads: {
      Hero_UGC_V1: { spend: 1200.0, purchases: 40, cpa: 30.0 },
      Review_Static_V2: { spend: 950.5, purchases: 25, cpa: 38.02 },
      Founder_Video_V3: { spend: 2345.67, purchases: 30, cpa: 78.19 },
      Carousel_Sale_V4: { spend: 1820.0, purchases: 12, cpa: 151.67 },
      LeadForm_Guide_V8: { spend: 1500.0, purchases: null, cpa: null },
      LeadForm_Quiz_V9: { spend: 900.0, purchases: null, cpa: null },
      WhatsApp_Offer_V10: { spend: 800.0, purchases: null, cpa: null },
    },
    totalSpend: MIXED_TOTAL,
    card: [/Result indicator/],
  },
  /* Cost per conversation: only the messaging row counts. */
  "18-results-messaging-conversations": {
    kpi: "cpa",
    cpaOutcome: "conversation",
    ads: {
      Hero_UGC_V1: { spend: 1200.0, conversations: null, cpa: null },
      Review_Static_V2: { spend: 950.5, conversations: null, cpa: null },
      Founder_Video_V3: { spend: 2345.67, conversations: null, cpa: null },
      Carousel_Sale_V4: { spend: 1820.0, conversations: null, cpa: null },
      LeadForm_Guide_V8: { spend: 1500.0, conversations: null, cpa: null },
      LeadForm_Quiz_V9: { spend: 900.0, conversations: null, cpa: null },
      WhatsApp_Offer_V10: { spend: 800.0, conversations: 64, cpa: 12.5 },
    },
    totalSpend: MIXED_TOTAL,
  },

  /* --- Attribution --- */
  "19-attribution-split-parentheses": { ads: CLICK_7_DAY, totalSpend: BASE_TOTAL, card: [/Ranked on 7-day click only/] },
  "20-attribution-split-brackets": { ads: CLICK_7_DAY, totalSpend: BASE_TOTAL, card: [/Ranked on 7-day click only/] },
  "21-attribution-setting-column": base,
  /* Per-window ROAS columns beside the blended one are never read as it. */
  "22-attribution-roas-windows-beside-blended": { ...base, card: [/ROAS from column 'Purchase ROAS \(return on ad spend\)'/] },
  /* The same header twice: the first column is read, and the card says so. */
  "23-duplicate-roas-header": { ...base, card: [/'Purchase ROAS \(return on ad spend\)' appears 2 times/] },

  /* --- Number formats --- */
  "24-us-thousands-separators": base,
  "25-eu-semicolon-decimal-comma": base,
  "26-eu-nbsp-thousands": base,
  "27-eu-narrow-nbsp-thousands": base,
  "28-currency-symbol-prefix-in-cell": base,
  "29-currency-symbol-suffix-in-cell": base,
  "30-currency-dollar-in-cell": base,
  "31-currency-code-in-cell": base,
  "32-percent-sign-cells": base,
  "33-eu-whole-numbers-dot-thousands": INTS,
  "34-decimal-comma-in-comma-file": base,
  "35-eu-three-decimal-roas": base,
  "36-us-whole-numbers-comma-thousands": INTS,
  "37-semicolon-with-decimal-points": base,

  /* --- File structure --- */
  "38-summary-row-first": { ...base, card: [/summary row/i] },
  "39-total-row-last": { ...base, card: [/summary row/i] },
  "40-blank-rows": base,
  "41-quoted-commas-in-names": {
    ads: {
      'Hero, UGC "v1" — 20% off': { spend: 1200.0, purchases: 40, roas: 4.0 },
      "Review; static, v2": { spend: 950.5, purchases: 25, roas: 2.5 },
      "Founder video, 0,85 cut": { spend: 2345.67, purchases: 30, roas: 0.85 },
      Carousel_Sale_V4: { spend: 1820.0, purchases: 12, roas: 0.67 },
      Demo_Video_V5: { spend: 640.25, purchases: 0, roas: 0 },
      Testimonial_V6: { spend: 1410.0, purchases: 21, roas: 2.5 },
      Promo_Static_V7: { spend: 1035.4, purchases: 16, roas: 1.69 },
    },
    totalSpend: BASE_TOTAL,
    median: 2.096,
  },
  "42-bom-crlf": base,
  "43-tab-delimited": base,
  /* Breakdowns: the slices of an ad add back up to the ad. */
  "44-day-breakdown": base,
  "45-age-breakdown": base,
  "46-placement-breakdown": base,
  "47-day-breakdown-with-summary-row": { ...base, card: [/summary row/i] },
  "48-day-breakdown-roas-per-slice": base,
  "49-same-ad-in-two-ad-sets": base,
  "50-wide-export-with-extra-columns": { ...base, card: [/ROAS from column 'Purchase ROAS \(return on ad spend\)'/, /Purchases from column 'Purchases'/] },

  /* --- Localised headers: refused by name, never guessed --- */
  "51-localized-lt": REFUSED_LANGUAGE,
  "52-localized-es": REFUSED_LANGUAGE,
  "53-localized-ar": REFUSED_LANGUAGE,
  "54-localized-de": REFUSED_LANGUAGE,
};

/**
 * Variants that expose a bug not fixed yet, with the cause. The runner
 * requires each of these to FAIL (so the reproduction is proven) and
 * every other variant to pass; a fix removes its entries from here in
 * the same commit, turning the variant into a regression test.
 */
export const PENDING: Record<string, string> = {
  "04-roas-purchase-and-website-differ": "website-only columns win over Ads Manager's Purchase ROAS",
  "05-roas-website-columns-first": "website-only columns win over Ads Manager's Purchase ROAS",
  "10-value-and-roas-without-count": "purchase count read from the conversion-value column",
  "11-website-value-and-roas-without-count": "purchase count read from the conversion-value column",
  "15-results-mixed-indicator": "Results counted as purchases whatever the Result indicator says",
  "17-results-cpa-mixed-indicator": "Results counted as purchases whatever the Result indicator says",
  "23-duplicate-roas-header": "a repeated header silently reads the LAST column",
  "33-eu-whole-numbers-dot-thousands": "dot thousands read as decimals when the file has no decimals",
  "38-summary-row-first": "the summary row is counted as an ad",
  "39-total-row-last": "the summary row is counted as an ad",
  "47-day-breakdown-with-summary-row": "the summary row is counted as an ad",
  "51-localized-lt": "a non-English export is called a campaign-level export",
  "52-localized-es": "a non-English export is called a campaign-level export",
  "53-localized-ar": "a non-English export is called a campaign-level export",
  "54-localized-de": "a non-English export is called a campaign-level export",
};
