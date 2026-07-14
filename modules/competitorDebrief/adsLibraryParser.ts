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
// Long-form testimonial/story ads (AG1/Huel/ColonBroom-style) routinely
// run several hundred words across multiple paragraphs — the previous
// 500-char cap threw away most of that content instead of surfacing it
// as evidence.
const MAX_BODY_CHARS = 2000;
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

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/* Bounds for the multi-paragraph prose signal below. The MIN floor
 * stays tight (rejects two short junk fragments that happen to split
 * into two "paragraphs" — "asdf jkl." / "qwer tyui." must never
 * qualify). The MAX bounds are deliberately generous: real long-form
 * story/testimonial ads (AG1/Huel/ColonBroom-style — an opening line,
 * several testimonial paragraphs, sometimes a "Week 1... Week 4..."
 * timeline) routinely run 200-600 words across paragraphs that
 * individually run 60-150 words. A tight cap here was the main reason
 * such ads fell through to the poorer "plain" fallback (no hook/body/
 * story split, no disclaimer stripping) — being long is not, on its
 * own, evidence that a block ISN'T ad copy; the structural requirement
 * (2+ genuine paragraphs, not one undifferentiated blob) is what
 * separates real ad copy from an arbitrary text dump, not length. */
const MINIMAL_PARAGRAPH_MIN_WORDS = 2;
const MAX_PARAGRAPH_WORDS = 200;
const MINIMAL_TOTAL_MIN_WORDS = 8;
const MAX_TOTAL_WORDS = 700;

/**
 * Second, narrower structural signal: two or more prose paragraphs, no
 * bullets, no bare CTA line — anything from a minimal "hook line, then
 * a body paragraph" ad ("Millions of meals served.\n\nJoin people
 * replacing unhealthy convenience food...") up to a full long-form
 * testimonial ad. The primary bullet/CTA-line signal above never fires
 * for this shape (nothing's bulleted, no button line), so without this
 * check such ads fell through to the single-paragraph "plain" fallback
 * and lost the hook/body/story split entirely — even though it's
 * exactly as unlabeled as the bulleted case. Every paragraph must be
 * non-bulleted and within the per-paragraph word bound, AND the total
 * word count must clear a small floor (MINIMAL_TOTAL_MIN_WORDS) and
 * stay under a generous ceiling (MAX_TOTAL_WORDS) — the ceiling exists
 * only to keep an unrelated multi-thousand-word document paste from
 * being treated as "one ad", not to exclude genuinely long ad copy.
 */
function looksLikeMultiParagraphProseAd(trimmed: string): boolean {
  const paragraphs = splitParagraphs(trimmed);
  if (paragraphs.length < 2) return false;

  const total = wordCount(trimmed);
  if (total < MINIMAL_TOTAL_MIN_WORDS || total > MAX_TOTAL_WORDS) return false;

  return paragraphs.every((paragraph) => {
    const lines = paragraph
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "");
    if (lines.some(isBulletLine)) return false;
    const words = wordCount(paragraph);
    return words >= MINIMAL_PARAGRAPH_MIN_WORDS && words <= MAX_PARAGRAPH_WORDS;
  });
}

/**
 * Detection heuristic: does this pasted block have the STRUCTURAL shape
 * of raw Meta Ads Library copy — an emoji/checkmark bullet list, a
 * short bare CTA line on its own (the rendered button text), or two or
 * more genuine prose paragraphs (from a minimal hook+body pair up to a
 * full long-form story ad) — rather than one undifferentiated block of
 * prose? Deliberately structure-based and positive-signal-only (never
 * "absence of labels" alone, and never gated on LENGTH — a long-form
 * testimonial ad is exactly as legitimately "Ads Library shaped" as a
 * short one) so a short free-text note doesn't get mis-routed here.
 * Has no opinion on explicit field labels — the caller (adParser.ts's
 * parseAdExample router) checks those FIRST and only calls this for
 * text that has none.
 */
export function looksLikeAdsLibraryCopy(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed === "") return false;
  const lines = trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
  if (lines.length >= 2) {
    if (lines.filter(isBulletLine).length >= 2) return true;
    if (isBareCtaLine(lines[lines.length - 1])) return true;
  }
  return looksLikeMultiParagraphProseAd(trimmed);
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

/* ------------------------------- prose triage -------------------------------- */
/* Structure-aware extraction for UNBULLETED prose — the gap that left long-form  */
/* story/testimonial ads (AG1/Huel/ColonBroom-style) mostly "missing" even once   */
/* they were correctly detected as native-shaped: classifyBullets above only      */
/* looks at bullet LINES, but real ad copy just as often states a benefit, a      */
/* proof point, an offer, or a positioning claim as an ordinary sentence inside a */
/* flowing paragraph. This generalizes the same idea (classify each discrete unit */
/* against the shared keyword tables, keep the verbatim quote) to prose UNITS —   */
/* a line where the copy already has line breaks (most Ads Library ad text does,  */
/* including "Week 1... Week 4..." timelines), else a sentence.                   */

const TIMELINE_UNIT_RE = /^(?:week|day|month)\s*\d+\b/i;
/** Recognizes a paragraph as first-person narrative/testimonial in
 *  SHAPE — deliberately narrow, structural markers only (never a
 *  sentiment/topic judgment), mirroring the same intent as
 *  strategicPatterns.ts's isFirstPersonStory check one layer up (that
 *  file is engine-only and cross-ad; this is a separate, parser-local
 *  copy for a single-ad, single-paragraph purpose — same reasoning as
 *  DATE_RE/URL_RE staying duplicated rather than shared, see the
 *  module doc comment above). */
const FIRST_PERSON_STORY_RE = /\bi\s+(?:used\s+to|was|felt|struggled|started|tried|found|noticed)\b/i;
const STORY_INTRO_RE = /\bmy\s+(?:journey|story|life)\b|\bsince\s+\d{4}\b/i;

const MIN_UNIT_WORDS = 3;
const MAX_STORY_ITEMS = 8;

/** Naive, deterministic sentence split — good enough for pulling
 *  quotable units out of flowing prose without any real NLP. Minor
 *  imperfections (an abbreviation causing an extra split) only ever
 *  produce a slightly shorter verbatim fragment, never fabricated
 *  content, which is the only property that actually matters here. */
function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+(?:\s+|$)/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

/** Each line is a candidate unit (this is how "Week 1: ...\nWeek 2:
 *  ...\n..." timeline entries get split apart even with no sentence-
 *  ending punctuation); a line that's itself a long flowing sentence
 *  or two is further split by sentence, so a single dense paragraph
 *  still yields multiple distinct, quotable units. */
function extractProseUnits(paragraph: string): string[] {
  const lines = paragraph
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
  const units: string[] = [];
  for (const line of lines) {
    const sentences = splitSentences(line);
    units.push(...(sentences.length > 0 ? sentences : [line]));
  }
  return units;
}

interface ProseEvidence {
  offers: string[];
  trust: string[];
  benefits: string[];
  positioning: string[];
  story: string[];
}

/**
 * Classifies every unit (line or sentence) across the given prose
 * paragraphs. Unlike classifyBullets, there is deliberately NO "default
 * to benefit" fallback here: a bullet list is discrete claims by
 * construction, so an unmatched bullet is still safely treated as one;
 * an ordinary prose sentence carries no such guarantee (most sentences
 * in a testimonial are connective narrative, not a specific claim), so
 * only units that hit an EXISTING keyword table become benefit/trust/
 * offer/positioning evidence — conservative by construction, never a
 * guess. A unit that doesn't hit any of those tables but sits inside a
 * recognized first-person/testimonial paragraph (or is itself a "Week
 * N"/"Day N"/"Month N" timeline entry, regardless of which paragraph
 * it's in) is still captured — as `story`, honestly labeled as
 * narrative rather than silently dropped or mislabeled as something
 * more specific than it is.
 */
function classifyProseUnits(paragraphs: string[]): ProseEvidence {
  const evidence: ProseEvidence = { offers: [], trust: [], benefits: [], positioning: [], story: [] };

  for (const paragraph of paragraphs) {
    const isStoryParagraph = FIRST_PERSON_STORY_RE.test(paragraph) || STORY_INTRO_RE.test(paragraph);

    for (const unit of extractProseUnits(paragraph)) {
      if (unit.split(/\s+/).filter(Boolean).length < MIN_UNIT_WORDS) continue;

      const isTimelineUnit = TIMELINE_UNIT_RE.test(unit);
      if (isTimelineUnit) evidence.story.push(unit);

      if (OFFER_PATTERNS.some((re) => re.test(unit)) || /\bfree\b/i.test(unit)) {
        evidence.offers.push(unit);
      } else if (detect(TRUST_TERMS, unit).length > 0) {
        evidence.trust.push(unit);
      } else if (detect(BENEFIT_TERMS, unit).length > 0) {
        evidence.benefits.push(unit);
      } else if (detect(POSITIONING_TERMS, unit).length > 0) {
        evidence.positioning.push(unit);
      } else if (isStoryParagraph && !isTimelineUnit) {
        evidence.story.push(unit);
      }
    }
  }

  return {
    offers: evidence.offers,
    trust: evidence.trust,
    benefits: evidence.benefits,
    positioning: evidence.positioning,
    story: dedupe(evidence.story).slice(0, MAX_STORY_ITEMS),
  };
}

/**
 * The native pipeline: paragraph-split → drop disclaimer paragraphs →
 * classify each remaining paragraph as a bare CTA line, a bullet list,
 * or prose → infer hook (first prose paragraph) / body (the rest) →
 * classify bullets into offer/trust/benefit AND classify prose units
 * (lines/sentences within unbulleted paragraphs) the same way, plus
 * story/narrative recognition (first-person testimonial paragraphs,
 * "Week N"/"Day N"/"Month N" timeline entries) → run the same shared
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
  const prose = classifyProseUnits(proseParagraphs);

  const hook = proseParagraphs[0]?.slice(0, MAX_HOOK_CHARS);
  const bodyParagraphs = proseParagraphs.slice(1);
  const body = bodyParagraphs.length > 0 ? bodyParagraphs.join(" ").slice(0, MAX_BODY_CHARS) : undefined;
  const story = prose.story.length > 0 ? prose.story : undefined;

  const lowerCleaned = cleanedText.toLowerCase();
  const cta = bareCta ?? CTA_PHRASES.find((p) => lowerCleaned.includes(p));

  // Priority: a bulleted offer list wins (most structured), then an
  // offer-shaped prose sentence (still a specific, isolated claim),
  // then a single whole-text pattern match as the last resort.
  let offer: string | undefined;
  if (bucket.offers.length > 0) {
    offer = bucket.offers.join(", ");
  } else if (prose.offers.length > 0) {
    offer = prose.offers.join(", ");
  } else {
    for (const re of OFFER_PATTERNS) {
      const m = cleanedText.match(re);
      if (m) {
        offer = m[0].replace(/\s+/g, " ").trim();
        break;
      }
    }
  }

  const startDate = cleanedText.match(DATE_RE)?.[0];
  const landingPage = cleanedText.match(URL_RE)?.[0];

  const marketSignals = extractMarketSignals(cleanedText);
  const positioning = dedupe([...detect(POSITIONING_TERMS, cleanedText), ...prose.positioning]);
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
    ...(story && { story }),
    ...(ignoredDisclaimers.length > 0 && { ignoredDisclaimers }),
    detectedHooks: marketSignals.hooks,
    detectedFormats,
    detectedOffers: dedupe([...marketSignals.offers, ...bucket.offers, ...prose.offers]),
    detectedPositioning: positioning,
    detectedTrust: dedupe([...trustCategories, ...bucket.trust, ...prose.trust]),
    detectedBenefits: dedupe([...benefitCategories, ...bucket.benefits, ...prose.benefits]),
  };
}
