/**
 * Creative Grouping V1 — pure-logic proofs for
 * modules/debrief/creativeGroups.ts, covering every scenario from the
 * milestone's own Step 7 fixture list. RankedAd fixtures are hand-built
 * (this module takes the complete judged/ranked set — never the
 * truncated winners/losers slices — so a synthetic array proves the
 * denominator contract precisely, independent of any real CSV).
 */
import assert from "node:assert/strict";
import { normalizeGroupLabel, summarizeCreativeGroups, MIN_GROUP_REPETITION } from "../modules/debrief/creativeGroups.ts";
import type { CreativeGroupAssignments, RankedAd } from "../modules/debrief/types.ts";

function mkAd(opts: {
  name: string;
  sourceName?: string;
  id?: string | null;
  deltaFromMedian: number;
  spend?: number;
}): RankedAd {
  return {
    name: opts.name,
    sourceName: opts.sourceName,
    id: opts.id ?? null,
    spend: opts.spend ?? 100,
    kpiValue: 2 + opts.deltaFromMedian,
    nameTags: [],
    conversions: 10,
    gate: "judged",
    deltaFromMedian: opts.deltaFromMedian,
    deltaPct: opts.deltaFromMedian === 0 ? 0 : opts.deltaFromMedian * 10,
  } as RankedAd;
}

/* ===================== 1. No labels -> no output ===================== */
{
  const ads = [mkAd({ name: "A", deltaFromMedian: 1 }), mkAd({ name: "B", deltaFromMedian: -1 })];
  const result = summarizeCreativeGroups(ads, {});
  assert.equal(result, null, "no declared groups -> null, existing behavior preserved");
  console.log("creativeGroups: 1. no labels -> null");
}

/* ===================== 2. One label on one judged ad -> not repeated ===================== */
{
  const ads = [mkAd({ name: "A", deltaFromMedian: 1 }), mkAd({ name: "B", deltaFromMedian: -1 })];
  const declared: CreativeGroupAssignments = { A: ["Morning routine"] };
  const result = summarizeCreativeGroups(ads, declared);
  assert.equal(result, null, "a single-execution label is never reported as repeated evidence");
  console.log("creativeGroups: 2. one label on one ad -> null (not repeated)");
}

/* ===================== 3. One label on 3 judged ads: 2 above, 1 below -> exact tally ===================== */
{
  const ads = [
    mkAd({ name: "A", deltaFromMedian: 1 }),
    mkAd({ name: "B", deltaFromMedian: 2 }),
    mkAd({ name: "C", deltaFromMedian: -1 }),
  ];
  const declared: CreativeGroupAssignments = {
    A: ["Morning routine"],
    B: ["Morning routine"],
    C: ["Morning routine"],
  };
  const result = summarizeCreativeGroups(ads, declared);
  assert.ok(result, "3 judged executions produce a group");
  assert.equal(result!.groups.length, 1);
  const g = result!.groups[0];
  assert.equal(g.label, "Morning routine");
  assert.equal(g.judgedCount, 3, "exact tally: 3 judged");
  assert.equal(g.aboveCount, 2, "exact tally: 2 above");
  assert.equal(g.atCount, 0);
  assert.equal(g.belowCount, 1, "exact tally: 1 below");
  assert.equal(g.members.length, 3, "all three executions reported, not just the two winners");
  console.log("creativeGroups: 3. one label on 3 judged ads -> exact 3/2/0/1 tally");
}

/* ===================== 4. Mixed group stays mixed, no winner classification ===================== */
{
  const ads = [
    mkAd({ name: "A", deltaFromMedian: 1 }),
    mkAd({ name: "B", deltaFromMedian: 2 }),
    mkAd({ name: "C", deltaFromMedian: 0 }),
    mkAd({ name: "D", deltaFromMedian: -1 }),
    mkAd({ name: "E", deltaFromMedian: -2 }),
  ];
  const declared: CreativeGroupAssignments = Object.fromEntries(
    ads.map((a) => [a.name, ["UGC"]])
  );
  const result = summarizeCreativeGroups(ads, declared);
  const g = result!.groups[0];
  assert.equal(g.judgedCount, 5);
  assert.equal(g.aboveCount, 2);
  assert.equal(g.atCount, 1);
  assert.equal(g.belowCount, 2);
  // No field anywhere classifies this group as "winning"/"losing" —
  // the type itself has no such field (structurally enforced), and
  // the object has exactly the tally + members + label keys.
  assert.deepEqual(
    Object.keys(g).sort(),
    ["aboveCount", "atCount", "belowCount", "judgedCount", "label", "members"].sort()
  );
  console.log("creativeGroups: 4. mixed group (2/1/2) stays mixed — no winner/loser field exists");
}

/* ===================== 5. Same ad with multiple labels counts once in each ===================== */
{
  const ads = [
    mkAd({ name: "A", deltaFromMedian: 1 }),
    mkAd({ name: "B", deltaFromMedian: 1 }),
    mkAd({ name: "C", deltaFromMedian: -1 }),
  ];
  const declared: CreativeGroupAssignments = {
    A: ["Morning routine", "UGC"],
    B: ["Morning routine"],
    C: ["UGC"],
  };
  const result = summarizeCreativeGroups(ads, declared);
  assert.equal(result!.groups.length, 2);
  const morning = result!.groups.find((g) => g.label === "Morning routine")!;
  const ugc = result!.groups.find((g) => g.label === "UGC")!;
  assert.equal(morning.judgedCount, 2, "A + B carry Morning routine");
  assert.equal(ugc.judgedCount, 2, "A + C carry UGC");
  assert.ok(morning.members.some((m) => m.name === "A"));
  assert.ok(ugc.members.some((m) => m.name === "A"), "A counts once in each relevant group, independently");
  console.log("creativeGroups: 5. one ad with multiple labels counts once in each group");
}

/* ===================== 6. Whitespace/case-only differences normalize to one group ===================== */
{
  const ads = [
    mkAd({ name: "A", deltaFromMedian: 1 }),
    mkAd({ name: "B", deltaFromMedian: -1 }),
  ];
  const declared: CreativeGroupAssignments = {
    A: ["Morning routine"],
    B: ["  morning   routine  "],
  };
  const result = summarizeCreativeGroups(ads, declared);
  assert.equal(result!.groups.length, 1, "case/whitespace variants normalize into ONE group");
  assert.equal(result!.groups[0].label, "Morning routine", "first-seen display casing wins");
  assert.equal(result!.groups[0].judgedCount, 2);
  assert.equal(normalizeGroupLabel("Morning routine"), normalizeGroupLabel("  morning   routine  "));
  console.log("creativeGroups: 6. whitespace/case-only label variants normalize into one group");
}

/* ===================== 7. Labels on below-spend-gate ads never inflate judged evidence ===================== */
{
  // A set-aside (below spend gate) ad never reaches rankedAds at all —
  // analysis.ts only ranks JUDGED ads. Proving this module honors that
  // by construction: if a caller (correctly) never includes a
  // set-aside ad in rankedAds, its label assignment (even if declared)
  // simply has no effect, since summarizeCreativeGroups never sees it.
  const judgedOnly = [
    mkAd({ name: "A", deltaFromMedian: 1 }),
    mkAd({ name: "B", deltaFromMedian: -1 }),
  ];
  const declared: CreativeGroupAssignments = {
    A: ["Morning routine"],
    B: ["Morning routine"],
    // "SetAsideAd" was declared but is NOT in rankedAds — exactly what
    // analysis.ts guarantees for a below-gate ad.
    SetAsideAd: ["Morning routine"],
  };
  const result = summarizeCreativeGroups(judgedOnly, declared);
  assert.equal(result!.groups[0].judgedCount, 2, "only the 2 judged executions count — the set-aside ad's label is inert");
  console.log("creativeGroups: 7. a label on a below-spend-gate (unjudged) ad never inflates the tally");
}

/* ===================== 8. Duplicate display ad names — each execution takes an INDEPENDENT assignment ===================== */
{
  // extract.ts's Duplicate Identity fix: same-name rows get a
  // disambiguated display name ("Ad X (row N)") and carry the RAW name
  // in sourceName. Creative Grouping V1's corrected identity contract
  // keys assignment by `id ?? name` — the disambiguated, per-row
  // `name` here — NOT by the shared sourceName, so a raw-name-only
  // declaration ("Ad X") deliberately reaches NEITHER duplicate row:
  // two distinct executions that happen to share a raw name must be
  // addressable independently, matching the milestone's own example
  // (raw name "UGC_V1", execution A: Morning routine, execution B:
  // Testimonial).
  const ads = [
    mkAd({ name: "Ad X (row 2)", sourceName: "Ad X", deltaFromMedian: 1 }),
    mkAd({ name: "Ad X (row 5)", sourceName: "Ad X", deltaFromMedian: -1 }),
    mkAd({ name: "Ad Y", deltaFromMedian: 1 }),
  ];
  const staleKeyDeclared: CreativeGroupAssignments = {
    "Ad X": ["Founder story"], // the OLD (buggy) sourceName-shaped key
    "Ad Y": ["Founder story"],
  };
  const staleResult = summarizeCreativeGroups(ads, staleKeyDeclared);
  assert.equal(staleResult, null, "a raw-name key ('Ad X') no longer reaches either duplicate execution — only Ad Y (a non-duplicate, keyed by its own name) would attach, which alone never clears the repetition floor");

  const correctlyKeyed: CreativeGroupAssignments = {
    "Ad X (row 2)": ["Founder story"],
    "Ad X (row 5)": ["Founder story"],
    "Ad Y": ["Founder story"],
  };
  const result = summarizeCreativeGroups(ads, correctlyKeyed);
  const g = result!.groups[0];
  assert.equal(g.judgedCount, 3, "keyed by each execution's own disambiguated name, all three correctly attach");
  const names = g.members.map((m) => m.name).sort();
  assert.deepEqual(names, ["Ad X (row 2)", "Ad X (row 5)", "Ad Y"]);
  console.log("creativeGroups: 8. duplicate display names — a raw-name key no longer collapses both executions; per-execution keys reach each independently");
}

/* ===================== 8a. Two executions sharing a raw name get DIFFERENT groups ===================== */
{
  const ads = [
    mkAd({ name: "UGC_V1 (row 2)", sourceName: "UGC_V1", deltaFromMedian: 2 }),
    mkAd({ name: "UGC_V1 (row 7)", sourceName: "UGC_V1", deltaFromMedian: 1 }),
    // A second execution of each so both groups clear the repetition floor.
    mkAd({ name: "Other morning", deltaFromMedian: 1 }),
    mkAd({ name: "Other testimonial", deltaFromMedian: -1 }),
  ];
  const declared: CreativeGroupAssignments = {
    "UGC_V1 (row 2)": ["Morning routine"],
    "Other morning": ["Morning routine"],
    "UGC_V1 (row 7)": ["Testimonial"],
    "Other testimonial": ["Testimonial"],
  };
  const result = summarizeCreativeGroups(ads, declared);
  assert.equal(result!.groups.length, 2, "the two same-named executions land in two DIFFERENT groups, not one shared group");
  const morning = result!.groups.find((g) => g.label === "Morning routine")!;
  const testimonial = result!.groups.find((g) => g.label === "Testimonial")!;
  assert.ok(morning.members.some((m) => m.name === "UGC_V1 (row 2)"));
  assert.ok(!morning.members.some((m) => m.name === "UGC_V1 (row 7)"), "the OTHER same-named execution never leaks into this group");
  assert.ok(testimonial.members.some((m) => m.name === "UGC_V1 (row 7)"));
  assert.ok(!testimonial.members.some((m) => m.name === "UGC_V1 (row 2)"));
  console.log("creativeGroups: 8a. two executions sharing a raw name independently take different groups; each contributes only to its own");
}

/* ===================== 8b. Same raw name + the SAME group intentionally assigned to both -> counts twice ===================== */
{
  const ads = [
    mkAd({ name: "UGC_V1 (row 2)", sourceName: "UGC_V1", deltaFromMedian: 2 }),
    mkAd({ name: "UGC_V1 (row 7)", sourceName: "UGC_V1", deltaFromMedian: -1 }),
  ];
  const declared: CreativeGroupAssignments = {
    "UGC_V1 (row 2)": ["Morning routine"],
    "UGC_V1 (row 7)": ["Morning routine"],
  };
  const result = summarizeCreativeGroups(ads, declared);
  assert.ok(result, "explicitly assigning the same group to both same-named executions is a legitimate, deliberate choice");
  assert.equal(result!.groups[0].judgedCount, 2, "both executions count — once each — toward the group");
  console.log("creativeGroups: 8b. same raw name, same group deliberately assigned to both -> counts twice, once per execution");
}

/* ===================== 8c. Duplicate-name execution WITHOUT a group is never accidentally included ===================== */
{
  const ads = [
    mkAd({ name: "UGC_V1 (row 2)", sourceName: "UGC_V1", deltaFromMedian: 2 }),
    mkAd({ name: "UGC_V1 (row 7)", sourceName: "UGC_V1", deltaFromMedian: -1 }), // no group declared
    mkAd({ name: "Other morning", deltaFromMedian: 1 }),
  ];
  const declared: CreativeGroupAssignments = {
    "UGC_V1 (row 2)": ["Morning routine"],
    "Other morning": ["Morning routine"],
    // "UGC_V1 (row 7)" intentionally has no entry.
  };
  const result = summarizeCreativeGroups(ads, declared);
  const g = result!.groups[0];
  assert.equal(g.judgedCount, 2, "the undeclared duplicate-name execution is excluded — sharing a raw name with a labeled execution is not itself an assignment");
  assert.ok(!g.members.some((m) => m.name === "UGC_V1 (row 7)"));
  console.log("creativeGroups: 8c. an unlabeled duplicate-name execution never inherits its sibling's group");
}

/* ===================== 8d. Ad ID path: id takes priority over name, even across duplicate-named rows ===================== */
{
  const ads = [
    mkAd({ name: "UGC_V1 (row 2)", sourceName: "UGC_V1", id: "act_111", deltaFromMedian: 2 }),
    mkAd({ name: "UGC_V1 (row 7)", sourceName: "UGC_V1", id: "act_222", deltaFromMedian: -1 }),
    mkAd({ name: "Solo", id: "act_333", deltaFromMedian: 1 }),
  ];
  const declared: CreativeGroupAssignments = {
    act_111: ["Morning routine"],
    act_333: ["Morning routine"],
    // act_222 (the second duplicate-named execution) undeclared.
  };
  const result = summarizeCreativeGroups(ads, declared);
  const g = result!.groups[0];
  assert.equal(g.judgedCount, 2, "assignment keyed by Ad ID reaches exactly the two declared executions");
  const names = g.members.map((m) => m.name).sort();
  assert.deepEqual(names, ["Solo", "UGC_V1 (row 2)"], "the id-keyed declaration resolves to the correct row despite both rows sharing a raw name");
  console.log("creativeGroups: 8d. Ad ID path — assignment keyed by id correctly disambiguates same-named rows without relying on row-N suffixing");
}

/* ===================== 8e. Fallback path: no id anywhere -> name-keyed assignment still works ===================== */
{
  const ads = [
    mkAd({ name: "Plain A", deltaFromMedian: 1 }),
    mkAd({ name: "Plain B", deltaFromMedian: -1 }),
  ];
  const declared: CreativeGroupAssignments = { "Plain A": ["G"], "Plain B": ["G"] };
  const result = summarizeCreativeGroups(ads, declared);
  assert.equal(result!.groups[0].judgedCount, 2, "with no Ad IDs present anywhere, the name fallback still resolves both executions correctly");
  console.log("creativeGroups: 8e. fallback path — name-keyed assignment works end to end when no ad carries an id");
}

/* ===================== 9. Missing KPI / unjudged execution never accidentally included ===================== */
{
  // Same principle as scenario 7, stated for the "unjudged" case
  // generally (missing KPI value -> analysis.ts excludes it from
  // rankedAds entirely) — this module has no way to accidentally
  // include an ad it was never given.
  const ads = [mkAd({ name: "A", deltaFromMedian: 1 }), mkAd({ name: "B", deltaFromMedian: -1 })];
  const declared: CreativeGroupAssignments = {
    A: ["Testimonial"],
    B: ["Testimonial"],
    UnjudgedAd: ["Testimonial"], // never in rankedAds — missing KPI value upstream
  };
  const result = summarizeCreativeGroups(ads, declared);
  assert.equal(result!.groups[0].judgedCount, 2, "an execution never in rankedAds can never be counted, regardless of a stray label entry");
  console.log("creativeGroups: 9. an unjudged/missing-KPI execution is never accidentally included");
}

/* ===================== 10. Sort order: judged count descending, then label alphabetically ===================== */
{
  const ads = [
    mkAd({ name: "A", deltaFromMedian: 1 }),
    mkAd({ name: "B", deltaFromMedian: 1 }),
    mkAd({ name: "C", deltaFromMedian: 1 }),
    mkAd({ name: "D", deltaFromMedian: 1 }),
    mkAd({ name: "E", deltaFromMedian: 1 }),
  ];
  const declared: CreativeGroupAssignments = {
    A: ["Zebra", "Two"],
    B: ["Zebra", "Two"],
    C: ["Apple"],
    D: ["Apple"],
    E: ["Apple"],
  };
  const result = summarizeCreativeGroups(ads, declared);
  assert.deepEqual(
    result!.groups.map((g) => g.label),
    ["Apple", "Two", "Zebra"],
    "Apple (3 judged) sorts first by count; Two/Zebra (2 judged each) tie-break alphabetically by normalized label"
  );
  console.log("creativeGroups: 10. deterministic sort — judged count desc, then normalized label alphabetically");
}

/* ===================== Additional: repetition threshold is exactly MIN_GROUP_REPETITION ===================== */
{
  assert.equal(MIN_GROUP_REPETITION, 2, "the repetition floor is 2 — not a confidence/strength threshold");
  console.log("creativeGroups: MIN_GROUP_REPETITION is 2, documented as a floor not a confidence bar");
}

/* ===================== Additional: blank/whitespace-only labels are never a group ===================== */
{
  const ads = [mkAd({ name: "A", deltaFromMedian: 1 }), mkAd({ name: "B", deltaFromMedian: -1 })];
  const declared: CreativeGroupAssignments = { A: ["   "], B: [""] };
  const result = summarizeCreativeGroups(ads, declared);
  assert.equal(result, null, "blank/whitespace-only labels never form a group");
  console.log("creativeGroups: blank/whitespace-only labels are ignored");
}

/* ===================== Additional: members sorted best-to-worst within a group ===================== */
{
  const ads = [
    mkAd({ name: "Worst", deltaFromMedian: -3 }),
    mkAd({ name: "Best", deltaFromMedian: 3 }),
    mkAd({ name: "Mid", deltaFromMedian: 1 }),
  ];
  const declared: CreativeGroupAssignments = { Worst: ["G"], Best: ["G"], Mid: ["G"] };
  const result = summarizeCreativeGroups(ads, declared);
  assert.deepEqual(
    result!.groups[0].members.map((m) => m.name),
    ["Best", "Mid", "Worst"],
    "members are sorted best-to-worst by deltaFromMedian, matching winners' own sort convention"
  );
  console.log("creativeGroups: group members sort best-to-worst");
}

/* ===================== Additional: evidence-honesty limits are always present, never per-group ===================== */
{
  const ads = [mkAd({ name: "A", deltaFromMedian: 1 }), mkAd({ name: "B", deltaFromMedian: -1 })];
  const declared: CreativeGroupAssignments = { A: ["G"], B: ["G"] };
  const result = summarizeCreativeGroups(ads, declared);
  assert.ok(result!.limits.buyer.length > 0);
  assert.ok(result!.limits.client.length > 0);
  // The caveat legitimately contains "caused" inside a negation
  // ("doesn't establish that... caused"), matching decision.ts's own
  // established buildLimits pattern — check for AFFIRMATIVE causal
  // claims instead of the bare word.
  assert.ok(!/\bproves\b|winning (angle|concept|group)/i.test(result!.limits.buyer), "no affirmative causal claim in the buyer caveat");
  assert.ok(!/\bproves\b|winning (angle|concept|group)/i.test(result!.limits.client), "no affirmative causal claim in the client caveat");
  assert.match(result!.limits.buyer, /doesn't establish|does not establish/i, "the caveat explicitly disclaims causation, matching decision.ts's own buildLimits phrasing convention");
  // One shared limits object, not one per group.
  assert.ok(!("limits" in result!.groups[0]));
  console.log("creativeGroups: evidence-honesty limits present once, no causal language, never per-group");
}

/* ===================== Additional: no causal wording anywhere in a group object ===================== */
{
  const ads = [mkAd({ name: "A", deltaFromMedian: 1 }), mkAd({ name: "B", deltaFromMedian: -1 })];
  const declared: CreativeGroupAssignments = { A: ["Founder story"], B: ["Founder story"] };
  const result = summarizeCreativeGroups(ads, declared);
  // Only the per-group data (numbers, names, the label) — NOT `limits`,
  // which legitimately discusses causation in order to disclaim it.
  const serializedGroups = JSON.stringify(result!.groups);
  assert.ok(
    !/winning|caused|proves|strongest|best angle/i.test(serializedGroups),
    "no causal/superlative vocabulary anywhere in the per-group data itself"
  );
  console.log("creativeGroups: no causal/superlative vocabulary in the per-group data");
}

console.log("creativeGroups: all assertions passed");
