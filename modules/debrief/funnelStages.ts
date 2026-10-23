/**
 * Real-account fix 4 — Mixed Funnel Stages. A decision-blind module
 * (same isolation pattern as segmentSpread.ts): an agency export mixed
 * TOFU (prospecting) and BOFU (retargeting) ads in one ranking, where
 * one account-wide median compares cold traffic with warm. The mixed-
 * segment warning couldn't see it — that export had no ad set or
 * campaign column, and the stage lived only in the ad names.
 *
 * Display-only by construction: it re-reads the already-ranked judged
 * ads and returns facts for ONE limits line. It never touches the spend
 * gate, the median, ranking, the committed action or evidenceState.
 */
import type { RankedAd } from "./types";

export type FunnelStage = "TOFU" | "MOFU" | "BOFU";

/** A bare stage token: TOFU/MOFU/BOFU as its own word once the usual
 *  name separators ([KEY] brackets, _ - . /) are spaces — so
 *  "[STG]TOFU_…" and "Spring_LT_BOFU" match, "TOFUTTI" doesn't. */
const STAGE_TOKEN = /(?:^|[^A-Za-z0-9])(TOFU|MOFU|BOFU)(?![A-Za-z0-9])/gi;

/** The one stage a label names, or null when it names none or several. */
export function stageFromLabel(label: string | null | undefined): FunnelStage | null {
  if (!label) return null;
  const found = new Set([...label.matchAll(STAGE_TOKEN)].map((m) => m[1].toUpperCase() as FunnelStage));
  return found.size === 1 ? [...found][0] : null;
}

/** An ad's stage: its own name first (the most specific label), then
 *  its campaign, then its ad set. */
export function stageForAd(ad: Pick<RankedAd, "name" | "campaignName" | "adSetName">): FunnelStage | null {
  return stageFromLabel(ad.name) ?? stageFromLabel(ad.campaignName) ?? stageFromLabel(ad.adSetName);
}

export interface FunnelMix {
  /** One entry per stage among the judged ads, in funnel order. */
  stages: { stage: FunnelStage; judged: number; median: number | null }[];
  /** Judged ads whose stage couldn't be read. */
  unknown: number;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** null unless the judged ads span MORE THAN ONE stage. Each stage's
 *  median is over its judged ads with a KPI value (zero-outcome ads
 *  stay out, exactly as in the account median). */
export function detectFunnelMix(ranked: readonly RankedAd[]): FunnelMix | null {
  const byStage = new Map<FunnelStage, RankedAd[]>();
  let unknown = 0;
  for (const ad of ranked) {
    const stage = stageForAd(ad);
    if (stage == null) unknown += 1;
    else byStage.set(stage, [...(byStage.get(stage) ?? []), ad]);
  }
  if (byStage.size < 2) return null;
  const order: FunnelStage[] = ["TOFU", "MOFU", "BOFU"];
  return {
    stages: order
      .filter((s) => byStage.has(s))
      .map((stage) => {
        const ads = byStage.get(stage)!;
        return {
          stage,
          judged: ads.length,
          median: median(ads.filter((a) => a.kpiValue != null && !a.zeroConversions).map((a) => a.kpiValue as number)),
        };
      }),
    unknown,
  };
}
