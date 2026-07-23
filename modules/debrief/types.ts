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

/* ------------------------------------------------------------------ */
/* Creative Format Confirmation V1: the user can confirm each ad's     */
/* creative format before generating, replacing the ad-name GUESS with */
/* user-provided context. Confirmations feed pattern detection, test   */
/* wording, and briefs ONLY — never spend, KPI values, the gate, the   */
/* median, or winner/loser ranking. A confirmed format is still just   */
/* user context, not proof of why an ad performed. No asset uploads,   */
/* no vision, no fetching — the user simply tells us what they already */
/* know about their own creative.                                      */
/* ------------------------------------------------------------------ */

/** The confirmable formats. `tag` values line up with the tag
 *  vocabulary the memo's pattern/test/brief code keys off (name-derived
 *  tags use the same strings where they overlap). */
export const CREATIVE_FORMAT_OPTIONS: { tag: string; label: string }[] = [
  { tag: "ugc", label: "UGC" },
  { tag: "testimonial", label: "Testimonial" },
  { tag: "founder-led", label: "Founder-led" },
  { tag: "static", label: "Static" },
  { tag: "product shot", label: "Product shot" },
  { tag: "video", label: "Video" },
  { tag: "carousel", label: "Carousel" },
  { tag: "before/after", label: "Before/after" },
  { tag: "discount/promo", label: "Discount / promo" },
  { tag: "comparison", label: "Comparison" },
];

/** Display label for a format tag (confirmed or name-derived). */
export const CREATIVE_FORMAT_LABELS: Record<string, string> =
  Object.fromEntries(CREATIVE_FORMAT_OPTIONS.map((o) => [o.tag, o.label]));

/** Ad name → confirmed format tag. Sent as an optional JSON field with
 *  the debrief request; lives only for that request, like the CSV. */
export type CreativeFormatOverrides = Record<string, string>;

/** Structured, user-actionable error returned by /api/debrief. Every
 *  failure reads as a product guide (what happened, how to fix it),
 *  never a stack trace. `detectedColumns` are the CSV's own headers —
 *  structural facts only, never row data. */
export interface DebriefApiError {
  title: string;
  message: string;
  fix: string;
  /** Headers found in the uploaded CSV, when column resolution ran. */
  detectedColumns?: string[];
  /** KPIs whose columns WERE detected — offered as switch suggestions
   *  when the selected KPI's column is missing. */
  suggestedKpis?: KpiKey[];
}

/** Optional self-reported test-quality answers (Evidence Inputs V1).
 *  Every field is optional and defaults to *unanswered* — an unanswered
 *  set is a complete no-op (output byte-identical to before the
 *  feature). These NEVER change ranking, median, spend gate, action, or
 *  evidenceState — they only append explanatory lines to the memo's
 *  evidence limits. See modules/debrief/decision.ts (buildLimits). */
export interface TestQualityContext {
  /** Was this a controlled test? "yes" suppresses the uncontrolled-test
   *  caveat but adds NO positive claim; "no"/"unsure" append a caveat;
   *  undefined = unanswered = no line. Never strengthens evidence. */
  controlledTest?: "yes" | "no" | "unsure";
  /** true = the user reported tracking changed mid-period → one
   *  comparability caveat. undefined/false = no line. */
  trackingChanged?: boolean;
  /** true = the user reported the offer, landing page, audience, or
   *  budget changed mid-period → one caveat. undefined/false = no line. */
  setupChanged?: boolean;
}

/** Optional structured framing of the account's current objective
 *  (Input Honesty V1). An ENUM ONLY — never derived from free text.
 *  It never changes numeric analysis, ranking, spend gate, action, or
 *  evidenceState; it may only frame report wording and append
 *  deterministic objective/KPI mismatch caveats to the evidence limits
 *  (see modules/debrief/decision.ts). Absent, or any value outside this
 *  set (including from the API), is a complete no-op. */
export type Objective = "efficiency" | "growth" | "learning";

/** The full set of optional, non-numeric inputs that MAY affect
 *  decision.ts's evidence limits/framing — and NOTHING else. Combines
 *  TestQualityContext (Evidence Inputs V1) with Objective (Input
 *  Honesty V1) into one clearly-scoped "framing-only" argument type. */
export interface DecisionInputContext extends TestQualityContext {
  objective?: Objective;
}

/** Context the user fills in alongside the CSV — never stored. */
export interface DebriefContext extends DecisionInputContext {
  kpi: KpiKey;
  /** Report-identification and framing context only (interpolated into
   *  headings and test/brief copy) — never analyzed, never affects
   *  scoring, ranking, action, or evidenceState. Required only so the
   *  report has a label; any text, including nonsense, is accepted
   *  verbatim. */
  product: string;
  /** Appears in tests and briefs as report context (e.g. "keep the
   *  offer, change the hook") — never interpreted, never affects
   *  scoring. Optional; empty uses a neutral fallback ("the current
   *  offer"). */
  offer: string;
  targetCpa: number | null;
  /** Copied into the report and creative briefs as the user's own
   *  guardrails, and quoted verbatim in one row-reason line — never
   *  interpreted, and its mere presence no longer affects confidence
   *  (Input Honesty V1). Arbitrary text, including nonsense, is
   *  accepted and reproduced as-is, never analyzed for meaning. */
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
   *  only for structural pattern hints — never presented as certainty.
   *  When the user confirms a format, this holds exactly that one tag
   *  and `formatConfirmed` is set. */
  nameTags: string[];
  /** True when the user confirmed this ad's format in the generator —
   *  the memo then says "Format confirmed as …" instead of "Ad name
   *  suggests …". Still user context, never proof of causation. */
  formatConfirmed?: boolean;
  /** Raw conversion count behind a purchase-based KPI (purchases for
   *  roas/cpa/purchases, leads for leads) when a count column is present
   *  in the CSV. null when the KPI isn't purchase-based (ctr/cpc) or no
   *  count column resolved. NEVER estimated, and never read by the spend
   *  gate, median, ranking, or any KPI value — display only. */
  conversions?: number | null;
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
  /** Spend across judged ads only (totalSpend minus set-aside spend).
   *  Added for Decision-First V1: cut-eligibility and concentration
   *  shares are computed against spend that actually earned a verdict,
   *  never against spend the gate excluded. */
  judgedSpend: number;
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
  /** Evidence Inputs V1: neutral conversion count for this ad
   *  ("34 purchases" / "12 leads"), present only for purchase-based
   *  KPIs when the CSV carried a count column. Display only — never a
   *  quality judgment, never estimated. Absent otherwise. */
  conversionLabel?: string;
}

/** A hand-off-ready creative brief for one next test. Generated
 *  deterministically alongside the test from the same facts — the UI
 *  only reveals it when the user selects the test and asks for briefs.
 *  Hooks and directions are structural (what to show/open with), never
 *  invented product claims, quotes, discounts, or competitor facts. */
export interface MemoBrief {
  title: string;
  objective: string;
  /** The test's own signal bullets — real data, not restated fluff. */
  basedOn: string[];
  concept: string;
  /** 3 hook directions tied to this test (market-flavored only when
   *  notes were provided). */
  hooks: string[];
  /** 4–6 bullets of shot / asset direction for the test's format. */
  assetDirection: string[];
  keepConstant: string;
  change: string;
  successMetric: string;
  guardrails: string[];
  /** Where this brief's grounding comes from (own data vs. market). */
  basisNote: string;
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
  brief: MemoBrief;
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

/* ------------------------------------------------------------------ */
/* Decision-First V1: the "Next move" card                             */
/* ------------------------------------------------------------------ */

/** The single committed call at the top of the report. Three actions,
 *  not five — budget movement is ONE decision with copy variants
 *  (shift/scale/cut), not separate action types. Always present:
 *  weak evidence yields an explicit `hold`, never a forced call.
 *
 *  Honesty contract (same as the rest of the memo): every number in
 *  the copy traces to an AnalysisResult value; metrics-only claims —
 *  the card never infers creative angles; the buyer and client
 *  registers always describe the SAME recommendation; `reassess`
 *  always contains a numeric trigger. */
export interface MemoDecision {
  action: "budget" | "test" | "hold";
  /** Present only when action is "hold". */
  holdReason?: "insufficient_data" | "flat_performance";
  headline: string;
  /** Jargon-free counterpart — no "kill/gate/benchmark/median/judged". */
  clientHeadline: string;
  rationale: string;
  clientRationale: string;
  /** Max 2 items per register. Includes the concentration guardrail
   *  line (copy-only — it never changes the action) when the top
   *  winner already holds ≥ CONCENTRATION_GUARDRAIL_PCT of judged
   *  spend under a scale/shift recommendation. */
  avoidNow: { buyer: string[]; client: string[] };
  /** One sentence per register; always ends in a numeric trigger. */
  reassess: { buyer: string; client: string };

  /* ---------------------------------------------------------------- */
  /* Evidence-Explicit Decision V1 (additive). Evidence strength and    */
  /* its limits are a SEPARATE dimension from `action`: a controlled     */
  /* test can be supported, a budget move can be limited, and a hold can */
  /* be supported when the field is clearly flat. All four fields below  */
  /* derive ONLY from AnalysisResult facts, never from `action`.         */
  /* See modules/debrief/decision.ts.                                    */
  /* ---------------------------------------------------------------- */
  /** How strongly THIS uploaded dataset supports its own conclusion —
   *  "supported by the currently available campaign dataset", never
   *  causally proven, externally validated, or a fair experiment. */
  evidenceState: "insufficient" | "limited" | "supported";
  /** The shape of the evidence, independent of the action: a materially
   *  separated field vs a clearly flat one. Set whenever a median exists
   *  (i.e. the field could be evaluated); undefined when it can't. */
  evidenceShape?: "separation" | "flatness";
  /** What this read cannot establish: one permanent dataset-only caveat
   *  (no causation, no future-performance guarantee, no control for
   *  unobserved differences) plus conditional lines from already-tracked
   *  facts. Two registers, like the rest of the memo. */
  limits: { buyer: string[]; client: string[] };
  /** The single controlled next test surfaced on the card: what to hold
   *  constant, the one variable to change, and which metric to watch.
   *  Sourced from the first next test; the numeric reassessment trigger
   *  stays separate (`reassess`). Absent when no next test exists. */
  nextControlledTest?: { preserve: string; change: string; watch: string };
}

export interface Memo {
  scope: MemoScope;
  /** Decision-First V1: the committed "Next move" — purely additive;
   *  no other memo field changed when this shipped. */
  decision: MemoDecision;
  tldr: string[];
  /** Plain-language verdict for the client-facing view — same facts as
   *  tldr, none of the buyer shorthand. */
  clientSummary: string[];
  winners: MemoWinnerLoserRow[];
  /** Evidence Inputs V1: a neutral, one-line statement of the conversion
   *  count behind the leading ad — or an explicit "not in this export"
   *  line when the count is unavailable. Two registers. null when there
   *  is no leading ad (no winner) or the KPI isn't purchase-based
   *  (ctr/cpc). Purely factual visibility — never a quality judgment,
   *  never estimated, never changes the action or evidenceState. */
  leadingConversion: { buyer: string; client: string } | null;
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
