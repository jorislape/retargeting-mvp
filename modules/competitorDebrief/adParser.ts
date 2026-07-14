import { CTA_PHRASES, detect, OFFER_PATTERNS, POSITIONING_TERMS, TRUST_TERMS, BENEFIT_TERMS } from "../competitor/pageSignals.ts";
import { extractMarketSignals } from "../debrief/marketSignals.ts";
import { looksLikeAdsLibraryCopy, parseAdsLibraryExample } from "./adsLibraryParser.ts";

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
 *
 * Two pipelines, one entry point (`parseAdExample`): explicit field
 * labels ("Headline:"/"CTA:"/etc.) always win and take the original,
 * unchanged path below (`parseMode: "labeled"`). Absent that, text with
 * the STRUCTURAL shape of raw Meta Ads Library copy (emoji/checkmark
 * bullet lists, a bare CTA button line) is routed to the native
 * pipeline (adsLibraryParser.ts, `parseMode: "native"`) — real users
 * paste this shape far more often than the labeled one. Anything else
 * (plain unstructured notes) falls back to this file's own unlabeled
 * extraction, unchanged (`parseMode: "plain"`).
 */

export type AdParseMode = "labeled" | "native" | "plain";

export interface ParsedAdExample {
  /** The original pasted block, verbatim. */
  raw: string;
  /** Which pipeline produced this result — drives mode-aware
   *  completeness copy in computeAdCompleteness/the review UI. */
  parseMode: AdParseMode;
  /** Explicit "Hook:" / "Primary text:" label value, when present; or
   *  (native mode only) the inferred opening paragraph. */
  hook?: string;
  /** Explicit "Headline:" / "Title:" label value, when present. Never
   *  inferred in any mode — there's no reliable structural signal that
   *  distinguishes a headline from a hook without a label. */
  headline?: string;
  /** Explicit "CTA:" label, or a matched CTA phrase found in the text. */
  cta?: string;
  /** Explicit "Offer:" label, or a matched offer phrase found in the text. */
  offer?: string;
  /** Explicit "Format:" label, when present. Never inferred — see
   *  `detectedFormats` for structural/keyword-based format hints. */
  format?: string;
  /** Explicit "Start date:"/"Date:" label, or a date-like pattern found
   *  in the text. */
  startDate?: string;
  /** Explicit "Landing page:"/"URL:" label, or the first URL found in
   *  the text — reference only, never fetched. */
  landingPage?: string;
  /** Native mode only: prose paragraphs after the hook, excluding
   *  bullets/CTA/disclaimers. */
  body?: string;
  /** Native mode only: verbatim narrative/testimonial units (lines or
   *  sentences) — a recognized first-person story opening ("I used
   *  to...", "My journey...", "Since 2020..."), a "Week N"/"Day N"/
   *  "Month N" timeline entry, or any other sentence within a
   *  recognized story paragraph that didn't hit a more specific
   *  offer/trust/benefit/positioning table. Long-form testimonial ads
   *  (AG1/Huel/ColonBroom-style) previously left most fields "missing"
   *  because nothing captured this content at all; this is what makes
   *  it visible as genuine supporting evidence instead of being
   *  silently folded into (or truncated out of) `body`. Every entry is
   *  a verbatim quote — never a summary or inference beyond "this text
   *  reads as narrative". */
  story?: string[];
  /** Native mode only: disclaimer/legal/footnote paragraphs excluded
   *  from extraction — kept here (verbatim) so nothing is silently
   *  dropped without being shown, even though it never becomes evidence. */
  ignoredDisclaimers?: string[];
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

function hasExplicitLabels(trimmed: string): boolean {
  return LABELED_FIELD_PATTERNS.some(({ re }) => re.test(trimmed));
}

/** The original single-pipeline logic: labels win when present
 *  (`mode: "labeled"`); otherwise a verbatim pattern match (CTA phrase,
 *  offer phrase, date, URL) and the shared keyword tables (`mode:
 *  "plain"`) — never a guess. Unchanged behavior from before the native
 *  Ads Library pipeline existed; `parseAdExample` below only decides
 *  WHICH mode a block reaches this function under. */
function parseStructuredAdExample(trimmed: string, mode: "labeled" | "plain"): ParsedAdExample {
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
    parseMode: mode,
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

/** Parses one ad block into structured fields. Routes to whichever
 *  pipeline fits the input (see the module doc comment above) — the
 *  caller never has to know which one ran; `parsed.parseMode` records
 *  it for the completeness UI. */
export function parseAdExample(raw: string): ParsedAdExample {
  const trimmed = raw.trim();
  if (hasExplicitLabels(trimmed)) {
    return parseStructuredAdExample(trimmed, "labeled");
  }
  if (looksLikeAdsLibraryCopy(trimmed)) {
    return parseAdsLibraryExample(trimmed);
  }
  return parseStructuredAdExample(trimmed, "plain");
}

/** Splits and parses bulk pasted ad text in one call — the primary
 *  entry point for the "Paste ads" flow. */
export function parseBulkAdExamples(text: string): ParsedAdExample[] {
  return splitAdBlocks(text).map(parseAdExample);
}

/**
 * The text that should reach the API/engine for this ad — `raw` with
 * any `ignoredDisclaimers` paragraphs removed. This exists because the
 * engine (modules/competitorDebrief/engine.ts, out of scope for this
 * parsing work) re-scans whatever text it's SENT for recurring
 * patterns; disclaimer stripping only in the review UI wouldn't stop
 * boilerplate ("results may vary", FDA disclaimers) from still reaching
 * the recurrence engine verbatim and potentially being counted as a
 * "recurring" pattern across ads that all happen to share the same
 * legal footer. `raw` itself is never modified — this is a separate,
 * derived value computed only at submit time. A no-op (returns `raw`
 * unchanged) for "labeled"/"plain" mode, since disclaimer detection
 * only runs in the native pipeline.
 */
export function textForAnalysis(parsed: ParsedAdExample): string {
  if (!parsed.ignoredDisclaimers || parsed.ignoredDisclaimers.length === 0) {
    return parsed.raw;
  }
  let cleaned = parsed.raw;
  for (const disclaimer of parsed.ignoredDisclaimers) {
    cleaned = cleaned.split(disclaimer).join("");
  }
  return cleaned.replace(/\n{3,}/g, "\n\n").trim();
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
  /** Evidence categories that WERE found — empty for "labeled" mode
   *  (its UI never showed a "Detected" line; the data just isn't
   *  computed as usefully there, see computeLabeledCompleteness). */
  detectedFields: string[];
  /** Evidence categories that weren't found. For "labeled" mode this is
   *  the classic 4-core-field check (Headline/CTA/Offer/Format,
   *  unchanged from before this file had a native pipeline). For
   *  "native"/"plain" mode this is a softer, evidence-based checklist
   *  (Hook/Benefits/Proof/Offer/Explicit CTA) — explicit labels were
   *  never the point of a natural-language paste, so judging one
   *  against "Missing: Headline, CTA, Offer" was actively misleading. */
  missingFields: string[];
  /** Total keyword-detected theme hits (hooks/formats/offers/
   *  positioning/trust/benefits combined) — a secondary richness signal
   *  alongside the core fields. */
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

function totalSignalCount(parsed: ParsedAdExample): number {
  return (
    parsed.detectedHooks.length +
    parsed.detectedFormats.length +
    parsed.detectedOffers.length +
    parsed.detectedPositioning.length +
    parsed.detectedTrust.length +
    parsed.detectedBenefits.length
  );
}

/** Original completeness logic, unchanged: explicit-label input is
 *  judged against the 4 core labeled fields — a user who typed
 *  "Headline:"/"CTA:" etc. and left some blank genuinely IS missing
 *  those fields, so the blunt checklist stays correct here. */
function computeLabeledCompleteness(parsed: ParsedAdExample): AdCompleteness {
  const missingFields = CORE_FIELDS.filter(({ key }) => !parsed[key]).map(({ label }) => label);
  const detectedFields = CORE_FIELDS.filter(({ key }) => parsed[key]).map(({ label }) => label);
  const signalCount = totalSignalCount(parsed);

  const wordCount = parsed.raw.trim().split(/\s+/).filter(Boolean).length;
  const hasAnySignal = missingFields.length < CORE_FIELDS.length || signalCount > 0;

  if (wordCount <= MALFORMED_MAX_WORDS && !hasAnySignal) {
    return { status: "malformed", detectedFields, missingFields, signalCount };
  }
  if (missingFields.length === 0) {
    return { status: "complete", detectedFields, missingFields, signalCount };
  }
  if (hasAnySignal) {
    return { status: "partial", detectedFields, missingFields, signalCount };
  }
  return { status: "empty", detectedFields, missingFields, signalCount };
}

/** Evidence-based checklist for unlabeled input ("native" Ads Library
 *  copy or "plain" free text) — judges what the ad actually
 *  communicates rather than which labels the user typed, since typing
 *  labels was never the expectation for either mode. "Explicit CTA" is
 *  deliberately softer than "CTA": a bare CTA phrase found via keyword
 *  fallback still counts as `cta` being set, so this only comes up
 *  missing when truly nothing button-like was found anywhere. */
const EVIDENCE_CATEGORIES: { label: string; present: (p: ParsedAdExample) => boolean }[] = [
  { label: "Hook", present: (p) => Boolean(p.hook) || p.detectedHooks.length > 0 },
  { label: "Story", present: (p) => (p.story?.length ?? 0) > 0 },
  { label: "Benefits", present: (p) => p.detectedBenefits.length > 0 },
  { label: "Proof", present: (p) => p.detectedTrust.length > 0 },
  { label: "Offer", present: (p) => Boolean(p.offer) || p.detectedOffers.length > 0 },
  { label: "Explicit CTA", present: (p) => Boolean(p.cta) },
];

/** Only warns (shows a "Missing" list) when genuinely little
 *  information exists — 3+ of the 5 categories present is treated as
 *  "complete" with no missing list at all, since demanding every
 *  category from a short ad is its own kind of false warning. */
function computeEvidenceCompleteness(parsed: ParsedAdExample): AdCompleteness {
  const detectedFields = EVIDENCE_CATEGORIES.filter((c) => c.present(parsed)).map((c) => c.label);
  const missingFields = EVIDENCE_CATEGORIES.filter((c) => !c.present(parsed)).map((c) => c.label);
  const signalCount = totalSignalCount(parsed);

  const wordCount = parsed.raw.trim().split(/\s+/).filter(Boolean).length;

  if (wordCount <= MALFORMED_MAX_WORDS && detectedFields.length === 0) {
    return { status: "malformed", detectedFields, missingFields, signalCount };
  }
  if (detectedFields.length >= 3) {
    return { status: "complete", detectedFields, missingFields: [], signalCount };
  }
  if (detectedFields.length >= 1) {
    return { status: "partial", detectedFields, missingFields, signalCount };
  }
  return { status: "empty", detectedFields, missingFields, signalCount };
}

/** Reads back the fields `parseAdExample` already extracted to give an
 *  honest, non-blocking completeness read — never a new extraction
 *  pass, never a reason to block generation on its own. Mode-aware: see
 *  computeLabeledCompleteness vs. computeEvidenceCompleteness. */
export function computeAdCompleteness(parsed: ParsedAdExample): AdCompleteness {
  if (parsed.parseMode === "labeled") {
    return computeLabeledCompleteness(parsed);
  }
  return computeEvidenceCompleteness(parsed);
}

/**
 * How many of the given parsed ad blocks count as USABLE evidence —
 * the single source of truth for "Generate" button eligibility, so it
 * can never drift from what the completeness/duplicate UI already
 * tells the user. A block counts only when its raw text is non-empty,
 * its completeness status isn't "malformed" (a stray fragment left
 * over from a bad split, or genuine junk — see computeAdCompleteness),
 * and it isn't a normalized-text duplicate of an earlier counted
 * block. Order-independent result (a count, not indices) since
 * eligibility only cares "is there at least one", not which one.
 */
export function countUsableAds(parsedBlocks: ParsedAdExample[]): number {
  const seen = new Set<string>();
  let count = 0;
  for (const parsed of parsedBlocks) {
    const raw = parsed.raw.trim();
    if (raw === "") continue;
    if (computeAdCompleteness(parsed).status === "malformed") continue;
    const key = normalizeForDedupe(raw);
    if (seen.has(key)) continue;
    seen.add(key);
    count++;
  }
  return count;
}
