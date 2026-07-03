import {
  fmtCount,
  fmtDeltaVsMedian,
  fmtKpiValue,
  fmtMoney,
} from "./format";
import {
  AnalysisResult,
  DebriefContext,
  KPI_LABELS,
  Memo,
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
      : `Next: run the reallocation test below, and start tagging ad names or creative notes so future debriefs can spot format patterns.`
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

function buildNextTests(analysis: AnalysisResult, context: DebriefContext): MemoTest[] {
  const { winners, losers, median, kpi, currency, spendGate, hasNameSignal } = analysis;
  const kpiLabel = KPI_LABELS[kpi];
  const medianLabel = median != null ? fmtKpiValue(median, kpi, currency) : "the benchmark";
  const tests: MemoTest[] = [];

  if (winners.length > 0) {
    const top = winners[0];
    tests.push({
      test: `Scale "${top.name}" budget by 50%.`,
      why: `It's already beating median ${kpiLabel} (${fmtDeltaVsMedian(top.deltaFromMedian, top.deltaPct)}) on ${fmtMoney(top.spend, currency)} spend — a proven signal worth more budget.`,
      setup: `Raise daily budget 50% for 5–7 days. Hold creative and audience constant so scaling effects aren't confused with a new variable.`,
      winningLooksLike: `${kpiLabel} stays within 10% of ${fmtKpiValue(top.kpiValue as number, kpi, currency)} at the higher spend level.`,
    });
  } else {
    tests.push({
      test: `Re-test your current top-spending ad with a fresh audience or placement.`,
      why: `No ad cleared the median this period, so the fastest signal is retesting your best-spending ad under a new condition.`,
      setup: `Duplicate the top-spending ad into a new ad set with one changed variable (audience or placement). Run for 5–7 days.`,
      winningLooksLike: `${kpiLabel} clears ${medianLabel}.`,
    });
  }

  if (losers.length > 0) {
    tests.push({
      test: `Reallocate the ${fmtMoney(analysis.belowBenchmarkSpend, currency)} on below-benchmark ads into your top 1–2 winners.`,
      why: `These ads are spending below ${medianLabel} with no sign of catching up.`,
      setup: `Pause the bottom ${losers.length} ad${losers.length === 1 ? "" : "s"} over 3–5 days; move their daily budget to the winners above. Keep total account budget constant so this isolates reallocation, not a spend increase.`,
      winningLooksLike: `Blended account ${kpiLabel} improves toward ${medianLabel} or better within 7 days.`,
    });
  } else {
    tests.push({
      test: `Hold current spend split and extend the flat-performing ads by one more week.`,
      why: `No ad is clearly underperforming yet — cutting now risks killing something that just needs more data.`,
      setup: `No budget changes. Re-run this debrief in 7 days with the extra data.`,
      winningLooksLike: `A clear winner or loser separates from ${medianLabel} once more spend has accumulated.`,
    });
  }

  if (hasNameSignal) {
    const dominant = winners[0]?.nameTags[0] ?? losers[0]?.nameTags[0] ?? "your winning";
    tests.push({
      test: `Brief 2 new ads in the "${dominant}" format showing up in your winners.`,
      why: `That format is already overrepresented among your top performers this period.`,
      setup: `Launch both variants with ~${fmtMoney(spendGate, currency)} budget each — enough to clear the spend gate — before judging.`,
      winningLooksLike: `At least one new ad clears ${fmtMoney(spendGate, currency)} spend and beats ${medianLabel}.`,
    });
  } else {
    tests.push({
      test: `Brief 2–3 new creative angles distinct from your current top spenders.`,
      why: `Metrics don't show a clear creative pattern yet — deliberately different angles is the fastest way to find one.${context.creativeNotes ? ` Consider your notes: "${context.creativeNotes.slice(0, 80)}".` : ""}`,
      setup: `Launch with matched budget (~${fmtMoney(spendGate, currency)} per ad) and hold audience/placement constant until each clears the spend gate.`,
      winningLooksLike: `At least one new ad clears ${fmtMoney(spendGate, currency)} spend and beats ${medianLabel}.`,
    });
  }

  return tests;
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
    winners: analysis.winners.map((ad) => buildRow(ad, analysis, context)),
    losers: {
      rows: analysis.losers.map((ad) => buildRow(ad, analysis, context)),
      killInstruction:
        analysis.losers.length > 0
          ? `Cut spend on the ads below. Combined ${fmtMoney(analysis.belowBenchmarkSpend, currency)} is going to ${fmtCount(analysis.belowBenchmarkCount)} below-benchmark ad${analysis.belowBenchmarkCount === 1 ? "" : "s"} total.`
          : "No ad fell clearly below the benchmark this period.",
      belowBenchmarkSpendLabel: fmtMoney(analysis.belowBenchmarkSpend, currency),
      setAsideNote:
        analysis.adsSetAside > 0
          ? `${analysis.adsSetAside} ad${analysis.adsSetAside === 1 ? "" : "s"} had too little spend (below ${fmtMoney(analysis.spendGate, currency)}) to judge fairly — set aside, not penalized.`
          : "No ads were set aside for low spend.",
    },
    patterns: buildPatterns(analysis),
    nextTests: buildNextTests(analysis, context),
    confidence: buildConfidence(analysis),
  };
}
