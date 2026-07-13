import { CTA_PHRASES, detect, OFFER_PATTERNS, POSITIONING_TERMS, TRUST_TERMS, BENEFIT_TERMS } from "../competitor/pageSignals.ts";
import { extractMarketSignals } from "../debrief/marketSignals.ts";
import type { ParsedAdExample } from "./adParser.ts";

/**
 * Native Ads Library copy parser — a SECOND pipeline, not a replacement.
 * The original parser (adParser.ts) is optimized for explicitly labeled
 * input ("Headline: ...", "CTA: ..."); real users almost never paste
 * ads that way — they copy straight out of the Meta Ads Library, which
 * looks like an opening line, an emoji/checkmark bullet list, an offer
 * block, and a bare CTA line ("Learn More"), with no labels at all.
 *
 * This module only runs when `looksLikeAdsLibraryCopy` recognizes that
 * SHAPE (adParser.ts's router checks explicit labels first — this
 * module has no opinion on labels one way or the other). Everything
 * extracted is still a verbatim quote, a fixed regex match, or a
 * keyword-table hit against the SAME shared tables the rest of this
 * codebase already uses (modules/competitor/pageSignals.ts,
 * modules/debrief/marketSignals.ts) — no AI, no OCR, no invented
 * fields. `raw` is never touched; disclaimer paragraphs are excluded
 * from EXTRACTION only, never from what's stored or shown as pasted.
 *
 * DATE_RE/URL_RE are intentionally duplicated (not imported) from
 * adParser.ts: importing them would make adParser.ts and this module
 * depend on each other at runtime in both directions. adParser.ts
 * already depends on this module (to call parseAdsLibraryExample), so
 * keeping this module's only cross-file dependency a type-only import
 * (erased at compile time, zero runtime edge) avoids a real circular
 * import for the sake of two trivial one-line regexes.
 */

const DATE_RE =
  /\b\d{4}-\d{2}-\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/i;
const URL_RE = /\bhttps?:\/\/[^\s)]+/i;

const MAX_HOOK_CHARS = 240;
const MAX_BODY_CHARS = 500;
const CTA_LINE_MAX_WORDS = 5;

/* ------------------------------- line shape -------------------------------- */

const EMOJI_BULLET_RE = /^[ \t]*\p{Extended_Pictographic}\uFE0F?[ \t]*/u;
const MARKER_BULLET_RE = /^[ \t]*(?:[•*✔✓☑]|-(?!-))[ \t]*/;

function isBulletLine(line: string): boolean {
  return EMOJI_BULLET_RE.test(line) || MARKER_BULLET_RE.test(line);
}

function stripBulletMarker(line: string): string {
  return line.replace(EMOJI_BULLET_RE, "").replace(MARKER_BULLET_RE, "").trim();
}

function isBareCtaLine(line: string): boolean {
  const cleaned = line.trim().toLowerCase().replace(/[.!]+$/, "");
  if (cleaned === "" || cleaned.split(/\s+/).length > CTA_LINE_MAX_WORDS) return false;
  return CTA_PHRASES.some((p) => cleaned === p);
}

/**
 * Detection heuristic: does this pasted block have the STRUCTURAL shape
 * of raw Meta Ads Library copy — an emoji/checkmark bullet list, or a
 * short bare CTA line on its own (the rendered button text) — rather
 * than plain prose? Deliberately narrow and positive-signal-only (never
 * "absence of labels" alone) so a short free-text note doesn't get
 * mis-routed here. Has no opinion on explicit field labels — the
 * caller (adParser.ts's parseAdExample router) checks those FIRST and
 * only calls this for text that has none.
 */
export function looksLikeAdsLibraryCopy(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed === "") return false;
  const lines = trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
  if (lines.length < 2) return false;
  if (lines.filter(isBulletLine).length >= 2) return true;
  return isBareCtaLine(lines[lines.length - 1]);
}

/* ------------------------------- disclaimers -------------------------------- */

/** Paragraph-level patterns for the boilerplate that Ads Library copy
 *  routinely carries alongside the real ad text — FDA/legal disclaimers,
 *  study footnotes, copyright, and bare "see more at <url>" reference
 *  lines. A paragraph matching any of these is excluded from extraction
 *  entirely (never becomes a hook/benefit/trust signal) but is still
 *  preserved verbatim in `raw` and listed in `ignoredDisclaimers` so
 *  nothing is silently dropped without being shown. Deliberately
 *  specific phrasing (not a bare "\bfda\b" match) so a genuine claim
 *  like "FDA-registered facility" is never swallowed as a disclaimer. */
const DISCLAIMER_PATTERNS: RegExp[] = [
  /this statement has not been evaluated/i,
  /not (?:been )?evaluated by the (?:u\.?s\.?\s*)?food and drug administration/i,
  /\bfda\b.{0,15}(?:has not|hasn'?t|not been)/i,
  /not intended to diagnose,?\s*treat,?\s*cure,?\s*(?:or\s*)?prevent/i,
  /terms (?:and|&) conditions (?:apply|may apply)/i,
  /\bsee (?:full |complete )?terms\b/i,
  /\*?\s*results may vary/i,
  /individual results may vary/i,
  /consult (?:your|a) (?:doctor|physician|healthcare provider)/i,
  /^\s*[[(]?\d{1,2}[)\]][ \t]*\S/, // numbered footnote line, e.g. "[1] Based on a 2023 study"
  /^\s*[*†‡§¹²³]+[ \t]*\S/, // symbol-footnote line
  /©|\ball rights reserved\b|\bcopyright\b/i,
  /^\s*(?:visit|see|learn more at)?[ \t]*(?:https?:\/\/|www\.)\S+[ \t]*$/i, // bare reference line
  /\bsponsored\b/i,
  /\bbased on a (?:survey|study) of\b/i,
];

function isDisclaimerParagraph(paragraph: string): boolean {
  return DISCLAIMER_PATTERNS.some((re) => re.test(paragraph));
}

function splitParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p !== "");
}

/* ------------------------------ bullet triage ------------------------------- */

interface BulletBucket {
  offers: string[];
  trust: string[];
  benefits: string[];
}

/** Each bullet line is classified by its OWN text against the same
 *  shared tables everything else uses — an offer pattern or a bare
 *  "free" wins first (bullets like "FREE Travel Packs" never carry
 *  enough context to hit OFFER_PATTERNS' phrase-based regexes alone),
 *  then a trust-term hit, else it's a plain benefit line. This is what
 *  turns "bullet lists" into "benefits" per the brief, without a new
 *  keyword vocabulary — just structural parsing on top of the existing
 *  tables. */
function classifyBullets(lines: string[]): BulletBucket {
  const bucket: BulletBucket = { offers: [], trust: [], benefits: [] };
  for (const rawLine of lines) {
    const text = stripBulletMarker(rawLine);
    if (text === "") continue;
    if (OFFER_PATTERNS.some((re) => re.test(text)) || /\bfree\b/i.test(text)) {
      bucket.offers.push(text);
    } else if (detect(TRUST_TERMS, text).length > 0) {
      bucket.trust.push(text);
    } else {
      bucket.benefits.push(text);
    }
  }
  return bucket;
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items));
}

/**
 * The native pipeline: paragraph-split → drop disclaimer paragraphs →
 * classify each remaining paragraph as a bare CTA line, a bullet list,
 * or prose → infer hook (first prose paragraph) / body (the rest) →
 * classify bullets into offer/trust/benefit → run the same shared
 * keyword tables (positioning/trust/benefits/hooks/formats) over the
 * disclaimer-free text. Same honesty contract as the labeled parser:
 * every field is a verbatim quote or a table hit, nothing invented,
 * and `raw` keeps the full original text untouched.
 */
export function parseAdsLibraryExample(raw: string): ParsedAdExample {
  const trimmed = raw.trim();
  const paragraphs = splitParagraphs(trimmed);

  const ignoredDisclaimers: string[] = [];
  const keptParagraphs: string[] = [];
  const bulletLines: string[] = [];
  const proseParagraphs: string[] = [];
  let bareCta: string | undefined;

  for (const paragraph of paragraphs) {
    if (isDisclaimerParagraph(paragraph)) {
      ignoredDisclaimers.push(paragraph);
      continue;
    }

    const lines = paragraph
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "");

    if (lines.length === 1 && isBareCtaLine(lines[0])) {
      if (!bareCta) bareCta = lines[0];
      continue;
    }

    const bulletCount = lines.filter(isBulletLine).length;
    if (bulletCount > 0 && bulletCount >= lines.length - 1) {
      for (const line of lines) {
        if (isBulletLine(line)) bulletLines.push(line);
      }
      keptParagraphs.push(paragraph);
      continue;
    }

    proseParagraphs.push(paragraph);
    keptParagraphs.push(paragraph);
  }

  const cleanedText = keptParagraphs.join("\n\n");
  const bucket = classifyBullets(bulletLines);

  const hook = proseParagraphs[0]?.slice(0, MAX_HOOK_CHARS);
  const bodyParagraphs = proseParagraphs.slice(1);
  const body = bodyParagraphs.length > 0 ? bodyParagraphs.join(" ").slice(0, MAX_BODY_CHARS) : undefined;

  const lowerCleaned = cleanedText.toLowerCase();
  const cta = bareCta ?? CTA_PHRASES.find((p) => lowerCleaned.includes(p));

  let offerFallback: string | undefined;
  if (bucket.offers.length === 0) {
    for (const re of OFFER_PATTERNS) {
      const m = cleanedText.match(re);
      if (m) {
        offerFallback = m[0].replace(/\s+/g, " ").trim();
        break;
      }
    }
  }
  const offer = bucket.offers.length > 0 ? bucket.offers.join(", ") : offerFallback;

  const startDate = cleanedText.match(DATE_RE)?.[0];
  const landingPage = cleanedText.match(URL_RE)?.[0];

  const marketSignals = extractMarketSignals(cleanedText);
  const positioning = detect(POSITIONING_TERMS, cleanedText);
  const trustCategories = detect(TRUST_TERMS, cleanedText);
  const benefitCategories = detect(BENEFIT_TERMS, cleanedText);

  const detectedFormats = dedupe(
    bulletLines.length >= 2 ? [...marketSignals.formats, "bullet-list / callout format"] : marketSignals.formats
  );

  return {
    raw: trimmed,
    parseMode: "native",
    ...(hook && { hook }),
    ...(cta && { cta }),
    ...(offer && { offer }),
    ...(startDate && { startDate }),
    ...(landingPage && { landingPage }),
    ...(body && { body }),
    ...(ignoredDisclaimers.length > 0 && { ignoredDisclaimers }),
    detectedHooks: marketSignals.hooks,
    detectedFormats,
    detectedOffers: dedupe([...marketSignals.offers, ...bucket.offers]),
    detectedPositioning: positioning,
    detectedTrust: dedupe([...trustCategories, ...bucket.trust]),
    detectedBenefits: dedupe([...benefitCategories, ...bucket.benefits]),
  };
}
