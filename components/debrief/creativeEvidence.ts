// Relative, explicit-".ts" type-only imports on purpose — same pattern
// as memoToText.ts: this file must be loadable by the plain-Node test
// runner (scripts/creativeEvidence.test.ts), so it imports types only
// and contains zero React, zero DOM, and zero asset knowledge.
import type { MemoComparison, MemoWinnerLoserRow } from "../../modules/debrief";

/**
 * Creative Evidence V1 — spotlight selection and ad-identity helpers.
 *
 * The selection contract (the part worth testing hard):
 *  - Spotlights are chosen from PERFORMANCE/COMPARISON evidence ONLY.
 *    This module never sees creative assets — `SpotlightSource` has no
 *    image field, so "an ad with an image" cannot outrank "the ad the
 *    evidence points at" by construction (test-enforced by a source
 *    scan). A spotlight without an image renders as a placeholder; it
 *    is never substituted.
 *  - At most three roles: Top performer, Weakest performer, Biggest
 *    change vs previous period (comparison runs only). When roles
 *    resolve to the same ad, the cards are MERGED — one card, multiple
 *    role labels — never the same creative twice.
 *  - Takeaways are evidence-safe restatements of facts the memo
 *    already computed (rankings, deltas, movement labels). No causal
 *    claim about the creative is ever generated here.
 */

/* ------------------------------------------------------------------ */
/* Ad identity                                                         */
/* ------------------------------------------------------------------ */

/** The ONE normalization rule for tying a creative asset to an ad
 *  name — identical to compare.ts's cross-period name key (trim +
 *  collapse internal whitespace, case-sensitive), so "identity" means
 *  the same thing everywhere in this product. Never fuzzy. */
export function normalizeAdName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Names that appear on MORE THAN ONE row of the loaded file. A name
 *  reused across rows is not structurally guaranteed to be one
 *  creative, so manual image attachment is disabled for it (the
 *  Verify stage explains why) and its spotlight renders the neutral
 *  placeholder instead of a possibly-wrong image. */
export function findAmbiguousAdNames(rowNames: readonly string[]): Set<string> {
  const counts = new Map<string, number>();
  for (const raw of rowNames) {
    const key = normalizeAdName(raw);
    if (key === "") continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const ambiguous = new Set<string>();
  for (const [key, count] of counts) {
    if (count > 1) ambiguous.add(key);
  }
  return ambiguous;
}

/* ------------------------------------------------------------------ */
/* Spotlight selection                                                 */
/* ------------------------------------------------------------------ */

export type SpotlightRole = "top" | "worst" | "mover";

export const SPOTLIGHT_ROLE_LABELS: Record<
  SpotlightRole,
  { buyer: string; client: string }
> = {
  top: { buyer: "Top performer", client: "Top performer" },
  worst: { buyer: "Weakest performer", client: "Weakest performer" },
  mover: {
    buyer: "Biggest change vs previous period",
    client: "Biggest change vs last period",
  },
};

/** The fixed section caveat — identification only, never causation. */
export const CREATIVE_EVIDENCE_CAVEAT = {
  buyer:
    "Creatives are shown for identification. Performance data shows how each ad performed, not why it performed that way.",
  client:
    "The images show which ad each result belongs to. The numbers show how each ad performed — not why.",
};

/** Everything selection is allowed to read — deliberately a narrow
 *  slice of the memo with NO asset/image field. */
export interface SpotlightSource {
  kpiLabel: string;
  adsJudged: number;
  winners: readonly MemoWinnerLoserRow[];
  loserRows: readonly MemoWinnerLoserRow[];
  comparison: Pick<MemoComparison, "improved" | "declined"> | null;
}

export interface Spotlight {
  /** Primary role — decides card order (top, worst, mover). */
  role: SpotlightRole;
  /** All roles this ad earned (≥2 after a dedupe merge). */
  roles: SpotlightRole[];
  adName: string;
  /** Normalized identity key for asset lookup (normalizeAdName). */
  assetKey: string;
  valueLabel: string;
  vsMedianLabel: string;
  spendLabel: string;
  /** Present on mover cards: the comparison's own movement label. */
  changeLabel?: string;
  takeaway: { buyer: string; client: string };
}

/** Parse the signed magnitude out of a comparison row's own
 *  changeLabel ("+41% (better)" / "−9% (worse)") — our generated
 *  format, so this is deterministic, not heuristic. Returns 0 when no
 *  percentage is present ("change not expressible as a %"). */
function changeMagnitude(changeLabel: string): number {
  const match = changeLabel.match(/(\d+)%/);
  return match ? Number(match[1]) : 0;
}

export function selectSpotlights(source: SpotlightSource): Spotlight[] {
  const { kpiLabel, adsJudged, winners, loserRows, comparison } = source;
  const judgedPhrase = `${adsJudged} ad${adsJudged === 1 ? "" : "s"}`;

  const spotlights: Spotlight[] = [];

  const top = winners[0];
  if (top) {
    spotlights.push({
      role: "top",
      roles: ["top"],
      adName: top.name,
      assetKey: normalizeAdName(top.name),
      valueLabel: top.valueLabel,
      vsMedianLabel: top.vsMedianLabel,
      spendLabel: top.spendLabel,
      takeaway: {
        buyer: `Best ${kpiLabel} of the ${judgedPhrase} judged this period.`,
        client: `The strongest ${kpiLabel} result of the ${judgedPhrase} with enough spend for a fair read.`,
      },
    });
  }

  const worst = loserRows[0];
  if (worst) {
    spotlights.push({
      role: "worst",
      roles: ["worst"],
      adName: worst.name,
      assetKey: normalizeAdName(worst.name),
      valueLabel: worst.valueLabel,
      vsMedianLabel: worst.vsMedianLabel,
      spendLabel: worst.spendLabel,
      takeaway: {
        buyer: `Weakest ${kpiLabel} of the ${judgedPhrase} judged this period.`,
        client: `The weakest ${kpiLabel} result of the ${judgedPhrase} with enough spend for a fair read.`,
      },
    });
  }

  if (comparison) {
    /* Biggest mover = the larger movement of the two lists' leading
       rows (each list is already sorted by |Δ%| descending in
       compare.ts). Ties go to the improvement — the report leads with
       what worked throughout. */
    const bestImproved = comparison.improved[0];
    const bestDeclined = comparison.declined[0];
    const mover =
      bestImproved && bestDeclined
        ? changeMagnitude(bestDeclined.changeLabel) >
          changeMagnitude(bestImproved.changeLabel)
          ? bestDeclined
          : bestImproved
        : bestImproved ?? bestDeclined;
    if (mover) {
      spotlights.push({
        role: "mover",
        roles: ["mover"],
        adName: mover.name,
        assetKey: normalizeAdName(mover.name),
        valueLabel: mover.currentLabel,
        vsMedianLabel: `${mover.previousLabel} → ${mover.currentLabel}`,
        spendLabel: mover.spendChangeLabel,
        changeLabel: mover.changeLabel,
        takeaway: {
          buyer: `Largest ${kpiLabel} movement vs the previous period among matched ads: ${mover.changeLabel}.`,
          client: `The biggest change vs last period among the ads present in both: ${mover.changeLabel}.`,
        },
      });
    }
  }

  /* Dedupe by identity: same ad in multiple roles → ONE card carrying
     every earned role label, keeping the earliest (strongest) role's
     card content and position. Never the same creative twice. */
  const byKey = new Map<string, Spotlight>();
  const deduped: Spotlight[] = [];
  for (const spotlight of spotlights) {
    const existing = byKey.get(spotlight.assetKey);
    if (existing) {
      existing.roles.push(spotlight.role);
      /* A merged mover contributes its movement context to the card
         that absorbed it — the fact is worth keeping visible. */
      if (spotlight.role === "mover" && spotlight.changeLabel) {
        existing.changeLabel = spotlight.changeLabel;
      }
    } else {
      byKey.set(spotlight.assetKey, spotlight);
      deduped.push(spotlight);
    }
  }
  return deduped;
}
