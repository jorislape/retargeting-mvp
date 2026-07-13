import type { CompetitorPageSignals, PageTextParts } from "./types";

/**
 * Deterministic signal extraction from fetched page text — the same
 * honesty policy as marketSignals.ts: keyword tables, no inference, no
 * external AI. Everything returned is something the page visibly says
 * ("observed on page"), never a claim about spend, traffic, or
 * performance. Pure string work, client-safe.
 */

const MAX_HEADLINE_CHARS = 140;
const MAX_LIST_ITEMS = 6;

/** CTA phrases worth reporting when a button/link (or the page text)
 *  carries them. Exported so other pure text-interpretation modules
 *  (e.g. modules/competitorDebrief's bulk ad-example parser) can reuse
 *  the same phrase list without a second judgment table. */
export const CTA_PHRASES = [
  "shop now",
  "buy now",
  "get started",
  "start free",
  "try now",
  "try it free",
  "free trial",
  "start your trial",
  "subscribe & save",
  "subscribe now",
  "subscribe",
  "sign up",
  "join now",
  "order now",
  "add to cart",
  "get yours",
  "claim your",
  "book a demo",
  "get the app",
  "take the quiz",
  // Meta's own Ads Manager CTA button vocabulary — missing these meant
  // pasted Ads Library copy (which usually carries the rendered button
  // text as its own trailing line) never matched a known CTA at all.
  "learn more",
  "download",
  "install now",
  "get quote",
  "contact us",
  "book now",
  "apply now",
  "watch more",
  "get offer",
  "send message",
];

/** Offer phrasing — matched text is restated, never embellished. */
export const OFFER_PATTERNS: RegExp[] = [
  /\b\d{1,2}%\s?off\b[^.!\n]{0,30}/i,
  /\bfree shipping\b/i,
  /\bfree (?:trial|sample|gift)\b/i,
  /\bfirst[\s-]order\b[^.!\n]{0,20}/i,
  /\bbundle(?:\s?(?:&|and)\s?save)?\b/i,
  /\bbuy one,? get one\b|\bbogo\b/i,
  /\bsubscribe\s?(?:&|and)\s?save\b/i,
  /\bdiscount code\b/i,
  /\bstudent discount\b/i,
  /\bsale\b/i,
  // Generic "FREE <thing>" — Ads Library copy commonly lists free gifts
  // by product name ("FREE Travel Packs") rather than the narrower
  // free (?:trial|sample|gift) phrasing above.
  /\bfree\s+[a-z][\w+&-]*(?:\s+[a-z][\w+&-]*){0,4}/i,
];

export const POSITIONING_TERMS: { label: string; re: RegExp }[] = [
  { label: "science-backed", re: /science[\s-]?backed|backed by science|lab[\s-]tested/i },
  { label: "clinically tested", re: /clinically\s(?:tested|proven|studied)/i },
  { label: "dermatologist-endorsed", re: /dermatologist[\s-](?:tested|approved|recommended|developed)/i },
  { label: "ingredient-led", re: /\bingredients?[\s-]?(?:first|led|list)|active ingredients?/i },
  { label: "natural / clean", re: /\b(?:all[\s-])?natural\b|\bclean (?:beauty|formula|ingredients)|\borganic\b/i },
  { label: "vegan / cruelty-free", re: /\bvegan\b|cruelty[\s-]?free/i },
  { label: "premium", re: /\bpremium\b|\bluxury\b/i },
  { label: "affordable", re: /\baffordable\b|\bbudget[\s-]friendly\b|won'?t break the bank/i },
  { label: "routine-based", re: /\broutine\b|\bregimen\b|\britual\b/i },
  { label: "problem-first", re: /problem[\s-](?:first|led)|tired of\b|struggling with\b/i },
  { label: "founder-led", re: /\bfounders?\b|our story|why (?:we|i) (?:built|made|started)/i },
  { label: "sustainable", re: /\bsustainab|\beco[\s-]?friendly|\brecyclable\b/i },
  { label: "personalized", re: /\bpersonali[sz]ed\b|\bcustomi[sz]ed\b|\btailored\b/i },
];

export const BENEFIT_TERMS: { label: string; re: RegExp }[] = [
  { label: "hydration", re: /\bhydrat|\bmoisturi[sz]/i },
  { label: "sensitive skin", re: /sensitive skin/i },
  { label: "acne / blemishes", re: /\bacne\b|\bblemish|\bbreakout/i },
  { label: "pores", re: /\bpores?\b/i },
  { label: "SPF / sun protection", re: /\bspf\b|sun protection|\buva?b?\b/i },
  { label: "fragrance-free", re: /fragrance[\s-]?free|unscented/i },
  { label: "lightweight", re: /\blightweight\b|non[\s-]?greasy|fast[\s-]absorbing/i },
  { label: "fast results", re: /fast results|results in \d+\s?(?:days?|weeks?)|\bin just \d+/i },
  { label: "anti-aging", re: /anti[\s-]?aging|\bwrinkle|fine lines/i },
  { label: "brightening / glow", re: /\bbrighten|\bglow\b|\bradian(?:ce|t)\b|\bdull(?:ness)?\b/i },
  { label: "soothing / calming", re: /\bsooth|\bcalm(?:ing)?\b|\bredness\b/i },
  { label: "barrier repair", re: /\bbarrier\b|\brepair/i },
  { label: "easy to use", re: /easy to use|\beffortless\b|in seconds\b/i },
  { label: "saves time", re: /save[s]? (?:you )?time|\btime[\s-]saving/i },
];

export const TRUST_TERMS: { label: string; re: RegExp }[] = [
  { label: "customer reviews / ratings", re: /\breviews?\b|\bratings?\b|\bstars?\b|★|\b[45](?:\.\d)?\s?\/\s?5\b/i },
  { label: "testimonials", re: /testimonial/i },
  { label: "dermatologist mention", re: /dermatologist/i },
  { label: "clinical claims", re: /clinical(?:ly)?\s|\bclinical stud/i },
  { label: "guarantee / risk-reversal", re: /guarante|money[\s-]?back|risk[\s-]?free/i },
  { label: "awards", re: /\baward/i },
  { label: "press mentions", re: /as seen in|featured in|\bpress\b/i },
  { label: "before/after", re: /before[\s/&-]*after/i },
  { label: "customer count", re: /\b[\d,.]+(?:k|m|\+|,000)\s?(?:\+\s?)?(?:happy\s)?(?:customers|members|users|sold)\b/i },
  {
    label: "celebrity / influencer endorsement",
    // "trusted by" excludes the generic "trusted by 50,000 customers"
    // social-proof phrasing (already its own "customer count" term
    // below) so this label stays specific to a named person/brand.
    re: /\brelies on\b|\btrusted by\b(?!\s+(?:over\s+)?[\d,]+)|\bendorsed by\b|\bambassador\b|\bpartnered with\b/i,
  },
];

/** Exported so other pure text-interpretation modules (e.g.
 *  modules/competitorDebrief) can reuse the same term tables against
 *  their own text without duplicating the keyword judgment calls. */
export function detect(terms: { label: string; re: RegExp }[], text: string): string[] {
  return terms
    .filter((t) => t.re.test(text))
    .map((t) => t.label)
    .slice(0, MAX_LIST_ITEMS);
}

/**
 * Page text parts → signals. Deterministic, and only restates what was
 * found: `headline` is the page's own h1/title, `cta` a real button or
 * link label, `offer` the matched offer phrasing, the rest keyword
 * labels. Returns null when nothing usable was found at all.
 */
export function extractPageSignals(
  parts: PageTextParts
): CompetitorPageSignals | null {
  const scanText = [
    parts.title,
    parts.metaDescription,
    parts.headings.join("\n"),
    parts.bodyText,
  ].join("\n");

  const headline = (parts.headings[0] || parts.title)
    .slice(0, MAX_HEADLINE_CHARS)
    .trim();

  /* A CTA is only reported when a real button/link label matches a
     known phrase; failing that, a phrase present in the page text. */
  let cta: string | undefined;
  for (const candidate of parts.ctaCandidates) {
    const lower = candidate.toLowerCase();
    if (CTA_PHRASES.some((p) => lower.includes(p))) {
      cta = candidate;
      break;
    }
  }
  if (!cta) {
    const lower = scanText.toLowerCase();
    cta = CTA_PHRASES.find((p) => lower.includes(p));
  }

  const offerMatches: string[] = [];
  for (const re of OFFER_PATTERNS) {
    const m = scanText.match(re);
    if (!m) continue;
    const phrase = m[0].replace(/\s+/g, " ").trim().toLowerCase();
    /* Skip phrases already contained in a longer match ("first order"
       inside "20% off your first order"). */
    if (!offerMatches.some((p) => p.includes(phrase))) offerMatches.push(phrase);
    if (offerMatches.length >= 3) break;
  }
  const offer = offerMatches.length > 0 ? offerMatches.join(", ") : undefined;

  const positioning = detect(POSITIONING_TERMS, scanText);
  const benefits = detect(BENEFIT_TERMS, scanText);
  const trustSignals = detect(TRUST_TERMS, scanText);
  const rawSummary = parts.metaDescription.slice(0, 220).trim() || undefined;

  const signals: CompetitorPageSignals = {
    ...(headline !== "" && { headline }),
    ...(cta && { cta }),
    ...(offer && { offer }),
    ...(positioning.length > 0 && { positioning: positioning.join(", ") }),
    ...(benefits.length > 0 && { benefits }),
    ...(trustSignals.length > 0 && { trustSignals }),
    ...(rawSummary && { rawSummary }),
  };

  return Object.keys(signals).length > 0 ? signals : null;
}

/* ------------------------------------------------------------------ */
/* Notes serialization — how fetched signals reach the market-notes    */
/* flow. The block goes into the competitor source's Notes field (the  */
/* user reviews it there); it reaches the report only through the      */
/* existing "Use as market notes" → marketContext path. Append-only,   */
/* directional wording, never a performance claim.                     */
/* ------------------------------------------------------------------ */

/** Serializes signals as a notes block. `host` labels where the
 *  signals came from (display only — nothing is fetched here). */
export function formatPageSignalsAsNotes(
  signals: CompetitorPageSignals,
  host?: string
): string {
  const offerCta = [
    signals.offer,
    signals.cta ? `CTA "${signals.cta}"` : null,
  ].filter(Boolean);

  const lines: string[] = [
    `Fetched page signals${host ? ` (${host})` : ""} — observed on page, directional only:`,
  ];
  if (signals.headline) lines.push(`- Headline: ${signals.headline}`);
  if (offerCta.length > 0) lines.push(`- Offer / CTA: ${offerCta.join(" · ")}`);
  if (signals.positioning) lines.push(`- Positioning: ${signals.positioning}`);
  if (signals.benefits && signals.benefits.length > 0) {
    lines.push(`- Claims / benefits: page mentions ${signals.benefits.join(", ")}`);
  }
  if (signals.trustSignals && signals.trustSignals.length > 0) {
    lines.push(`- Social proof / trust: ${signals.trustSignals.join(", ")}`);
  }
  if (signals.rawSummary) lines.push(`- Page summary: ${signals.rawSummary}`);
  return lines.join("\n");
}

/** Appends the block to existing notes without touching what the user
 *  wrote. An identical block already present is a no-op, so a repeat
 *  fetch of an unchanged page can't duplicate itself. */
export function appendPageSignalsToNotes(
  existingNotes: string,
  block: string
): string {
  const existing = existingNotes.trim();
  if (existing.includes(block)) return existingNotes;
  return existing === "" ? block : `${existing}\n\n${block}`;
}
