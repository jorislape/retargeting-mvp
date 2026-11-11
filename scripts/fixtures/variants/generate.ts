/**
 * Robustness Sweep — generator for the synthetic Ads Manager exports in
 * this folder. Run `node scripts/fixtures/variants/generate.ts` to
 * rewrite every NN-*.csv from the known inputs below; the CSVs are
 * committed, and scripts/robustnessVariants.test.ts asserts each one
 * against the HAND-WRITTEN numbers in expected.ts (never against this
 * file — the expectations are typed out separately so a generator bug
 * can't hide a parser bug).
 *
 * Shapes mirror real Ads Manager exports: Meta's own column names
 * ("Purchase ROAS (return on ad spend)", "Website purchases conversion
 * value", "Results" + "Result indicator" + "Cost per results",
 * "Attribution setting"), 6-decimal ratios ("0.850000"), blank cells
 * (not 0) for "no actions", breakdown rows, the optional summary row,
 * and what Excel / Google Sheets do to a file in an EU locale
 * (semicolons, decimal commas, dot / space thousands, currency in the
 * cell). Synthetic data only — no real account.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = import.meta.dirname;

/* ------------------------------------------------------------------ */
/* Known inputs                                                        */
/* ------------------------------------------------------------------ */

interface Ad {
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  value: number;
}

/** The base account: seven ads, four of them with four-digit spend so
 *  every thousands-separator style is exercised. V3 (0.85x) and V4
 *  (0.67x) are the tester's two ads; V5 has no purchases. */
const BASE: Ad[] = [
  { name: "Hero_UGC_V1", spend: 1200.0, impressions: 120000, clicks: 1500, purchases: 40, value: 4800.0 },
  { name: "Review_Static_V2", spend: 950.5, impressions: 95050, clicks: 760, purchases: 25, value: 2376.25 },
  { name: "Founder_Video_V3", spend: 2345.67, impressions: 234567, clicks: 1900, purchases: 30, value: 1993.82 },
  { name: "Carousel_Sale_V4", spend: 1820.0, impressions: 182000, clicks: 1640, purchases: 12, value: 1219.4 },
  { name: "Demo_Video_V5", spend: 640.25, impressions: 64025, clicks: 512, purchases: 0, value: 0 },
  { name: "Testimonial_V6", spend: 1410.0, impressions: 141000, clicks: 1269, purchases: 21, value: 3525.0 },
  { name: "Promo_Static_V7", spend: 1035.4, impressions: 103540, clicks: 1087, purchases: 16, value: 1752.0 },
];

/** Whole-number account, for exports that carry no decimals at all. */
const INTS: Ad[] = [
  { name: "Hero_UGC_V1", spend: 1200, impressions: 120000, clicks: 1500, purchases: 40, value: 4800 },
  { name: "Founder_Video_V3", spend: 2346, impressions: 234567, clicks: 1900, purchases: 30, value: 1994 },
  { name: "Carousel_Sale_V4", spend: 1820, impressions: 182000, clicks: 1640, purchases: 12, value: 1219 },
  { name: "Review_Static_V2", spend: 951, impressions: 95050, clicks: 760, purchases: 25, value: 2376 },
];

/* ------------------------------------------------------------------ */
/* Number styles                                                       */
/* ------------------------------------------------------------------ */

type Kind = "money" | "int" | "ratio" | "pct";
interface Style {
  /** thousands separator ("" = none) and decimal mark */
  group: string;
  decimal: string;
  /** decimals written for ratios (Meta writes 6) */
  ratioDigits: number;
  moneyPrefix?: string;
  moneySuffix?: string;
  pctSuffix?: string;
  /** money written with no decimals at all */
  wholeMoney?: boolean;
}

const RAW: Style = { group: "", decimal: ".", ratioDigits: 6 };
const US: Style = { group: ",", decimal: ".", ratioDigits: 2 };
const EU: Style = { group: ".", decimal: ",", ratioDigits: 2 };
const EU_PLAIN: Style = { group: "", decimal: ",", ratioDigits: 2 };
const NBSP = " ";
const NNBSP = " ";

function grouped(intPart: string, sep: string): string {
  return sep === "" ? intPart : intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

function num(value: number, kind: Kind, s: Style): string {
  const digits = kind === "int" ? 0 : kind === "ratio" ? s.ratioDigits : kind === "money" && s.wholeMoney ? 0 : 2;
  const [int, frac] = value.toFixed(digits).split(".");
  const body = grouped(int, s.group) + (frac ? s.decimal + frac : "");
  if (kind === "money") return `${s.moneyPrefix ?? ""}${body}${s.moneySuffix ?? ""}`;
  if (kind === "pct") return `${body}${s.pctSuffix ?? ""}`;
  return body;
}

/* ------------------------------------------------------------------ */
/* CSV writing                                                         */
/* ------------------------------------------------------------------ */

interface Csv {
  delimiter?: "," | ";" | "\t";
  bom?: boolean;
  eol?: "\n" | "\r\n";
}

function cell(v: string, d: string): string {
  return v.includes(d) || /["\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function serialize(matrix: string[][], csv: Csv = {}): string {
  const d = csv.delimiter ?? ",";
  const eol = csv.eol ?? "\n";
  return (csv.bom ? "﻿" : "") + matrix.map((r) => r.map((c) => cell(c, d)).join(d)).join(eol) + eol;
}

/* ------------------------------------------------------------------ */
/* Column library — header + how a row's cell is produced               */
/* ------------------------------------------------------------------ */

type Col = { header: string; get: (ad: Ad, s: Style) => string };
const blankIfZero = (ad: Ad, text: string) => (ad.purchases === 0 ? "" : text);
const roasOf = (ad: Ad) => ad.value / ad.spend;

const name = (header = "Ad name"): Col => ({ header, get: (a) => a.name });
const spend = (header = "Amount spent (USD)"): Col => ({ header, get: (a, s) => num(a.spend, "money", s) });
const impressions = (header = "Impressions"): Col => ({ header, get: (a, s) => num(a.impressions, "int", s) });
const clicks = (header = "Link clicks"): Col => ({ header, get: (a, s) => num(a.clicks, "int", s) });
const ctr = (header = "CTR (link click-through rate)"): Col => ({
  header,
  get: (a, s) => num((a.clicks / a.impressions) * 100, "pct", s),
});
/** Meta writes a blank, not 0, when an ad recorded no purchases. */
const purchases = (header = "Purchases"): Col => ({ header, get: (a, s) => blankIfZero(a, num(a.purchases, "int", s)) });
const value = (header = "Purchases conversion value"): Col => ({ header, get: (a, s) => blankIfZero(a, num(a.value, "money", s)) });
const roas = (header = "Purchase ROAS (return on ad spend)"): Col => ({ header, get: (a, s) => blankIfZero(a, num(roasOf(a), "ratio", s)) });
const costPer = (header = "Cost per purchase (USD)"): Col => ({ header, get: (a, s) => blankIfZero(a, num(a.spend / (a.purchases || 1), "money", s)) });
const fixed = (header: string, text: string | ((a: Ad) => string)): Col => ({ header, get: (a) => (typeof text === "string" ? text : text(a)) });

const STANDARD: Col[] = [name(), spend(), impressions(), clicks(), purchases(), value(), roas()];

function build(cols: Col[], ads: Ad[], s: Style = RAW): string[][] {
  return [cols.map((c) => c.header), ...ads.map((a) => cols.map((c) => c.get(a, s)))];
}

/** A copy of the ads with other purchase numbers (e.g. the website-only
 *  share of the same ads), keyed by ad name; unlisted ads are unchanged. */
function withNumbers(ads: Ad[], overrides: Record<string, { purchases: number; value: number }>): Ad[] {
  return ads.map((a) => (overrides[a.name] ? { ...a, ...overrides[a.name] } : a));
}

/** Columns that read from a second copy of the ads (same names). */
function from(other: Ad[], col: Col): Col {
  return { header: col.header, get: (a, s) => col.get(other.find((o) => o.name === a.name) ?? a, s) };
}

/* ------------------------------------------------------------------ */
/* Breakdowns — each ad split into slices that sum back to the ad      */
/* ------------------------------------------------------------------ */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Splits one ad into slices by spend share; purchases are split by the
 *  hand-picked integer parts below, value in proportion to purchases.
 *  The last slice takes the remainder, so the slices sum to the ad. */
function slices(ad: Ad, shares: number[], purchaseParts: number[]): Ad[] {
  const out: Ad[] = [];
  let spendLeft = ad.spend;
  let valueLeft = ad.value;
  let impLeft = ad.impressions;
  let clicksLeft = ad.clicks;
  shares.forEach((share, i) => {
    const last = i === shares.length - 1;
    const p = purchaseParts[i];
    const sp = last ? round2(spendLeft) : round2(ad.spend * share);
    const v = last ? round2(valueLeft) : ad.purchases > 0 ? round2((ad.value * p) / ad.purchases) : 0;
    const im = last ? impLeft : Math.round(ad.impressions * share);
    const cl = last ? clicksLeft : Math.round(ad.clicks * share);
    spendLeft -= sp;
    valueLeft -= v;
    impLeft -= im;
    clicksLeft -= cl;
    out.push({ name: ad.name, spend: sp, impressions: im, clicks: cl, purchases: p, value: v });
  });
  return out;
}

const PARTS3: Record<string, number[]> = {
  Hero_UGC_V1: [20, 12, 8],
  Review_Static_V2: [13, 7, 5],
  Founder_Video_V3: [15, 9, 6],
  /* one slice with spend and no purchases — its cells are blank */
  Carousel_Sale_V4: [8, 4, 0],
  Demo_Video_V5: [0, 0, 0],
  Testimonial_V6: [11, 6, 4],
  Promo_Static_V7: [8, 5, 3],
};
const PARTS2: Record<string, number[]> = {
  Hero_UGC_V1: [26, 14],
  Review_Static_V2: [15, 10],
  Founder_Video_V3: [21, 9],
  Carousel_Sale_V4: [12, 0],
  Demo_Video_V5: [0, 0],
  Testimonial_V6: [13, 8],
  Promo_Static_V7: [10, 6],
};

/** Breakdown matrix: `labels` are the breakdown cells per slice. */
function breakdown(
  breakdownHeaders: string[],
  labels: string[][],
  shares: number[],
  parts: Record<string, number[]>,
  cols: Col[],
  s: Style = RAW
): string[][] {
  const header = [...breakdownHeaders, ...cols.map((c) => c.header)];
  const rows: string[][] = [];
  for (const ad of BASE) {
    slices(ad, shares, parts[ad.name]).forEach((slice, i) => {
      rows.push([...labels[i], ...cols.map((c) => c.get(slice, s))]);
    });
  }
  return [header, ...rows];
}

/** The summary row Ads Manager adds when "Include summary row" is
 *  ticked: blank dimension cells, totals in the metric cells. */
function summaryRow(cols: Col[], ads: Ad[], lead: string[] = [], label = ""): string[] {
  const total: Ad = {
    name: label,
    spend: round2(ads.reduce((n, a) => n + a.spend, 0)),
    impressions: ads.reduce((n, a) => n + a.impressions, 0),
    clicks: ads.reduce((n, a) => n + a.clicks, 0),
    purchases: ads.reduce((n, a) => n + a.purchases, 0),
    value: round2(ads.reduce((n, a) => n + a.value, 0)),
  };
  return [...lead, ...cols.map((c) => c.get(total, RAW))];
}

/* ------------------------------------------------------------------ */
/* The variants                                                        */
/* ------------------------------------------------------------------ */

const PURCHASE = "actions:offsite_conversion.fb_pixel_purchase";
const LEAD = "actions:lead";
const MESSAGING = "actions:onsite_conversion.messaging_conversation_started_7d";
const WINDOW = "7-day click or 1-day view";

/** Website-only share of the same ads: most of V3 / V4's purchases came
 *  through other channels (shop, app, offline), so their website ROAS is
 *  0.07x / 0.22x while Ads Manager's Purchase ROAS says 0.85x / 0.67x. */
const WEBSITE = withNumbers(BASE, {
  Hero_UGC_V1: { purchases: 38, value: 4560.0 },
  Founder_Video_V3: { purchases: 3, value: 164.2 },
  Carousel_Sale_V4: { purchases: 4, value: 400.4 },
});
/** Click-only (7-day click) and view-through (1-day view) parts. */
const CLICK7 = withNumbers(BASE, {
  Hero_UGC_V1: { purchases: 36, value: 4320.0 },
  Review_Static_V2: { purchases: 22, value: 2091.1 },
  Founder_Video_V3: { purchases: 27, value: 1829.62 },
  Carousel_Sale_V4: { purchases: 11, value: 1128.4 },
  Testimonial_V6: { purchases: 18, value: 3031.5 },
  Promo_Static_V7: { purchases: 14, value: 1532.39 },
});
const VIEW1 = withNumbers(BASE, {
  Hero_UGC_V1: { purchases: 4, value: 480.0 },
  Review_Static_V2: { purchases: 3, value: 285.15 },
  Founder_Video_V3: { purchases: 3, value: 164.2 },
  Carousel_Sale_V4: { purchases: 1, value: 91.0 },
  Testimonial_V6: { purchases: 3, value: 493.5 },
  Promo_Static_V7: { purchases: 2, value: 219.61 },
});

/** Lead / messaging rows for the Results variants (not purchases). */
const LEAD_ADS: Ad[] = [
  { name: "LeadForm_Guide_V8", spend: 1500.0, impressions: 150000, clicks: 1800, purchases: 120, value: 0 },
  { name: "LeadForm_Quiz_V9", spend: 900.0, impressions: 90000, clicks: 990, purchases: 45, value: 0 },
];
const MESSAGING_ADS: Ad[] = [
  { name: "WhatsApp_Offer_V10", spend: 800.0, impressions: 80000, clicks: 640, purchases: 64, value: 0 },
];
const RESULT_KIND = new Map<string, string>([
  ...BASE.map((a) => [a.name, PURCHASE] as [string, string]),
  ...LEAD_ADS.map((a) => [a.name, LEAD] as [string, string]),
  ...MESSAGING_ADS.map((a) => [a.name, MESSAGING] as [string, string]),
]);
const isPurchaseRow = (a: Ad) => RESULT_KIND.get(a.name) === PURCHASE;
const results = (): Col => ({ header: "Results", get: (a, s) => blankIfZero(a, num(a.purchases, "int", s)) });
const resultIndicator = (): Col => ({ header: "Result indicator", get: (a) => (a.purchases === 0 ? "" : (RESULT_KIND.get(a.name) ?? "")) });
const costPerResults = (): Col => ({ header: "Cost per results", get: (a, s) => blankIfZero(a, num(a.spend / (a.purchases || 1), "ratio", s)) });
const resultsValue = (): Col => ({ header: "Results value", get: (a, s) => (isPurchaseRow(a) ? blankIfZero(a, num(a.value, "money", s)) : "") });
const resultsRoas = (): Col => ({ header: "Results ROAS", get: (a, s) => (isPurchaseRow(a) ? blankIfZero(a, num(roasOf(a), "ratio", s)) : "") });

const MIXED_RESULTS = [...BASE.slice(0, 4), ...LEAD_ADS, ...MESSAGING_ADS];

const QUOTED_NAMES: Record<string, string> = {
  Hero_UGC_V1: 'Hero, UGC "v1" — 20% off',
  Review_Static_V2: "Review; static, v2",
  Founder_Video_V3: "Founder video, 0,85 cut",
};

const variants: { file: string; text: string }[] = [];
function add(file: string, matrix: string[][], csv: Csv = {}) {
  variants.push({ file, text: serialize(matrix, csv) });
}
/** Inserts rows into a built matrix (index counts data rows, 0-based). */
function insert(matrix: string[][], at: number, ...rows: string[][]): string[][] {
  const out = [...matrix];
  out.splice(at + 1, 0, ...rows);
  return out;
}
const blankRow = (matrix: string[][]) => matrix[0].map(() => "");

/* --- ROAS and value columns ---------------------------------------- */
add("01-roas-purchase-standard.csv", build(STANDARD, BASE));
add(
  "02-roas-website-only.csv",
  build(
    [name(), spend(), impressions(), purchases("Website purchases"), value("Website purchases conversion value"), roas("Website purchase ROAS (return on ad spend)")],
    BASE
  )
);
add("03-roas-results-columns.csv", build([name(), spend(), results(), resultIndicator(), costPerResults(), resultsValue(), resultsRoas()], BASE));
add(
  "04-roas-purchase-and-website-differ.csv",
  build(
    [
      name(), spend(), impressions(),
      purchases(), value(), roas(),
      from(WEBSITE, purchases("Website purchases")),
      from(WEBSITE, value("Website purchases conversion value")),
      from(WEBSITE, roas("Website purchase ROAS (return on ad spend)")),
    ],
    BASE
  )
);
add(
  "05-roas-website-columns-first.csv",
  build(
    [
      name(), spend(),
      from(WEBSITE, roas("Website purchase ROAS (return on ad spend)")),
      from(WEBSITE, value("Website purchases conversion value")),
      from(WEBSITE, purchases("Website purchases")),
      roas(), value(), purchases(),
    ],
    BASE
  )
);
add("06-roas-purchase-and-results-roas.csv", build([name(), spend(), results(), resultIndicator(), resultsRoas(), purchases(), roas()], BASE));
add("07-roas-without-value-column.csv", build([name(), spend(), impressions(), purchases(), roas()], BASE));
add("08-roas-column-only.csv", build([name(), spend(), impressions(), roas()], BASE));
add("09-value-without-roas-column.csv", build([name(), spend(), purchases(), value()], BASE));
add("10-value-and-roas-without-count.csv", build([name(), spend(), impressions(), value(), roas()], BASE));
add(
  "11-website-value-and-roas-without-count.csv",
  build([name(), spend(), value("Website purchases conversion value"), roas("Website purchase ROAS (return on ad spend)")], BASE)
);
{
  /* value present, ROAS cell blank on two ads */
  const blankRoas: Col = { header: roas().header, get: (a, s) => (["Hero_UGC_V1", "Founder_Video_V3"].includes(a.name) ? "" : roas().get(a, s)) };
  add("12-value-present-roas-blank.csv", build([name(), spend(), purchases(), value(), blankRoas], BASE));
  /* ROAS present, value cell blank on two ads */
  const blankValue: Col = { header: value().header, get: (a, s) => (["Hero_UGC_V1", "Founder_Video_V3"].includes(a.name) ? "" : value().get(a, s)) };
  add("13-roas-present-value-blank.csv", build([name(), spend(), purchases(), blankValue, roas()], BASE));
}
{
  /* a 0-purchase ad written with explicit zeros instead of blanks */
  const zero = (c: Col, z: string): Col => ({ header: c.header, get: (a, s) => (a.purchases === 0 ? z : c.get(a, s)) });
  add("14-zero-purchases-explicit-zeros.csv", build([name(), spend(), zero(purchases(), "0"), zero(value(), "0.00"), zero(roas(), "0.000000")], BASE));
}

/* --- Results + Result indicator ------------------------------------ */
add(
  "15-results-mixed-indicator.csv",
  build([name(), spend(), results(), resultIndicator(), costPerResults(), resultsValue(), resultsRoas(), fixed("Attribution setting", WINDOW)], MIXED_RESULTS)
);
add(
  "16-results-mixed-with-purchase-columns.csv",
  build(
    [
      name(), spend(), results(), resultIndicator(), costPerResults(),
      { header: "Purchases", get: (a, s) => (isPurchaseRow(a) ? purchases().get(a, s) : "") },
      { header: "Purchases conversion value", get: (a, s) => (isPurchaseRow(a) ? value().get(a, s) : "") },
      { header: "Purchase ROAS (return on ad spend)", get: (a, s) => (isPurchaseRow(a) ? roas().get(a, s) : "") },
    ],
    MIXED_RESULTS
  )
);
add("17-results-cpa-mixed-indicator.csv", build([name(), spend(), impressions(), results(), resultIndicator(), costPerResults()], MIXED_RESULTS));
add("18-results-messaging-conversations.csv", build([name(), spend(), impressions(), results(), resultIndicator(), costPerResults()], MIXED_RESULTS));

/* --- Attribution ---------------------------------------------------- */
{
  const split = (open: string, close: string): Col[] => [
    name(), spend(), purchases(), value(), roas(),
    from(CLICK7, purchases(`Purchases ${open}7-day click${close}`)),
    from(CLICK7, value(`Purchases conversion value ${open}7-day click${close}`)),
    from(VIEW1, purchases(`Purchases ${open}1-day view${close}`)),
    from(VIEW1, value(`Purchases conversion value ${open}1-day view${close}`)),
  ];
  add("19-attribution-split-parentheses.csv", build(split("(", ")"), BASE));
  add("20-attribution-split-brackets.csv", build(split("[", "]"), BASE));
}
add("21-attribution-setting-column.csv", build([name(), spend(), impressions(), purchases(), value(), roas(), fixed("Attribution setting", WINDOW)], BASE));
add(
  "22-attribution-roas-windows-beside-blended.csv",
  build(
    [
      name(), spend(),
      from(VIEW1, roas("Purchase ROAS (return on ad spend) (1-day view)")),
      from(CLICK7, roas("Purchase ROAS (return on ad spend) (7-day click)")),
      purchases(), roas(),
    ],
    BASE
  )
);
add(
  "23-duplicate-roas-header.csv",
  build([name(), spend(), purchases(), roas(), from(VIEW1, roas())], BASE)
);

/* --- Number formats ------------------------------------------------- */
add("24-us-thousands-separators.csv", build([...STANDARD, costPer()], BASE, US));
add("25-eu-semicolon-decimal-comma.csv", build([name(), spend("Amount spent (EUR)"), impressions(), clicks(), purchases(), value(), roas()], BASE, EU), { delimiter: ";" });
add("26-eu-nbsp-thousands.csv", build([name(), spend("Amount spent (EUR)"), impressions(), purchases(), value(), roas()], BASE, { ...EU, group: NBSP }), { delimiter: ";" });
add("27-eu-narrow-nbsp-thousands.csv", build([name(), spend("Amount spent (EUR)"), impressions(), purchases(), value(), roas()], BASE, { ...EU, group: NNBSP }), { delimiter: ";" });
add("28-currency-symbol-prefix-in-cell.csv", build([name(), spend("Amount spent"), purchases(), value(), roas()], BASE, { ...EU, moneyPrefix: "€" }), { delimiter: ";" });
add("29-currency-symbol-suffix-in-cell.csv", build([name(), spend("Amount spent"), purchases(), value(), roas()], BASE, { ...EU, group: NBSP, moneySuffix: `${NBSP}€` }), { delimiter: ";" });
add("30-currency-dollar-in-cell.csv", build([name(), spend("Amount spent"), impressions(), purchases(), value(), roas()], BASE, { ...US, moneyPrefix: "$" }));
add("31-currency-code-in-cell.csv", build([name(), spend("Amount spent"), purchases(), value(), roas()], BASE, { ...EU, moneySuffix: " EUR" }), { delimiter: ";" });
add("32-percent-sign-cells.csv", build([name(), spend(), impressions(), clicks(), ctr(), purchases(), value(), roas()], BASE, { ...US, pctSuffix: "%" }));
add("33-eu-whole-numbers-dot-thousands.csv", build([name(), spend("Amount spent (EUR)"), impressions(), purchases(), value()], INTS, { ...EU, wholeMoney: true }), { delimiter: ";" });
add("34-decimal-comma-in-comma-file.csv", build([name(), spend("Amount spent (EUR)"), impressions(), purchases(), value(), roas()], BASE, EU_PLAIN));
add("35-eu-three-decimal-roas.csv", build([name(), spend("Amount spent (EUR)"), purchases(), value(), roas()], BASE, { ...EU, ratioDigits: 3 }), { delimiter: ";" });
add("36-us-whole-numbers-comma-thousands.csv", build([name(), spend(), impressions(), purchases(), value()], INTS, { ...US, wholeMoney: true }));
add("37-semicolon-with-decimal-points.csv", build(STANDARD, BASE), { delimiter: ";" });

/* --- File structure ------------------------------------------------- */
add("38-summary-row-first.csv", insert(build(STANDARD, BASE), 0, summaryRow(STANDARD, BASE)));
add("39-total-row-last.csv", [...build(STANDARD, BASE), summaryRow(STANDARD, BASE, [], "Total")]);
{
  const m = build(STANDARD, BASE);
  add("40-blank-rows.csv", insert(insert(insert(m, 2, blankRow(m)), 5, blankRow(m), blankRow(m)), 0, blankRow(m)));
}
add("41-quoted-commas-in-names.csv", build([{ header: "Ad name", get: (a) => QUOTED_NAMES[a.name] ?? a.name }, ...STANDARD.slice(1)], BASE, US));
add("42-bom-crlf.csv", build(STANDARD, BASE), { bom: true, eol: "\r\n" });
add("43-tab-delimited.csv", build(STANDARD, BASE, US), { delimiter: "\t", bom: true });
{
  const DAYS = [["2026-10-01"], ["2026-10-02"], ["2026-10-03"]];
  const SHARES3 = [0.5, 0.3, 0.2];
  const period: Col[] = [fixed("Reporting starts", "2026-10-01"), fixed("Reporting ends", "2026-10-03")];
  add("44-day-breakdown.csv", breakdown(["Day"], DAYS, SHARES3, PARTS3, [name(), ...period, spend(), impressions(), purchases(), value(), roas()]));
  add(
    "45-age-breakdown.csv",
    breakdown(["Age"], [["18-24"], ["25-34"], ["35-44"]], [0.2, 0.45, 0.35], PARTS3, [name(), spend(), impressions(), purchases(), value()])
  );
  add(
    "46-placement-breakdown.csv",
    breakdown(
      ["Platform", "Placement"],
      [["Facebook", "Feed"], ["Instagram", "Instagram Reels"]],
      [0.6, 0.4],
      PARTS2,
      [name(), spend(), impressions(), clicks(), purchases(), value(), roas()]
    )
  );
  const dayCols = [name(), spend(), impressions(), purchases(), value(), roas()];
  add("47-day-breakdown-with-summary-row.csv", insert(breakdown(["Day"], DAYS, SHARES3, PARTS3, dayCols), 0, summaryRow(dayCols, BASE, [""])));
  /* ROAS per slice and no value column: the merged ROAS has to be
     recomputed (spend-weighted), never the average of the slices. */
  add("48-day-breakdown-roas-per-slice.csv", breakdown(["Day"], DAYS, [0.7, 0.2, 0.1], PARTS3, [name(), spend(), purchases(), roas()]));
}
{
  /* the same ad name running in two ad sets */
  const m = breakdown(["Ad set name"], [["Prospecting - Broad"], ["Retargeting - 30d"]], [0.75, 0.25], PARTS2, [name(), spend(), impressions(), purchases(), value(), roas()]);
  add("49-same-ad-in-two-ad-sets.csv", [["Campaign name", ...m[0]], ...m.slice(1).map((r) => ["Sales - Evergreen", ...r])]);
}
add(
  "50-wide-export-with-extra-columns.csv",
  build(
    [
      fixed("Reporting starts", "2026-10-01"), fixed("Reporting ends", "2026-10-31"),
      fixed("Campaign name", "Sales - Evergreen"), fixed("Ad set name", "Prospecting - Broad"), name(),
      fixed("Ad delivery", "active"), fixed("Attribution setting", WINDOW),
      results(), resultIndicator(), costPerResults(),
      { header: "Reach", get: (a, s) => num(Math.round(a.impressions / 1.6), "int", s) },
      fixed("Frequency", "1.600000"), spend("Amount spent (EUR)"), impressions(),
      { header: "CPM (cost per 1,000 impressions) (EUR)", get: (a, s) => num((a.spend / a.impressions) * 1000, "ratio", s) },
      clicks(), ctr(),
      { header: "Adds to cart", get: (a, s) => num(a.purchases * 4 + 9, "int", s) },
      { header: "Adds to cart conversion value", get: (a, s) => num(a.value * 4 + 310, "money", s) },
      { header: "Checkouts initiated", get: (a, s) => num(a.purchases * 2 + 3, "int", s) },
      purchases(), value(), roas(), costPer("Cost per purchase (EUR)"),
    ],
    BASE
  )
);

/* --- Localised headers ---------------------------------------------- */
add(
  "51-localized-lt.csv",
  build(
    [name("Skelbimo pavadinimas"), spend("Išleista suma (EUR)"), impressions("Parodymai"), purchases("Pirkimai"), value("Pirkimų konversijos vertė"), roas("Pirkimo ROAS (reklamos išlaidų grąža)")],
    BASE,
    EU
  ),
  { delimiter: ";" }
);
add(
  "52-localized-es.csv",
  build(
    [name("Nombre del anuncio"), spend("Importe gastado (EUR)"), impressions("Impresiones"), purchases("Compras"), value("Valor de conversión de compras"), roas("ROAS de compras (retorno de la inversión publicitaria)")],
    BASE,
    EU
  ),
  { delimiter: ";" }
);
add(
  "53-localized-ar.csv",
  build(
    [name("اسم الإعلان"), spend("المبلغ الذي تم إنفاقه (SAR)"), impressions("مرات الظهور"), purchases("عمليات الشراء"), value("قيمة تحويل عمليات الشراء"), roas("عائد الإنفاق الإعلاني (ROAS) لعمليات الشراء")],
    BASE
  )
);
add(
  "54-localized-de.csv",
  build(
    [name("Anzeigenname"), spend("Ausgegebener Betrag (EUR)"), impressions("Impressionen"), purchases("Käufe"), value("Conversion-Wert der Käufe"), roas("Kauf-ROAS (Return on Ad Spend)")],
    BASE,
    EU
  ),
  { delimiter: ";" }
);

/** Every variant as { file, text } — the test compares these with the
 *  committed CSVs so the two can't drift. */
export const VARIANTS: readonly { file: string; text: string }[] = variants;

if (process.argv[1] && process.argv[1].endsWith("generate.ts")) {
  for (const v of variants) writeFileSync(join(DIR, v.file), v.text, "utf8");
  console.log(`wrote ${variants.length} variants to scripts/fixtures/variants/`);
}
