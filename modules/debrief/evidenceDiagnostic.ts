// Explicit ".ts" extension, same load-bearing reason as decision.ts,
// compare.ts, and briefReadiness.ts: types.ts imports nothing, so this
// file's whole dependency chain resolves under plain Node's
// type-stripping test runner (scripts/evidenceDiagnostic.test.ts).
import { MIN_OUTCOMES_FOR_SUPPORTED } from "./decision.ts";
import { outcomeNounsForKpi } from "./types.ts";
import type {
  AnalysisResult,
  EvidenceDiagnosticFinding,
  EvidenceDiagnosticRungId,
  KpiKey,
  MemoEvidenceDiagnostic,
  RankedAd,
} from "./types.ts";
import type { MoneyFormatter } from "./decision.ts";

/**
 * Evidence Diagnostic V1.
 *
 * A THIRD question, distinct from evidenceState (whole-dataset decision
 * readiness, decision.ts) and Brief Readiness (per-test brief-worthiness,
 * briefReadiness.ts): "the primary KPI's own outcome evidence on THIS ad
 * is too thin to trust — what upstream funnel signal, already in this
 * export, is worth inspecting next?"
 *
 * Isolation contract (test-enforced, mirrors briefReadiness.ts/
 * compare.ts): decision.ts must NEVER import this file. This file MAY
 * read decision.ts's exported constants/types one-directionally
 * (MIN_OUTCOMES_FOR_SUPPORTED, MoneyFormatter — reused rather than
 * duplicated), but nothing here ever feeds back into the committed
 * decision, evidenceState, confidence.level, or Brief Readiness.
 *
 * Bounded scope (deliberate, not a placeholder): exactly ONE ad per
 * report — analysis.winners[0], the same ad T1 anchors. The worst loser
 * is NOT diagnosed in V1: a losing ad's own thin conversion count is
 * close to definitional (that's often why it lost), so the identical
 * trigger would fire on nearly every loser — noise, not signal. Winner-
 * only keeps this thread anchored to the exact same ad evidenceState's
 * own noise-floor cap and Brief Readiness's winner side already use.
 *
 * No materiality cutoff. The ladder walk stops at the FIRST rung with
 * both a valid value for this ad and a valid account-relative median
 * from OTHER comparable judged ads — whatever that delta is (1% or
 * 80%), it is reported as-is. Never classified good/bad/strong/weak/
 * unusual, never polarity-corrected into "better/worse" — a raw
 * magnitude/direction fact ("18% above this account's median"), framed
 * as something worth inspecting, never as evidence the ad is failing
 * or succeeding.
 */

/** Median of a list of finite numbers — same simple algorithm as
 *  analysis.ts's own median() (not exported there, so duplicated here
 *  rather than creating a cross-import decision.ts/analysis.ts doesn't
 *  otherwise have). */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface RungDef {
  id: EvidenceDiagnosticRungId;
  label: string;
  /** This ad's own value for the rung, or null when not computable
   *  (column absent, cell unparseable, or a divide-by-zero case like 0
   *  add-to-carts). null is never treated as 0 — it means "skip this
   *  rung for this ad", not "this ad measured zero". */
  valueFor: (ad: RankedAd) => number | null;
  /** How the value is displayed — money for cost-based rungs, a plain
   *  percentage for CTR. */
  format: (value: number, money: MoneyFormatter) => string;
}

function costPerEvent(ad: RankedAd, count: number | null | undefined): number | null {
  if (count == null || count <= 0 || ad.spend <= 0) return null;
  return ad.spend / count;
}

function ctrValue(ad: RankedAd): number | null {
  if (ad.impressions == null || ad.impressions <= 0 || ad.linkClicks == null) return null;
  return (ad.linkClicks / ad.impressions) * 100;
}

const RUNGS: Record<"ecommerce" | "leads", RungDef[]> = {
  ecommerce: [
    {
      id: "add_to_cart",
      label: "Add-to-cart cost",
      valueFor: (ad) => costPerEvent(ad, ad.addToCart),
      format: (v, money) => money(v),
    },
    {
      id: "content_view",
      label: "Content-view cost",
      valueFor: (ad) => costPerEvent(ad, ad.contentViews),
      format: (v, money) => money(v),
    },
    {
      id: "ctr",
      label: "CTR",
      valueFor: ctrValue,
      format: (v) => `${v.toFixed(2)}%`,
    },
    {
      id: "cpm",
      label: "CPM",
      valueFor: (ad) => (ad.cpm != null ? ad.cpm : null),
      format: (v, money) => money(v),
    },
  ],
  leads: [
    {
      id: "ctr",
      label: "CTR",
      valueFor: ctrValue,
      format: (v) => `${v.toFixed(2)}%`,
    },
    {
      id: "cpm",
      label: "CPM",
      valueFor: (ad) => (ad.cpm != null ? ad.cpm : null),
      format: (v, money) => money(v),
    },
  ],
};

/** Ladder shape by KPI (contract §4): ecommerce (purchases/roas/cpa)
 *  gets the full 4-rung ladder; leads gets the shorter 2-rung ladder
 *  (no add-to-cart/content-view concept exists for a lead objective in
 *  Meta's own event taxonomy — forcing the ecommerce shape onto it
 *  would be dishonest); ctr/cpc get no ladder at all — they are
 *  already Debrief's most upstream tracked metrics, with nothing
 *  further down to fall back to. */
function ladderFor(kpi: KpiKey): RungDef[] | null {
  if (kpi === "purchases" || kpi === "roas" || kpi === "cpa") return RUNGS.ecommerce;
  if (kpi === "leads") return RUNGS.leads;
  return null; // ctr, cpc
}

function fmtDelta(deltaPct: number): string {
  const rounded = Math.round(Math.abs(deltaPct));
  return `${rounded}% ${deltaPct >= 0 ? "above" : "below"} this account's median`;
}

function buildFinding(
  rung: RungDef,
  ad: RankedAd,
  comparablePool: RankedAd[],
  money: MoneyFormatter
): EvidenceDiagnosticFinding | null {
  const adValue = rung.valueFor(ad);
  if (adValue == null) return null;

  const comparableValues = comparablePool
    .map((other) => rung.valueFor(other))
    .filter((v): v is number => v != null);
  const medianValue = median(comparableValues);
  if (medianValue == null) return null;

  const deltaPct = medianValue !== 0 ? ((adValue - medianValue) / Math.abs(medianValue)) * 100 : null;
  const valueLabel = rung.format(adValue, money);
  const medianLabel = rung.format(medianValue, money);
  const deltaClause =
    deltaPct != null
      ? fmtDelta(deltaPct)
      : `this account's median is ${medianLabel}, so no percentage difference can be shown`;

  return {
    rungId: rung.id,
    label: rung.label,
    valueLabel,
    medianLabel,
    deltaPct,
    buyer: `${rung.label} for "${ad.name}" is ${valueLabel}, vs this account's ${medianLabel} median — ${deltaClause}. This is an upstream signal to inspect, not evidence that the ad is failing.`,
  };
}

/**
 * The activation trigger for a given ad's outcome evidence — "thin"
 * (a verified count under the shared noise floor), "unverifiable" (no
 * count column resolved — missing is never treated as zero), or null
 * (sufficient evidence, or the KPI has no outcome concept at all).
 * Reuses decision.ts's own disclosed noise floor rather than inventing
 * a second one, but is otherwise independent of decision.ts's
 * winners[0]-specific isOutcomeVolumeBelowFloor — this is a general,
 * per-ad check so it stays correct if ever pointed at a different ad.
 */
function outcomeTrigger(
  ad: RankedAd,
  kpi: KpiKey
): "thin_volume" | "unverifiable_volume" | null {
  if (outcomeNounsForKpi(kpi) == null) return null;
  if (ad.conversions == null) return "unverifiable_volume";
  if (ad.conversions < MIN_OUTCOMES_FOR_SUPPORTED) return "thin_volume";
  return null;
}

/**
 * Bounded to analysis.winners[0]. Returns null when there is no top
 * winner, the KPI has no outcome concept (ctr/cpc), or the winner's own
 * outcome evidence is already sufficient — a diagnostic with nothing to
 * add is not generated, never rendered empty.
 */
export function deriveEvidenceDiagnostic(
  analysis: AnalysisResult,
  money: MoneyFormatter
): MemoEvidenceDiagnostic | null {
  const top: RankedAd | null = analysis.winners[0] ?? null;
  if (top == null) return null;

  const trigger = outcomeTrigger(top, analysis.kpi);
  if (trigger == null) return null;

  const ladder = ladderFor(analysis.kpi);
  if (ladder == null) return null; // ctr/cpc — no fallback within this model

  const comparablePool = analysis.rankedAds.filter((ad) => ad !== top);

  let finding: EvidenceDiagnosticFinding | null = null;
  for (const rung of ladder) {
    finding = buildFinding(rung, top, comparablePool, money);
    if (finding != null) break;
  }

  /* Provenance Coherence V1: the thin_volume branch now names the
     floor number and attributes it, mirroring the exact "minimal
     noise floor ... Debrief default, not a universal threshold" idiom
     decision.ts's own limits copy and briefReadiness.ts's buyer copy
     already use for this identical constant — so a reader who sees
     the diagnostic in isolation (its own card, own TXT line) doesn't
     have to cross-reference the decision card to learn "too few" is
     Debrief's own minimal bar, not a practitioner or industry number.
     unverifiable_volume is untouched: that branch is about a missing
     column, not a threshold, so no floor applies to attribute. */
  const triggerClause =
    trigger === "thin_volume"
      ? `"${top.name}" has ${top.conversions} recorded ${outcomeNounsForKpi(analysis.kpi)!.many} — under this read's minimal ${MIN_OUTCOMES_FOR_SUPPORTED}-${outcomeNounsForKpi(analysis.kpi)!.one} noise floor (Debrief default, not a universal threshold), too few to trust this KPI reading on its own.`
      : `This export has no verifiable ${outcomeNounsForKpi(analysis.kpi)!.one} count for "${top.name}", so this KPI reading can't be fully verified.`;

  const buyer =
    finding != null
      ? `${triggerClause} ${finding.buyer}`
      : `${triggerClause} Debrief could not evaluate upstream evidence for "${top.name}" from the available export.`;

  return {
    trigger,
    finding,
    noComparableEvidence: finding == null,
    buyer,
  };
}
