import {
  fmtCount,
  fmtDeltaVsMedian,
  fmtKpiValue,
  fmtMoney,
} from "./format";
import { extractMarketSignals } from "./marketSignals";
import {
  AnalysisResult,
  DebriefContext,
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

function describeAdReason(
  ad: RankedAd,
  hasCreativeNotes: boolean,
  creativeNotes: string
): string {
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

  if (hasNameSignal) {
    const tagShare = (group: typeof winners) => {
      const counts = new Map<string, number>();
      for (const ad of group) {
        for (const tag of ad.nameTags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
      let best: [string, number] | null = null;
      for (const entry of counts.entries()) {
        if (!best || entry[1] > best[1]) best = entry;
      }
      return best;
    };
    const winnerTag = tagShare(winners);
    if (winnerTag) {
      winnerNotes.push(
        `"${winnerTag[0]}"-tagged ads make up ${winnerTag[1]}/${winners.length} winners.`
      );
    }
    const loserTag = tagShare(losers);
    if (loserTag) {
      loserNotes.push(
        `"${loserTag[0]}"-tagged ads make up ${loserTag[1]}/${losers.length} losers.`
      );
    }
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
  if (top && signals.has("founder-led") && !top.nameTags.includes("founder")) {
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

  return { bullets: bullets.slice(0, 4), caveat: MARKET_CAVEAT };
}

/** The most common name tag in a group, or null. */
function dominantTag(group: RankedAd[]): { tag: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const ad of group) {
    for (const tag of ad.nameTags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  let best: { tag: string; count: number } | null = null;
  for (const [tag, count] of counts.entries()) {
    if (!best || count > best.count) best = { tag, count };
  }
  return best;
}

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
};

/**
 * Next tests are CREATIVE tests. Budget movement lives in the verdict
 * and the losers section; at most one scaling action appears here, and
 * only when the data strongly supports it (top winner ≥30% past the
 * median). The other slots are always angle/format iterations tied to
 * named ads and their numbers.
 */
const SCALE_TEST_MIN_DELTA_PCT = 30;

function buildNextTests(analysis: AnalysisResult, context: DebriefContext): MemoTest[] {
  const { winners, losers, median, kpi, currency, spendGate, hasNameSignal } = analysis;
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

  /* T1 — iterate the proven winner (creative). */
  if (top) {
    const format = winnerTag && top.nameTags.includes(winnerTag.tag) ? `${winnerTag.tag} ` : "";
    const founderLed =
      market?.has("founder-led") && !top.nameTags.includes("founder");
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
    });
  } else {
    const marketAngles = market && market.hooks.length > 0;
    tests.push({
      test: `Brief 3 deliberately distinct angles${context.product ? ` for ${context.product}` : ""}: problem-led, social-proof-led, and offer-led.`,
      why: `No ad beat the ${medianLabel} median this period — flat results mean the account needs new angles, not more budget behind existing ones.${
        marketAngles
          ? ` Your market notes point the same way (${market.hooks.join(", ")}) — directional support for the problem-led slot.`
          : ""
      }`,
      setup: `Matched budget (~${gateLabel} per ad), same audience and placement across all three, so the angle is the only variable.`,
      winningLooksLike: `At least one angle clears ${gateLabel} spend and beats ${medianLabel}.`,
    });
  }

  /* T2 — rebuild the worst judged ad (creative), before killing the
     angle outright. */
  if (worst) {
    const worstStats = `${fmtKpiValue(worst.kpiValue as number, kpi, currency)} ${kpiLabel} (${fmtDeltaVsMedian(worst.deltaFromMedian, worst.deltaPct)}) on ${fmtMoney(worst.spend, currency)} spend`;
    const problemFirst = market?.has("problem-first") ?? false;
    if (worst.nameTags.includes("discount/promo")) {
      tests.push({
        test: `Rebuild "${worst.name}" so the hook leads with the problem and the discount becomes the closer.`,
        why: `An offer-led ad running ${worstStats} means the discount alone isn't earning attention — the opening has to sell the problem before the price can close.${
          problemFirst
            ? " Problem-first hooks also repeat in your market notes — an observed pattern worth adapting to your own claim, not copying."
            : ""
        }`,
        setup: `Reduce the original's spend (it's in the losers list). Launch the rebuild at ~${gateLabel} with the same audience, placement, and offer — creative is the only change.`,
        winningLooksLike: `The rebuild beats the original's ${fmtKpiValue(worst.kpiValue as number, kpi, currency)} and closes to within 20% of ${medianLabel}.`,
      });
    } else if (winnerTag && !worst.nameTags.includes(winnerTag.tag)) {
      tests.push({
        test: `Reshoot "${worst.name}"'s message in the ${winnerTag.tag} format carrying your winners.`,
        why: `The message got ${fmtMoney(worst.spend, currency)} of spend but ran ${fmtDeltaVsMedian(worst.deltaFromMedian, worst.deltaPct)}, while ${winnerTag.tag} ads hold ${winnerTag.count}/${winners.length} winner slots — test whether the format, not the message, is what's failing.${
          problemFirst
            ? " Give the reshoot a problem-first opening — a repeating pattern in your market notes (directional)."
            : ""
        }`,
        setup: `Reduce the original's spend. Launch the ${winnerTag.tag} version at ~${gateLabel}, same audience and offer.`,
        winningLooksLike: `The reshoot beats the original's ${fmtKpiValue(worst.kpiValue as number, kpi, currency)} ${kpiLabel} and approaches ${medianLabel}.`,
      });
    } else {
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
      });
    }
  } else {
    tests.push({
      test: `Test ${winnerTag ? FORMAT_CHALLENGERS[winnerTag.tag] ?? "a new format" : "a new creative format"} against your current best ad as control.`,
      why: hasNameSignal
        ? `Nothing is clearly failing, so the next signal comes from challenging the dominant format rather than fixing losers.`
        : `Nothing is clearly failing and no format pattern is visible yet — a controlled format test creates the pattern data future debriefs need.`,
      setup: `One challenger, one control, matched budget (~${gateLabel} each), same audience and offer.`,
      winningLooksLike: `The challenger clears ${gateLabel} spend and beats ${medianLabel}.`,
    });
  }

  /* T3 — the ONLY slot a budget action may occupy, and only when the
     winner's lead is emphatic. Otherwise: a structured format
     challenger (creative again). */
  const scaleJustified =
    top != null && top.deltaPct != null && top.deltaPct >= SCALE_TEST_MIN_DELTA_PCT;
  if (scaleJustified) {
    tests.push({
      test: `Scale "${top.name}" daily budget by 25–50%.`,
      why: `The one budget move this data strongly supports: ${fmtDeltaVsMedian(top.deltaFromMedian, top.deltaPct)} vs median on ${fmtMoney(top.spend, currency)} already spent. Everything else this period is a creative problem, not a budget one.`,
      setup: `Raise the budget in a single step, then hold for 5–7 days. No creative or audience edits while measuring, so scaling is the only variable.`,
      winningLooksLike: `${kpiLabel} stays within 15% of ${fmtKpiValue(top.kpiValue as number, kpi, currency)} at the higher spend.`,
    });
  } else if (top && market?.has("bundle")) {
    /* Market-informed offer variant on the proven angle — still a
       creative/offer test, never a budget action. */
    tests.push({
      test: `Test "${top.name}"'s winning angle with a bundle offer variant (market signal).`,
      why: `Bundle offers repeat in your market notes while the account runs ${context.offer ? `"${context.offer}"` : "a single offer"} — an offer variant on the angle already proven at ${fmtKpiValue(top.kpiValue as number, kpi, currency)} ${kpiLabel} is the cheapest adaptation to test. Directional only: the notes don't confirm competitor performance.`,
      setup: `Same creative and audience as "${top.name}"; only the offer changes to a bundle. ~${gateLabel} until it clears the spend gate.`,
      winningLooksLike: `The bundle variant clears ${gateLabel} spend and beats the ${medianLabel} median ${kpiLabel}.`,
    });
  } else {
    const challenger = winnerTag
      ? FORMAT_CHALLENGERS[winnerTag.tag] ?? "a deliberately different creative format"
      : "a deliberately different creative format";
    tests.push({
      test: `Test ${challenger} against your ${winnerTag ? `${winnerTag.tag} ads` : "current best ad"} as the control.`,
      why: winnerTag
        ? `${winnerTag.tag} ads hold ${winnerTag.count}/${winners.length} winner slots but the lead isn't decisive — a structured challenger shows whether the format or the message is doing the work.`
        : `No format is clearly winning${hasNameSignal ? "" : " and names carry no format signal"} — the fastest way to a pattern is one controlled format-vs-format test.${context.creativeNotes ? ` Use your notes ("${context.creativeNotes.slice(0, 60)}…") to pick the challenger.` : ""}`,
      setup: `Launch the challenger at ~${gateLabel} alongside the control, same audience and offer, until both clear the spend gate.`,
      winningLooksLike: `The challenger clears ${gateLabel} spend and beats ${medianLabel}.`,
    });
  }

  return tests;
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

function buildConfidence(analysis: AnalysisResult): { level: "high" | "medium" | "low"; notes: string[] } {
  const { adsJudged, adsSetAside, adsAnalyzed, winners, losers, median, hasCreativeNotes, hasNameSignal, missingColumns, spendGate, currency } =
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

  return { level, notes };
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
    confidence: buildConfidence(analysis),
  };
}
