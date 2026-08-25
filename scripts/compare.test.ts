/**
 * Period Comparison V2 — plain-Node proofs for modules/debrief/compare.ts.
 *
 * The matching honesty rules are the whole feature, so they're the bulk
 * of this file: basis selection (Ad ID over name, disclosed either
 * way), duplicate/missing-key exclusion (counted, never guessed, never
 * leaked into appeared/disappeared), judged-both-periods-only deltas,
 * KPI-polarity-aware improvement, composition caveats, period sanity
 * warnings — plus two contract scans: no causal vocabulary anywhere in
 * the output, and compare.ts importing nothing but types.ts (the
 * decision-side isolation scan lives in decision.test.ts).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildComparison, COMPARISON_CAVEAT } from "../modules/debrief/compare.ts";
import { HIGHER_IS_BETTER } from "../modules/debrief/types.ts";
import type {
  AnalysisResult,
  KpiKey,
  MemoComparison,
  ParsedAd,
  RankedAd,
} from "../modules/debrief/types.ts";

const fmt = {
  money: (v: number) => `$${v.toFixed(2)}`,
  kpiValue: (v: number) => v.toFixed(2),
  kpiLabel: "ROAS",
};

interface AdSpec {
  name: string;
  kpiValue?: number | null; // undefined → below gate (not judged)
  spend?: number;
  id?: string | null;
  conversions?: number | null;
}

function toParsed(spec: AdSpec): ParsedAd {
  return {
    name: spec.name,
    id: spec.id ?? null,
    spend: spec.spend ?? 100,
    kpiValue: spec.kpiValue ?? null,
    nameTags: [],
    conversions: spec.conversions ?? null,
  };
}

/** Builds a period from ad specs: ads with a kpiValue are judged (and
 *  ranked vs the median of judged values); the rest are set aside. */
function period(
  specs: AdSpec[],
  opts: { kpi?: KpiKey; dateRange?: { start: string; end: string } | null } = {}
): { analysis: AnalysisResult; ads: ParsedAd[] } {
  const kpi = opts.kpi ?? "roas";
  const ads = specs.map(toParsed);
  const judged = ads.filter((a) => a.kpiValue != null);
  const values = judged.map((a) => a.kpiValue as number).sort((a, b) => a - b);
  const median =
    values.length === 0
      ? null
      : values.length % 2 !== 0
        ? values[Math.floor(values.length / 2)]
        : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
  const higher = HIGHER_IS_BETTER[kpi];
  const rankedAds: RankedAd[] =
    median == null
      ? []
      : judged.map((a) => {
          const value = a.kpiValue as number;
          const delta = higher ? value - median : median - value;
          return {
            ...a,
            gate: "judged" as const,
            deltaFromMedian: delta,
            deltaPct: median !== 0 ? (delta / Math.abs(median)) * 100 : null,
          };
        });
  const winners = rankedAds
    .filter((a) => a.deltaFromMedian > 0)
    .sort((a, b) => b.deltaFromMedian - a.deltaFromMedian);
  const losers = rankedAds
    .filter((a) => a.deltaFromMedian < 0)
    .sort((a, b) => a.deltaFromMedian - b.deltaFromMedian);
  return {
    ads,
    analysis: {
      kpi,
      adsAnalyzed: ads.length,
      adsJudged: judged.length,
      adsSetAside: ads.length - judged.length,
      totalSpend: ads.reduce((s, a) => s + a.spend, 0),
      judgedSpend: judged.reduce((s, a) => s + a.spend, 0),
      currency: null,
      dateRange: opts.dateRange === undefined ? null : opts.dateRange,
      spendGate: 50,
      spendGateBasis: "floor_or_mean",
      median,
      winners,
      losers,
      rankedAds,
      belowBenchmarkSpend: losers.reduce((s, a) => s + a.spend, 0),
      belowBenchmarkCount: losers.length,
      hasNameSignal: false,
      hasCreativeNotes: false,
      missingColumns: [],
      duplicateAdNames: [],
    },
  };
}

function allStrings(cmp: MemoComparison): string[] {
  return [
    cmp.matchNote,
    ...cmp.account.buyer,
    ...cmp.account.client,
    ...cmp.improved.flatMap((r) => [r.name, r.changeLabel, r.spendChangeLabel, r.conversionChangeLabel ?? ""]),
    ...cmp.declined.flatMap((r) => [r.name, r.changeLabel, r.spendChangeLabel, r.conversionChangeLabel ?? ""]),
    ...cmp.persistence.buyer,
    ...cmp.persistence.client,
    ...cmp.limits.buyer,
    ...cmp.limits.client,
    cmp.caveat,
  ];
}

/* ===================== basis selection + visible provenance ===================== */

{
  // Ids in both periods → ad_id, disclosed.
  const withIds = buildComparison(
    period([{ name: "A", kpiValue: 3, id: "1" }, { name: "B", kpiValue: 2, id: "2" }]),
    period([{ name: "A", kpiValue: 2, id: "1" }, { name: "B", kpiValue: 2, id: "2" }]),
    fmt
  );
  assert.equal(withIds.matchBasis, "ad_id");
  assert.ok(withIds.matchNote.includes("Ad ID"), "id provenance is stated");

  // Ids in only one period → name fallback, with the rename limitation
  // stated BOTH in the visible matchNote and in the limits.
  const nameFallback = buildComparison(
    period([{ name: "A", kpiValue: 3, id: "1" }]),
    period([{ name: "A", kpiValue: 2 }]),
    fmt
  );
  assert.equal(nameFallback.matchBasis, "ad_name");
  assert.ok(
    nameFallback.matchNote.includes("exact ad name") &&
      nameFallback.matchNote.includes("renamed"),
    "name-matching provenance and its rename consequence are visible in matchNote"
  );
  assert.ok(
    nameFallback.limits.buyer.some((l) => l.includes("matched by exact ad name")),
    "name-matching limitation also recorded in limits"
  );
  // A renamed ad under ID matching would still match — under name
  // matching it splits into disappeared + appeared:
  const renamed = buildComparison(
    period([{ name: "New name", kpiValue: 3 }]),
    period([{ name: "Old name", kpiValue: 2 }]),
    fmt
  );
  assert.equal(renamed.appeared.total, 1);
  assert.equal(renamed.disappeared.total, 1);
  assert.equal(renamed.matchedJudgedBoth, 0);
}

/* ===================== KPI-polarity-aware deltas ===================== */

{
  // ROAS (higher better): 2 → 3 is improvement.
  const roas = buildComparison(
    period([{ name: "A", kpiValue: 3 }, { name: "B", kpiValue: 1 }]),
    period([{ name: "A", kpiValue: 2 }, { name: "B", kpiValue: 2 }]),
    fmt
  );
  assert.equal(roas.matchedJudgedBoth, 2);
  assert.equal(roas.improved.length, 1);
  assert.equal(roas.improved[0].name, "A");
  assert.ok(roas.improved[0].changeLabel.includes("+50%") && roas.improved[0].changeLabel.includes("better"));
  assert.equal(roas.declined[0].name, "B");
  assert.ok(roas.declined[0].changeLabel.includes("worse"));

  // CPA (lower better): 20 → 10 is improvement.
  const cpa = buildComparison(
    period([{ name: "A", kpiValue: 10 }, { name: "B", kpiValue: 30 }], { kpi: "cpa" }),
    period([{ name: "A", kpiValue: 20 }, { name: "B", kpiValue: 20 }], { kpi: "cpa" }),
    { ...fmt, kpiLabel: "CPA" }
  );
  assert.equal(cpa.improved[0].name, "A");
  assert.ok(cpa.improved[0].changeLabel.includes("better"));
  assert.equal(cpa.declined[0].name, "B");

  // Conversion movement shown only when both periods carry counts.
  const conv = buildComparison(
    period([{ name: "A", kpiValue: 3, conversions: 30 }]),
    period([{ name: "A", kpiValue: 2, conversions: 12 }]),
    fmt
  );
  assert.equal(conv.improved[0].conversionChangeLabel, "12 → 30 purchases");
  const convMissing = buildComparison(
    period([{ name: "A", kpiValue: 3, conversions: 30 }]),
    period([{ name: "A", kpiValue: 2 }]),
    fmt
  );
  assert.equal(convMissing.improved[0].conversionChangeLabel, undefined);
}

/* ===================== zero-baseline movements (QA C2) ===================== */

{
  // Previous value 0 → current positive: a REAL movement with a certain
  // direction, inexpressible as a % — never "effectively unchanged".
  const zeroUp = buildComparison(
    period([{ name: "A", kpiValue: 2 }, { name: "B", kpiValue: 1.5 }]),
    period([{ name: "A", kpiValue: 0 }, { name: "B", kpiValue: 1 }]),
    fmt
  );
  assert.equal(zeroUp.improved.length, 2, "0 → 2 lands in improved (polarity: higher better)");
  assert.ok(
    zeroUp.improved.some((r) => r.name === "A" && r.changeLabel.includes("not expressible as a %")),
    "zero-baseline row carries the explicit non-% change label"
  );
  assert.ok(
    zeroUp.account.buyer.some((l) => l.includes("0 effectively unchanged")),
    "zero-baseline mover never counted as effectively unchanged"
  );
  assert.ok(
    zeroUp.account.buyer.some((l) => l.includes("previous value of zero")),
    "buyer tally names the zero baseline"
  );
  assert.ok(
    zeroUp.account.client.some((l) => l.includes("previous value of zero")),
    "client tally names the zero baseline"
  );

  // Polarity preserved: CPA (lower better) 0 → 20 is a decline.
  const zeroCpa = buildComparison(
    period([{ name: "A", kpiValue: 20 }, { name: "B", kpiValue: 10 }], { kpi: "cpa" }),
    period([{ name: "A", kpiValue: 0 }, { name: "B", kpiValue: 10 }], { kpi: "cpa" }),
    { ...fmt, kpiLabel: "CPA" }
  );
  assert.equal(zeroCpa.declined.length, 1, "CPA 0 → 20 lands in declined");
  assert.equal(zeroCpa.declined[0].name, "A");

  // Normal percentage deltas are untouched by the new bucketing.
  const normal = buildComparison(
    period([{ name: "A", kpiValue: 3 }, { name: "B", kpiValue: 1 }]),
    period([{ name: "A", kpiValue: 2 }, { name: "B", kpiValue: 2 }]),
    fmt
  );
  assert.ok(normal.improved[0].changeLabel.includes("+50%"), "expressible deltas keep % labels");
  assert.ok(
    !normal.account.buyer.some((l) => l.includes("previous value of zero")),
    "no zero-baseline clause without a zero baseline"
  );
}

/* ===================== duplicate/missing keys: excluded, counted, never guessed ===================== */

{
  // Duplicate name in the CURRENT period: both rows excluded + counted;
  // the previous period's same-named row is excluded from disappeared.
  const dupCurrent = buildComparison(
    period([
      { name: "Dup", kpiValue: 3 },
      { name: "Dup", kpiValue: 1 },
      { name: "Solo", kpiValue: 2 },
    ]),
    period([{ name: "Dup", kpiValue: 2 }, { name: "Solo", kpiValue: 2 }]),
    fmt
  );
  assert.equal(dupCurrent.unmatched.ambiguousOrMissingKey, 2);
  assert.equal(dupCurrent.matchedJudgedBoth, 1, "only Solo matches");
  assert.equal(dupCurrent.appeared.total, 0, "an ambiguous key never reads as 'new'");
  assert.equal(dupCurrent.disappeared.total, 0, "an ambiguous key never reads as 'removed'");
  assert.ok(
    dupCurrent.limits.buyer.some((l) => l.includes("couldn't be matched one-to-one")),
    "ambiguity disclosed in limits"
  );

  // Duplicate name in the PREVIOUS period only: the current unique ad
  // existed before (twice) — it must NOT appear as new.
  const dupPrevious = buildComparison(
    period([{ name: "Dup", kpiValue: 3 }]),
    period([{ name: "Dup", kpiValue: 2 }, { name: "Dup", kpiValue: 1 }]),
    fmt
  );
  assert.equal(dupPrevious.appeared.total, 0, "a previously-duplicated name never reads as 'new'");
  assert.equal(dupPrevious.matchedJudgedBoth, 0);
  assert.equal(dupPrevious.unmatched.ambiguousOrMissingKey, 1);

  // Id mode: a current-period row with a missing id is excluded +
  // counted, never silently name-matched — even though a same-named
  // row exists in the previous period.
  const missingId = buildComparison(
    period([{ name: "A", kpiValue: 3, id: "1" }, { name: "B", kpiValue: 2 }]),
    period([{ name: "A", kpiValue: 2, id: "1" }, { name: "B", kpiValue: 2, id: "2" }]),
    fmt
  );
  assert.equal(missingId.matchBasis, "ad_id");
  assert.equal(missingId.unmatched.ambiguousOrMissingKey, 1, "current B has no id");
  assert.equal(missingId.matchedJudgedBoth, 1, "only A matches by id");
  assert.equal(missingId.appeared.total, 0, "an id-less row never reads as 'new'");
}

/* ===================== row-label identity never fabricates a match (QA B1) ===================== */

{
  // Duplicate-named rows arrive with row-disambiguated display names
  // and the raw name in sourceName. Matching MUST key on the raw name
  // (row positions aren't stable across exports) — so both rows stay
  // ambiguous and excluded, exactly like before the display change.
  const cur = period([
    { name: "Alpha (row 2)", kpiValue: 3 },
    { name: "Alpha (row 5)", kpiValue: 1 },
    { name: "Solo", kpiValue: 2 },
  ]);
  cur.ads[0].sourceName = "Alpha";
  cur.ads[1].sourceName = "Alpha";
  for (const a of cur.analysis.rankedAds) if (a.name.startsWith("Alpha")) a.sourceName = "Alpha";
  const prev = period([
    { name: "Alpha (row 3)", kpiValue: 2 },
    { name: "Alpha (row 7)", kpiValue: 2 },
    { name: "Solo", kpiValue: 2 },
  ]);
  prev.ads[0].sourceName = "Alpha";
  prev.ads[1].sourceName = "Alpha";
  for (const a of prev.analysis.rankedAds) if (a.name.startsWith("Alpha")) a.sourceName = "Alpha";
  const cmp = buildComparison(cur, prev, fmt);
  assert.equal(cmp.matchedJudgedBoth, 1, "only Solo matches — row labels never pair up");
  assert.equal(cmp.unmatched.ambiguousOrMissingKey, 2, "both duplicate rows counted ambiguous");
  assert.equal(cmp.appeared.total, 0, "row-labeled duplicates never read as new ads");
}

/* ===================== judged-both-periods-only deltas ===================== */

{
  const cmp = buildComparison(
    period([{ name: "A", kpiValue: 3 }, { name: "B", kpiValue: 2 }, { name: "C" }]),
    period([{ name: "A", kpiValue: 2 }, { name: "B" }, { name: "C", kpiValue: 1 }]),
    fmt
  );
  // A judged both; B judged current-only? (B: prev unjudged, curr judged)
  // and C the reverse — both count as judgedOnePeriodOnly, no delta.
  assert.equal(cmp.matchedJudgedBoth, 1);
  assert.equal(cmp.unmatched.judgedOnePeriodOnly, 2);
  assert.ok(
    cmp.limits.buyer.some((l) => l.includes("only one of the two periods")),
    "one-period-judged ads disclosed"
  );
}

/* ===================== account movement, tally, composition caveat ===================== */

{
  const differing = buildComparison(
    period([{ name: "A", kpiValue: 3 }, { name: "E", kpiValue: 5 }]),
    period([{ name: "A", kpiValue: 2 }, { name: "C", kpiValue: 1 }]),
    fmt
  );
  assert.ok(
    differing.account.buyer.some((l) => l.startsWith("Median ROAS moved from")),
    "median movement stated"
  );
  assert.ok(
    differing.account.buyer.some((l) => l.includes("composition change")),
    "differing judged sets draw the composition caveat"
  );
  assert.equal(differing.appeared.total, 1);
  assert.equal(differing.disappeared.total, 1);

  const identical = buildComparison(
    period([{ name: "A", kpiValue: 3 }, { name: "B", kpiValue: 1 }]),
    period([{ name: "A", kpiValue: 2 }, { name: "B", kpiValue: 2 }]),
    fmt
  );
  assert.ok(
    !identical.account.buyer.some((l) => l.includes("composition change")),
    "identical judged sets draw no composition caveat"
  );

  // Sub-1% moves are tallied as effectively unchanged, not as movement.
  const flat = buildComparison(
    period([{ name: "A", kpiValue: 2.001 }, { name: "B", kpiValue: 3 }]),
    period([{ name: "A", kpiValue: 2.0 }, { name: "B", kpiValue: 2 }]),
    fmt
  );
  assert.equal(flat.improved.length + flat.declined.length, 1, "only B moved beyond the band");
  assert.ok(
    flat.account.buyer.some((l) => l.includes("1 effectively unchanged")),
    "unchanged tally stated"
  );

  // Zero matches: account-level movement still present, stated honestly.
  const none = buildComparison(
    period([{ name: "X", kpiValue: 3 }]),
    period([{ name: "Y", kpiValue: 2 }]),
    fmt
  );
  assert.equal(none.matchedJudgedBoth, 0);
  assert.ok(
    none.account.buyer.some((l) => l.includes("No individual ad could be reliably matched")),
    "zero-match case stated, not hidden"
  );
}

/* ===================== winner persistence ===================== */

{
  const cmp = buildComparison(
    period([{ name: "Champ", kpiValue: 5 }, { name: "B", kpiValue: 2 }, { name: "C", kpiValue: 1 }]),
    period([{ name: "Champ", kpiValue: 4 }, { name: "B", kpiValue: 2 }, { name: "C", kpiValue: 1 }, { name: "Gone", kpiValue: 6, spend: 500 }]),
    fmt
  );
  assert.ok(
    cmp.persistence.buyer.some((l) => l.includes('"Gone"') && l.includes("no longer appears")),
    "a departed prior winner is reported"
  );
  assert.ok(
    cmp.persistence.buyer.some((l) => l.includes('"Champ"') && l.includes("above the median again")),
    "a persisting prior winner is reported"
  );
}

/* ===================== period sanity warnings ===================== */

{
  const overlap = buildComparison(
    period([{ name: "A", kpiValue: 3 }], { dateRange: { start: "2026-06-15", end: "2026-07-15" } }),
    period([{ name: "A", kpiValue: 2 }], { dateRange: { start: "2026-06-01", end: "2026-06-30" } }),
    fmt
  );
  assert.ok(
    overlap.limits.buyer.some((l) => l.includes("overlap")),
    "overlapping periods drawn out"
  );

  const swapped = buildComparison(
    period([{ name: "A", kpiValue: 3 }], { dateRange: { start: "2026-05-01", end: "2026-05-31" } }),
    period([{ name: "A", kpiValue: 2 }], { dateRange: { start: "2026-06-01", end: "2026-06-30" } }),
    fmt
  );
  assert.ok(
    swapped.limits.buyer.some((l) => l.includes("right slots")),
    "previous-after-current order flagged"
  );

  const lengths = buildComparison(
    period([{ name: "A", kpiValue: 3 }], { dateRange: { start: "2026-06-01", end: "2026-06-30" } }),
    period([{ name: "A", kpiValue: 2 }], { dateRange: { start: "2026-05-25", end: "2026-05-31" } }),
    fmt
  );
  assert.ok(
    lengths.limits.buyer.some((l) => l.includes("differ in length")),
    "length mismatch flagged"
  );

  const noDates = buildComparison(
    period([{ name: "A", kpiValue: 3 }]),
    period([{ name: "A", kpiValue: 2 }]),
    fmt
  );
  assert.ok(
    noDates.limits.buyer.some((l) => l.includes("can't be verified")),
    "missing dates disclosed"
  );

  const clean = buildComparison(
    period([{ name: "A", kpiValue: 3 }], { dateRange: { start: "2026-06-01", end: "2026-06-30" } }),
    period([{ name: "A", kpiValue: 2 }], { dateRange: { start: "2026-05-01", end: "2026-05-31" } }),
    fmt
  );
  assert.ok(
    !clean.limits.buyer.some((l) => l.includes("overlap") || l.includes("differ in length") || l.includes("right slots")),
    "sequential equal-length periods draw no sanity warnings"
  );
}

/* ===================== honesty contracts ===================== */

{
  // No causal vocabulary anywhere in generated output — "what changed"
  // never becomes "why it changed".
  const cmp = buildComparison(
    period([
      { name: "A", kpiValue: 3, conversions: 30 },
      { name: "B", kpiValue: 1 },
      { name: "Dup", kpiValue: 2 },
      { name: "Dup", kpiValue: 2 },
      { name: "New", kpiValue: 4 },
    ], { dateRange: { start: "2026-06-10", end: "2026-07-10" } }),
    period([
      { name: "A", kpiValue: 2, conversions: 12 },
      { name: "B", kpiValue: 2 },
      { name: "Old", kpiValue: 6, spend: 400 },
    ], { dateRange: { start: "2026-06-01", end: "2026-06-30" } }),
    fmt
  );
  const causal = /\b(because|caused|causing|due to|driven by|drove|led to|thanks to|resulted in|explains?)\b/i;
  for (const line of allStrings(cmp)) {
    assert.ok(!causal.test(line), `causal vocabulary in comparison output: "${line}"`);
  }
  assert.equal(cmp.caveat, COMPARISON_CAVEAT);
  assert.ok(
    cmp.caveat.includes("does not establish why") && cmp.caveat.includes("never feeds the Next-move"),
    "the caveat separates what from why and states decision isolation"
  );

  // Client register of every two-register field stays jargon-free.
  const banned = ["judged", "median", "spend gate", "benchmark"];
  const clientText = [
    ...cmp.account.client,
    ...cmp.persistence.client,
    ...cmp.limits.client,
  ]
    .join(" ")
    .toLowerCase();
  for (const word of banned) {
    assert.ok(!clientText.includes(word), `client comparison copy must not contain "${word}"`);
  }
}

{
  // compare.ts must stay runtime-import-free except types.ts — no
  // network code, no decision.ts, no memo.ts (the reverse isolation —
  // decision.ts never importing compare — is scanned in decision.test.ts).
  const source = readFileSync(new URL("../modules/debrief/compare.ts", import.meta.url), "utf-8");
  const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    [...new Set(imports)],
    ["./types.ts"],
    "compare.ts imports nothing but types.ts"
  );
}

console.log("compare.test.ts: all assertions passed");
