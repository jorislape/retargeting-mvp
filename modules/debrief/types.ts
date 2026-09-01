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

/** The outcome-count noun behind a KPI: purchases for roas/cpa/
 *  purchases, leads for leads, none for ctr/cpc (their reliability axis
 *  is clicks, not conversions). The single source of truth for this
 *  mapping — memo.ts (conversion display) and decision.ts (the
 *  user-set scaling minimum, Decision Criteria V2) both read it, so
 *  the two can never disagree about which count a KPI carries. */
export function outcomeNounsForKpi(
  kpi: KpiKey
): { one: string; many: string } | null {
  if (kpi === "leads") return { one: "lead", many: "leads" };
  if (kpi === "roas" || kpi === "cpa" || kpi === "purchases") {
    return { one: "purchase", many: "purchases" };
  }
  return null; // ctr, cpc
}

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

/* ------------------------------------------------------------------ */
/* Decision Criteria V2: the user's OWN decision bars. Deliberately     */
/* NOT part of DecisionInputContext — that type's contract is "framing  */
/* copy only, never the action," while these two inputs genuinely       */
/* participate in the evidence bar and the scaling decision. Both are   */
/* optional; both null is a complete no-op (Debrief defaults apply and  */
/* the output is unchanged except for the always-present provenance     */
/* list). This is NOT a rules-builder: exactly these two criteria, no   */
/* configurable percentages, no custom formulas.                        */
/* ------------------------------------------------------------------ */

export interface DecisionCriteria {
  /** Minimum count of the selected KPI's OWN outcome (purchases for
   *  ROAS/CPA/Purchases, leads for Leads — see outcomeNounsForKpi)
   *  that the leading ad must have recorded before a scale/shift
   *  budget move is recommended. Applied ONLY when that count can
   *  actually be verified in the export: if the count column is
   *  absent the criterion is NOT silently enforced — an explicit
   *  "couldn't be checked" limits line appears instead. Never
   *  applicable to CTR/CPC (no outcome count exists); never a
   *  purchase-only "conversions" generalization. */
  minOutcomeCount?: number | null;
  /** Evidence Sufficiency V1 — Brief Readiness (winner side): minimum
   *  outcome count on the LEADING ad before its observed win is treated
   *  as established enough to brief creative against. Deliberately a
   *  SEPARATE field from minOutcomeCount above (which gates the
   *  scale/shift BUDGET action and has no default — null there means
   *  "no gate at all"). This field always has an effective bar: unset
   *  falls back to Debrief's own disclosed, practitioner-informed
   *  default (BRIEF_READY_MIN_OUTCOMES in briefReadiness.ts), never a
   *  silent no-op. See modules/debrief/briefReadiness.ts. */
  minBriefOutcomeCount?: number | null;
  /** Evidence Sufficiency V1 — Brief Readiness (loser side): minimum
   *  multiple of the ad's cost target (or, when no target CPA is given,
   *  a disclosed proxy — this account's own evidence gate) the ad must
   *  have spent before its underperformance is treated as confident
   *  rather than possibly under-tested. Also always has an effective
   *  bar when unset (Debrief's own disclosed default). See
   *  modules/debrief/briefReadiness.ts. */
  minLossSpendMultiple?: number | null;
}

/** One decision bar that participated in this memo's call, with its
 *  provenance — Debrief's default or the user's own criterion. Always
 *  built, so every report can show WHOSE bars decided (universal
 *  thresholds are never presented as universal truth). */
export interface AppliedCriterion {
  label: string;
  source: "debrief_default" | "user";
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
  /** Define/Context Foundation V1 — the ROAS analog to targetCpa.
   *  Display + success-criterion wording only (kpi === "roas" branch of
   *  buildNextTests' successMetric) — deliberately NEVER feeds the
   *  spend gate (unlike targetCpa's 3× rule): converting a ROAS target
   *  into an implied spend/cost figure would require price/AOV data
   *  this app never collects, so that formula would not be honest.
   *  null = not supplied. */
  targetRoas: number | null;
  /** Copied into the report and creative briefs as the user's own
   *  guardrails, and quoted verbatim in one row-reason line — never
   *  interpreted, and its mere presence no longer affects confidence
   *  (Input Honesty V1). Arbitrary text, including nonsense, is
   *  accepted and reproduced as-is, never analyzed for meaning. */
  creativeNotes: string;
  /** Optional pasted market/competitor notes (V1: manual input only).
   *  Directional context for the memo — never a performance claim. */
  marketContext: string;
  /** Decision Criteria V2 — user's custom evidence gate: spend per ad
   *  (in the account currency) an ad must reach before it's judged.
   *  Replaces the default gate computation when set (spendGateBasis
   *  "user_gate"); null = Debrief's default rules. */
  spendGateOverride: number | null;
  /** Decision Criteria V2 — see DecisionCriteria.minOutcomeCount.
   *  null = no user minimum. */
  minOutcomeCount: number | null;
  /** Evidence Sufficiency V1 — see DecisionCriteria.minBriefOutcomeCount.
   *  null = Debrief's disclosed default applies. */
  minBriefOutcomeCount: number | null;
  /** Evidence Sufficiency V1 — see DecisionCriteria.minLossSpendMultiple.
   *  null = Debrief's disclosed default applies. */
  minLossSpendMultiple: number | null;
}

/** One ad row after column resolution and metric derivation. */
export interface ParsedAd {
  /** Display identity. Normally the raw ad-name cell; when the SAME
   *  normalized name appears on multiple rows (Duplicate Identity fix),
   *  each row's name is disambiguated deterministically as
   *  "Name (row N)" — N being the spreadsheet row number — so no two
   *  ads in one report ever share a label. Rows stay separate ads;
   *  nothing is aggregated, and the export is never assumed to prove
   *  same-name rows are the same creative. */
  name: string;
  /** The raw ad-name cell when `name` was disambiguated (set ONLY for
   *  duplicate-named rows). Cross-period matching (compare.ts) and
   *  creative-format-override matching key on this, so row-position
   *  labels can never fabricate a cross-period or override match. */
  sourceName?: string;
  /** Meta's Ad ID, when the export included an "Ad ID" column — the
   *  reliable cross-period identifier for Period Comparison V2 (it
   *  survives renames; names don't). null when the column is absent or
   *  the cell is empty. Never synthesized. */
  id?: string | null;
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
  spendGateBasis: "target_cpa" | "floor_or_mean" | "user_gate";
  median: number | null;
  winners: RankedAd[];
  losers: RankedAd[];
  /** EVERY judged ad with its delta vs the median (winners ∪ losers ∪
   *  ads exactly at the median), not just the top-5 display slices.
   *  Added for Period Comparison V2, which needs the full judged field
   *  to match ads across periods. Empty when no median exists. */
  rankedAds: RankedAd[];
  belowBenchmarkSpend: number;
  belowBenchmarkCount: number;
  /** Spend Allocation V1 — mirrors belowBenchmarkSpend/Count exactly,
   *  summed over the full winnerPool (deltaFromMedian > 0), never just
   *  the display-truncated `winners` slice. */
  aboveBenchmarkSpend: number;
  aboveBenchmarkCount: number;
  /** Spend Allocation V1 — judged ads exactly at the median
   *  (deltaFromMedian === 0): neither a winner nor a loser under the
   *  existing strict >/< pools, but real judged spend that belongs
   *  nowhere else. Structurally guaranteed to be non-empty whenever
   *  adsJudged is odd (median() then returns one judged ad's own
   *  value). Summed over the full judged set, same discipline as
   *  above/belowBenchmarkSpend. */
  atBenchmarkSpend: number;
  atBenchmarkCount: number;
  hasNameSignal: boolean;
  hasCreativeNotes: boolean;
  missingColumns: string[];
  /** Duplicate Identity fix: the distinct RAW ad names that appear on
   *  more than one row of the export (empty on clean files). Rows are
   *  kept as separate ads with row-numbered labels; this list drives
   *  the honesty disclosure in the decision's limits. */
  duplicateAdNames: string[];
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
  /** Raw, polarity-corrected distance used only for presentation geometry.
   * Positive is better and negative is worse for every KPI. */
  deltaPct: number | null;
  spendLabel: string;
  reason: string;
  /** Evidence Inputs V1: neutral conversion count for this ad
   *  ("34 purchases" / "12 leads"), present only for purchase-based
   *  KPIs when the CSV carried a count column. Display only — never a
   *  quality judgment, never estimated. Absent otherwise. */
  conversionLabel?: string;
}

/* ------------------------------------------------------------------ */
/* Spend Allocation V1 — "where is judged spend sitting relative to the */
/* benchmark?" Complements Performance Ranking (which ads) rather than  */
/* repeating it (where the money is). Purely descriptive: never read by */
/* decision.ts, never independently determines the recommended action, */
/* and always reflects the FULL judged pool — independent of           */
/* customization.topAdsShown, which only slices what Performance        */
/* Ranking / Winners / Underperformers display.                         */
/* ------------------------------------------------------------------ */

/** One of the three judged-spend segments. Canonical order is always
 *  below -> at -> above (see components/debrief/spendAllocationMath.ts,
 *  which independently encodes the same order for the pure geometry
 *  layer — the two must stay in sync, but memo.ts cannot import from
 *  components/, so the order is intentionally duplicated rather than
 *  shared). Only segments with count > 0 are ever present; an empty
 *  group is omitted, never rendered as a fake zero-width segment. */
export interface MemoSpendAllocationSegment {
  id: "below" | "at" | "above";
  count: number;
  spend: number;
  spendLabel: string;
  /** Rounded for display only ("35%") — never the source of bar
   *  geometry, which SpendAllocationChart recomputes from spend and
   *  judgedSpend directly so a rounded label can never distort the
   *  true proportional width. */
  shareLabel: string;
}

/** Set-aside spend, disclosed separately from the 100%-of-judged-spend
 *  bar and denominated against TOTAL spend — never judged spend — so
 *  the two percentages can never be misread as sharing one base.
 *  Present only when at least one ad was set aside. */
export interface MemoSpendAllocationSetAside {
  count: number;
  spend: number;
  spendLabel: string;
  /** Rounded share of TOTAL spend, display only. */
  shareOfTotalLabel: string;
  note: { buyer: string; client: string };
}

/** Spend Allocation V1's memo-level fact sheet. null when there is no
 *  judged spend to show (judgedSpend <= 0) — the same "nothing to
 *  render" discipline PerformanceRankingChart already follows for an
 *  empty row set. */
export interface MemoSpendAllocation {
  judgedSpend: number;
  judgedSpendLabel: string;
  totalSpend: number;
  totalSpendLabel: string;
  /** Below -> at -> above, count > 0 only. */
  segments: MemoSpendAllocationSegment[];
  setAside: MemoSpendAllocationSetAside | null;
  headline: { buyer: string; client: string };
  caveat: { buyer: string; client: string };
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

/* ------------------------------------------------------------------ */
/* Evidence Sufficiency + Brief Readiness V1                           */
/*                                                                    */
/* A SEPARATE question from evidenceState (whole-dataset decision      */
/* readiness) and confidence.level (whole-dataset trust): "is THIS     */
/* specific observed win/loss strong enough to responsibly brief       */
/* creative against?" Computed per test in modules/debrief/            */
/* briefReadiness.ts — a dedicated, decision-blind module. Winner-side */
/* and loser-side use genuinely different rules (outcome COUNT vs      */
/* spend MULTIPLE — see that file). NEVER read by decision.ts, NEVER   */
/* changes evidenceState/confidence.level/the committed action —       */
/* isolation is test-enforced the same way compare.ts/decision.ts is.  */
/* ------------------------------------------------------------------ */

export type BriefReadinessState = "ready" | "directional" | "insufficient";

/** Per-test evidence-sufficiency read. Two registers, like the rest of
 *  the memo; `criterion` always states whose bar decided (Debrief's
 *  disclosed default or the user's own), mirroring AppliedCriterion —
 *  universal thresholds are never presented as universal truth here
 *  either. */
export interface MemoBriefReadiness {
  state: BriefReadinessState;
  buyer: string;
  client: string;
  criterion: AppliedCriterion;
  /** Buyer-only mechanical caveat for a "ready" loser-side read whose
   *  bar was cleared automatically by construction (this account's
   *  spend gate is already 3×target CPA), not by spend genuinely
   *  above the loss-confidence bar. Set ONLY on that one path — every
   *  other "ready" read has nothing mechanical to disclose, so this
   *  stays undefined and the terse state badge is the whole story.
   *  Never rendered in client view (mechanical gate/spend-multiple
   *  reasoning is buyer vocabulary). */
  disclosureNote?: string;
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
  /** Evidence Sufficiency V1 — the missing link in the traceability
   *  chain (Observed signal -> Hypothesis -> Variable changed ->
   *  Controls -> Success criterion). basedOn/change/keepConstant/
   *  successMetric already covered the other four; this states the
   *  hypothesis explicitly rather than leaving it implicit in `why`.
   *  Deterministic, templated from the same facts as the rest of the
   *  test — never a causal claim, always "if X, we expect Y, because
   *  signal S already observed in this dataset." */
  hypothesis: string;
  /** Present only for tests that claim an observed winning or losing
   *  PATTERN worth briefing (T1 winner-iteration, T2 loser-rebuild).
   *  Absent for tests that don't make that claim (budget-elasticity
   *  tests, fresh unobserved format/offer challengers) — brief
   *  readiness has nothing to qualify there. */
  briefReadiness?: MemoBriefReadiness;
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
/* Period Comparison V2: "What changed" between two exports.           */
/*                                                                    */
/* Strictly descriptive — every sentence is "X moved from A to B",    */
/* never why. Built by modules/debrief/compare.ts from two            */
/* independently-analyzed periods; NEVER read by decision.ts (the      */
/* Next-move call is a current-period read only — test-enforced).      */
/* null when no previous-period file was provided, in which case the   */
/* memo is byte-identical to a single-period run.                      */
/* ------------------------------------------------------------------ */

export type ComparisonMatchBasis = "ad_id" | "ad_name";

/** One reliably-matched ad, judged in BOTH periods. Labels only —
 *  formatted upstream so the UI/TXT never re-derive numbers. */
export interface MemoComparisonRow {
  name: string;
  previousLabel: string;
  currentLabel: string;
  /** KPI-polarity-aware movement, e.g. "+18% (better)" / "−9% (worse)". */
  changeLabel: string;
  spendChangeLabel: string;
  /** "12 → 30 purchases" when both periods carried a count. */
  conversionChangeLabel?: string;
  /** Movement V1 — the same raw values compare.ts already computes
   *  internally, exposed for chart geometry. Never recomputed
   *  elsewhere; MovementChart/movementChartMath consume these
   *  directly rather than parsing the formatted labels above. */
  prevValue: number;
  currValue: number;
  /** Polarity-corrected % change vs the previous value (same
   *  convention as RankedAd.deltaPct — positive always means
   *  "better" for the KPI's own polarity); null when the previous
   *  value was 0 — not expressible as a %, see compare.ts's
   *  zero-baseline handling. */
  pct: number | null;
  /** True when this movement is in the KPI's own "better" direction.
   *  Set even when pct is null — a zero-baseline row still has a
   *  known, polarity-correct direction. */
  better: boolean;
}

export interface MemoComparison {
  /** How ads were matched across the two exports. Surfaced prominently
   *  in the comparison section itself (a visible provenance line), not
   *  only in the limits text. */
  matchBasis: ComparisonMatchBasis;
  /** The visible provenance sentence for matchBasis. */
  matchNote: string;
  periodLabel: { previous: string | null; current: string | null };
  /** Account-level movement: benchmark, spend, judged counts, and the
   *  improved/declined/unchanged tally. Two registers. */
  account: { buyer: string[]; client: string[] };
  /** Movement V1 — the account-level median/benchmark movement
   *  sentence, named explicitly so a consumer (MovementChart) doesn't
   *  depend on account[0]'s position as an implicit contract. Same
   *  text as account.buyer[0]/account.client[0] — both are set from
   *  the same local variable in compare.ts, so this is a presentation
   *  convenience, never a second source of truth. */
  medianMovement: { buyer: string; client: string };
  improved: MemoComparisonRow[];
  declined: MemoComparisonRow[];
  /** Matched ads judged in both periods (the delta-capable set). */
  matchedJudgedBoth: number;
  unmatched: {
    /** Ads excluded from one-to-one matching: their key repeats within
     *  a period, or (in ad_id mode) the id cell is empty. Counted over
     *  the CURRENT period; the previous period's counterparts are
     *  excluded from appeared/disappeared too — never guessed. */
    ambiguousOrMissingKey: number;
    /** Matched ads judged in only one of the two periods — no delta is
     *  computed for them (the other side is below the evidence bar). */
    judgedOnePeriodOnly: number;
  };
  /** Where last period's leading ads landed this period. Two registers. */
  persistence: { buyer: string[]; client: string[] };
  appeared: { names: string[]; total: number };
  disappeared: { names: string[]; total: number };
  /** Evidence Confidence V2 — cross-period consistency of the CURRENT
   *  leader, computed comparison-side and rendered as CONTEXT beside
   *  the evidence claim. Strictly descriptive (above/below the
   *  previous period's own benchmark, or honestly unreadable); NEVER
   *  an input to the decision or evidenceState — the comparison→
   *  decision isolation is unchanged and test-enforced. null when the
   *  current period has no top winner. */
  leaderConsistency: {
    status: "led_both" | "lead_is_new" | "not_judged_previously" | "not_matched";
    buyer: string;
    client: string;
  } | null;
  /** Fixed: what changed ≠ why it changed; never feeds the Next move. */
  caveat: string;
  limits: { buyer: string[]; client: string[] };
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
  /** Present only when action is "budget" — which copy variant fired
   *  (TLDR Coherence fix): "shift" = scale + cut, "scale" = scale
   *  only, "cut" = cut only. Lets the memo's verdict lines agree with
   *  the committed call WITHOUT re-deriving eligibility (the exact
   *  duplication decision.ts exists to prevent): a winner imperative
   *  is only voiced under shift/scale, a kill imperative only under
   *  shift/cut. */
  budgetVariant?: "shift" | "scale" | "cut";
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
  /** Decision Criteria V2 — the decision bars that participated in this
   *  call, each labeled with its provenance (Debrief default vs the
   *  user's own criterion). Always present: default thresholds are
   *  Debrief's rules, not universal truth, and the report says whose
   *  bars decided. Buyer-register wording; rendered in buyer view. */
  appliedCriteria: AppliedCriterion[];
}

export interface Memo {
  scope: MemoScope;
  /** Decision-First V1: the committed "Next move" — purely additive;
   *  no other memo field changed when this shipped. */
  decision: MemoDecision;
  /** Period Comparison V2 — "What changed" vs an optional previous-
   *  period export. null on single-period runs (generateMemo always
   *  sets null; the route attaches a comparison when a previous file
   *  was provided). NEVER an input to `decision` — the Next move is a
   *  current-period read only. */
  comparison: MemoComparison | null;
  /** Spend Allocation V1 — purely additive; null when there's no judged
   *  spend to show. */
  spendAllocation: MemoSpendAllocation | null;
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
