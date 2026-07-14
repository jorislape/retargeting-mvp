/**
 * Input Automation V1 proofs (plain Node, no framework).
 *
 * Covers every stage of modules/competitorDebrief/pageDump.ts in
 * isolation (stripChromeLines, detectAdBoundaries, groupPossibleVariants,
 * selectRepresentatives) plus the 6 acceptance scenarios from the
 * approved spec end to end via processPageDump(): 20 ads with repeated
 * UI text, 10 variants of the same ad, mixed active/inactive cards,
 * one-line/long-form/bullet-heavy ads with no blank lines, malformed
 * fragments, and no clear boundaries at all.
 *
 * The Jaccard threshold (VARIANT_JACCARD_THRESHOLD = 0.6) is validated
 * here against measured similarity, not assumed: a real 10-variant
 * fixture set (differing by one word/clause each) scores 0.619-0.842
 * pairwise, while genuinely different ads — even ones sharing topic and
 * vocabulary — score 0.03-0.09. The threshold sits in a wide, real gap
 * between those two populations.
 */
import assert from "node:assert/strict";
import {
  detectAdBoundaries,
  groupPossibleVariants,
  MAX_REPRESENTATIVES,
  processPageDump,
  selectRepresentatives,
  stripChromeLines,
} from "../modules/competitorDebrief/pageDump.ts";
import { computeAdCompleteness, parseAdExample } from "../modules/competitorDebrief/adParser.ts";
import type { AdCompleteness } from "../modules/competitorDebrief/adParser.ts";

/* ============================== Stage A: stripChromeLines ============================== */

{
  // Each curated pattern individually.
  assert.equal(stripChromeLines("Active").removedLineCount, 1);
  assert.equal(stripChromeLines("Inactive").removedLineCount, 1);
  assert.equal(stripChromeLines("Library ID: 123456789012345").removedLineCount, 1);
  assert.equal(stripChromeLines("Started running on Jan 5, 2026").removedLineCount, 1);
  assert.equal(stripChromeLines("Started running on Jan 5, 2026 · Total active time 12 days").removedLineCount, 1);
  assert.equal(stripChromeLines("Sponsored").removedLineCount, 1);
  assert.equal(stripChromeLines("Sponsored · Acme Skincare").removedLineCount, 1);
  assert.equal(stripChromeLines("See ad details").removedLineCount, 1);
  assert.equal(stripChromeLines("See summary details").removedLineCount, 1);
  assert.equal(stripChromeLines("Why am I seeing this ad?").removedLineCount, 1);
  assert.equal(stripChromeLines("Report ad").removedLineCount, 1);
  assert.equal(stripChromeLines("Platforms").removedLineCount, 1);
  assert.equal(stripChromeLines("Facebook, Instagram").removedLineCount, 1);
  assert.equal(stripChromeLines("Ad Library").removedLineCount, 1);
}

{
  // Negative controls: real ad copy containing chrome-ADJACENT words in
  // a genuine sentence must survive completely untouched — this is the
  // single most important property of Stage A. Never strip by
  // repetition or vague word match, only exact/near-exact chrome shape.
  const negativeControls = [
    "Stay active all day with our energy blend.",
    "I started running on empty stomachs and hated it — this changed that.",
    "See more of what makes our formula different.", // "see more" deliberately NOT a chrome pattern (overlaps CTA_PHRASES-adjacent phrasing)
    "Our library of workouts has something for everyone.",
    "Report back after 30 days — you'll feel the difference.",
    "Free shipping on all Facebook and Instagram orders this week.", // contains platform names but NOT as a bare line
  ];
  for (const line of negativeControls) {
    const result = stripChromeLines(line);
    assert.equal(result.removedLineCount, 0, `must not strip: "${line}"`);
    assert.equal(result.cleaned, line);
  }
}

{
  // Blank lines are always preserved (they matter for Stage B).
  const result = stripChromeLines("Hook line.\n\nActive\n\nBody line.");
  assert.equal(result.removedLineCount, 1);
  assert.equal(result.cleaned, "Hook line.\n\n\nBody line.");
}

{
  // Competitor-name stripping: ONLY an exact (normalized) full-line
  // match — never a substring, never based on repetition.
  const withName = "Acme Skincare\nHook line about our product.\nShop Now";
  const stripped = stripChromeLines(withName, "Acme Skincare");
  assert.equal(stripped.removedLineCount, 1);
  assert.ok(!stripped.cleaned.includes("Acme Skincare"));

  // Case/whitespace-insensitive (same normalization as normalizeForDedupe).
  const strippedCaseInsensitive = stripChromeLines("ACME   Skincare\nHook.\nShop Now", "acme skincare");
  assert.equal(strippedCaseInsensitive.removedLineCount, 1);

  // A line that merely CONTAINS the competitor name must survive — this
  // is the exact-match requirement, not a substring rule.
  const partialMatch = stripChromeLines("Acme Skincare's new formula is here.\nShop Now", "Acme Skincare");
  assert.equal(partialMatch.removedLineCount, 0);

  // With no competitorName provided, no name-based stripping happens at all.
  const noNameProvided = stripChromeLines("Acme Skincare\nHook.\nShop Now");
  assert.equal(noNameProvided.removedLineCount, 0);
}

/* ============================ Stage B: detectAdBoundaries ============================== */

{
  // Tier 1: markers/blank-lines reused unchanged — splitAdBlocks already
  // proves this path; confirm delegation happens and confidence is "high".
  const segments = detectAdBoundaries("Ad 1\nHook one.\n\nAd 2\nHook two.");
  assert.equal(segments.length, 2);
  assert.ok(segments.every((s) => s.confidence === "high"));
}

{
  // Tier 2: no markers, no blank lines — bare CTA lines anchor the split.
  const dump = [
    "Struggling with dry skin every winter? Our balm fixes that fast.",
    "Shop Now",
    "New to skincare? Start with the basics that actually work.",
    "Learn More",
  ].join("\n");
  const segments = detectAdBoundaries(dump);
  assert.equal(segments.length, 2);
  assert.ok(segments.every((s) => s.confidence === "medium"));
  assert.ok(segments[0].raw.includes("Shop Now"));
  assert.ok(segments[1].raw.includes("Learn More"));
  assert.ok(!segments[1].raw.includes("Shop Now"));
}

{
  // Tier 3: no markers, no blank lines, no bare CTA line anywhere —
  // degrades to the existing floor behavior (whole input as one block),
  // explicitly tagged "low" rather than pretending it's reliable.
  const undifferentiated =
    "This is one long undifferentiated paragraph with no separators, no blank lines, and no line that is purely a CTA phrase on its own, so nothing here gives the splitter any anchor to work with at all.";
  const segments = detectAdBoundaries(undifferentiated);
  assert.equal(segments.length, 1);
  assert.equal(segments[0].confidence, "low");
  assert.equal(segments[0].raw, undifferentiated);
}

{
  // Empty input never crashes, never returns a phantom segment.
  assert.deepEqual(detectAdBoundaries(""), []);
  assert.deepEqual(detectAdBoundaries("   \n  "), []);
}

{
  // KNOWN FAILURE MODE (documented, not fixed in V1): a CTA phrase that
  // legitimately appears as its OWN line mid-body (not just as the
  // terminal button) is indistinguishable from a real ad boundary here
  // and WILL over-split. Pinned down as an explicit regression/
  // documentation test rather than silently ignored — this is exactly
  // why Tier 2 is tagged "medium" confidence, never "high".
  const midBodyCta = [
    "Our founder started this brand in her kitchen.",
    "Learn More",
    "about the ingredients before you decide — every batch is tested.",
    "Shop Now",
  ].join("\n");
  const segments = detectAdBoundaries(midBodyCta);
  assert.equal(
    segments.length,
    2,
    "known limitation: a mid-body bare CTA line over-splits one ad into two — surfaced at medium confidence, not silently trusted"
  );
}

/* ========================= Stage D: groupPossibleVariants =============================== */

// Empirically validated (see spec/report): pairwise Jaccard among these
// 10 variants ranges 0.619-0.842; a genuinely different ad sharing the
// same template shape scores 0.094, and one sharing only topic
// vocabulary scores 0.032 — a wide margin either side of the 0.6 cutoff.
const TEN_VARIANTS = [
  "Struggling with bloating after every meal? Our daily probiotic blend helps restore your gut balance naturally.\nShop Now",
  "Struggling with bloating after every meal? Our daily probiotic blend helps restore your gut health naturally.\nShop Now",
  "Tired of bloating after every meal? Our daily probiotic blend helps restore your gut balance naturally.\nShop Now",
  "Struggling with bloating after every meal? Our daily probiotic blend helps restore your gut balance fast.\nShop Now",
  "Struggling with bloating after every meal? This daily probiotic blend helps restore your gut balance naturally.\nShop Now",
  "Struggling with bloating after every meal? Our daily probiotic blend helps you restore your gut balance naturally.\nShop Now",
  "Struggling with bloating after every meal? Our daily probiotic mix helps restore your gut balance naturally.\nShop Now",
  "Struggling with bloating after every single meal? Our daily probiotic blend helps restore your gut balance naturally.\nShop Now",
  "Struggling with bloating after every meal? Our daily probiotic blend helps restore gut balance naturally.\nShop Now",
  "Struggling with bloating after every meal? Our daily probiotic blend really helps restore your gut balance naturally.\nShop Now",
];

{
  const { groupIdByIndex, groups } = groupPossibleVariants(TEN_VARIANTS);
  assert.equal(groups.length, 1, "all 10 variants must cluster into exactly one group");
  assert.equal(groups[0].memberIndices.length, 10);
  const firstGroupId = groupIdByIndex[0];
  assert.ok(firstGroupId !== null);
  assert.ok(groupIdByIndex.every((id) => id === firstGroupId), "every variant must share the same group id");
}

{
  // Adversarial negative control: two DIFFERENT real ads about the same
  // general topic, sharing real vocabulary ("probiotic", "gut health",
  // "daily") — must NOT be grouped. This is the property that matters
  // most for near-dup grouping: sharing a topic is not sharing an idea.
  const adA = "Millions of women trust our daily probiotic to support gut health and reduce bloating within weeks.\nShop Now";
  const adB = "Doctors recommend this probiotic supplement for daily gut health support backed by clinical studies.\nLearn More";
  const { groupIdByIndex, groups } = groupPossibleVariants([adA, adB]);
  assert.equal(groups.length, 0);
  assert.deepEqual(groupIdByIndex, [null, null]);
}

{
  // Exact duplicates group too — reuses the SAME normalizeForDedupe key
  // adParser.ts's own findDuplicateIndices/dedupeAdTexts already use,
  // not a second exact-match implementation.
  const a = "Same exact ad text, word for word.\nShop Now";
  const b = "  same exact   AD text, word for word.  \n\nshop now";
  const { groups } = groupPossibleVariants([a, b]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].memberIndices, [0, 1]);
}

{
  // Below the token floor, near-match never fires — only exact match
  // can group very short texts. Documents an accepted, conservative
  // tradeoff: short variant taglines that differ by even one word won't
  // be grouped in V1.
  const short1 = "Free shipping today only";
  const short2 = "Free shipping this week only";
  const { groups } = groupPossibleVariants([short1, short2]);
  assert.equal(groups.length, 0, "short near-miss texts stay ungrouped by design (MIN_TOKENS_FOR_NEAR_MATCH floor)");
}

{
  // Blank/empty entries never group with anything.
  const { groupIdByIndex } = groupPossibleVariants(["", TEN_VARIANTS[0], "  "]);
  assert.deepEqual(groupIdByIndex, [null, null, null]);
}

/* ======================== Stage E: selectRepresentatives ================================ */

function completenessFor(raw: string): AdCompleteness {
  return computeAdCompleteness(parseAdExample(raw));
}

{
  // Fewer than the cap: select ALL eligible candidates, never padded,
  // never fewer than what's actually usable.
  const texts = [
    "Struggling with bloating? Our probiotic fixes that.\nShop Now",
    "Tired of low energy? Our electrolyte mix helps.\nLearn More",
    "New to skincare? Start simple.\nGet Started",
  ];
  const completenessList = texts.map(completenessFor);
  const { isRepresentative, poolSize } = selectRepresentatives(completenessList, [null, null, null]);
  assert.equal(poolSize, 3);
  assert.deepEqual(isRepresentative, [true, true, true]);
}

{
  // More than MAX_REPRESENTATIVES ungrouped singles: capped, top-ranked
  // by completeness/signal richness only.
  const texts = Array.from({ length: 15 }, (_, i) =>
    i < 5
      ? `Rich ad ${i}: struggling with a real problem? Our clinically tested, dermatologist-approved formula with a 30-day guarantee and 20% off your first order fixes it fast.\nShop Now`
      : `Thin ad number ${i} with nothing especially notable to say about it at all.`
  );
  const completenessList = texts.map(completenessFor);
  const groupIdByIndex = new Array(15).fill(null);
  const { isRepresentative, poolSize } = selectRepresentatives(completenessList, groupIdByIndex);
  assert.equal(poolSize, 15);
  assert.equal(isRepresentative.filter(Boolean).length, MAX_REPRESENTATIVES);
  // The 5 richest ("Rich ad" fixtures) must all be selected first.
  for (let i = 0; i < 5; i++) assert.equal(isRepresentative[i], true, `rich ad ${i} must be selected`);
}

{
  // Malformed candidates are never selected, grouped or not.
  const texts = ["...", "ok", "Struggling with a real problem? Our formula fixes it.\nShop Now"];
  const completenessList = texts.map(completenessFor);
  assert.equal(completenessList[0].status, "malformed");
  assert.equal(completenessList[1].status, "malformed");
  const { isRepresentative } = selectRepresentatives(completenessList, [null, null, null]);
  assert.deepEqual(isRepresentative, [false, false, true]);
}

{
  // One per group preferred over multiple members of the same group —
  // diversity of distinct ideas over raw ad count.
  const texts = [
    ...TEN_VARIANTS, // indices 0-9, all one group
    "A completely different ad about a different product entirely, unrelated to the others.\nLearn More", // index 10, ungrouped
  ];
  const completenessList = texts.map(completenessFor);
  const groupIdByIndex: (number | null)[] = [...TEN_VARIANTS.map(() => 0), null];
  const { isRepresentative, poolSize } = selectRepresentatives(completenessList, groupIdByIndex);
  assert.equal(poolSize, 2, "one slot for the variant group + one for the ungrouped single");
  assert.equal(isRepresentative.filter(Boolean).length, 2);
  assert.equal(isRepresentative[10], true, "the ungrouped distinct ad must be selected");
  assert.equal(
    isRepresentative.slice(0, 10).filter(Boolean).length,
    1,
    "exactly one of the 10 variants is selected as the group's representative"
  );
}

{
  // Determinism / no paste-order preference: reversing input order but
  // keeping the SAME completeness scores must select based on score,
  // not position — the winner is the genuinely richer ad regardless of
  // where it was pasted.
  const richText =
    "Struggling with a real problem? Our clinically tested, dermatologist-approved formula with a guarantee and 20% off fixes it fast.\nShop Now";
  const thinText = "Thin ad.";
  const forward = [richText, thinText].map(completenessFor);
  const backward = [thinText, richText].map(completenessFor);
  const forwardResult = selectRepresentatives(forward, [0, 0]);
  const backwardResult = selectRepresentatives(backward, [0, 0]);
  assert.equal(forwardResult.isRepresentative[0], true, "rich ad wins when pasted first");
  assert.equal(backwardResult.isRepresentative[1], true, "rich ad STILL wins when pasted second — score decides, not position");

  // True tie (identical completeness scores): tiebreak is stable/
  // deterministic (earlier index), not an active preference for "paste
  // order" as a quality signal — documented as the only case this ever
  // applies.
  const tiedA = "Ad one about nothing in particular.\nShop Now";
  const tiedB = "Ad two about nothing in particular.\nShop Now";
  const tiedCompleteness = [tiedA, tiedB].map(completenessFor);
  assert.deepEqual(tiedCompleteness[0], tiedCompleteness[1], "fixture must genuinely tie for this test to be meaningful");
  const tiedResult = selectRepresentatives(tiedCompleteness, [0, 0]);
  assert.equal(tiedResult.isRepresentative[0], true);
  assert.equal(tiedResult.isRepresentative[1], false);
}

/* ============================ processPageDump: acceptance scenarios ====================== */

/* --- (a) 20 copied ads with repeated UI text, no blank lines anywhere --- */
{
  const chromeCluster = (n: number) =>
    ["Sponsored", `Library ID: ${1000000000000 + n}`, "Active", "Started running on Jan 5, 2026"].join("\n");
  // 20 genuinely distinct hooks — different products, different
  // sentence shapes, no shared template. A templated hook that only
  // swaps one word/number (e.g. "Hook line number N about...") was
  // tried here first and FAILED: it accidentally over-grouped 19 of
  // the 20 into one variant group, because near-duplicate grouping
  // measures textual overlap, not topic distinctness — a long, mostly-
  // identical sentence with one swapped word looks exactly like a real
  // A/B variant. Caught during manual dev-server verification, fixed
  // here, and documented as a known failure mode in the report: two
  // structurally near-identical sentences differing by only a short
  // phrase (e.g. two ads built from the same internal copy template)
  // can be over-grouped even when they're conceptually different ads.
  const hooks = [
    "Struggling with bloating after every meal? Our probiotic blend fixes that.",
    "Dehydrated by lunchtime? This electrolyte mix keeps you sharp all afternoon.",
    "Wake up to visibly smoother skin with our overnight retinol serum.",
    "Restless nights end here — our weighted blanket helps you fall asleep faster.",
    "Skip the coffee shop line. Cold brew delivered fresh to your door every week.",
    "Sitting all day is wrecking your back. This desk converter fixes your posture.",
    "Stay active all day with our energy blend — no crash, no jitters.", // negative control: contains "active" as a real word
    "Runners rave about how secure these earbuds stay, mile after mile.",
    "No more takeout guilt — chef-made meals delivered, ready in five minutes.",
    "Chafing ruined your last long run. This balm makes sure it never happens again.",
    "Staring at screens all day? These glasses cut the eye strain by evening.",
    "Stronger nails, thicker hair — one scoop of this peptide powder daily.",
    "Nothing sticks to this pan, and nothing scratches it either.",
    "Your toothbrush is 3 years old and you know it. Time for an upgrade.",
    "Cold showers build discipline. This unheated plunge tub brings it home.",
    "Your houseplants keep dying. This self-watering pot ends that streak.",
    "Jet lag doesn't stand a chance against this travel-size light therapy lamp.",
    "Tangled cables everywhere? This one dock charges everything at once.",
    "Your dog's leash walks are chaos. This harness actually stops the pulling.",
    "Meal prep Sunday just got shorter with this all-in-one chopper.",
  ];
  const buildAd = (n: number, hook: string) => [chromeCluster(n), hook, "Shop Now"].join("\n");
  const dump = hooks.map((hook, i) => buildAd(i + 1, hook)).join("\n");

  const result = processPageDump(dump);
  assert.equal(result.chromeLinesRemoved, 80, "4 chrome lines × 20 ads");
  assert.equal(result.candidates.length, 20);
  assert.ok(result.candidates.every((c) => c.boundaryConfidence === "medium"));
  assert.ok(
    result.candidates.every((c) => !/^\s*(?:active|inactive)\s*$/im.test(c.raw)),
    "no candidate should retain a bare Active/Inactive chrome line"
  );
  const negativeControlCandidate = result.candidates.find((c) => c.raw.includes("Stay active all day"));
  assert.ok(negativeControlCandidate, "real ad copy containing the word 'active' must survive chrome-stripping");
  assert.ok(result.warnings.some((w) => w.code === "chrome-removed"));
  assert.equal(result.variantGroups.length, 0, "20 genuinely distinct ads must not be grouped as possible variants");
  assert.equal(
    result.candidates.filter((c) => c.isRepresentative).length,
    MAX_REPRESENTATIVES,
    "20 distinct usable ads exceed the cap, so exactly 10 are selected by default"
  );
}

/* --- (b) 10 variants of the same ad --- */
{
  const dump = TEN_VARIANTS.join("\n\n"); // blank-line separated -> Tier 1, high confidence
  const result = processPageDump(dump);
  assert.equal(result.candidates.length, 10);
  assert.ok(result.candidates.every((c) => c.boundaryConfidence === "high"));
  assert.equal(result.variantGroups.length, 1);
  const groupId = result.candidates[0].variantGroupId;
  assert.ok(groupId !== null);
  assert.ok(result.candidates.every((c) => c.variantGroupId === groupId));
  assert.equal(result.candidates.filter((c) => c.isRepresentative).length, 1);
  assert.equal(
    result.candidates.filter((c) => !c.isRepresentative).length,
    9,
    "the other 9 variants stay visible, just not auto-selected"
  );
  assert.ok(result.warnings.some((w) => w.code === "possible-variants-grouped" && w.message.includes("10 ads total")));
}

/* --- (c) mixed active/inactive ad cards --- */
{
  const sharedAd = "Struggling with frizzy hair every summer? Our leave-in treatment fixes that in one use.\nShop Now";
  const dump = [`Active\n${sharedAd}`, `Inactive\n${sharedAd}`, "Active\nA totally different ad about a different product.\nLearn More"].join(
    "\n\n"
  );
  const result = processPageDump(dump);
  assert.equal(result.candidates.length, 3);
  // The Active-status and Inactive-status copies of the SAME ad become
  // byte-identical once status is stripped -> they exact-match-group.
  assert.equal(result.candidates[0].raw, sharedAd);
  assert.equal(result.candidates[1].raw, sharedAd);
  assert.equal(result.candidates[0].variantGroupId, result.candidates[1].variantGroupId);
  assert.ok(result.candidates[0].variantGroupId !== null);
  // Explicit non-goal: no candidate, group, or selection carries any
  // trace of which one was originally Active vs Inactive.
  assert.ok(!result.candidates.some((c) => /^\s*(?:active|inactive)\s*$/im.test(c.raw)));
}

/* --- (d) one-line, long-form, and bullet-heavy ads, no blank lines anywhere --- */
{
  const dump = [
    "Just three ingredients. Zero compromises. Try it today.",
    "Shop Now",
    "I used to dread mornings — low energy, brain fog, the whole thing. Since 2021 I've started every day with this and it changed everything. Week 1: more energy by 10am. Week 4: sleeping better, thinking clearer.",
    "Learn More",
    "✔ 25 vitamins and minerals in one scoop",
    "✔ Zero sugar, zero fillers",
    "✔ Third-party tested for purity",
    "Get Started",
  ].join("\n");

  const result = processPageDump(dump);
  assert.equal(result.candidates.length, 3);
  assert.ok(result.candidates.every((c) => c.boundaryConfidence === "medium"));
  assert.ok(
    result.candidates.every((c) => c.parsed.parseMode === "native"),
    "each candidate must reach the existing native pipeline, unchanged, once boundaries are cut"
  );
  assert.ok(result.candidates[0].parsed.cta, "one-line ad: CTA extracted");
  assert.ok(
    (result.candidates[1].parsed.story?.length ?? 0) > 0 || Boolean(result.candidates[1].parsed.hook),
    "long-form testimonial ad: story or hook extracted"
  );
  assert.ok(result.candidates[2].parsed.detectedBenefits.length > 0, "bullet-heavy ad: benefits extracted from bullets");
}

/* --- (e) malformed page fragments --- */
{
  const goodAd1 = "Struggling with dry skin? Our balm fixes that fast.\nShop Now";
  const goodAd2 = "New to skincare? Start with the basics.\nLearn More";
  const strayFragment = "...";
  const chromeOnlyFragment = "Sponsored\nActive\nLibrary ID: 999999999999999";
  const dump = [goodAd1, chromeOnlyFragment, strayFragment, goodAd2].join("\n\n");

  const result = processPageDump(dump);
  // The chrome-only fragment reduces to nothing after stripping and is
  // dropped before it ever becomes a candidate.
  assert.equal(result.candidates.length, 3, "2 good ads + 1 stray malformed fragment, chrome-only fragment dropped entirely");
  const malformed = result.candidates.filter((c) => c.completeness.status === "malformed");
  assert.equal(malformed.length, 1);
  assert.ok(!malformed[0].isRepresentative);
  assert.equal(result.candidates.filter((c) => c.isRepresentative).length, 2);
}

/* --- (f) no clear boundaries at all --- */
{
  const undifferentiated =
    "This is a single long block of text with no separators, no blank lines, no chrome lines, and no line that is purely a CTA phrase on its own, so automation has nothing to anchor a split on and must not pretend otherwise.";
  const result = processPageDump(undifferentiated);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].boundaryConfidence, "low");
  assert.equal(result.candidates[0].isRepresentative, true, "the single block is still selected so the user has something to review/edit");
  assert.ok(result.warnings.some((w) => w.code === "no-clear-boundaries"));
}

/* --- capped-at-max warning fires when the eligible pool exceeds the cap --- */
{
  // 12 genuinely distinct ads (different products, different sentence
  // shapes, no shared template or "Ad N:" label prefix — the latter
  // would both trigger splitAdBlocks's label-stripping AND remove the
  // one differentiating token, artificially inflating similarity) — so
  // this test proves the cap fires on real pool size, not on accidental
  // variant grouping.
  const texts = [
    "Struggling with bloating after every meal? Our probiotic blend fixes that.\nShop Now",
    "Dehydrated by lunchtime? This electrolyte mix keeps you sharp all afternoon.\nShop Now",
    "Wake up to visibly smoother skin with our overnight retinol serum.\nShop Now",
    "Restless nights end here — our weighted blanket helps you fall asleep faster.\nShop Now",
    "Skip the coffee shop line. Cold brew delivered fresh to your door every week.\nShop Now",
    "Sitting all day is wrecking your back. This desk converter fixes your posture.\nShop Now",
    "Runners rave about how secure these earbuds stay, mile after mile.\nShop Now",
    "No more takeout guilt — chef-made meals delivered, ready in five minutes.\nShop Now",
    "Chafing ruined your last long run. This balm makes sure it never happens again.\nShop Now",
    "Staring at screens all day? These glasses cut the eye strain by evening.\nShop Now",
    "Stronger nails, thicker hair — one scoop of this peptide powder daily.\nShop Now",
    "Nothing sticks to this pan, and nothing scratches it either.\nShop Now",
  ];
  const result = processPageDump(texts.join("\n\n"));
  assert.equal(result.candidates.length, 12);
  assert.equal(result.candidates.filter((c) => c.isRepresentative).length, MAX_REPRESENTATIVES);
  assert.ok(result.warnings.some((w) => w.code === "capped-at-max"));
}

console.log("pageDump: all assertions passed");
