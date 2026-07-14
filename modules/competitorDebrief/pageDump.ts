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
 * processPageDump's orchestration also enforces one hard rule after
 * parsing: a segment with no hook, no headline, no CTA, no offer, and
 * no other recognizable ad body (computeAdCompleteness's "malformed" or
 * "empty" status — reused, not reimplemented) never becomes a
 * PageDumpCandidate at all — a leftover UI/header fragment must never
 * be presented to the user as something to review as an ad. The one
 * exception: if EVERY segment would be filtered out, nothing is
 * dropped — the user must never be left with a blank review state just
 * because the only thing found was thin (this is what keeps the
 * existing "no clear boundaries" single-block floor behavior intact).
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
      i++;
      continue;
    }

    break;
  }

  return { cleaned: lines.slice(i).join("\n"), headerLinesRemoved: removed };
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
  // Requires an immediate Month Day, Year date so a real sentence like
  // "I started running on empty stomachs" can never match — the Meta
  // chrome phrase is always followed by a date, never a description.
  { label: "started running on", re: /^\s*started\s+running\s+on\s+[A-Za-z]+\.?\s+\d{1,2},?\s+\d{4}\b.*$/i },
  { label: "bare sponsored line", re: /^\s*sponsored\s*$/i },
  // "Sponsored · Page Name" / "Sponsored - Page Name" — a distinctive,
  // literal UI construct no real ad copy would write as body text;
  // anchored on the word "Sponsored" plus a separator, never on
  // guessing the page name itself.
  { label: "sponsored + page name", re: /^\s*sponsored\s*(?:[·•|]|-{1,2})\s*\S.*$/i },
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

/**
 * Strips known chrome lines. `competitorName`, when provided,
 * additionally strips a line ONLY when it is an exact (whitespace/case
 * normalized) match for the full competitor name the user typed — never
 * a partial/substring match, never based on how often it repeats. Blank
 * lines are always preserved (they still matter for Stage B's reused
 * blank-line-run tier).
 */
export function stripChromeLines(text: string, competitorName?: string): ChromeStripResult {
  const normalizedCompetitorName =
    competitorName && competitorName.trim() !== "" ? normalizeForDedupe(competitorName) : null;

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  let removedLineCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      kept.push(line);
      continue;
    }
    const isKnownChrome = CHROME_LINE_PATTERNS.some(({ re }) => re.test(trimmed));
    const isExactCompetitorNameLine =
      normalizedCompetitorName !== null && normalizeForDedupe(trimmed) === normalizedCompetitorName;
    if (isKnownChrome || isExactCompetitorNameLine) {
      removedLineCount++;
      continue;
    }
    kept.push(line);
  }

  return { cleaned: kept.join("\n"), removedLineCount };
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
 */
export function groupPossibleVariants(texts: string[]): VariantGroupingResult {
  const n = texts.length;
  const uf = new UnionFind(n);
  const tokenLists = texts.map(tokenize);
  const bigramSets = tokenLists.map(bigramSet);

  for (let i = 0; i < n; i++) {
    if (texts[i].trim() === "") continue;
    for (let j = i + 1; j < n; j++) {
      if (texts[j].trim() === "") continue;
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
 */
export function selectRepresentatives(
  completenessList: AdCompleteness[],
  groupIdByIndex: (number | null)[]
): RepresentativeSelection {
  const n = completenessList.length;
  const isRepresentative = new Array(n).fill(false);

  const groupBestIndex = new Map<number, number>();
  const pool: number[] = [];

  for (let i = 0; i < n; i++) {
    const groupId = groupIdByIndex[i];
    if (groupId === null) {
      if (completenessList[i].status !== "malformed") pool.push(i);
      continue;
    }
    if (completenessList[i].status === "malformed") continue;
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
/* Orchestration + Stage F warnings                                    */
/* ------------------------------------------------------------------ */

export interface PageDumpWarning {
  code:
    | "no-clear-boundaries"
    | "possible-variants-grouped"
    | "capped-at-max"
    | "chrome-removed"
    | "non-ad-fragments-skipped";
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
}

export interface PageDumpResult {
  candidates: PageDumpCandidate[];
  variantGroups: VariantGroup[];
  chromeLinesRemoved: number;
  warnings: PageDumpWarning[];
}

/**
 * The single entry point: one large pasted blob in, a reviewable set of
 * candidates out. `competitorName` is optional and used ONLY for the
 * exact-match competitor-name chrome-stripping rule (Stage A) — passing
 * it never changes boundary detection, grouping, or selection.
 */
export function processPageDump(rawInput: string, competitorName?: string): PageDumpResult {
  const { cleaned: withoutHeader, headerLinesRemoved } = stripLeadingHeader(rawInput);
  const { cleaned, removedLineCount } = stripChromeLines(withoutHeader, competitorName);
  const allSegments = detectAdBoundaries(cleaned).filter((s) => s.raw.trim() !== "");

  const allParsed = allSegments.map((s) => parseAdExample(s.raw));
  const allCompleteness = allParsed.map((p) => computeAdCompleteness(p));

  // "Never create an AdBlock if: no hook, no headline, no CTA, no
  // offer, no recognizable ad body" — a segment whose completeness
  // status is "malformed" or "empty" (computeAdCompleteness's own
  // categories for exactly this: zero detected evidence anywhere)
  // never becomes a candidate. The one exception: if filtering would
  // leave NOTHING at all, keep everything unfiltered instead — the
  // user must never be left with a blank review state just because
  // the only thing found (e.g. the Tier-3 "no boundaries" single
  // block) happens to be thin.
  const hasRecognizableContent = (c: AdCompleteness) => c.status !== "malformed" && c.status !== "empty";
  const keepFlags = allCompleteness.map(hasRecognizableContent);
  const useFilter = keepFlags.some(Boolean);

  const segments = useFilter ? allSegments.filter((_, i) => keepFlags[i]) : allSegments;
  const parsedList = useFilter ? allParsed.filter((_, i) => keepFlags[i]) : allParsed;
  const completenessList = useFilter ? allCompleteness.filter((_, i) => keepFlags[i]) : allCompleteness;
  const nonAdFragmentsSkipped = useFilter ? allSegments.length - segments.length : 0;

  const texts = segments.map((s) => s.raw);
  const { groupIdByIndex, groups } = groupPossibleVariants(texts);
  const selection = selectRepresentatives(completenessList, groupIdByIndex);

  const candidates: PageDumpCandidate[] = segments.map((seg, i) => ({
    id: i,
    raw: seg.raw,
    parsed: parsedList[i],
    completeness: completenessList[i],
    boundaryConfidence: seg.confidence,
    variantGroupId: groupIdByIndex[i],
    isRepresentative: selection.isRepresentative[i],
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

  const totalChromeLinesRemoved = headerLinesRemoved + removedLineCount;
  if (totalChromeLinesRemoved > 0) {
    warnings.push({
      code: "chrome-removed",
      message: `Removed ${totalChromeLinesRemoved} likely interface line${totalChromeLinesRemoved === 1 ? "" : "s"} (e.g. "Meta Ads Library", "Sponsored", "Active", "Library ID") before splitting into ads.`,
    });
  }

  return { candidates, variantGroups: groups, chromeLinesRemoved: totalChromeLinesRemoved, warnings };
}
