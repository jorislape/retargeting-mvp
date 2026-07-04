/**
 * Domain types for the CSV → memo flow. Nothing here is persisted —
 * these types exist only for the lifetime of a single request.
 */

export type KpiKey = "roas" | "cpa" | "ctr" | "cpc" | "leads" | "purchases";

export const KPI_LABELS: Record<KpiKey, string> = {
  roas: "ROAS",
  cpa: "CPA",
  ctr: "CTR",
  cpc: "CPC",
  leads: "Leads",
  purchases: "Purchases",
};

/** Plain-language explainers for the client-facing report view and
 *  abbreviation helper text. One sentence, no jargon. */
export const KPI_EXPLAINERS: Record<KpiKey, string> = {
  roas: "Return on ad spend — revenue earned for every $1 spent on ads",
  cpa: "Cost per acquisition — what one purchase or lead costs in ad spend",
  ctr: "Click-through rate — the share of people who saw an ad and clicked",
  cpc: "Cost per click — what one click on an ad costs",
  leads: "Leads — the number of sign-ups or enquiries an ad generated",
  purchases: "Purchases — the number of sales an ad generated",
};

/** Higher is better for these; lower is better for the rest. */
export const HIGHER_IS_BETTER: Record<KpiKey, boolean> = {
  roas: true,
  ctr: true,
  leads: true,
  purchases: true,
  cpa: false,
  cpc: false,
};

/** Context the user fills in alongside the CSV — never stored. */
export interface DebriefContext {
  kpi: KpiKey;
  product: string;
  offer: string;
  goal: string;
  targetCpa: number | null;
  creativeNotes: string;
  /** Optional pasted market/competitor notes (V1: manual input only).
   *  Directional context for the memo — never a performance claim. */
  marketContext: string;
}

/** One ad row after column resolution and metric derivation. */
export interface ParsedAd {
  name: string;
  spend: number;
  /** The value for the selected KPI, in that KPI's own units. */
  kpiValue: number | null;
  /** Best-effort lowercase keyword tags pulled from the ad name, used
   *  only for structural pattern hints — never presented as certainty. */
  nameTags: string[];
}

export type GateReason = "judged" | "below_spend_gate" | "no_kpi_value";

export interface GatedAd extends ParsedAd {
  gate: GateReason;
}

export interface RankedAd extends GatedAd {
  /** Signed distance from the median in the "better" direction. */
  deltaFromMedian: number;
  /** deltaFromMedian as a % of the median, when the median is non-zero. */
  deltaPct: number | null;
}

export interface AnalysisResult {
  kpi: KpiKey;
  adsAnalyzed: number;
  adsJudged: number;
  adsSetAside: number;
  totalSpend: number;
  currency: string | null;
  dateRange: { start: string; end: string } | null;
  spendGate: number;
  spendGateBasis: "target_cpa" | "floor_or_mean";
  median: number | null;
  winners: RankedAd[];
  losers: RankedAd[];
  belowBenchmarkSpend: number;
  belowBenchmarkCount: number;
  hasNameSignal: boolean;
  hasCreativeNotes: boolean;
  missingColumns: string[];
}

export interface MemoScope {
  product: string;
  kpiLabel: string;
  /** Plain-language expansion of the KPI abbreviation (client view). */
  kpiExplainer: string;
  dateRangeLabel: string | null;
  adsAnalyzed: number;
  adsJudged: number;
  adsSetAside: number;
  totalSpendLabel: string;
  medianLabel: string;
}

export interface MemoWinnerLoserRow {
  name: string;
  valueLabel: string;
  vsMedianLabel: string;
  spendLabel: string;
  reason: string;
}

export interface MemoTest {
  test: string;
  why: string;
  setup: string;
  winningLooksLike: string;
  /** 2–4 compact bullets naming the signals behind the recommendation
   *  (own-data first, market context directional, guardrails last).
   *  Never invented — only signals the data actually shows. Rendered
   *  as "Signals used" (buyer) / "Why this test" (client). */
  signals: string[];
}

/** Summary of user-pasted market/competitor context. Directional by
 *  definition: bullets restate what the USER observed, they never
 *  assert competitor spend or performance. Null when no context was
 *  provided — the memo is then byte-identical to a run without the
 *  feature. */
export interface MemoMarketSignal {
  bullets: string[];
  caveat: string;
  /** Deterministic quality read on the pasted notes (category count). */
  quality: {
    level: "strong" | "good" | "weak";
    summary: string;
  };
}

export interface Memo {
  scope: MemoScope;
  tldr: string[];
  /** Plain-language verdict for the client-facing view — same facts as
   *  tldr, none of the buyer shorthand. */
  clientSummary: string[];
  winners: MemoWinnerLoserRow[];
  losers: {
    rows: MemoWinnerLoserRow[];
    killInstruction: string;
    /** Softened phrasing of killInstruction for the client view —
     *  "reduce/pause", never "kill". */
    clientInstruction: string;
    belowBenchmarkSpendLabel: string;
    setAsideNote: string;
  };
  patterns: {
    winners: string[];
    losers: string[];
  };
  /** Present only when the user pasted market/competitor context. */
  marketSignal: MemoMarketSignal | null;
  nextTests: MemoTest[];
  /** "What not to do" — anti-recommendations derived from the same
   *  deterministic data as the tests. Two registers, like the rest of
   *  the memo: buyer keeps the shorthand, client stays jargon-free.
   *  Empty arrays mean the section simply doesn't render. */
  avoid: {
    buyer: string[];
    client: string[];
  };
  confidence: {
    level: "high" | "medium" | "low";
    notes: string[];
    /** Why the level is what it is — buyer register, bullet-ready. */
    reasons: string[];
    /** The same explanation as one plain-language sentence. */
    clientWhy: string;
  };
}
