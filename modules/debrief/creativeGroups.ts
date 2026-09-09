/**
 * Creative Grouping V1 — a dedicated, decision-blind module (same
 * isolation pattern as briefReadiness.ts / evidenceDiagnostic.ts /
 * compare.ts): summarizes repeated performance evidence for
 * user-declared creative groups. NEVER read by decision.ts, NEVER
 * changes evidenceState/confidence/Brief Readiness/the committed
 * action/the spend gate/winners/losers/comparison. It only re-reads
 * already-computed RankedAd facts (deltaFromMedian's sign — the exact
 * same classification winners/losers/Spend Allocation already use, no
 * new threshold) through a label the user typed.
 *
 * A "group" is not an engine concept — it's whatever the user calls
 * it. This module encodes no taxonomy of hooks/angles/concepts/
 * formats; it only counts and classifies.
 */
import type { CreativeGroupAssignments, MemoCreativeGroup, MemoCreativeGroups, RankedAd } from "./types";

/** The minimum judged executions carrying a label before it's reported
 *  as a repeated pattern — NOT a strength/confidence threshold, just
 *  the difference between "repeated" and "one execution." */
export const MIN_GROUP_REPETITION = 2;

/** Trim + collapse internal whitespace + lowercase — the MATCH key
 *  only. "Morning routine", "morning routine", and " Morning routine "
 *  all resolve to the same group; the DISPLAY label (see below) is
 *  never this normalized form. */
export function normalizeGroupLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Execution-identity resolution (Creative Grouping V1, corrected):
 *  Meta's Ad ID when the export included one — the most reliable,
 *  rename-proof key — otherwise `ad.name`, which by this point is
 *  ALREADY a stable, unique-per-row identity: extract.ts's Duplicate
 *  Identity fix (disambiguateDuplicateNames) appends a deterministic
 *  "(row N)" suffix to every row sharing a raw name BEFORE this module
 *  ever sees it, so two executions named "UGC_V1" are never the same
 *  key here. This is deliberately NOT sourceName (the shared RAW name)
 *  — that was the bug: keying by sourceName collapsed distinct
 *  executions that merely happen to share a display name back into one
 *  shared assignment, exactly like creativeFormatOverrides does (a
 *  fine tradeoff for a format guess, not for user-declared per-
 *  execution group membership). A defensive `.trim()` fallback covers
 *  a padded id/name from a hand-built request; both sides of this
 *  match are otherwise already-computed, already-trimmed values. */
function executionKey(ad: RankedAd): string {
  return ad.id ?? ad.name;
}

function labelsForAd(ad: RankedAd, declared: CreativeGroupAssignments): readonly string[] {
  const key = executionKey(ad);
  return declared[key] ?? declared[key.trim()] ?? [];
}

/** RankedAd.deltaFromMedian is already polarity-corrected ("signed
 *  distance from the median in the 'better' direction" — see
 *  types.ts), so its sign alone is the category — the exact same
 *  classification analysis.ts's winner/loser/at pools and Spend
 *  Allocation's below/at/above segments already use. No new benchmark
 *  concept, no materiality cutoff invented here. */
function categoryFor(ad: RankedAd): "below" | "at" | "above" {
  if (ad.deltaFromMedian > 0) return "above";
  if (ad.deltaFromMedian < 0) return "below";
  return "at";
}

const CREATIVE_GROUPS_LIMITS = {
  buyer:
    "Grouping is something you declared, not detected from the data — shared group membership doesn't establish that the group caused these results, and grouped ads may differ from each other in other unobserved ways.",
  client:
    "These groups are ones you assigned yourself. Ads sharing a group aren't proven to have won or lost because of that shared idea — they could differ in other ways too.",
};

/**
 * Pure, deterministic. Input: the complete judged/ranked set
 * (analysis.rankedAds — winners ∪ losers ∪ at-median ads, NEVER the
 * truncated winners/losers display slices, so every judged execution
 * carrying a label counts in its group's denominator) and the user's
 * raw label assignments. Output: null when there's no repeated-group
 * evidence to show (same "nothing to render" discipline
 * MemoSpendAllocation already follows) — either no labels were
 * supplied, or every label landed on fewer than MIN_GROUP_REPETITION
 * judged executions.
 */
export function summarizeCreativeGroups(
  rankedAds: readonly RankedAd[],
  declared: CreativeGroupAssignments
): MemoCreativeGroups | null {
  if (Object.keys(declared).length === 0) return null;

  const byKey = new Map<string, { label: string; members: RankedAd[] }>();
  for (const ad of rankedAds) {
    for (const rawLabel of labelsForAd(ad, declared)) {
      const key = normalizeGroupLabel(rawLabel);
      if (key === "") continue; // blank/whitespace-only label — never a group
      const display = rawLabel.trim().replace(/\s+/g, " ");
      let entry = byKey.get(key);
      if (!entry) {
        // First-seen display casing/spacing wins — rankedAds' own
        // order is already deterministic, so this is stable.
        entry = { label: display, members: [] };
        byKey.set(key, entry);
      }
      // One ad can carry the same label only once (defensive — the UI
      // never offers duplicate chips, but a hand-built fixture might).
      if (!entry.members.includes(ad)) entry.members.push(ad);
    }
  }

  const groups: (MemoCreativeGroup & { normalizedKey: string })[] = [];
  for (const [key, { label, members }] of byKey) {
    if (members.length < MIN_GROUP_REPETITION) continue;
    const sorted = [...members].sort((a, b) => b.deltaFromMedian - a.deltaFromMedian);
    let belowCount = 0;
    let atCount = 0;
    let aboveCount = 0;
    const memberRows = sorted.map((ad) => {
      const category = categoryFor(ad);
      if (category === "below") belowCount += 1;
      else if (category === "at") atCount += 1;
      else aboveCount += 1;
      return { name: ad.name, category };
    });
    groups.push({
      normalizedKey: key,
      label,
      judgedCount: sorted.length,
      belowCount,
      atCount,
      aboveCount,
      members: memberRows,
    });
  }

  if (groups.length === 0) return null;

  // Deterministic order: judged count descending, then normalized
  // label alphabetically — a display convenience, never a ranking
  // claim (no group is ever called "winning" or "stronger").
  groups.sort((a, b) => {
    if (b.judgedCount !== a.judgedCount) return b.judgedCount - a.judgedCount;
    return a.normalizedKey.localeCompare(b.normalizedKey);
  });

  return {
    groups: groups.map((g) => ({
      label: g.label,
      judgedCount: g.judgedCount,
      belowCount: g.belowCount,
      atCount: g.atCount,
      aboveCount: g.aboveCount,
      members: g.members,
    })),
    limits: CREATIVE_GROUPS_LIMITS,
  };
}
