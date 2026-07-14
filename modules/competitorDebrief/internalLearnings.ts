import type { CompetitorDebrief, CompetitorDebriefTest } from "./types.ts";

/**
 * Internal Learnings MVP — lets the user paste their own team's prior
 * test results (worked/failed/avoid/general learnings) and uses them to
 * make next-test recommendations context-aware, instead of always
 * treating competitor patterns as brand-new ideas.
 *
 * Manual input only. No database, no account memory, no auth changes,
 * no LLM/external call — this file is pure string parsing and pure
 * data transformation, same deterministic-template approach as the
 * rest of modules/competitorDebrief.
 *
 * Architecture: this is a POST-PROCESSING layer, not a change to the
 * engine. `engine.ts`/`strategicPatterns.ts` are untouched — every
 * synthesis/strategic-pattern rule still runs exactly as before, and
 * `applyInternalLearnings` only adjusts the FINAL `nextTests` array
 * (and adds the new `internalLearnings` field) on top of what the
 * engine already produced. This keeps the well-tested synthesis logic
 * completely unaffected and makes the new behavior easy to reason
 * about and remove independently.
 *
 * Honesty policy: matching is conservative token-overlap over a
 * SHORT, scoped pair of fields (a test's hookOrAngle/offerOrCta —
 * never the boilerplate-heavy hypothesis/whatYoullLearn prose), never
 * fuzzy/semantic. No past test, winner, or loser is ever invented —
 * every adjustment traces to (a) the user's own pasted learning text,
 * verbatim, and (b) evidence fields the engine already produced from
 * the pasted ads. When matching is uncertain, the original
 * recommendation is left untouched rather than forcing a reference.
 */

export type LearningOutcome = "worked" | "failed" | "avoid" | "learning" | "unknown";

export interface ParsedLearning {
  outcome: LearningOutcome;
  /** The original pasted line, verbatim, trimmed only. */
  raw: string;
  /** Text after the "Worked:"/"Failed:"/"Avoid:"/"Learning:" label, or
   *  the whole line when no recognized label was found (`outcome`
   *  stays "unknown" in that case — never guessed). */
  text: string;
  /** Stemmed, stopword-filtered significant terms from `text` — the
   *  same terms termsOverlap() computes internally, exposed here so
   *  callers/tests can inspect what actually drives matching. */
  normalizedTerms: string[];
}

const OUTCOME_LABEL_RE = /^(worked|failed|avoid|learning)\s*[:\-–—]\s*(.+)$/i;

/* ------------------------------------------------------------------ */
/* Conservative term matching — stem + stopword filter, then overlap   */
/* by shared-term coverage. Deliberately NOT fuzzy/semantic: two       */
/* phrases either share enough of their distinctive vocabulary or they */
/* don't. See termsOverlap() for the exact thresholds.                 */
/* ------------------------------------------------------------------ */

/** Generic English function words plus a handful of this engine's own
 *  template vocabulary ("test", "pattern", "observed", ...) that
 *  appears in nearly every generated test/evidence string regardless
 *  of topic — without these, that boilerplate would dominate the
 *  overlap signal instead of genuine topical overlap. */
const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "your", "have", "been", "were",
  "only", "just", "more", "less", "very", "much", "also", "than", "when", "then",
  "into", "about", "after", "before", "first", "which", "their", "there", "these",
  "those", "because", "using", "already", "still", "some", "such", "like", "over",
  "each", "every", "both", "either", "neither", "other", "another", "same", "different",
  "test", "tests", "testing", "tested", "worth", "observed", "across", "against",
  "pattern", "patterns", "independent", "claim", "claims", "result", "results",
  "response", "audience", "directional", "specific", "instead", "rather", "without",
  "does", "doesn", "didn", "isn", "wasn", "aren", "won", "not", "but", "can", "will",
]);

/** Crude English suffix stripper — good enough for exact-plural
 *  matching ("injections" <-> "injection") without a real stemming
 *  library or any AI. Only used as a matching key, never for display. */
function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function normalizeTerms(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .map(stem)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

export interface TermOverlapResult {
  overlap: boolean;
  sharedTerms: string[];
}

/**
 * Conservative overlap check between two short phrases (a learning's
 * text and a competitor-evidence label / test hookOrAngle / offerOrCta
 * — never a long boilerplate-heavy sentence). Requires either TWO+
 * shared terms covering at least 40% of the shorter phrase, or ONE
 * shared term that makes up at least two-thirds of it — i.e. the
 * shorter phrase is basically just that one word. A single
 * one-of-several shared word (e.g. "quiz" shared between "Quiz CTA"
 * and the generic two-word offer fallback "quiz funnel", which several
 * unrelated tests can end up reusing) is deliberately NOT enough on its
 * own — that's what keeps this from over-tagging every test that
 * happens to reuse the same short fallback value, and from
 * over-suppressing unrelated ideas.
 */
export function termsOverlap(a: string, b: string): TermOverlapResult {
  const termsA = new Set(normalizeTerms(a));
  const termsB = new Set(normalizeTerms(b));
  if (termsA.size === 0 || termsB.size === 0) return { overlap: false, sharedTerms: [] };

  const shared = [...termsA].filter((t) => termsB.has(t));
  if (shared.length === 0) return { overlap: false, sharedTerms: [] };

  const coverage = shared.length / Math.min(termsA.size, termsB.size);
  const overlap = shared.length >= 2 ? coverage >= 0.4 : coverage >= 2 / 3;
  return { overlap, sharedTerms: shared };
}

/* ------------------------------------------------------------------ */
/* Line parsing                                                        */
/* ------------------------------------------------------------------ */

/** Parses one pasted line. Never guesses a label that isn't there —
 *  anything without a recognized "Worked:"/"Failed:"/"Avoid:"/
 *  "Learning:" prefix stays `outcome: "unknown"` with the whole line
 *  as `text`, still shown, never used for matching. */
export function parseLearningLine(rawLine: string): ParsedLearning {
  const raw = rawLine.trim();
  const m = raw.match(OUTCOME_LABEL_RE);
  const outcome: LearningOutcome = m ? (m[1].toLowerCase() as LearningOutcome) : "unknown";
  const text = m ? m[2].trim() : raw;
  return { outcome, raw, text, normalizedTerms: normalizeTerms(text) };
}

/** Splits pasted text into one learning per non-blank line, dropping
 *  exact (whitespace/case-normalized) duplicate lines — first
 *  occurrence wins, same policy as the "Paste ads" duplicate handling
 *  (modules/competitorDebrief/adParser.ts's dedupeAdTexts). */
export function parseInternalLearnings(text: string): ParsedLearning[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");

  const seen = new Set<string>();
  const result: ParsedLearning[] = [];
  for (const line of lines) {
    const key = line.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(parseLearningLine(line));
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Comparative preference — "X outperforms/beats Y" phrasing, matched  */
/* against a test's "A vs. B" hookOrAngle structure so the recommended */
/* variant can lead with the side the user's own team already found    */
/* stronger, rather than presenting it as an untested coin flip.       */
/* ------------------------------------------------------------------ */

const COMPARATIVE_RE =
  /^(.+?)\s+(?:outperforms?|beats?|works?\s+better\s+than|performs?\s+better\s+than|is\s+better\s+than)\s+(.+?)[.!]?$/i;

interface ComparativePreference {
  winnerText: string;
  loserText: string;
}

function extractComparativePreference(text: string): ComparativePreference | null {
  const m = text.match(COMPARATIVE_RE);
  if (!m) return null;
  return { winnerText: m[1].trim(), loserText: m[2].trim() };
}

const VERSUS_RE = /^(.+?)\s+vs\.?\s+(.+)$/i;

function splitVersusHookOrAngle(hookOrAngle: string): [string, string] | null {
  const m = hookOrAngle.match(VERSUS_RE);
  if (!m) return null;
  return [m[1].trim(), m[2].trim()];
}

/* ------------------------------------------------------------------ */
/* Recommendation adjustment                                           */
/* ------------------------------------------------------------------ */

export interface InternalLearningNote {
  kind: "builds-on" | "adjusted" | "avoids-failed";
  /** Short badge text — one of the three fixed phrases from the brief,
   *  never a per-case invented label. */
  label: string;
  /** One sentence, always quoting the user's own pasted learning text
   *  verbatim as the supporting evidence. */
  explanation: string;
}

function capitalize(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}

const ANGLE_EVIDENCE_FIELDS: (keyof CompetitorDebrief)[] = [
  "dominantNarrative",
  "proofStrategy",
  "positioningThemes",
  "creativeStructure",
];

/** Looks for a DIFFERENT angle already present in the debrief's own
 *  evidence (never invented) that isn't itself flagged by any
 *  failed/avoid learning and isn't just a restatement of the angle
 *  being replaced. Returns null when nothing usable is available —
 *  callers must handle that honestly rather than fabricating one. */
function findAlternativeAngle(
  debrief: CompetitorDebrief,
  failedOrAvoid: ParsedLearning[],
  usedAngle: string
): string | null {
  for (const field of ANGLE_EVIDENCE_FIELDS) {
    const values = debrief[field] as string[];
    for (const candidate of values) {
      if (termsOverlap(candidate, usedAngle).overlap) continue;
      if (failedOrAvoid.some((l) => termsOverlap(candidate, l.text).overlap)) continue;
      return candidate;
    }
  }
  return null;
}

/** Which test field actually triggered the conflict — only THAT field
 *  gets rewritten (the other stays exactly as the engine produced it).
 *  Fixes an earlier version of this function that always rewrote
 *  hookOrAngle even when the flagged overlap was in offerOrCta. */
type ConflictField = "hookOrAngle" | "offerOrCta";

function buildSuppressedOrAdjustedTest(
  test: CompetitorDebriefTest,
  learning: ParsedLearning,
  failedOrAvoid: ParsedLearning[],
  debrief: CompetitorDebrief,
  conflictField: ConflictField
): CompetitorDebriefTest {
  const flaggedValue = test[conflictField];
  const alternative = findAlternativeAngle(debrief, failedOrAvoid, flaggedValue);
  const reason = learning.outcome === "avoid" ? "flagged that angle as already saturated" : "already tested this angle and it didn't work";

  const replacement = alternative
    ? `${capitalize(alternative)} — instead of the flagged angle`
    : "A different angle than the one flagged below — no clear alternative in the pasted evidence yet, so pick one deliberately rather than repeating the flagged pattern.";

  const hypothesis = alternative
    ? `Skip this angle — your team ${reason} ("${learning.text}"). Test the same underlying competitor pattern through ${alternative.toLowerCase()} instead, which your team hasn't ruled out.`
    : `Skip this angle — your team ${reason} ("${learning.text}"). Deliberately choose a different angle before testing rather than repeating the flagged pattern.`;

  const label = learning.outcome === "avoid" ? "Avoids repeating a failed test" : "Adjusted because this was previously tested";
  const kind: InternalLearningNote["kind"] = learning.outcome === "avoid" ? "avoids-failed" : "adjusted";

  return {
    ...test,
    [conflictField]: replacement,
    hypothesis,
    internalLearningNote: { kind, label, explanation: `Your team noted: "${learning.text}"` },
  };
}

function buildComparativeReframedTest(
  test: CompetitorDebriefTest,
  learning: ParsedLearning,
  favoredSide: string,
  otherSide: string
): CompetitorDebriefTest {
  const hookOrAngle = `${capitalize(favoredSide)} (favored — your team's learning) vs. ${otherSide}`;
  const hypothesis =
    `Your team's own testing found ${favoredSide.toLowerCase()} outperforms ${otherSide.toLowerCase()} ` +
    `("${learning.text}") — leading with that here instead of treating it as an untested toss-up, while ` +
    `still keeping ${otherSide.toLowerCase()} as the contrast to confirm it holds for this audience too.`;

  return {
    ...test,
    hypothesis,
    hookOrAngle,
    internalLearningNote: {
      kind: "builds-on",
      label: "Builds on internal learning",
      explanation: `Your team noted: "${learning.text}"`,
    },
  };
}

function buildBuildsOnTest(test: CompetitorDebriefTest, learning: ParsedLearning): CompetitorDebriefTest {
  const hypothesis =
    `Your team has already validated this direction ("${learning.text}") — this test builds on that ` +
    `rather than treating it as a new idea. ${test.hypothesis}`;

  return {
    ...test,
    hypothesis,
    internalLearningNote: {
      kind: "builds-on",
      label: "Builds on internal learning",
      explanation: `Your team noted: "${learning.text}"`,
    },
  };
}

/** One test, checked against all actionable learnings. Priority order:
 *  (1) failed/avoid — do not recommend an already-flagged angle as-is,
 *  ever; (2) a comparative "X outperforms Y" learning matched against
 *  an "A vs. B" hookOrAngle — reframe to lead with the validated side;
 *  (3) a plain worked/learning overlap — tag as building on validated
 *  ground, content otherwise unchanged. First match wins; no match
 *  leaves the test exactly as the engine produced it (requirement: "if
 *  there is no meaningful match, preserve the current recommendation
 *  behavior"). */
function adjustTest(
  test: CompetitorDebriefTest,
  failedOrAvoid: ParsedLearning[],
  workedOrLearning: ParsedLearning[],
  debrief: CompetitorDebrief
): CompetitorDebriefTest {
  for (const learning of failedOrAvoid) {
    if (termsOverlap(test.hookOrAngle, learning.text).overlap) {
      return buildSuppressedOrAdjustedTest(test, learning, failedOrAvoid, debrief, "hookOrAngle");
    }
    if (termsOverlap(test.offerOrCta, learning.text).overlap) {
      return buildSuppressedOrAdjustedTest(test, learning, failedOrAvoid, debrief, "offerOrCta");
    }
  }

  const versus = splitVersusHookOrAngle(test.hookOrAngle);
  if (versus) {
    const [sideA, sideB] = versus;
    for (const learning of workedOrLearning) {
      const pref = extractComparativePreference(learning.text);
      if (!pref) continue;
      const aWins = termsOverlap(pref.winnerText, sideA).overlap && termsOverlap(pref.loserText, sideB).overlap;
      const bWins = !aWins && termsOverlap(pref.winnerText, sideB).overlap && termsOverlap(pref.loserText, sideA).overlap;
      if (aWins) return buildComparativeReframedTest(test, learning, sideA, sideB);
      if (bWins) return buildComparativeReframedTest(test, learning, sideB, sideA);
    }
  }

  for (const learning of workedOrLearning) {
    const hookHit = termsOverlap(test.hookOrAngle, learning.text);
    const ctaHit = termsOverlap(test.offerOrCta, learning.text);
    if (hookHit.overlap || ctaHit.overlap) {
      return buildBuildsOnTest(test, learning);
    }
  }

  return test;
}

export interface InternalLearningsSummary {
  /** Every parsed, deduped learning — including "unknown" lines, so
   *  nothing pasted is ever silently hidden — even though only
   *  worked/failed/avoid/learning entries can affect recommendations. */
  items: ParsedLearning[];
}

/**
 * Applies pasted internal learnings to an already-generated debrief.
 * Pure post-processing: competitor-evidence arrays (recurringHooks,
 * positioningThemes, strategic-pattern fields, etc.) are returned
 * completely unmodified — only `nextTests` and the new
 * `internalLearnings` field change. Called once, at the end of
 * generateCompetitorDebrief.
 */
export function applyInternalLearnings(
  debrief: CompetitorDebrief,
  learnings: ParsedLearning[]
): CompetitorDebrief {
  const internalLearnings: InternalLearningsSummary | null = learnings.length > 0 ? { items: learnings } : null;

  const actionable = learnings.filter((l) => l.outcome !== "unknown");
  if (actionable.length === 0) {
    return { ...debrief, internalLearnings };
  }

  const failedOrAvoid = actionable.filter((l) => l.outcome === "failed" || l.outcome === "avoid");
  const workedOrLearning = actionable.filter((l) => l.outcome === "worked" || l.outcome === "learning");

  const nextTests = debrief.nextTests.map((test) => adjustTest(test, failedOrAvoid, workedOrLearning, debrief));

  return { ...debrief, nextTests, internalLearnings };
}
