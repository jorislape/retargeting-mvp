import { CTA_PHRASES, detect, OFFER_PATTERNS, POSITIONING_TERMS, TRUST_TERMS, BENEFIT_TERMS } from "../competitor/pageSignals.ts";
import { extractMarketSignals } from "../debrief/marketSignals.ts";

/**
 * Bulk ad-example parsing — splits one pasted blob into multiple ad
 * blocks and extracts structured fields from each, deterministically.
 * No network access, no AI call: labeled fields ("Headline: ...") are
 * matched with fixed regexes, and thematic fields (hooks/formats/
 * offers/positioning/trust/benefits) reuse the SAME keyword tables the
 * single-paste flow already uses (modules/debrief/marketSignals.ts,
 * modules/competitor/pageSignals.ts) — never a second judgment system.
 *
 * Honesty policy: every field is either an explicit label match, a
 * verbatim regex match (CTA phrase, offer phrase, date, URL), or a
 * keyword-table hit. Nothing is inferred or guessed — an absent field
 * stays absent. `raw` always preserves the original block text
 * untouched, so nothing extracted is ever the only record of what was
 * pasted.
 */

export interface ParsedAdExample {
  /** The original pasted block, verbatim. */
  raw: string;
  /** Explicit "Hook:" / "Primary text:" label value, when present. */
  hook?: string;
  /** Explicit "Headline:" / "Title:" label value, when present. */
  headline?: string;
  /** Explicit "CTA:" label, or a matched CTA phrase found in the text. */
  cta?: string;
  /** Explicit "Offer:" label, or a matched offer phrase found in the text. */
  offer?: string;
  /** Explicit "Format:" label, when present. */
  format?: string;
  /** Explicit "Start date:"/"Date:" label, or a date-like pattern found
   *  in the text. */
  startDate?: string;
  /** Explicit "Landing page:"/"URL:" label, or the first URL found in
   *  the text — reference only, never fetched. */
  landingPage?: string;
  /** Keyword-detected themes — same tables as the single-paste flow. */
  detectedHooks: string[];
  detectedFormats: string[];
  detectedOffers: string[];
  detectedPositioning: string[];
  detectedTrust: string[];
  detectedBenefits: string[];
}

const SEPARATOR_LINE_RE = /^[ \t]*[-=*_]{3,}[ \t]*$/;
const LABEL_LINE_RE = /^[ \t]*(?:ad|example)[ \t]*#?[ \t]*\d+[ \t]*[:.\-–—]?[ \t]*(.*)$/i;

/**
 * Splits bulk pasted text into individual ad blocks. Prefers explicit
 * markers (separator lines like "---", or repeated labels like
 * "Ad 1", "Example 2:") when any are present; otherwise falls back to
 * blank-line-run boundaries. A single block with no markers and no
 * blank-line runs is returned as one ad — never silently dropped.
 */
export function splitAdBlocks(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized === "") return [];

  const lines = normalized.split("\n");
  const hasMarkers = lines.some(
    (l) => SEPARATOR_LINE_RE.test(l) || LABEL_LINE_RE.test(l)
  );

  if (hasMarkers) {
    const blocks: string[] = [];
    let current: string[] = [];
    for (const line of lines) {
      if (SEPARATOR_LINE_RE.test(line)) {
        if (current.length > 0) blocks.push(current.join("\n").trim());
        current = [];
        continue;
      }
      const labelMatch = line.match(LABEL_LINE_RE);
      if (labelMatch) {
        if (current.length > 0) blocks.push(current.join("\n").trim());
        current = labelMatch[1] ? [labelMatch[1]] : [];
        continue;
      }
      current.push(line);
    }
    if (current.length > 0) blocks.push(current.join("\n").trim());
    return blocks.filter((b) => b !== "");
  }

  const blocks = normalized
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b !== "");
  return blocks.length > 0 ? blocks : [normalized];
}

const LABELED_FIELD_PATTERNS: { key: keyof Pick<ParsedAdExample, "hook" | "headline" | "cta" | "offer" | "format" | "startDate" | "landingPage">; re: RegExp }[] = [
  { key: "hook", re: /^[ \t]*(?:hook|primary\s*text)[ \t]*[:\-–—][ \t]*(.+)$/im },
  { key: "headline", re: /^[ \t]*(?:headline|title)[ \t]*[:\-–—][ \t]*(.+)$/im },
  { key: "cta", re: /^[ \t]*(?:cta|call[\s-]to[\s-]action)[ \t]*[:\-–—][ \t]*(.+)$/im },
  { key: "offer", re: /^[ \t]*offer[ \t]*[:\-–—][ \t]*(.+)$/im },
  { key: "format", re: /^[ \t]*format[ \t]*[:\-–—][ \t]*(.+)$/im },
  { key: "startDate", re: /^[ \t]*(?:start\s*date|date)[ \t]*[:\-–—][ \t]*(.+)$/im },
  { key: "landingPage", re: /^[ \t]*(?:landing\s*page|url|link)[ \t]*[:\-–—][ \t]*(.+)$/im },
];

const DATE_RE =
  /\b\d{4}-\d{2}-\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b/i;
const URL_RE = /\bhttps?:\/\/[^\s)]+/i;

/** Parses one ad block into structured fields. Labels win when
 *  present; otherwise falls back to a verbatim pattern match (CTA
 *  phrase, offer phrase, date, URL) — never a guess. */
export function parseAdExample(raw: string): ParsedAdExample {
  const trimmed = raw.trim();

  const labeled: Partial<Record<string, string>> = {};
  for (const { key, re } of LABELED_FIELD_PATTERNS) {
    const m = trimmed.match(re);
    if (m?.[1]) labeled[key] = m[1].trim();
  }

  const lower = trimmed.toLowerCase();
  const cta =
    labeled.cta ?? CTA_PHRASES.find((p) => lower.includes(p));

  let offer = labeled.offer;
  if (!offer) {
    for (const re of OFFER_PATTERNS) {
      const m = trimmed.match(re);
      if (m) {
        offer = m[0].replace(/\s+/g, " ").trim();
        break;
      }
    }
  }

  const startDate = labeled.startDate ?? trimmed.match(DATE_RE)?.[0];
  const landingPage = labeled.landingPage ?? trimmed.match(URL_RE)?.[0];

  const marketSignals = extractMarketSignals(trimmed);
  const positioning = detect(POSITIONING_TERMS, trimmed);
  const trust = detect(TRUST_TERMS, trimmed);
  const benefits = detect(BENEFIT_TERMS, trimmed);

  return {
    raw: trimmed,
    ...(labeled.hook && { hook: labeled.hook }),
    ...(labeled.headline && { headline: labeled.headline }),
    ...(cta && { cta }),
    ...(offer && { offer }),
    ...(labeled.format && { format: labeled.format }),
    ...(startDate && { startDate }),
    ...(landingPage && { landingPage }),
    detectedHooks: marketSignals.hooks,
    detectedFormats: marketSignals.formats,
    detectedOffers: marketSignals.offers,
    detectedPositioning: positioning,
    detectedTrust: trust,
    detectedBenefits: benefits,
  };
}

/** Splits and parses bulk pasted ad text in one call — the primary
 *  entry point for the "Paste ads" flow. */
export function parseBulkAdExamples(text: string): ParsedAdExample[] {
  return splitAdBlocks(text).map(parseAdExample);
}

/* ------------------------------------------------------------------ */
/* Duplicate detection + per-ad completeness — review-step affordances */
/* only. Nothing here changes what parseAdExample extracts; it reads   */
/* the same fields back to warn the user, non-blocking, before they    */
/* generate.                                                           */
/* ------------------------------------------------------------------ */

/** The dedupe key: whitespace/case-normalized exact match — same
 *  "normalized-string" approach the watchlist feature already uses for
 *  page-signal diffing (modules/competitor/watchlist.ts). Deliberately
 *  NOT fuzzy/similarity-based: two ads differing by even one real word
 *  (a different offer, a different headline) must never collapse into
 *  one, so only whitespace/case noise is normalized away. */
export function normalizeForDedupe(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** For each raw ad text, the index of the FIRST earlier entry with the
 *  same normalized text, or null if this entry is unique so far (the
 *  first occurrence of a repeated text is also null — only later
 *  repeats point back). Blank entries never count as duplicates of
 *  each other. Pure and order-preserving so it can drive both a UI
 *  warning ("Duplicate of Ad N") and payload deduplication from the
 *  same source of truth. */
export function findDuplicateIndices(rawTexts: string[]): (number | null)[] {
  const firstSeenAt = new Map<string, number>();
  return rawTexts.map((raw, i) => {
    const key = normalizeForDedupe(raw);
    if (key === "") return null;
    const earlier = firstSeenAt.get(key);
    if (earlier !== undefined) return earlier;
    firstSeenAt.set(key, i);
    return null;
  });
}

/** Distinct ad texts only (first occurrence wins, order preserved) —
 *  the smallest safe boundary for recurrence correctness: this is what
 *  must feed `adTexts`/`exampleCount` so a pasted duplicate can never
 *  be counted as a second, independent recurrence of a pattern. Blank
 *  entries are dropped, not treated as duplicates of each other. */
export function dedupeAdTexts(rawTexts: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of rawTexts) {
    const trimmed = raw.trim();
    if (trimmed === "") continue;
    const key = normalizeForDedupe(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export type AdCompletenessStatus = "complete" | "partial" | "empty" | "malformed";

export interface AdCompleteness {
  status: AdCompletenessStatus;
  /** Subset of the four core structured fields that weren't detected —
   *  hook/startDate/landingPage are excluded because they're routinely
   *  and legitimately absent (metadata, not creative signal). */
  missingFields: string[];
  /** Total keyword-detected theme hits (hooks/formats/offers/
   *  positioning/trust/benefits combined) — a secondary richness signal
   *  alongside the four core fields. */
  signalCount: number;
}

const CORE_FIELDS: { key: keyof Pick<ParsedAdExample, "headline" | "cta" | "offer" | "format">; label: string }[] = [
  { key: "headline", label: "Headline" },
  { key: "cta", label: "CTA" },
  { key: "offer", label: "Offer" },
  { key: "format", label: "Format" },
];

/** Below this word count, an ad with zero detected fields/signals is
 *  flagged as likely-unusable rather than merely incomplete — e.g. a
 *  stray blank line or a fragment left over from a bad split. */
const MALFORMED_MAX_WORDS = 4;

/** Reads back the fields `parseAdExample` already extracted to give an
 *  honest, non-blocking completeness read — never a new extraction
 *  pass, never a reason to block generation on its own. */
export function computeAdCompleteness(parsed: ParsedAdExample): AdCompleteness {
  const missingFields = CORE_FIELDS.filter(({ key }) => !parsed[key]).map(({ label }) => label);
  const signalCount =
    parsed.detectedHooks.length +
    parsed.detectedFormats.length +
    parsed.detectedOffers.length +
    parsed.detectedPositioning.length +
    parsed.detectedTrust.length +
    parsed.detectedBenefits.length;

  const wordCount = parsed.raw.trim().split(/\s+/).filter(Boolean).length;
  const hasAnySignal = missingFields.length < CORE_FIELDS.length || signalCount > 0;

  if (wordCount <= MALFORMED_MAX_WORDS && !hasAnySignal) {
    return { status: "malformed", missingFields, signalCount };
  }
  if (missingFields.length === 0) {
    return { status: "complete", missingFields, signalCount };
  }
  if (hasAnySignal) {
    return { status: "partial", missingFields, signalCount };
  }
  return { status: "empty", missingFields, signalCount };
}
