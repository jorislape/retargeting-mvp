import {
  computeAdCompleteness,
  normalizeForDedupe,
  parseAdExample,
  splitAdBlocks,
  type AdCompleteness,
  type ParsedAdExample,
} from "./adParser.ts";
import { isBareCtaLine } from "./adsLibraryParser.ts";

/**
 * Input Automation V1 — turns one large, messy Ads Library page paste
 * into a reviewable set of candidate ads, WITHOUT scraping, browser
 * automation, OCR, extensions, or Meta API integration. This module
 * only ever produces plain candidate STRINGS; every candidate is then
 * run through the existing, unchanged parseAdExample() (same as the
 * "Paste ads" flow already does) so nothing downstream — the parser,
 * the engine, strategicPatterns.ts, internalLearnings.ts, or the API
 * route — needs to know this input mode exists.
 *
 * Pipeline (each stage is a separate, independently testable pure
 * function — no I/O, no randomness, no external calls):
 *   A0. stripLeadingHeader — ignore everything before the first real ad
 *                             card: the "Meta Ads Library" page title,
 *                             results count, filter/search bar, and the
 *                             page/profile name sandwiched among them.
 *                             Only ever scans from the very start of the
 *                             paste and stops at the first line that
 *                             doesn't look like page header content — a
 *                             dump that doesn't open with recognized
 *                             header content is left untouched.
 *   A. stripChromeLines    — remove known Meta Ads Library UI chrome
 *                             (curated exact/near-exact patterns only;
 *                             never "repeats a lot, so strip it")
 *   B. detectAdBoundaries  — reuse splitAdBlocks's marker/blank-line
 *                             tier unchanged; fall back to a bare-CTA-
 *                             line anchor only when that tier can't
 *                             separate anything; degrade to "whole
 *                             input as one block" (the existing floor
 *                             behavior) when neither signal exists —
 *                             every segment is tagged with an explicit
 *                             high/medium/low confidence, never silently
 *                             presented as reliable when it isn't
 *   C. (exact duplicates)  — folded into groupPossibleVariants below via
 *                             the SAME normalizeForDedupe() key adParser.ts
 *                             already uses; no new exact-match logic
 *   D. groupPossibleVariants — near-duplicate clustering (word-bigram
 *                             Jaccard similarity, no new dependency).
 *                             Never deletes or hides anything — only
 *                             groups. "Possible variants," never
 *                             "duplicates": this is a heuristic, not a
 *                             proven fact about two ads.
 *   E. selectRepresentatives — deterministic: one per variant group plus
 *                             every ungrouped, non-malformed single,
 *                             ranked ONLY by the existing
 *                             computeAdCompleteness()/signal-count data.
 *                             Never uses paste order, active/inactive
 *                             status, or any performance signal as a
 *                             preference — index is used only as a
 *                             last-resort, order-preserving tiebreak
 *                             when two candidates are otherwise exactly
 *                             tied on real signal, so selection stays
 *                             fully deterministic.
 *   F. warnings            — structured, non-blocking notices (never a
 *                             bare boolean) surfaced in processPageDump's
 *                             result.
 *
 * processPageDump's orchestration also enforces two hard rules after
 * parsing, each with its own dedicated counter and warning so a
 * fragment is never silently discarded — a user must always be able to
 * see why fewer candidates appeared than were present in the copied
 * page:
 *   - a segment with no hook, no headline, no CTA, no offer, and no
 *     other recognizable ad body (computeAdCompleteness's "malformed"
 *     or "empty" status — reused, not reimplemented) never becomes a
 *     PageDumpCandidate — a leftover UI/header fragment must never be
 *     presented as something to review as an ad
 *     (nonAdFragmentsSkipped / "non-ad-fragments-skipped").
 *   - a destination-preview / link-preview card attached to an ad (a
 *     bare domain line plus a short, evidence-free product-title/price/
 *     app-description shell — see isDestinationPreviewFragment below)
 *     never becomes its own PageDumpCandidate either — it's metadata
 *     ABOUT an ad's destination, not a second, independent ad
 *     (destinationPreviewSkipped / "destination-preview-skipped").
 * The one exception to both: if EVERY segment would be filtered out,
 * nothing is dropped — the user must never be left with a blank review
 * state just because the only thing found was thin (this is what keeps
 * the existing "no clear boundaries" single-block floor behavior
 * intact).
 *
 * Stage G (user review before generation) is NOT in this file — it's
 * the caller's job (CompetitorDebriefPanel.tsx) to render these
 * candidates, let the user include/exclude/edit them, and only then
 * feed the selected raw text into the SAME AdBlock[] state and
 * handleGenerate() payload construction the existing "Paste ads" flow
 * already uses. Nothing here ever auto-submits.
 */

/* ------------------------------------------------------------------ */
/* Stage A0: leading page-header removal                               */
/* ------------------------------------------------------------------ */

/**
 * Curated patterns for the page-level HEADER/preamble a raw Ads
 * Library copy-paste carries before the first real ad card: the "Meta
 * Ads Library" page title, the results count, and the filter/search
 * bar. Distinct from CHROME_LINE_PATTERNS below (which repeats before
 * EVERY ad card) — these appear ONCE, only at the very top of the
 * page, which is exactly what stripLeadingHeader() below uses them
 * for. Deliberately conservative and specific (not a bare "search" or
 * "filter" keyword match anywhere in the text) — these only matter as
 * anchors for the LEADING scan below, never applied mid-document.
 */
const HEADER_LINE_PATTERNS: RegExp[] = [
  /^\s*meta\s+ads?\s+library\s*$/i,
  /^\s*ads?\s+library\s*$/i,
  // "Results: ~14,000" / "Results ~14,000" / "~14,000 results"
  /^\s*results?\s*:?\s*~?[\d][\d,]*\s*(?:results?)?\s*$/i,
  /^\s*~?[\d][\d,]*\s+results?\s*$/i,
  /^\s*filters?\s*$/i,
  /^\s*search\s*$/i,
  /^\s*search\s+by\s+keyword\s+or\s+advertiser\b.*$/i,
  /^\s*ad\s*category\s*$/i,
];

/** How many consecutive short, unrecognized "label" lines (e.g. the
 *  page/profile name sandwiched between "Meta Ads Library" and
 *  "Results: ...") can be swept into the preamble in a row before
 *  requiring another real header-pattern match to continue — a small,
 *  bounded safety net so a misfire can't eat an unbounded amount of
 *  real ad content. */
const MAX_CONSECUTIVE_PREAMBLE_LABELS = 2;
const MAX_PREAMBLE_LABEL_WORDS = 6;

export interface LeadingHeaderStripResult {
  cleaned: string;
  headerLinesRemoved: number;
  /** Competitor Input Trust V2: the last short "label" line swept as
   *  part of the leading preamble — the deterministic best guess at a
   *  page/profile name for a paste that opens on a single advertiser's
   *  profile view (as opposed to per-card "Sponsored" chrome, captured
   *  separately in stripChromeLines below). null when no such label
   *  line was swept. This does not change WHICH lines count as
   *  preamble — only records the one already-recognized as a label,
   *  never a new heuristic. */
  leadingPageName: string | null;
}

/**
 * "Before boundary detection, ignore everything before the first
 * actual ad card." Walks lines from the very start ONLY — never
 * touches anything after the first line that doesn't fit the page-
 * header shape. A leading line is treated as header/preamble when it:
 *   - is blank, or
 *   - matches a curated HEADER_LINE_PATTERNS entry, or
 *   - is a short (<=6 words), unpunctuated "label" line — e.g. the
 *     page/profile name — but ONLY once at least one real header
 *     pattern has already matched, and only up to
 *     MAX_CONSECUTIVE_PREAMBLE_LABELS in a row.
 * The moment a line doesn't fit, the preamble ends there — that line
 * and everything after it proceeds to normal chrome-stripping and
 * boundary detection completely unchanged. A dump that doesn't open
 * with any recognized header pattern is returned untouched (0 lines
 * removed) — this never scans or alters anything past the leading run.
 */
export function stripLeadingHeader(text: string): LeadingHeaderStripResult {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let removed = 0;
  let sawHeaderAnchor = false;
  let consecutiveLabels = 0;
  let leadingPageName: string | null = null;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (trimmed === "") {
      i++;
      continue;
    }

    if (HEADER_LINE_PATTERNS.some((re) => re.test(trimmed))) {
      sawHeaderAnchor = true;
      consecutiveLabels = 0;
      removed++;
      i++;
      continue;
    }

    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    const looksLikeLabel =
      wordCount > 0 &&
      wordCount <= MAX_PREAMBLE_LABEL_WORDS &&
      !/[.!?]$/.test(trimmed) &&
      !isBareCtaLine(trimmed);
    if (sawHeaderAnchor && looksLikeLabel && consecutiveLabels < MAX_CONSECUTIVE_PREAMBLE_LABELS) {
      consecutiveLabels++;
      removed++;
      leadingPageName = trimmed;
      i++;
      continue;
    }

    break;
  }

  return { cleaned: lines.slice(i).join("\n"), headerLinesRemoved: removed, leadingPageName };
}

/* ------------------------------------------------------------------ */
/* Stage A: UI chrome filtering                                        */
/* ------------------------------------------------------------------ */

/**
 * Curated, line-exact (or near-exact) Meta Ads Library UI chrome
 * strings. Deliberately NOT frequency-based ("this line repeats a lot,
 * so it must be chrome") — a genuinely recurring hook or tagline is
 * exactly the signal strategicPatterns.ts exists to surface, so
 * stripping by repetition alone would delete real evidence. Every
 * pattern here matches a KNOWN, STABLE piece of Ads Library page
 * chrome and nothing else; deliberately excludes anything that
 * overlaps CTA_PHRASES (pageSignals.ts) — "Learn More" / "See More"
 * are real ad CTAs as often as they're page navigation, so they are
 * never treated as chrome here, only as a boundary anchor (Stage B)
 * or a CTA field (the existing parser).
 */
const CHROME_LINE_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "status badge", re: /^\s*(?:active|inactive)\s*$/i },
  { label: "library id", re: /^\s*library\s*id\b[:#\s-]*\d[\d,\s]*$/i },
  // Requires an immediate date so a real sentence like "I started
  // running on empty stomachs" can never match — the Meta chrome
  // phrase is always followed by a date, never a description. Both
  // date orderings Meta renders are accepted: US "Jul 1, 2026" and
  // international "1 Jul 2026" (what non-US locales see).
  {
    label: "started running on",
    re: /^\s*started\s+running\s+on\s+(?:[A-Za-z]+\.?\s+\d{1,2},?|\d{1,2}\s+[A-Za-z]+\.?,?)\s+\d{4}\b.*$/i,
  },
  // NOTE: bare "Sponsored" and "Sponsored · Page Name" are NOT in this
  // generic list — Competitor Input Trust V2 handles both with
  // dedicated logic in stripChromeLines below, since (unlike every
  // other chrome pattern here) they carry advertiser-attribution
  // evidence that must be captured, not just deleted.
  { label: "see ad details", re: /^\s*see\s+ad\s+details\s*$/i },
  { label: "see summary details", re: /^\s*see\s+summary\s+details\s*$/i },
  { label: "why am I seeing this ad", re: /^\s*why\s+am\s+i\s+seeing\s+this\s+ad\??\s*$/i },
  { label: "report ad", re: /^\s*report\s+ad\s*$/i },
  { label: "platforms label", re: /^\s*platforms?\s*$/i },
  // Closed vocabulary, bare line only — no real ad copy is ever just
  // the word "Facebook" or "Instagram" (optionally comma-joined) alone.
  { label: "platform list (bare)", re: /^\s*(?:facebook|instagram|messenger|audience network)(?:\s*,\s*(?:facebook|instagram|messenger|audience network))*\s*$/i },
  { label: "ad library header", re: /^\s*ad\s+library\s*$/i },
];

export interface ChromeStripResult {
  cleaned: string;
  removedLineCount: number;
}

/* ------------------------------------------------------------------ */
/* Competitor Input Trust V2: advertiser/page-name marker              */
/* ------------------------------------------------------------------ */

/**
 * Internal-only sentinel used to smuggle a captured page name THROUGH
 * boundary detection (Stage B), which otherwise only ever sees plain
 * ad-copy lines. "§" is deliberately never a valid piece of Ads
 * Library chrome or real ad copy, so a marker line can never collide
 * with pasted text; it's stripped back out (see extractPageNameMarker)
 * before parseAdExample or any user-facing rendering ever sees it —
 * this is internal plumbing, not a new visible format.
 */
const PAGE_NAME_MARKER_PREFIX = "§PAGE_NAME:";
const PAGE_NAME_MARKER_SUFFIX = "§";
const PAGE_NAME_MARKER_LINE_RE = /^§PAGE_NAME:(.*)§$/;

function makePageNameMarker(name: string): string {
  return `${PAGE_NAME_MARKER_PREFIX}${name.trim()}${PAGE_NAME_MARKER_SUFFIX}`;
}

// "Sponsored · Page Name" / "Sponsored - Page Name" — a distinctive,
// literal UI construct no real ad copy would write as body text;
// anchored on the word "Sponsored" plus a separator. Capturing group
// isolates the name itself so it can be preserved instead of deleted.
const SPONSORED_PAGE_NAME_RE = /^\s*sponsored\s*(?:[·•|]|-{1,2})\s*(\S.*?)\s*$/i;
const BARE_SPONSORED_RE = /^\s*sponsored\s*$/i;

/**
 * Strips known chrome lines. `competitorName`, when provided,
 * additionally strips a line ONLY when it is an exact (whitespace/case
 * normalized) match for the full competitor name the user typed — never
 * a partial/substring match, never based on how often it repeats. Blank
 * lines are always preserved (they still matter for Stage B's reused
 * blank-line-run tier).
 *
 * Competitor Input Trust V2: the three per-card "this is whose ad it
 * is" shapes are no longer silently deleted — they're replaced with an
 * internal marker (see above) so processPageDump can attach the
 * captured name to whichever candidate follows:
 *   - "Sponsored · Page Name" (one line) — name captured directly.
 *   - a short, unpunctuated, non-CTA, non-chrome label line IMMEDIATELY
 *     followed by bare "Sponsored" (the real Ads Library card header:
 *     "Nike" / "Sponsored" on two lines, name FIRST) — checked before
 *     the exact-competitor-name delete below, since that delete would
 *     otherwise destroy the attribution evidence exactly when the card
 *     belongs to the competitor the user typed.
 *   - bare "Sponsored" immediately followed by a label-shaped line
 *     (name AFTER — the shape this repo's own Ads Library regression
 *     fixture uses: "Sponsored" / "Nike"). If nothing label-shaped
 *     precedes OR follows, only the bare "Sponsored" line is removed,
 *     exactly as before.
 * All three reuse the EXACT label-shape heuristic stripLeadingHeader
 * already uses, not a new pattern. After a marker is emitted, blank
 * lines immediately following the consumed card header are skipped so
 * the marker stays glued to the creative text it labels — otherwise
 * Stage B's blank-line splitting could cut the marker into its own
 * (attribution-less) segment. Every other chrome pattern (Library ID,
 * Active/Inactive, Started running on, Platforms, etc.) is still a
 * plain, unrecovered delete — none of them carry attribution evidence.
 */
export function stripChromeLines(text: string, competitorName?: string): ChromeStripResult {
  const normalizedCompetitorName =
    competitorName && competitorName.trim() !== "" ? normalizeForDedupe(competitorName) : null;

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  let removedLineCount = 0;
  let i = 0;

  const looksLikeLabelLine = (trimmed: string): boolean => {
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
    return (
      trimmed !== "" &&
      wordCount > 0 &&
      wordCount <= MAX_PREAMBLE_LABEL_WORDS &&
      !/[.!?]$/.test(trimmed) &&
      !isBareCtaLine(trimmed) &&
      !PAGE_NAME_MARKER_LINE_RE.test(trimmed) &&
      !CHROME_LINE_PATTERNS.some(({ re }) => re.test(trimmed))
    );
  };

  // Glue: after a captured card header, skip the blank line(s) between
  // it and the creative text so the marker can't be split off into its
  // own segment by Stage B. A no-op when no blank follows.
  const skipFollowingBlanks = () => {
    while (i < lines.length && lines[i].trim() === "") i++;
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      kept.push(line);
      i++;
      continue;
    }

    const sponsoredNameMatch = SPONSORED_PAGE_NAME_RE.exec(trimmed);
    if (sponsoredNameMatch) {
      removedLineCount++;
      kept.push(makePageNameMarker(sponsoredNameMatch[1]));
      i++;
      skipFollowingBlanks();
      continue;
    }

    // Name BEFORE "Sponsored" — the real Ads Library card header order.
    // Must run before the exact-competitor-name delete below: when the
    // card is the competitor's own, that delete would otherwise remove
    // the name line first and leave the card unattributable.
    if (looksLikeLabelLine(trimmed) && i + 1 < lines.length && BARE_SPONSORED_RE.test(lines[i + 1].trim())) {
      removedLineCount += 2;
      kept.push(makePageNameMarker(trimmed));
      i += 2;
      skipFollowingBlanks();
      continue;
    }

    if (BARE_SPONSORED_RE.test(trimmed)) {
      const nextTrimmed = i + 1 < lines.length ? lines[i + 1].trim() : "";
      if (looksLikeLabelLine(nextTrimmed)) {
        removedLineCount += 2;
        kept.push(makePageNameMarker(nextTrimmed));
        i += 2;
        skipFollowingBlanks();
        continue;
      }
      // Bare "Sponsored" always gets removed, whether or not anything
      // label-shaped follows it.
      removedLineCount++;
      i++;
      continue;
    }

    const isKnownChrome = CHROME_LINE_PATTERNS.some(({ re }) => re.test(trimmed));
    const isExactCompetitorNameLine =
      normalizedCompetitorName !== null && normalizeForDedupe(trimmed) === normalizedCompetitorName;
    if (isKnownChrome || isExactCompetitorNameLine) {
      removedLineCount++;
      i++;
      continue;
    }
    kept.push(line);
    i++;
  }

  return { cleaned: kept.join("\n"), removedLineCount };
}

/**
 * Pulls any internal advertiser/page-name marker(s) out of a boundary-
 * cut segment's raw text, returning marker-free text plus the resolved
 * page name. A segment normally carries at most one marker; it can
 * carry more only when boundary detection under-split two differently-
 * attributed cards into one segment — if the markers found disagree
 * (compared via normalizeForDedupe, the same helper used everywhere
 * else in this module), attribution is treated as unknown rather than
 * guessing which one is right. Markers that all agree resolve to that
 * one name. Never touches parseAdExample, completeness, or grouping —
 * this always runs first so nothing downstream ever sees a marker.
 */
export function extractPageNameMarker(raw: string): { raw: string; pageName: string | null } {
  const lines = raw.split("\n");
  const kept: string[] = [];
  const found: string[] = [];
  for (const line of lines) {
    const match = PAGE_NAME_MARKER_LINE_RE.exec(line.trim());
    if (match) {
      found.push(match[1]);
    } else {
      kept.push(line);
    }
  }
  if (found.length === 0) return { raw, pageName: null };
  const normalizedSet = new Set(found.map((n) => normalizeForDedupe(n)));
  const pageName = normalizedSet.size === 1 ? found[0] : null;
  return { raw: kept.join("\n").trim(), pageName };
}

/* ------------------------------------------------------------------ */
/* Competitor Input Trust V2 Checkpoint 2/3: attribution classification */
/* ------------------------------------------------------------------ */

export type AdvertiserAttribution = "match" | "mismatch" | "unknown";

/**
 * Checkpoint 3: splits a user-typed "Also known as / alternate Page
 * names" field into a plain list — comma-separated, trimmed, empty
 * entries dropped. No dedup, no normalization here (that happens at
 * comparison time in classifyAdvertiserAttribution, via
 * normalizeForDedupe, the same helper this module already uses
 * everywhere else) — this function only parses the raw text shape.
 */
export function parseAliases(aliasesText: string): string[] {
  return aliasesText
    .split(",")
    .map((a) => a.trim())
    .filter((a) => a !== "");
}

/**
 * Deterministic attribution classification, Ads Library page mode
 * only — reuses normalizeForDedupe exactly as Checkpoint 1 did for
 * pageName/grouping comparisons, the same helper this module already
 * uses everywhere else. No fuzzy matching, no punctuation stripping,
 * no substring matching, no semantic similarity.
 *
 *   match    — pageName is non-null AND its normalized form equals the
 *              normalized competitorName OR any normalized alias.
 *   mismatch — pageName is non-null AND its normalized form matches
 *              neither the normalized competitorName nor any alias.
 *   unknown  — pageName is null (attribution impossible), OR neither
 *              competitorName nor any alias has been given yet
 *              (nothing to compare against) — never reported as
 *              "mismatch" just because the form hasn't been filled in.
 *
 * Aliases only ever WIDEN the match set (a name that used to mismatch
 * can become a match once a matching alias is added) — they can never
 * turn an existing match into a mismatch, since competitorName itself
 * is always still one of the accepted names.
 */
export function classifyAdvertiserAttribution(
  pageName: string | null,
  competitorName?: string,
  aliases?: string[]
): AdvertiserAttribution {
  if (pageName === null) return "unknown";
  const acceptedNames = [competitorName, ...(aliases ?? [])].filter(
    (n): n is string => n !== undefined && n.trim() !== ""
  );
  if (acceptedNames.length === 0) return "unknown";
  const normalizedPageName = normalizeForDedupe(pageName);
  const normalizedAccepted = acceptedNames.map((n) => normalizeForDedupe(n));
  return normalizedAccepted.includes(normalizedPageName) ? "match" : "mismatch";
}

/* ------------------------------------------------------------------ */
/* Stage B: boundary detection                                         */
/* ------------------------------------------------------------------ */

export type BoundaryConfidence = "high" | "medium" | "low";

export interface BoundarySegment {
  raw: string;
  confidence: BoundaryConfidence;
}

/**
 * Splits chrome-stripped text into candidate ad segments.
 *
 * Tier 1 (confidence "high"): reuse splitAdBlocks() UNCHANGED — if the
 * paste already has explicit separators or blank-line runs (the same
 * signal the existing "Paste ads" flow already trusts), that split
 * wins outright.
 *
 * Tier 2 (confidence "medium"): a bare CTA line — the rendered button
 * text — is very often the last visible content before the next ad
 * card starts in a raw, unmarked dump. Only engaged when Tier 1
 * couldn't separate anything. Never splits mid-line, only at an
 * existing line boundary. KNOWN failure mode: an ad whose own body
 * copy contains a bare CTA phrase as its own line (not just as the
 * terminal button) will be over-split here — this is why the result is
 * tagged "medium," never "high," so the review UI can warn rather than
 * imply a reliable split.
 *
 * Tier 3 (confidence "low"): no anchor found anywhere — falls back to
 * the existing, already-proven floor behavior (whole input as one
 * block). Never blocks the user; they can still edit/split it by hand
 * in the review step.
 */
export function detectAdBoundaries(cleanedText: string): BoundarySegment[] {
  const trimmed = cleanedText.trim();
  if (trimmed === "") return [];

  const markerBlocks = splitAdBlocks(trimmed);
  if (markerBlocks.length > 1) {
    return markerBlocks.map((raw) => ({ raw, confidence: "high" as const }));
  }

  const lines = trimmed.replace(/\r\n/g, "\n").split("\n");
  const segments: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    current.push(line);
    if (isBareCtaLine(line.trim())) {
      segments.push(current.join("\n").trim());
      current = [];
    }
  }
  if (current.some((l) => l.trim() !== "")) {
    segments.push(current.join("\n").trim());
  }
  const nonEmpty = segments.filter((s) => s !== "");

  if (nonEmpty.length > 1) {
    return nonEmpty.map((raw) => ({ raw, confidence: "medium" as const }));
  }

  return [{ raw: trimmed, confidence: "low" as const }];
}

/* ------------------------------------------------------------------ */
/* Stage D: possible-variant grouping (exact + near-duplicate)         */
/* ------------------------------------------------------------------ */

/** Same Jaccard threshold rationale documented in the module doc
 *  comment at the bottom of this section — deliberately conservative,
 *  tuned toward under-grouping (a couple of near-identical cards left
 *  ungrouped is mildly redundant but harmless) rather than over-
 *  grouping (which would hide a genuinely distinct ad from the default
 *  selection, corrupting the very recurrence signal this feature feeds
 *  into strategicPatterns.ts). Revisit only with real-usage evidence,
 *  not by adjusting until a single fixture passes. */
const VARIANT_JACCARD_THRESHOLD = 0.6;

/** Below this token count, bigram overlap is too noisy to trust as a
 *  "same idea" signal (a 3-word fragment matching another 3-word
 *  fragment on 2 shared bigrams is a coincidence, not a variant) — such
 *  short texts are only ever grouped via the exact-match path. */
const MIN_TOKENS_FOR_NEAR_MATCH = 6;

function tokenize(text: string): string[] {
  return normalizeForDedupe(text)
    .replace(/[^a-z0-9\s]/gi, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function bigramSet(tokens: string[]): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i++) set.add(`${tokens[i]}_${tokens[i + 1]}`);
  return set;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Minimal union-find — path-compressed, union-by-nothing-fancy since
 *  candidate counts are always small (bounded by MAX_OBSERVATIONS_CHARS
 *  upstream). */
class UnionFind {
  private parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  }
}

export interface VariantGroup {
  id: number;
  memberIndices: number[];
}

export interface VariantGroupingResult {
  /** Group id per input index, or null when that candidate wasn't
   *  related (exactly or nearly) to any other candidate. */
  groupIdByIndex: (number | null)[];
  groups: VariantGroup[];
}

/**
 * Groups candidates that are either EXACT duplicates (via the same
 * normalizeForDedupe() key adParser.ts's own findDuplicateIndices/
 * dedupeAdTexts already use — not a new exact-match implementation) or
 * "possible variants" (near-duplicate, via word-bigram Jaccard
 * similarity — no new dependency, no fuzzy string-distance library).
 * Framed as "possible," never "confirmed": this is a heuristic
 * clustering, unlike Stage C's exact match, which stays authoritative.
 * Never deletes anything — every member of every group remains an
 * individually addressable candidate for the caller.
 *
 * Competitor Input Trust V2: `pageNames`, when provided, is a HARD gate
 * checked before any text-similarity comparison — two candidates are
 * never unioned (exact OR near-duplicate) when both have a non-null
 * captured pageName and those names differ (normalizeForDedupe-
 * compared, the same helper this module already uses everywhere else —
 * no second normalization system). Brand identity, once captured,
 * overrules text similarity; near-identical copy from two different
 * advertisers must never be presented as "the same ad." A null
 * pageName (attribution unknown) never blocks grouping by itself —
 * only a genuine, known mismatch does. Omitting `pageNames` entirely
 * preserves the exact pre-V2 behavior.
 */
export function groupPossibleVariants(texts: string[], pageNames?: (string | null)[]): VariantGroupingResult {
  const n = texts.length;
  const uf = new UnionFind(n);
  const tokenLists = texts.map(tokenize);
  const bigramSets = tokenLists.map(bigramSet);
  const normalizedPageName = (i: number): string | null => {
    const name = pageNames?.[i];
    return name && name.trim() !== "" ? normalizeForDedupe(name) : null;
  };

  for (let i = 0; i < n; i++) {
    if (texts[i].trim() === "") continue;
    for (let j = i + 1; j < n; j++) {
      if (texts[j].trim() === "") continue;
      const pageNameI = normalizedPageName(i);
      const pageNameJ = normalizedPageName(j);
      if (pageNameI !== null && pageNameJ !== null && pageNameI !== pageNameJ) continue;
      const isExact = normalizeForDedupe(texts[i]) === normalizeForDedupe(texts[j]);
      const isNear =
        !isExact &&
        tokenLists[i].length >= MIN_TOKENS_FOR_NEAR_MATCH &&
        tokenLists[j].length >= MIN_TOKENS_FOR_NEAR_MATCH &&
        jaccardSimilarity(bigramSets[i], bigramSets[j]) >= VARIANT_JACCARD_THRESHOLD;
      if (isExact || isNear) uf.union(i, j);
    }
  }

  const rootToMembers = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    if (texts[i].trim() === "") continue;
    const root = uf.find(i);
    if (!rootToMembers.has(root)) rootToMembers.set(root, []);
    rootToMembers.get(root)!.push(i);
  }

  const groups: VariantGroup[] = [];
  const groupIdByIndex: (number | null)[] = new Array(n).fill(null);
  let nextGroupId = 0;
  for (const members of rootToMembers.values()) {
    if (members.length < 2) continue;
    const id = nextGroupId++;
    groups.push({ id, memberIndices: members });
    for (const m of members) groupIdByIndex[m] = id;
  }

  return { groupIdByIndex, groups };
}

/* ------------------------------------------------------------------ */
/* Stage E: deterministic representative selection                     */
/* ------------------------------------------------------------------ */

export const MAX_REPRESENTATIVES = 10;

const COMPLETENESS_STATUS_RANK: Record<AdCompleteness["status"], number> = {
  complete: 3,
  partial: 2,
  empty: 1,
  malformed: 0,
};

function richnessScore(c: AdCompleteness): number {
  return c.detectedFields.length + c.signalCount;
}

/** True when `a` should be preferred over `b` as a group's
 *  representative — completeness status first, then signal richness,
 *  then (only when those are EXACTLY tied) the earlier original index,
 *  purely so ties resolve the same way every run. This is NOT a "prefer
 *  ads pasted first" preference — it only ever activates when the real
 *  signal (status + richness) is identical, at which point no other
 *  data exists to break the tie. */
function isBetterRepresentative(a: AdCompleteness, aIndex: number, b: AdCompleteness, bIndex: number): boolean {
  const statusDiff = COMPLETENESS_STATUS_RANK[a.status] - COMPLETENESS_STATUS_RANK[b.status];
  if (statusDiff !== 0) return statusDiff > 0;
  const richnessDiff = richnessScore(a) - richnessScore(b);
  if (richnessDiff !== 0) return richnessDiff > 0;
  return aIndex < bIndex;
}

export interface RepresentativeSelection {
  isRepresentative: boolean[];
  /** Count of eligible selection units (one per variant group, plus one
   *  per ungrouped non-malformed single) BEFORE the MAX_REPRESENTATIVES
   *  cap — lets the caller warn when real candidates exist beyond the
   *  default top-10 without recomputing the grouping logic again. */
  poolSize: number;
}

/**
 * Deterministic representative selection: one candidate per variant
 * group (the group's best-completeness member) plus every ungrouped,
 * non-malformed single, ranked ONLY by computeAdCompleteness()'s
 * existing status/signal data, capped at MAX_REPRESENTATIVES. Never
 * reads paste order, active/inactive status, or any performance signal
 * as a preference. Never pads below 5 — if fewer than 5 eligible
 * candidates exist, all of them are selected (mirrors the existing
 * "if only two ads qualify, you see two" rule used elsewhere in this
 * codebase).
 *
 * Competitor Input Trust V2 Checkpoint 2: `attribution`, when
 * provided, is an additional eligibility gate ON TOP OF the existing
 * malformed check — a candidate whose attribution is "mismatch" or
 * "unknown" can NEVER become a pool member or a group's representative,
 * no matter how complete or rich its content is. This is deliberately
 * a gate, not a ranking factor: within the eligible ("match") set, the
 * existing completeness/richness ranking is completely unchanged. A
 * variant group with no eligible member contributes nothing to the
 * pool — every one of its members simply stays unselected, which is
 * how a genuine zero-match state is reached rather than worked around.
 * Omitting `attribution` preserves the exact pre-Checkpoint-2 behavior.
 */
export function selectRepresentatives(
  completenessList: AdCompleteness[],
  groupIdByIndex: (number | null)[],
  attribution?: AdvertiserAttribution[]
): RepresentativeSelection {
  const n = completenessList.length;
  const isRepresentative = new Array(n).fill(false);
  const isEligible = (i: number) =>
    completenessList[i].status !== "malformed" && (attribution === undefined || attribution[i] === "match");

  const groupBestIndex = new Map<number, number>();
  const pool: number[] = [];

  for (let i = 0; i < n; i++) {
    const groupId = groupIdByIndex[i];
    if (groupId === null) {
      if (isEligible(i)) pool.push(i);
      continue;
    }
    if (!isEligible(i)) continue;
    const currentBest = groupBestIndex.get(groupId);
    if (
      currentBest === undefined ||
      isBetterRepresentative(completenessList[i], i, completenessList[currentBest], currentBest)
    ) {
      groupBestIndex.set(groupId, i);
    }
  }
  for (const idx of groupBestIndex.values()) pool.push(idx);

  pool.sort((a, b) => {
    if (isBetterRepresentative(completenessList[a], a, completenessList[b], b)) return -1;
    if (isBetterRepresentative(completenessList[b], b, completenessList[a], a)) return 1;
    return 0;
  });

  const selectedCount = Math.min(pool.length, MAX_REPRESENTATIVES);
  for (let k = 0; k < selectedCount; k++) isRepresentative[pool[k]] = true;

  return { isRepresentative, poolSize: pool.length };
}

/* ------------------------------------------------------------------ */
/* Destination-preview fragment detection                              */
/* ------------------------------------------------------------------ */

/**
 * A line that IS a domain (registrable domain, optional multi-level
 * TLD like ".com.br", optional path) and nothing else — never a
 * sentence that merely mentions one. Meta's own link-preview cards
 * always render the destination domain as its own bare line (often
 * upper-cased); real ad copy essentially never opens a line with
 * nothing but a bare domain string.
 */
const BARE_DOMAIN_LINE_RE = /^\s*(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?\s*$/i;

/** Generous cap on the remaining word count (segment minus the domain
 *  line) — comfortably covers "Product Name / $130.00 / Shop Now" or a
 *  short app-store description, while staying well below what a real
 *  ad's hook+body would run. */
const DESTINATION_PREVIEW_MAX_REMAINING_WORDS = 20;

/**
 * Recognizes a destination-preview / link-preview card — a bare domain
 * line plus a short, evidence-free product-title/price/app-description
 * shell — as metadata ATTACHED to an ad, not a second, independent ad.
 * This exists because boundary detection (Stage B) can't distinguish
 * "a new ad card started" from "this ad's own link-preview card
 * started" — both look identical structurally (a bare-CTA-line ends
 * the segment before it). Deliberately generic (no brand-specific
 * domain list) and conservative:
 *   - only fires when the segment's FIRST line is a bare domain — a
 *     domain mentioned mid-sentence never matches;
 *   - never fires if the segment has ANY genuine ad-copy evidence
 *     (a detected benefit, trust signal, positioning claim, offer
 *     PATTERN match, or story unit) elsewhere — reusing the already-
 *     computed ParsedAdExample fields, not a second keyword pass;
 *   - ignores the CTA/hook fields entirely on purpose: those are
 *     exactly the weak, incidental signals that let these blocks slip
 *     past computeAdCompleteness's malformed/empty check in the first
 *     place (see the audit that led to this function).
 */
export function isDestinationPreviewFragment(raw: string, parsed: ParsedAdExample): boolean {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");
  if (lines.length === 0) return false;

  const firstLine = lines[0];
  if (!BARE_DOMAIN_LINE_RE.test(firstLine)) return false;

  const hasGenuineEvidence =
    parsed.detectedBenefits.length > 0 ||
    parsed.detectedTrust.length > 0 ||
    parsed.detectedPositioning.length > 0 ||
    parsed.detectedOffers.length > 0 ||
    (parsed.story?.length ?? 0) > 0;
  if (hasGenuineEvidence) return false;

  const wordsOf = (s: string) => s.split(/\s+/).filter(Boolean).length;
  const remainingWords = wordsOf(raw.trim()) - wordsOf(firstLine);
  return remainingWords <= DESTINATION_PREVIEW_MAX_REMAINING_WORDS;
}

/* ------------------------------------------------------------------ */
/* Orchestration + Stage F warnings                                    */
/* ------------------------------------------------------------------ */

export interface PageDumpWarning {
  code:
    | "no-clear-boundaries"
    | "possible-variants-grouped"
    | "capped-at-max"
    | "chrome-removed"
    | "non-ad-fragments-skipped"
    | "destination-preview-skipped";
  message: string;
}

export interface PageDumpCandidate {
  id: number;
  /** Chrome-stripped, boundary-cut text for this candidate — never
   *  re-derived once produced; the caller edits this value directly. */
  raw: string;
  /** parseAdExample(raw), computed once here so the caller doesn't need
   *  a second, redundant parse pass to build its own review state. */
  parsed: ParsedAdExample;
  completeness: AdCompleteness;
  boundaryConfidence: BoundaryConfidence;
  variantGroupId: number | null;
  isRepresentative: boolean;
  /** Competitor Input Trust V2: the captured advertiser/page name for
   *  this candidate — from its own per-card "Sponsored"/"Sponsored ·
   *  Name" marker if one was found, else the page-level
   *  leadingPageName fallback (a single-profile-view paste), else
   *  null. null means attribution is genuinely impossible for this
   *  candidate — never a guess. Exact, string-normalized comparisons
   *  only (see groupPossibleVariants); no fuzzy matching, no AI. */
  pageName: string | null;
  /** Checkpoint 2: classifyAdvertiserAttribution(pageName,
   *  competitorName) — computed once here, read back by the caller and
   *  by selectRepresentatives above. See that function for the exact
   *  match/mismatch/unknown rules. */
  advertiserAttribution: AdvertiserAttribution;
}

export interface PageDumpResult {
  candidates: PageDumpCandidate[];
  variantGroups: VariantGroup[];
  chromeLinesRemoved: number;
  /** Count of segments excluded for having no recognizable ad content
   *  at all (computeAdCompleteness "malformed"/"empty") — a dedicated,
   *  separate counter from destinationPreviewSkipped so the two
   *  exclusion reasons are never conflated. */
  nonAdFragmentsSkipped: number;
  /** Count of segments excluded as a destination-preview / link-preview
   *  card (a bare domain line plus a short, evidence-free shell)
   *  attached to an ad rather than a standalone ad — see
   *  isDestinationPreviewFragment. Always disclosed, never a silent
   *  drop: a user must be able to see why fewer candidates appeared
   *  than were present in the copied page. */
  destinationPreviewSkipped: number;
  warnings: PageDumpWarning[];
}

/**
 * The single entry point: one large pasted blob in, a reviewable set of
 * candidates out. `competitorName` is optional and has two effects,
 * both additive: the exact-match chrome-stripping rule (Stage A,
 * unchanged since Checkpoint 1), and — new in Checkpoint 2 — the
 * advertiserAttribution classification of every candidate against it
 * (see classifyAdvertiserAttribution), which selectRepresentatives
 * then uses as a hard eligibility gate. Passing it never changes
 * boundary detection or grouping. `aliases` (Checkpoint 3) only widens
 * the match set for that same classification — it has no effect on
 * Stage A's chrome-stripping rule, which still only strips an exact
 * competitorName line.
 */
export function processPageDump(rawInput: string, competitorName?: string, aliases?: string[]): PageDumpResult {
  const { cleaned: withoutHeader, headerLinesRemoved, leadingPageName } = stripLeadingHeader(rawInput);
  const { cleaned, removedLineCount } = stripChromeLines(withoutHeader, competitorName);
  const rawSegments = detectAdBoundaries(cleaned).filter((s) => s.raw.trim() !== "");

  // Competitor Input Trust V2: pull any per-segment advertiser marker
  // out before anything else touches this text — parseAdExample,
  // completeness, and grouping must never see the internal marker as
  // ad content. A segment with no marker of its own falls back to the
  // page-level leadingPageName (the single-profile-view paste shape)
  // rather than being left unknown when a page-level name IS
  // available; a segment with neither stays null (attribution
  // genuinely impossible), never guessed.
  const markerExtracted = rawSegments.map((s) => extractPageNameMarker(s.raw));
  const allSegments: BoundarySegment[] = rawSegments.map((s, i) => ({
    raw: markerExtracted[i].raw,
    confidence: s.confidence,
  }));
  const allPageNames: (string | null)[] = markerExtracted.map((e) => e.pageName ?? leadingPageName);

  const allParsed = allSegments.map((s) => parseAdExample(s.raw));
  const allCompleteness = allParsed.map((p) => computeAdCompleteness(p));

  // Two hard exclusion rules, checked in order so a segment is
  // attributed to exactly ONE reason (never double-counted):
  //   1. "Never create an AdBlock if: no hook, no headline, no CTA, no
  //      offer, no recognizable ad body" — computeAdCompleteness's own
  //      "malformed"/"empty" status.
  //   2. A destination-preview / link-preview card attached to an ad
  //      (see isDestinationPreviewFragment) — only checked for segments
  //      that already cleared rule 1, since a malformed/empty segment
  //      is already being excluded for a more fundamental reason.
  // The one exception to both: if filtering would leave NOTHING at
  // all, keep everything unfiltered instead — the user must never be
  // left with a blank review state just because the only thing found
  // (e.g. the Tier-3 "no boundaries" single block) happens to be thin.
  type ExclusionReason = "non-ad-fragment" | "destination-preview" | null;
  const exclusionReasons: ExclusionReason[] = allSegments.map((seg, i) => {
    const completeness = allCompleteness[i];
    if (completeness.status === "malformed" || completeness.status === "empty") return "non-ad-fragment";
    if (isDestinationPreviewFragment(seg.raw, allParsed[i])) return "destination-preview";
    return null;
  });
  const keepFlags = exclusionReasons.map((r) => r === null);
  const useFilter = keepFlags.some(Boolean);

  const segments = useFilter ? allSegments.filter((_, i) => keepFlags[i]) : allSegments;
  const parsedList = useFilter ? allParsed.filter((_, i) => keepFlags[i]) : allParsed;
  const completenessList = useFilter ? allCompleteness.filter((_, i) => keepFlags[i]) : allCompleteness;
  const pageNames = useFilter ? allPageNames.filter((_, i) => keepFlags[i]) : allPageNames;
  const nonAdFragmentsSkipped = useFilter
    ? exclusionReasons.filter((r) => r === "non-ad-fragment").length
    : 0;
  const destinationPreviewSkipped = useFilter
    ? exclusionReasons.filter((r) => r === "destination-preview").length
    : 0;

  // Checkpoint 2: classify once, per filtered candidate, then feed the
  // SAME array into selectRepresentatives as a hard eligibility gate —
  // never a ranking factor. This is what guarantees a mismatch/unknown
  // candidate can't become default-included just by being the
  // richest/first in its group or pool. The gate itself only applies
  // when a real competitorName was actually typed — with none given
  // yet (e.g. "Extract ads" clicked before the name field is filled
  // in), there is nothing to validate against, so selection falls back
  // to the exact pre-Checkpoint-2 (richness-only) behavior rather than
  // zeroing out every default just because everything reads "unknown".
  const hasAnyAcceptedName =
    (competitorName !== undefined && competitorName.trim() !== "") || (aliases ?? []).some((a) => a.trim() !== "");
  const attribution = pageNames.map((pageName) => classifyAdvertiserAttribution(pageName, competitorName, aliases));

  const texts = segments.map((s) => s.raw);
  const { groupIdByIndex, groups } = groupPossibleVariants(texts, pageNames);
  const selection = selectRepresentatives(completenessList, groupIdByIndex, hasAnyAcceptedName ? attribution : undefined);

  const candidates: PageDumpCandidate[] = segments.map((seg, i) => ({
    id: i,
    raw: seg.raw,
    parsed: parsedList[i],
    completeness: completenessList[i],
    boundaryConfidence: seg.confidence,
    variantGroupId: groupIdByIndex[i],
    isRepresentative: selection.isRepresentative[i],
    pageName: pageNames[i],
    advertiserAttribution: attribution[i],
  }));

  const warnings: PageDumpWarning[] = [];

  if (candidates.length === 1 && candidates[0].boundaryConfidence === "low") {
    warnings.push({
      code: "no-clear-boundaries",
      message:
        "No clear ad boundaries were detected — the paste was kept as one block. Edit it directly, or add a blank line between ads and try again.",
    });
  }

  if (groups.length > 0) {
    const totalGroupedMembers = groups.reduce((sum, g) => sum + g.memberIndices.length, 0);
    warnings.push({
      code: "possible-variants-grouped",
      message: `${groups.length} possible-variant group${groups.length === 1 ? "" : "s"} found (${totalGroupedMembers} ads total) — showing 1 representative per group by default. Every variant stays visible and can be included individually.`,
    });
  }

  if (selection.poolSize > MAX_REPRESENTATIVES) {
    warnings.push({
      code: "capped-at-max",
      message: `Found more usable ads than the default review set — showing the top ${MAX_REPRESENTATIVES} by evidence richness. The rest are still listed below and can be included manually.`,
    });
  }

  if (nonAdFragmentsSkipped > 0) {
    warnings.push({
      code: "non-ad-fragments-skipped",
      message: `Skipped ${nonAdFragmentsSkipped} fragment${nonAdFragmentsSkipped === 1 ? "" : "s"} with no recognizable ad content (hook, headline, CTA, offer, or body) — likely leftover page interface text.`,
    });
  }

  if (destinationPreviewSkipped > 0) {
    warnings.push({
      code: "destination-preview-skipped",
      message: `Skipped ${destinationPreviewSkipped} destination-preview block${destinationPreviewSkipped === 1 ? "" : "s"} (e.g. an App Store or storefront link card) — attached to an ad rather than a standalone ad.`,
    });
  }

  const totalChromeLinesRemoved = headerLinesRemoved + removedLineCount;
  if (totalChromeLinesRemoved > 0) {
    warnings.push({
      code: "chrome-removed",
      message: `Removed ${totalChromeLinesRemoved} likely interface line${totalChromeLinesRemoved === 1 ? "" : "s"} (e.g. "Meta Ads Library", "Sponsored", "Active", "Library ID") before splitting into ads.`,
    });
  }

  return {
    candidates,
    variantGroups: groups,
    chromeLinesRemoved: totalChromeLinesRemoved,
    nonAdFragmentsSkipped,
    destinationPreviewSkipped,
    warnings,
  };
}
