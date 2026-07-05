import {
  fmtCount,
  fmtDeltaVsMedian,
  fmtKpiValue,
  fmtMoney,
} from "./format";
import { assessMarketNotes, extractMarketSignals } from "./marketSignals";
import {
  AnalysisResult,
  CREATIVE_FORMAT_LABELS,
  DebriefContext,
  HIGHER_IS_BETTER,
  KPI_EXPLAINERS,
  KPI_LABELS,
  Memo,
  MemoMarketSignal,
  MemoTest,
  MemoWinnerLoserRow,
  RankedAd,
} from "./types";

/**
 * Assembles the memo from the deterministic analysis + user context.
 * Every sentence is templated from real numbers — no free-form
 * generation. This is the seam to swap in an LLM later: replace the
 * body of `generateMemo` with a call that takes the same
 * (AnalysisResult, DebriefContext) fact sheet and returns a Memo of the
 * same shape, so the UI never has to change. Until then, this keeps
 * the product honest, fast, and free to run.
 */

/** Display label for a format tag ("ugc" → "UGC"); name-derived tags
 *  not in the confirmable list pass through as-is. */
const formatLabel = (tag: string): string => CREATIVE_FORMAT_LABELS[tag] ?? tag;

function describeAdReason(
  ad: RankedAd,
  hasCreativeNotes: boolean,
  creativeNotes: string
): string {
  /* User-confirmed format: state it as confirmed — but it's still user
     context about WHAT the ad is, never proof of WHY it performed. */
  if (ad.formatConfirmed && ad.nameTags.length > 0) {
    return `Format confirmed as ${ad.nameTags.map(formatLabel).join("/")} — user-provided context, not proof of why it performed.`;
  }
  if (ad.nameTags.length > 0) {
    return `Ad name suggests ${ad.nameTags.join("/")} creative — confirm against the actual asset.`;
  }
  if (hasCreativeNotes) {
    const snippet =
      creativeNotes.length > 60 ? `${creativeNotes.slice(0, 57)}...` : creativeNotes;
    return `No format signal in the name — cross-check against your notes ("${snippet}").`;
  }
  return "Metrics only — angle unknown.";
}

function buildRow(
  ad: RankedAd,
  analysis: AnalysisResult,
  context: DebriefContext
): MemoWinnerLoserRow {
  return {
    name: ad.name,
    valueLabel: fmtKpiValue(ad.kpiValue as number, analysis.kpi, analysis.currency),
    vsMedianLabel: fmtDeltaVsMedian(ad.deltaFromMedian, ad.deltaPct),
    spendLabel: fmtMoney(ad.spend, analysis.currency),
    reason: describeAdReason(ad, analysis.hasCreativeNotes, context.creativeNotes),
  };
}

function buildTldr(analysis: AnalysisResult): string[] {
  const { winners, losers, median, kpi, currency, belowBenchmarkSpend, belowBenchmarkCount } =
    analysis;
  const kpiLabel = KPI_LABELS[kpi];
  const medianLabel = median != null ? fmtKpiValue(median, kpi, currency) : null;
  const lines: string[] = [];

  if (winners.length > 0) {
    const top = winners[0];
    lines.push(
      `"${top.name}" is the clear winner at ${fmtKpiValue(top.kpiValue as number, kpi, currency)} ${kpiLabel} (${fmtDeltaVsMedian(top.deltaFromMedian, top.deltaPct)}) on ${fmtMoney(top.spend, currency)} spend — move budget toward it.`
    );
  } else if (medianLabel) {
    lines.push(
      `No ad meaningfully beat the ${medianLabel} ${kpiLabel} benchmark this period — treat results as flat, not a breakout.`
    );
  } else {
    lines.push(
      `Not enough ads cleared the spend gate to call a winner this period — treat this debrief as directional only.`
    );
  }

  if (losers.length > 0) {
    const extra = belowBenchmarkCount - losers.length;
    lines.push(
      `Kill or shrink "${losers[0].name}"${extra > 0 ? ` and ${extra} other below-benchmark ad${extra === 1 ? "" : "s"}` : ""} — combined ${fmtMoney(belowBenchmarkSpend, currency)} spent below the benchmark.`
    );
  } else {
    lines.push(`No ad is clearly underperforming enough to kill outright.`);
  }

  lines.push(
    analysis.hasNameSignal
      ? `Next: brief new creative in the format your winners share (see Patterns and Next tests below).`
      : `Next: run the creative tests below, and start tagging ad names or creative notes so future debriefs can spot format patterns.`
  );

  return lines;
}

function buildPatterns(analysis: AnalysisResult): { winners: string[]; losers: string[] } {
  const { winners, losers, currency, hasNameSignal, hasCreativeNotes } = analysis;
  const winnerNotes: string[] = [];
  const loserNotes: string[] = [];

  if (winners.length > 0 && losers.length > 0) {
    const avgWinnerSpend = winners.reduce((s, a) => s + a.spend, 0) / winners.length;
    const avgLoserSpend = losers.reduce((s, a) => s + a.spend, 0) / losers.length;
    if (avgWinnerSpend > avgLoserSpend * 1.2) {
      winnerNotes.push(
        `Winners run higher spend on average (${fmtMoney(avgWinnerSpend, currency)} vs ${fmtMoney(avgLoserSpend, currency)}) — scale looks correlated with performance, not just noise.`
      );
    } else if (avgLoserSpend > avgWinnerSpend * 1.2) {
      loserNotes.push(
        `Losers actually spent more on average (${fmtMoney(avgLoserSpend, currency)} vs ${fmtMoney(avgWinnerSpend, currency)} for winners) — more budget isn't fixing weak creative here.`
      );
    }
  }

  /* Format-share bullets. Gating matches how the tags are used
     downstream (Next Tests signals, What-not-to-do): a name-derived
     GUESS still needs group-level support (hasNameSignal) before
     Patterns asserts it, but a user-CONFIRMED format is direct context
     and shows on its own — if the Next Tests signals can say "ugc ads
     hold 2/5 winner slots (2 formats user-confirmed)", Patterns must
     show the same share. Runs without confirmations are byte-identical
     to the legacy wording and gate. */
  const tagNote = (
    best: { tag: string; count: number; confirmed: number },
    group: RankedAd[],
    groupLabel: "winners" | "underperformers"
  ): string =>
    best.confirmed > 0
      ? `${formatLabel(best.tag)} ads make up ${best.count}/${group.length} ${groupLabel} (${best.confirmed} format${best.confirmed === 1 ? "" : "s"} user-confirmed).`
      : `"${best.tag}"-tagged ads make up ${best.count}/${group.length} ${groupLabel === "winners" ? "winners" : "losers"}.`;
  const winnerTag = dominantTag(winners);
  if (winnerTag && (hasNameSignal || winnerTag.confirmed > 0)) {
    winnerNotes.push(tagNote(winnerTag, winners, "winners"));
  }
  const loserTag = dominantTag(losers);
  if (loserTag && (hasNameSignal || loserTag.confirmed > 0)) {
    loserNotes.push(tagNote(loserTag, losers, "underperformers"));
  }

  if (winnerNotes.length === 0) {
    winnerNotes.push(
      hasCreativeNotes || hasNameSignal
        ? "No consistent structural pattern found among winners beyond the numbers themselves."
        : "Angle analysis is limited — no creative descriptions were provided, so this is metrics only."
    );
  }
  if (loserNotes.length === 0) {
    loserNotes.push(
      hasCreativeNotes || hasNameSignal
        ? "No consistent structural pattern found among losers beyond the numbers themselves."
        : "Angle analysis is limited — no creative descriptions were provided, so this is metrics only."
    );
  }

  return { winners: winnerNotes, losers: loserNotes };
}

/* ------------------------------------------------------------------ */
/* Market / competitor context (manually pasted text only).            */
/*                                                                     */
/* The text is scanned for known creative-strategy terms — formats,    */
/* hooks, offers — via the shared keyword map in marketSignals.ts      */
/* (the same table the generator's "Structure notes" button uses),     */
/* with the same keyword-matching honesty as ad-name tags: we only     */
/* restate what the user wrote, grouped. No scraping, no inference     */
/* about competitor spend or performance, ever. Own account data       */
/* stays the primary signal; market context can only REFRAME a test,   */
/* not create a claim.                                                 */
/* ------------------------------------------------------------------ */

const MARKET_CAVEAT =
  "Market context is directional — it does not confirm competitor spend or performance.";

/** 2–4 bullets restating the user's own market notes, plus the fixed
 *  directional caveat. Null when no context was pasted — the memo is
 *  then identical to a run without this feature. */
function buildMarketSignal(
  analysis: AnalysisResult,
  context: DebriefContext
): MemoMarketSignal | null {
  const text = context.marketContext.trim();
  if (text === "") return null;

  const signals = extractMarketSignals(text);
  const top = analysis.winners[0] ?? null;
  const bullets: string[] = [];

  if (signals.formats.length > 0) {
    bullets.push(
      `Formats observed in the market: ${signals.formats.join(", ")}.`
    );
  }
  if (signals.hooks.length > 0) {
    bullets.push(
      `Hooks repeating across the notes: ${signals.hooks.join(", ")} — an observed pattern, not verified performance.`
    );
  }
  if (signals.offers.length > 0) {
    bullets.push(`Offers in circulation: ${signals.offers.join(", ")}.`);
  }

  if (bullets.length === 0) {
    const snippet = text.length > 120 ? `${text.slice(0, 117)}…` : text;
    bullets.push(
      `Notes captured: "${snippet}" — carried into the next tests as directional context.`
    );
  }

  /* What seems worth adapting — always tied back to own data. */
  if (top && signals.has("founder-led") && !isFounderLed(top)) {
    bullets.push(
      `Worth testing: a founder-led take on "${top.name}"'s proven angle — adapt, don't copy.`
    );
  } else if (top && signals.has("bundle")) {
    bullets.push(
      `Worth testing: "${top.name}"'s winning angle with a bundle offer variant.`
    );
  } else if (top && signals.formats.length > 0) {
    bullets.push(
      `Worth testing: the ${signals.formats[0]} pattern applied to "${top.name}"'s angle — your own numbers stay the primary signal.`
    );
  } else {
    bullets.push(
      `These notes shape the angle tests below — your own account data stays the primary signal.`
    );
  }

  return {
    bullets: bullets.slice(0, 4),
    caveat: MARKET_CAVEAT,
    /* assessMarketNotes never returns null for non-empty text. */
    quality: assessMarketNotes(text)!,
  };
}

/** The most common format tag in a group, or null. `confirmed` counts
 *  how many of those ads carry a user-confirmed format (Creative Format
 *  Confirmation) rather than a name guess — 0 on any run without
 *  confirmations, keeping legacy wording untouched. */
function dominantTag(
  group: RankedAd[]
): { tag: string; count: number; confirmed: number } | null {
  const counts = new Map<string, { count: number; confirmed: number }>();
  for (const ad of group) {
    for (const tag of ad.nameTags) {
      const entry = counts.get(tag) ?? { count: 0, confirmed: 0 };
      entry.count += 1;
      if (ad.formatConfirmed) entry.confirmed += 1;
      counts.set(tag, entry);
    }
  }
  let best: { tag: string; count: number; confirmed: number } | null = null;
  for (const [tag, entry] of counts.entries()) {
    if (!best || entry.count > best.count) best = { tag, ...entry };
  }
  return best;
}

/** True when the ad is already founder-fronted — via a confirmed
 *  "founder-led" format or a founder-ish name tag. */
const isFounderLed = (ad: RankedAd): boolean =>
  ad.nameTags.some((t) => t.startsWith("founder"));

/** For the third test slot when no scale move is justified: pick a
 *  structured challenger to the winning format, so the test creates
 *  new pattern data instead of iterating in place. Deterministic. */
const FORMAT_CHALLENGERS: Record<string, string> = {
  ugc: "a founder/expert explainer video",
  testimonial: "the same testimonial format with a different customer segment",
  video: "a static distilled from the video's strongest claim",
  static: "a 15-second video cut of the top static",
  "before/after": "the same transformation told by the customer on camera (UGC)",
  carousel: "the carousel's first card as a standalone static",
  "discount/promo": "a value-led version where the discount is the closer, not the hook",
  urgency: "the same offer without the urgency framing",
  /* Reachable only via user-confirmed formats — ad names never
     produce these tags. */
  "founder-led": "a customer-voiced (UGC) version of the founder story",
  "product shot": "the product shown in real use instead of the studio shot",
  comparison: "the winning claim stated on its own, without the comparison frame",
};

/** Shot / asset direction per creative format — structural direction
 *  only (what to show, how to open), never invented claims, quotes,
 *  offers, or competitor facts. Reused across brief kinds. */
const ASSET_DIRECTION: Record<string, string[]> = {
  "founder-led": [
    "Founder on camera, speaking straight to lens — phone-grade is fine, authenticity beats polish.",
    "Natural setting (workspace, home) — no studio look.",
    "Burned-in captions; assume sound-off viewing.",
    "Cut or reframe every 2–3 seconds to hold attention.",
    "End card: product + the offer exactly as it exists today.",
  ],
  ugc: [
    "Creator-shot, handheld phone footage — native to feed, not produced.",
    "Product in real use within the first 3 seconds.",
    "Voiceover or captions carrying the angle's core line.",
    "Imperfect lighting is acceptable — polish reads as an ad.",
    "End card: the offer as it exists today.",
  ],
  testimonial: [
    "Use existing customer review language verbatim — never invented quotes.",
    "Attribute only with permission; initials are enough.",
    "Open on the review's strongest line, not the product.",
    "Simple treatment — the words are the creative.",
    "Close with product shot + current offer.",
  ],
  static: [
    "One message per image — the angle's core claim, nothing else.",
    "Visual hierarchy: hook line first, product second, offer last.",
    "First read must land in under 2 seconds.",
    "No more than ~10 words of copy on the image.",
  ],
  carousel: [
    "Card 1 must work standalone — hook + visual, no setup required.",
    "One idea per card; the sequence tells the angle start to finish.",
    "Design cards to be read out of order — most viewers won't swipe in sequence.",
    "Repeat the offer only on the final card.",
  ],
  "problem-first": [
    "First frame states the problem plainly — no brand, no product yet.",
    "Agitate briefly (1–2 beats), then introduce the product as the turn.",
    "Keep the problem in the customer's words, not marketing language.",
    "The offer appears only after the solution beat — closer, not hook.",
    "Burned-in captions; assume sound-off viewing.",
  ],
  video: [
    "Open mid-action — no logo or title card in the first 3 seconds.",
    "Burned-in captions; assume sound-off viewing.",
    "One idea per cut; re-hook visually every 3–5 seconds.",
    "End card: product + the offer exactly as it exists today.",
  ],
  /* Reachable only via user-confirmed formats (Creative Format
     Confirmation) — name tags never produce these. */
  "product shot": [
    "One hero frame: the product sharp, large, and unobstructed.",
    "Show scale and texture — context props only if they clarify use.",
    "Hook line as short overlay text; the product stays the visual.",
    "First read must land in under 2 seconds.",
    "Offer stated plainly, once — never stacked on the hero frame.",
  ],
  comparison: [
    "Split-frame or sequential A/B — make the two sides instantly readable.",
    "Compare only on claims that already exist — never invented competitor facts.",
    "Lead with the dimension the viewer cares about, not the product name.",
    "Keep labels plain; the contrast does the talking.",
    "End card: product + the offer exactly as it exists today.",
  ],
};

const directionFor = (tag: string | null | undefined): string[] =>
  (tag && ASSET_DIRECTION[tag]) || ASSET_DIRECTION.video;

/**
 * Next tests are CREATIVE tests. Budget movement lives in the verdict
 * and the losers section; at most one scaling action appears here, and
 * only when the data strongly supports it (top winner ≥30% past the
 * median). The other slots are always angle/format iterations tied to
 * named ads and their numbers.
 */
const SCALE_TEST_MIN_DELTA_PCT = 30;

function buildNextTests(analysis: AnalysisResult, context: DebriefContext): MemoTest[] {
  const {
    winners,
    losers,
    median,
    kpi,
    currency,
    spendGate,
    hasNameSignal,
    belowBenchmarkSpend,
    belowBenchmarkCount,
    adsSetAside,
  } = analysis;
  const kpiLabel = KPI_LABELS[kpi];
  const medianLabel = median != null ? fmtKpiValue(median, kpi, currency) : "the benchmark";
  const gateLabel = fmtMoney(spendGate, currency);
  const tests: MemoTest[] = [];

  const top = winners[0] ?? null;
  const worst = losers[0] ?? null; // losers arrive sorted worst-first
  const winnerTag = dominantTag(winners);

  /* Market context (when pasted) may REFRAME a test — own performance
     data stays the primary signal, and every market-informed line says
     so. Null when the field was left empty, in which case every branch
     below is byte-identical to the pre-market-context engine. */
  const market =
    context.marketContext.trim() === ""
      ? null
      : extractMarketSignals(context.marketContext);

  /* Compact signal bullets — the receipts behind each recommendation.
     Built only from what the data actually shows: own numbers first,
     market notes always marked directional, guardrails last. */
  const topSignal = top
    ? `"${top.name}" leads at ${fmtKpiValue(top.kpiValue as number, kpi, currency)} ${kpiLabel} (${fmtDeltaVsMedian(top.deltaFromMedian, top.deltaPct)}) on ${fmtMoney(top.spend, currency)} spend.`
    : null;
  const worstSignal = worst
    ? `"${worst.name}" spent ${fmtMoney(worst.spend, currency)} and ran ${fmtDeltaVsMedian(worst.deltaFromMedian, worst.deltaPct)}.`
    : null;
  const tagSignal = winnerTag
    ? `${winnerTag.tag} ads hold ${winnerTag.count}/${winners.length} winner slots${
        winnerTag.confirmed > 0
          ? ` (${winnerTag.confirmed} format${winnerTag.confirmed === 1 ? "" : "s"} user-confirmed)`
          : ""
      }.`
    : null;
  const belowSignal =
    belowBenchmarkCount > 0
      ? `Combined ${fmtMoney(belowBenchmarkSpend, currency)} spent below the median across ${fmtCount(belowBenchmarkCount)} ad${belowBenchmarkCount === 1 ? "" : "s"}.`
      : null;
  const gateSignal =
    adsSetAside > 0
      ? `${adsSetAside} thin-spend ad${adsSetAside === 1 ? " was" : "s were"} set aside, not judged.`
      : null;
  const sig = (...items: (string | null | false | undefined)[]) =>
    items
      .filter((s): s is string => typeof s === "string" && s !== "")
      .slice(0, 4);

  /* ---- Creative-brief scaffolding (deterministic, shared) ---- */
  const product = context.product || "the product";
  const offerLabel = context.offer ? `"${context.offer}"` : "the current offer";
  const typicalLabel =
    median != null
      ? `the ${medianLabel} typical result`
      : "the account benchmark (once enough ads clear the gate to set one)";
  const successMetric =
    kpi === "cpa" && context.targetCpa != null
      ? `CPA below your ${fmtMoney(context.targetCpa, currency)} target once the ~${gateLabel} spend gate is cleared.`
      : kpi === "ctr"
        ? `CTR above ${typicalLabel} once the ~${gateLabel} spend gate is cleared, without cost per click worsening materially.`
        : `${kpiLabel} ${HIGHER_IS_BETTER[kpi] ? "above" : "below"} ${typicalLabel} once the ~${gateLabel} spend gate is cleared.`;
  const briefGuardrails = (marketInformed: boolean): string[] => [
    `Do not judge before ~${gateLabel} of spend — below the gate the ad is set aside, not failed.`,
    `Do not scale until the test beats ${typicalLabel} by ${SCALE_TEST_MIN_DELTA_PCT}%+.`,
    ...(marketInformed
      ? [
          "Do not copy competitor ads directly — adapt the observed pattern to your own claim.",
        ]
      : []),
  ];
  const basisNote = (marketInformed: boolean): string =>
    marketInformed
      ? "Own performance data leads this brief; market notes shaped it directionally only."
      : market
        ? "Based mostly on your own performance data — the market notes didn't change this test."
        : "Based on your own performance data — no market notes were provided.";

  /* T1 — iterate the proven winner (creative). */
  if (top) {
    const format = winnerTag && top.nameTags.includes(winnerTag.tag) ? `${winnerTag.tag} ` : "";
    const founderLed =
      (market?.has("founder-led") ?? false) && !isFounderLed(top);
    const signals = sig(
      topSignal,
      tagSignal,
      founderLed && "Market notes mention founder-led video — directional.",
      gateSignal
    );
    tests.push({
      test: founderLed
        ? `Brief 2 new ${format}variants of "${top.name}" — keep the angle; make one a founder-led version (market signal), change only the hook on the other.`
        : `Brief 2 new ${format}variants of "${top.name}" — keep the angle, change the hook.`,
      why: `It leads the account at ${fmtKpiValue(top.kpiValue as number, kpi, currency)} ${kpiLabel} (${fmtDeltaVsMedian(top.deltaFromMedian, top.deltaPct)}) on ${fmtMoney(top.spend, currency)} spend. The angle has proven demand — new hooks find its ceiling before fatigue does.${
        founderLed
          ? " Your market notes flag founder-led video as an observed pattern — worth testing as an adaptation of the proven angle. Adapt, don't copy."
          : ""
      }`,
      setup: `Same audience, placement, and offer as the original. ~${gateLabel} per variant so each clears the spend gate. Change only the opening 3 seconds / first frame between variants.`,
      winningLooksLike: `At least one variant beats the ${medianLabel} median ${kpiLabel} within 7 days.`,
      signals,
      brief: {
        title: founderLed
          ? `Founder-led variant of the "${top.name}" angle`
          : `Hook variants of "${top.name}"`,
        objective:
          "Learn whether the account's proven angle has more headroom — find a new opening that beats the original before fatigue does.",
        basedOn: signals,
        concept: `Two variants of the winning ad: identical angle, offer, and audience — only the opening changes.${
          founderLed
            ? " One variant is fronted by the founder, adapting an observed market pattern onto the proven angle."
            : ""
        }`,
        hooks: [
          `Cold-open on the angle's payoff moment — the outcome "${top.name}" sells, before any context.`,
          `Question open: turn the angle's core promise for ${product} into a direct question in the first line.`,
          founderLed
            ? `Founder to camera: a one-sentence "why we built this" open, then cut into the proven angle (market signal — adapt, don't copy).`
            : "Text-led open: the angle's strongest existing line as bold on-screen text before any footage.",
        ],
        assetDirection: directionFor(
          founderLed
            ? "founder-led"
            : winnerTag && top.nameTags.includes(winnerTag.tag)
              ? winnerTag.tag
              : top.nameTags[0]
        ),
        keepConstant: `The angle, ${offerLabel} offer, audience, and placements of "${top.name}" — it earned its lead doing exactly this.`,
        change: founderLed
          ? "Only the opening: one variant gets a new hook, the other gets the founder-led front."
          : "Only the opening 3 seconds / first frame — nothing else.",
        successMetric,
        guardrails: briefGuardrails(founderLed),
        basisNote: basisNote(founderLed),
      },
    });
  } else {
    const marketAngles = (market && market.hooks.length > 0) ?? false;
    const signals = sig(
      `No ad beat the ${medianLabel} median ${kpiLabel} this period.`,
      marketAngles &&
        market != null &&
        `Market notes mention ${market.hooks.join(", ")} — directional.`,
      gateSignal
    );
    tests.push({
      test: `Brief 3 deliberately distinct angles${context.product ? ` for ${context.product}` : ""}: problem-led, social-proof-led, and offer-led.`,
      why: `No ad beat the ${medianLabel} median this period — flat results mean the account needs new angles, not more budget behind existing ones.${
        marketAngles && market != null
          ? ` Your market notes point the same way (${market.hooks.join(", ")}) — directional support for the problem-led slot.`
          : ""
      }`,
      setup: `Matched budget (~${gateLabel} per ad), same audience and placement across all three, so the angle is the only variable.`,
      winningLooksLike: `At least one angle clears ${gateLabel} spend and beats ${medianLabel}.`,
      signals,
      brief: {
        title: "Angle exploration: problem-led vs social-proof vs offer-led",
        objective: `Find a first winning angle — nothing beat ${typicalLabel} this period, so the account needs new direction, not iteration.`,
        basedOn: signals,
        concept: `Three deliberately different ads for ${product}: one leads with the problem, one with social proof, one with the offer. Same audience and budget, so the angle is the only variable.`,
        hooks: [
          `Problem-led: open on the problem in the customer's own words — no product in the first beat.${marketAngles ? " (Problem-first opens repeat in your market notes — directional.)" : ""}`,
          "Social-proof-led: open on evidence you already have — real review language or real usage numbers, never invented.",
          `Offer-led: state ${offerLabel} plainly in the first line — no build-up.`,
        ],
        assetDirection: [
          "Same format across all three ads (whichever ships fastest) — the angle stays the only variable.",
          "Open each ad inside its angle within 2 seconds — no shared intro.",
          "Use only claims, reviews, and offer terms that already exist.",
          "Burned-in captions; assume sound-off viewing.",
          "Identical end card across all three: product + current offer.",
        ],
        keepConstant: `Audience, placement, budget (~${gateLabel} each), and the live offer.`,
        change: "The angle — problem-led vs social-proof-led vs offer-led. Nothing else.",
        successMetric,
        guardrails: briefGuardrails(marketAngles),
        basisNote: basisNote(marketAngles),
      },
    });
  }

  /* T2 — rebuild the worst judged ad (creative), before killing the
     angle outright. */
  if (worst) {
    const worstStats = `${fmtKpiValue(worst.kpiValue as number, kpi, currency)} ${kpiLabel} (${fmtDeltaVsMedian(worst.deltaFromMedian, worst.deltaPct)}) on ${fmtMoney(worst.spend, currency)} spend`;
    const problemFirst = market?.has("problem-first") ?? false;
    if (worst.nameTags.includes("discount/promo")) {
      const signals = sig(
        worstSignal,
        belowSignal,
        problemFirst && "Market notes flag problem-first hooks — directional."
      );
      tests.push({
        test: `Rebuild "${worst.name}" so the hook leads with the problem and the discount becomes the closer.`,
        why: `An offer-led ad running ${worstStats} means the discount alone isn't earning attention — the opening has to sell the problem before the price can close.${
          problemFirst
            ? " Problem-first hooks also repeat in your market notes — an observed pattern worth adapting to your own claim, not copying."
            : ""
        }`,
        setup: `Reduce the original's spend (it's in the losers list). Launch the rebuild at ~${gateLabel} with the same audience, placement, and offer — creative is the only change.`,
        winningLooksLike: `The rebuild beats the original's ${fmtKpiValue(worst.kpiValue as number, kpi, currency)} and closes to within 20% of ${medianLabel}.`,
        signals,
        brief: {
          title: `Problem-first rebuild of "${worst.name}"`,
          objective:
            "Learn whether the hook, not the discount, is what's failing — one rebuild before the angle is retired.",
          basedOn: signals,
          concept:
            "Rebuild of the discount ad: the opening sells the problem, the discount moves to the end as the closer. Same offer, same audience.",
          hooks: [
            `Open on the problem the product solves — plainly, no price in the first beat.${problemFirst ? " (Problem-first opens repeat in your market notes — directional.)" : ""}`,
            "Product-first open: show it in real use before any offer language.",
            "Cost-of-inaction open: what staying with the status quo costs — the discount arrives only as the resolution.",
          ],
          assetDirection: [
            ...ASSET_DIRECTION["problem-first"].slice(0, 4),
            `Keep the discount exactly as it exists (${offerLabel}) — never a new or bigger offer.`,
          ],
          keepConstant: "The offer itself, audience, and placement — only the creative changes.",
          change: "The order of information: problem first, discount last.",
          successMetric,
          guardrails: briefGuardrails(problemFirst),
          basisNote: basisNote(problemFirst),
        },
      });
    } else if (winnerTag && !worst.nameTags.includes(winnerTag.tag)) {
      const signals = sig(
        worstSignal,
        tagSignal,
        problemFirst && "Market notes flag problem-first hooks — directional."
      );
      tests.push({
        test: `Reshoot "${worst.name}"'s message in the ${winnerTag.tag} format carrying your winners.`,
        why: `The message got ${fmtMoney(worst.spend, currency)} of spend but ran ${fmtDeltaVsMedian(worst.deltaFromMedian, worst.deltaPct)}, while ${winnerTag.tag} ads hold ${winnerTag.count}/${winners.length} winner slots — test whether the format, not the message, is what's failing.${
          problemFirst
            ? " Give the reshoot a problem-first opening — a repeating pattern in your market notes (directional)."
            : ""
        }`,
        setup: `Reduce the original's spend. Launch the ${winnerTag.tag} version at ~${gateLabel}, same audience and offer.`,
        winningLooksLike: `The reshoot beats the original's ${fmtKpiValue(worst.kpiValue as number, kpi, currency)} ${kpiLabel} and approaches ${medianLabel}.`,
        signals,
        brief: {
          title: `${winnerTag.tag} reshoot of "${worst.name}"`,
          objective:
            "Learn whether the message or the format is failing — the same message rebuilt in the format carrying your winners.",
          basedOn: signals,
          concept: `The loser's message reshot as ${winnerTag.tag} — the format holding ${winnerTag.count}/${winners.length} winner slots. Message, audience, and offer stay identical.`,
          hooks: [
            `Restate the original ad's core message in the first 2 seconds of the ${winnerTag.tag} treatment.`,
            "Open on the strongest single claim the original buried — earn attention before detail.",
            problemFirst
              ? "Problem-first open on the pain point behind the message (observed market pattern — directional)."
              : "Contrast open: show the before-state the message speaks to, then turn.",
          ],
          assetDirection: directionFor(winnerTag.tag),
          keepConstant: `The message, audience, and offer of "${worst.name}".`,
          change: `The format only — rebuilt as ${winnerTag.tag}, matching your winners.`,
          successMetric,
          guardrails: briefGuardrails(problemFirst),
          basisNote: basisNote(problemFirst),
        },
      });
    } else {
      const signals = sig(
        worstSignal,
        belowSignal,
        problemFirst && "Market notes flag problem-first hooks — directional."
      );
      tests.push({
        test: problemFirst
          ? `Rebuild "${worst.name}" with a problem-first opening hook (observed market pattern) before writing the angle off.`
          : `Rebuild "${worst.name}" with a new opening hook before writing the angle off.`,
        why: `At ${worstStats} it's the account's weakest judged ad — one rebuild is cheaper than losing an angle that might only have a hook problem.${
          problemFirst
            ? " Your market notes flag problem-first hooks as a repeating pattern — directional, and the cheapest place to test it."
            : ""
        }`,
        setup: `Reduce the original's spend. One rebuild at ~${gateLabel}, changing only the hook — same body, audience, and offer.`,
        winningLooksLike: `The rebuild beats ${fmtKpiValue(worst.kpiValue as number, kpi, currency)} ${kpiLabel} clearly; if it doesn't, retire the angle.`,
        signals,
        brief: {
          title: `Hook rebuild of "${worst.name}"`,
          objective:
            "Learn whether the angle only has a hook problem — one rebuild before retiring it.",
          basedOn: signals,
          concept: `The same ad with a new opening${problemFirst ? ", built problem-first (observed market pattern)" : ""} — body, audience, and offer untouched.`,
          hooks: [
            problemFirst
              ? "Problem-first open: state the pain point plainly before the product appears (market notes — directional)."
              : "Payoff-first open: move the ad's strongest moment into second one.",
            `Question open: the angle's promise for ${product} as a direct question.`,
            "Text-led open: the core existing line as bold on-screen text before any footage.",
          ],
          assetDirection: directionFor(worst.nameTags[0]),
          keepConstant: `Everything after the opening — body, audience, placement, and ${offerLabel}.`,
          change: "Only the opening hook.",
          successMetric,
          guardrails: briefGuardrails(problemFirst),
          basisNote: basisNote(problemFirst),
        },
      });
    }
  } else {
    const challenger = winnerTag
      ? FORMAT_CHALLENGERS[winnerTag.tag] ?? "a new creative format"
      : "a new creative format";
    const signals = sig(
      "No judged ad is failing clearly this period.",
      tagSignal,
      gateSignal
    );
    tests.push({
      test: `Test ${challenger} against your current best ad as control.`,
      why: hasNameSignal
        ? `Nothing is clearly failing, so the next signal comes from challenging the dominant format rather than fixing losers.`
        : `Nothing is clearly failing and no format pattern is visible yet — a controlled format test creates the pattern data future debriefs need.`,
      setup: `One challenger, one control, matched budget (~${gateLabel} each), same audience and offer.`,
      winningLooksLike: `The challenger clears ${gateLabel} spend and beats ${medianLabel}.`,
      signals,
      brief: {
        title: `Format challenger: ${challenger}`,
        objective:
          "Learn whether the format or the message is doing the work — one controlled format-vs-format test against the current best ad.",
        basedOn: signals,
        concept: `${challenger.charAt(0).toUpperCase()}${challenger.slice(1)} carrying the control ad's exact message, tested head-to-head at matched budget.`,
        hooks: [
          "Translate the control ad's core message into the challenger format's native opening.",
          "Keep the first line of copy identical to the control — the format stays the only variable.",
          "Open inside the new format's strength (motion for video, one bold claim for static) with the same message.",
        ],
        assetDirection: [
          `Build: ${challenger}.`,
          ...ASSET_DIRECTION.video.slice(0, 4),
        ],
        keepConstant: "Message, audience, offer, and budget parity with the control.",
        change: "The format only.",
        successMetric,
        guardrails: briefGuardrails(false),
        basisNote: basisNote(false),
      },
    });
  }

  /* T3 — the ONLY slot a budget action may occupy, and only when the
     winner's lead is emphatic. Otherwise: a structured format
     challenger (creative again). */
  const scaleJustified =
    top != null && top.deltaPct != null && top.deltaPct >= SCALE_TEST_MIN_DELTA_PCT;
  if (scaleJustified) {
    const signals = sig(
      topSignal,
      `The lead clears the ${SCALE_TEST_MIN_DELTA_PCT}% bar this memo requires before any budget move.`
    );
    tests.push({
      test: `Scale "${top.name}" daily budget by 25–50%.`,
      why: `The one budget move this data strongly supports: ${fmtDeltaVsMedian(top.deltaFromMedian, top.deltaPct)} vs median on ${fmtMoney(top.spend, currency)} already spent. Everything else this period is a creative problem, not a budget one.`,
      setup: `Raise the budget in a single step, then hold for 5–7 days. No creative or audience edits while measuring, so scaling is the only variable.`,
      winningLooksLike: `${kpiLabel} stays within 15% of ${fmtKpiValue(top.kpiValue as number, kpi, currency)} at the higher spend.`,
      signals,
      brief: {
        title: `Scale readiness: "${top.name}"`,
        objective: `Learn whether the winner holds its ${fmtKpiValue(top.kpiValue as number, kpi, currency)} ${kpiLabel} at 25–50% higher spend.`,
        basedOn: signals,
        concept:
          "No new creative launches — this is a budget-elasticity test. Prepare (don't launch) two refresh openings so a fatigue dip can be answered fast once the window closes.",
        hooks: [
          "Refresh A (prepare only): same angle, new opening scene — ready to swap if frequency climbs.",
          "Refresh B (prepare only): same angle, text-led open — held in reserve.",
          "Launch neither refresh during the measurement window — the live ad stays untouched.",
        ],
        assetDirection: [
          `No edits to "${top.name}" while measuring — creative, audience, and placements stay frozen.`,
          "Raise the budget in one step (25–50%), then hold 5–7 days.",
          "Watch frequency and early-drop-off for fatigue signals.",
          "Produce both refresh openings now; launch only after the window closes.",
        ],
        keepConstant: "Everything about the live ad — this is a budget test, not a creative one.",
        change: "Daily budget only, one step up.",
        successMetric: `${kpiLabel} stays within 15% of ${fmtKpiValue(top.kpiValue as number, kpi, currency)} at the higher spend.`,
        guardrails: [
          "Do not change creative or audience during the 5–7 day window — scaling must stay the only variable.",
          `If ${kpiLabel} drifts more than 15%, step the budget back — no chasing with edits mid-window.`,
        ],
        basisNote: basisNote(false),
      },
    });
  } else if (top && market?.has("bundle")) {
    /* Market-informed offer variant on the proven angle — still a
       creative/offer test, never a budget action. */
    const signals = sig(
      topSignal,
      "Market notes mention bundle offers — directional."
    );
    tests.push({
      test: `Test "${top.name}"'s winning angle with a bundle offer variant (market signal).`,
      why: `Bundle offers repeat in your market notes while the account runs ${context.offer ? `"${context.offer}"` : "a single offer"} — an offer variant on the angle already proven at ${fmtKpiValue(top.kpiValue as number, kpi, currency)} ${kpiLabel} is the cheapest adaptation to test. Directional only: the notes don't confirm competitor performance.`,
      setup: `Same creative and audience as "${top.name}"; only the offer changes to a bundle. ~${gateLabel} until it clears the spend gate.`,
      winningLooksLike: `The bundle variant clears ${gateLabel} spend and beats the ${medianLabel} median ${kpiLabel}.`,
      signals,
      brief: {
        title: `Bundle offer variant of "${top.name}"`,
        objective:
          "Learn whether a bundle offer lifts the proven angle — the offer is the only variable.",
        basedOn: signals,
        concept:
          "The winning creative and audience with the offer switched to a bundle — adapting an offer pattern observed in your market notes (directional).",
        hooks: [
          `Keep the winning ad's opening untouched — the bundle appears at the offer beat, not the hook.`,
          "Value-stack open: show the bundle contents together before any price framing.",
          `Same-hook A/B: an opening identical to "${top.name}" so the offer is the only difference.`,
        ],
        assetDirection: [
          "Show every bundle component together in one frame — clarity beats cleverness.",
          "Use only bundle terms that actually exist — never imply extra discounts.",
          `Match the creative structure of "${top.name}" shot-for-shot where possible.`,
          "End card: the bundle offer stated plainly.",
          "Burned-in captions; assume sound-off viewing.",
        ],
        keepConstant: `The creative, audience, and opening of "${top.name}".`,
        change: `The offer only — from ${offerLabel} to a bundle variant.`,
        successMetric,
        guardrails: briefGuardrails(true),
        basisNote: basisNote(true),
      },
    });
  } else {
    const challenger = winnerTag
      ? FORMAT_CHALLENGERS[winnerTag.tag] ?? "a deliberately different creative format"
      : "a deliberately different creative format";
    const signals = sig(
      tagSignal ?? "No format is clearly winning yet.",
      topSignal,
      gateSignal
    );
    tests.push({
      test: `Test ${challenger} against your ${winnerTag ? `${winnerTag.tag} ads` : "current best ad"} as the control.`,
      why: winnerTag
        ? `${winnerTag.tag} ads hold ${winnerTag.count}/${winners.length} winner slots but the lead isn't decisive — a structured challenger shows whether the format or the message is doing the work.`
        : `No format is clearly winning${hasNameSignal ? "" : " and names carry no format signal"} — the fastest way to a pattern is one controlled format-vs-format test.${context.creativeNotes ? ` Use your notes ("${context.creativeNotes.slice(0, 60)}…") to pick the challenger.` : ""}`,
      setup: `Launch the challenger at ~${gateLabel} alongside the control, same audience and offer, until both clear the spend gate.`,
      winningLooksLike: `The challenger clears ${gateLabel} spend and beats ${medianLabel}.`,
      signals,
      brief: {
        title: `Format challenger: ${challenger}`,
        objective:
          "Learn whether the format or the message is doing the work — one controlled format-vs-format test against the current control.",
        basedOn: signals,
        concept: `${challenger.charAt(0).toUpperCase()}${challenger.slice(1)} carrying the control ad's exact message, tested head-to-head at matched budget.`,
        hooks: [
          "Translate the control ad's core message into the challenger format's native opening.",
          "Keep the first line of copy identical to the control — the format stays the only variable.",
          "Open inside the new format's strength (motion for video, one bold claim for static) with the same message.",
        ],
        assetDirection: [
          `Build: ${challenger}.`,
          ...ASSET_DIRECTION.video.slice(0, 4),
        ],
        keepConstant: "Message, audience, offer, and budget parity with the control.",
        change: "The format only.",
        successMetric,
        guardrails: briefGuardrails(false),
        basisNote: basisNote(false),
      },
    });
  }

  return tests;
}

/**
 * "What not to do" — anti-recommendations from the same deterministic
 * facts the tests use. Each bullet exists only when its condition holds
 * in the data (or market notes were actually provided); nothing generic
 * ever appears. Buyer register keeps the shorthand; client register
 * stays jargon-free ("typical result", no "kill"/"spend gate").
 */
function buildAvoid(
  analysis: AnalysisResult,
  context: DebriefContext
): { buyer: string[]; client: string[] } {
  const { winners, losers, median, kpi, currency, spendGate, adsSetAside } =
    analysis;
  const kpiLabel = KPI_LABELS[kpi];
  const medianLabel = median != null ? fmtKpiValue(median, kpi, currency) : null;
  const top = winners[0] ?? null;
  const worst = losers[0] ?? null;
  const hasMarket = context.marketContext.trim() !== "";
  const buyer: string[] = [];
  const client: string[] = [];

  /* Loser-side: don't feed what's failing. */
  if (worst && worst.nameTags.includes("discount/promo")) {
    buyer.push(
      `Do not launch more discount-led ads until the hook is rebuilt — "${worst.name}" ran ${fmtDeltaVsMedian(worst.deltaFromMedian, worst.deltaPct)}.`
    );
    client.push(
      `We're not creating more discount-first ads until the message is rebuilt — the current one runs below the typical result.`
    );
  } else {
    const loserTag = dominantTag(losers);
    if (loserTag && loserTag.count >= 2) {
      buyer.push(
        `Do not move budget into ${loserTag.tag} ads while they hold ${loserTag.count}/${losers.length} loser slots.`
      );
      client.push(
        `We're not adding budget to ${loserTag.tag}-style ads while they run below the typical result.`
      );
    }
  }

  /* Budget discipline. */
  if (top && top.deltaPct != null) {
    if (top.deltaPct >= SCALE_TEST_MIN_DELTA_PCT) {
      buyer.push(
        `Do not scale anything except "${top.name}" — everything else this period is a creative problem, not a budget one.`
      );
      client.push(
        `We're only increasing budget behind "${top.name}" — nowhere else until the next tests read.`
      );
    } else {
      buyer.push(
        `Do not scale budgets on this lead — "${top.name}" is ${Math.round(top.deltaPct)}% past the median, under the ${SCALE_TEST_MIN_DELTA_PCT}% bar a scale move needs.`
      );
      client.push(
        `We're not increasing budgets yet — the current lead isn't decisive enough to scale safely.`
      );
    }
  } else if (!top && medianLabel) {
    buyer.push(
      `Do not add budget to existing ads — nothing beat the ${medianLabel} median ${kpiLabel} this period.`
    );
    client.push(
      `We're not adding budget to current ads — none pulled clearly ahead this period.`
    );
  }

  /* Guardrail: thin-spend ads stay unjudged. */
  if (adsSetAside > 0) {
    buyer.push(
      `Do not judge the ${adsSetAside} low-spend ad${adsSetAside === 1 ? "" : "s"} yet — below the ${fmtMoney(spendGate, currency)} spend gate they're set aside, not failed.`
    );
    client.push(
      `We're not judging the ${adsSetAside} ad${adsSetAside === 1 ? "" : "s"} that ${adsSetAside === 1 ? "hasn't" : "haven't"} spent enough yet — they get a fair read once the data is there.`
    );
  }

  /* Market honesty. */
  if (hasMarket) {
    buyer.push(
      `Do not treat market context as confirmed competitor performance — it's directional only.`
    );
    client.push(
      `We're not treating market observations as proof of what works — they steer tests only.`
    );
  }

  return { buyer: buyer.slice(0, 4), client: client.slice(0, 4) };
}

/** The verdict in client language: what happened, what it means, what
 *  we'll do — same facts as tldr, no buyer shorthand ("kill",
 *  "benchmark", "spend gate"). */
function buildClientSummary(analysis: AnalysisResult): string[] {
  const { winners, losers, median, kpi, currency, belowBenchmarkSpend, belowBenchmarkCount } =
    analysis;
  const kpiLabel = KPI_LABELS[kpi];
  const lines: string[] = [];

  if (winners.length > 0) {
    const top = winners[0];
    lines.push(
      `Your strongest ad this period was "${top.name}" at ${fmtKpiValue(top.kpiValue as number, kpi, currency)} ${kpiLabel} — clearly ahead of the account's typical result (${median != null ? fmtKpiValue(median, kpi, currency) : "n/a"}). It earns a larger share of the budget.`
    );
  } else if (median != null) {
    lines.push(
      `No single ad pulled clearly ahead this period — performance was flat across the account, so the focus shifts to finding a new winning idea rather than shuffling budget.`
    );
  } else {
    lines.push(
      `Most ads hadn't spent enough yet to judge fairly, so this report is directional rather than conclusive.`
    );
  }

  if (losers.length > 0) {
    lines.push(
      `${fmtCount(belowBenchmarkCount)} ad${belowBenchmarkCount === 1 ? "" : "s"} performed below the account's typical result, together accounting for ${fmtMoney(belowBenchmarkSpend, currency)} of spend. We're reducing or pausing their budgets so that money works harder.`
    );
  } else {
    lines.push(
      `No ad underperformed badly enough to pause — budgets stay where they are while the next tests run.`
    );
  }

  lines.push(
    `Next, we're testing new creative built on what this data shows works — the specific tests are listed below.`
  );

  return lines;
}

function buildConfidence(
  analysis: AnalysisResult,
  hasMarket: boolean
): Memo["confidence"] {
  const { adsJudged, adsSetAside, adsAnalyzed, winners, losers, median, hasCreativeNotes, hasNameSignal, missingColumns, spendGate, currency, belowBenchmarkSpend } =
    analysis;
  const notes: string[] = [];

  if (adsSetAside > 0) {
    notes.push(
      `${adsSetAside} of ${adsAnalyzed} ads were set aside for insufficient spend (below ${fmtMoney(spendGate, currency)}) — excluded from winners/losers, not penalized.`
    );
  }
  if (!hasCreativeNotes && !hasNameSignal) {
    notes.push("No creative notes or clear ad-name pattern — angle analysis is metrics-only.");
  }
  if (missingColumns.includes("Ad name")) {
    notes.push("Ad name column wasn't found — ads are labeled generically (Ad 1, Ad 2, …).");
  }
  if (missingColumns.includes("Reporting date range")) {
    notes.push("CSV didn't include a reporting date range — treating all rows as one period.");
  }
  if (median == null) {
    notes.push("Not enough ads passed the spend gate to compute a reliable benchmark.");
  }

  let level: "high" | "medium" | "low" = "high";
  if (median == null || adsJudged < 5 || (winners.length === 0 && losers.length === 0)) {
    level = "low";
  } else if (
    adsJudged < 10 ||
    winners.length < 3 ||
    losers.length < 3 ||
    missingColumns.length > 0 ||
    (!hasCreativeNotes && !hasNameSignal)
  ) {
    level = "medium";
  }

  if (notes.length === 0) {
    notes.push("Data was complete enough that no caveats apply beyond the usual: more days of spend always sharpens the read.");
  }

  /* Why the level landed where it did — derived from the exact same
     conditions that set it, so the explanation can never contradict
     the verdict. Buyer register as bullets; one plain sentence for the
     client view. */
  const reasons: string[] = [];
  let clientWhy: string;
  const topPct = winners[0]?.deltaPct ?? null;

  if (level === "high") {
    reasons.push(
      `${adsJudged} of ${adsAnalyzed} ads cleared the spend gate — a fair sample to judge.`
    );
    if (topPct != null && topPct >= 30) {
      reasons.push(
        `The top winner is ${Math.round(topPct)}% past the median — a meaningful lead, not noise.`
      );
    }
    if (losers.length > 0 && belowBenchmarkSpend > 0) {
      reasons.push(
        `${fmtMoney(belowBenchmarkSpend, currency)} sat below the median — the cut side is material.`
      );
    }
    if (hasMarket) {
      reasons.push(
        "Market notes point the same direction — directional support only."
      );
    }
    clientWhy =
      "Confidence is high because most ads had enough spend to judge fairly and the gap between what worked and what didn't is clear.";
  } else if (level === "medium") {
    if (adsJudged < 10) {
      reasons.push(
        `Only ${adsJudged} ads cleared the spend gate — patterns can still shift as more spend lands.`
      );
    }
    if (winners.length < 3 || losers.length < 3) {
      reasons.push(
        `The winner/loser groups are small (${winners.length} vs ${losers.length}) — one ad can swing the read.`
      );
    }
    if (missingColumns.length > 0) {
      reasons.push(
        `The export was missing ${missingColumns.length} column${missingColumns.length === 1 ? "" : "s"} — parts of the read are less precise.`
      );
    }
    if (!hasCreativeNotes && !hasNameSignal) {
      reasons.push(
        "No creative notes or name pattern — the judgement is metrics-only."
      );
    }
    if (topPct != null && topPct < 30) {
      reasons.push(
        `The top winner is only ${Math.round(topPct)}% past the median — a lead, not a landslide.`
      );
    }
    clientWhy =
      "Confidence is medium because the results point one way, but the sample is small enough that the next round of spend could still shift it.";
  } else {
    if (median == null) {
      reasons.push(
        "Not enough ads cleared the spend gate to set a reliable benchmark."
      );
    }
    if (adsJudged < 5) {
      reasons.push(
        `Only ${adsJudged} ad${adsJudged === 1 ? "" : "s"} could be judged — too few to separate signal from noise.`
      );
    }
    if (median != null && winners.length === 0 && losers.length === 0) {
      reasons.push("Nothing clearly won or lost this period.");
    }
    reasons.push(
      "Treat the tests below as ideas to validate, not firm decisions."
    );
    clientWhy =
      "Confidence is low because too few ads had enough spend to judge — treat the next steps as ideas to test rather than firm decisions.";
  }

  return { level, notes, reasons: reasons.slice(0, 4), clientWhy };
}

export function generateMemo(analysis: AnalysisResult, context: DebriefContext): Memo {
  const { kpi, currency, median } = analysis;

  return {
    scope: {
      product: context.product || "Your account",
      kpiLabel: KPI_LABELS[kpi],
      kpiExplainer: KPI_EXPLAINERS[kpi],
      dateRangeLabel: analysis.dateRange
        ? `${analysis.dateRange.start} – ${analysis.dateRange.end}`
        : null,
      adsAnalyzed: analysis.adsAnalyzed,
      adsJudged: analysis.adsJudged,
      adsSetAside: analysis.adsSetAside,
      totalSpendLabel: fmtMoney(analysis.totalSpend, currency),
      medianLabel: median != null ? fmtKpiValue(median, kpi, currency) : "Not enough data",
    },
    tldr: buildTldr(analysis),
    clientSummary: buildClientSummary(analysis),
    winners: analysis.winners.map((ad) => buildRow(ad, analysis, context)),
    losers: {
      rows: analysis.losers.map((ad) => buildRow(ad, analysis, context)),
      killInstruction:
        analysis.losers.length > 0
          ? `Cut spend on the ads below and move it behind your winners. Combined ${fmtMoney(analysis.belowBenchmarkSpend, currency)} is going to ${fmtCount(analysis.belowBenchmarkCount)} below-benchmark ad${analysis.belowBenchmarkCount === 1 ? "" : "s"} total.`
          : "No ad fell clearly below the benchmark this period.",
      clientInstruction:
        analysis.losers.length > 0
          ? `We're reducing or pausing spend on the ads below — together they spent ${fmtMoney(analysis.belowBenchmarkSpend, currency)} while performing under the account's typical result, and that budget moves behind the ads that are working.`
          : "No ad underperformed badly enough to pause this period.",
      belowBenchmarkSpendLabel: fmtMoney(analysis.belowBenchmarkSpend, currency),
      setAsideNote:
        analysis.adsSetAside > 0
          ? `${analysis.adsSetAside} ad${analysis.adsSetAside === 1 ? "" : "s"} had too little spend (below ${fmtMoney(analysis.spendGate, currency)}) to judge fairly — set aside, not penalized.`
          : "No ads were set aside for low spend.",
    },
    patterns: buildPatterns(analysis),
    marketSignal: buildMarketSignal(analysis, context),
    nextTests: buildNextTests(analysis, context),
    avoid: buildAvoid(analysis, context),
    confidence: buildConfidence(analysis, context.marketContext.trim() !== ""),
  };
}
