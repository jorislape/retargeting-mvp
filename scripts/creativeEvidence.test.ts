/**
 * Creative Evidence V1 — plain-Node proofs for
 * components/debrief/creativeEvidence.ts plus the milestone's two
 * structural contracts:
 *
 *  1. Spotlight selection is a pure function of PERFORMANCE/COMPARISON
 *     evidence — the module cannot see creative assets at all (source
 *     scan), so an attached image can never change which ads are
 *     spotlighted.
 *  2. The engine (modules/debrief) is completely unaware of creative
 *     assets — no image, object-URL, thumbnail, or asset identifier
 *     appears anywhere in it (source scan), so image presence cannot
 *     change analysis, decision, memo claims, or evidence state by
 *     construction.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

import {
  CREATIVE_EVIDENCE_CAVEAT,
  findAmbiguousAdNames,
  normalizeAdName,
  selectSpotlights,
  SPOTLIGHT_ROLE_LABELS,
  type SpotlightSource,
} from "../components/debrief/creativeEvidence.ts";
import type { MemoWinnerLoserRow } from "../modules/debrief/types.ts";

function row(name: string, valueLabel = "4.62× ROAS", vsMedianLabel = "+100% vs median", spendLabel = "$428.60"): MemoWinnerLoserRow {
  return { name, valueLabel, vsMedianLabel, spendLabel, reason: "Metrics only — angle unknown." };
}

function source(overrides: Partial<SpotlightSource> = {}): SpotlightSource {
  return {
    kpiLabel: "ROAS",
    adsJudged: 11,
    winners: [],
    loserRows: [],
    comparison: null,
    ...overrides,
  };
}

/* ===================== identity helpers ===================== */

{
  assert.equal(normalizeAdName("  UGC_Morning  Routine_V1  "), "UGC_Morning Routine_V1");
  assert.equal(normalizeAdName("plain"), "plain");
  // Case-sensitive on purpose — never fuzzy.
  assert.notEqual(normalizeAdName("Ad A"), normalizeAdName("ad a"));

  const ambiguous = findAmbiguousAdNames(["A", "B", " A ", "C", "C", "C", ""]);
  assert.deepEqual([...ambiguous].sort(), ["A", "C"], "whitespace-variant duplicates detected; blanks ignored");
  assert.equal(findAmbiguousAdNames(["A", "B"]).size, 0);
}

/* ===================== spotlight selection ===================== */

{
  // Top + worst from winners[0]/losers[0]; no comparison → no mover.
  const spots = selectSpotlights(
    source({
      winners: [row("Winner"), row("Second")],
      loserRows: [row("Loser", "0.62× ROAS", "-73% vs median", "$198.20"), row("AlsoBad")],
    })
  );
  assert.equal(spots.length, 2);
  assert.deepEqual(spots.map((s) => s.role), ["top", "worst"]);
  assert.equal(spots[0].adName, "Winner");
  assert.equal(spots[1].adName, "Loser");
  assert.ok(spots[0].takeaway.buyer.includes("Best ROAS of the 11 ads judged"), "top takeaway restates ranking facts only");
  assert.ok(spots[1].takeaway.client.includes("weakest ROAS result"), "worst client takeaway is jargon-free ranking talk");

  // Empty memo → no spotlights (strip renders nothing downstream).
  assert.deepEqual(selectSpotlights(source()), []);

  // Winner-only and loser-only shapes.
  assert.deepEqual(selectSpotlights(source({ winners: [row("W")] })).map((s) => s.role), ["top"]);
  assert.deepEqual(selectSpotlights(source({ loserRows: [row("L")] })).map((s) => s.role), ["worst"]);
}

{
  // Mover: the larger |Δ%| of improved[0]/declined[0]; ties go to the
  // improvement.
  const comparisonRow = (name: string, changeLabel: string) => ({
    name,
    previousLabel: "2.00",
    currentLabel: "3.00",
    changeLabel,
    spendChangeLabel: "$100.00 → $150.00",
  });
  const declinedWins = selectSpotlights(
    source({
      winners: [row("W")],
      loserRows: [row("L")],
      comparison: {
        improved: [comparisonRow("Up", "+20% (better)")],
        declined: [comparisonRow("Down", "−45% (worse)")],
      },
    })
  );
  assert.equal(declinedWins.length, 3);
  const mover = declinedWins.find((s) => s.role === "mover")!;
  assert.equal(mover.adName, "Down", "the larger movement wins the mover slot");
  assert.ok(mover.takeaway.buyer.includes("−45% (worse)"), "mover takeaway carries the comparison's own label");
  assert.equal(mover.changeLabel, "−45% (worse)");

  const tie = selectSpotlights(
    source({
      winners: [row("W")],
      loserRows: [row("L")],
      comparison: {
        improved: [comparisonRow("Up", "+30% (better)")],
        declined: [comparisonRow("Down", "−30% (worse)")],
      },
    })
  );
  assert.equal(tie.find((s) => s.role === "mover")!.adName, "Up", "ties go to the improvement");

  // Improved-only / declined-only comparisons still produce a mover.
  const improvedOnly = selectSpotlights(
    source({
      comparison: { improved: [comparisonRow("Solo", "+12% (better)")], declined: [] },
    })
  );
  assert.deepEqual(improvedOnly.map((s) => s.role), ["mover"]);

  // Empty comparison lists → no mover card.
  const emptyCmp = selectSpotlights(
    source({ winners: [row("W")], comparison: { improved: [], declined: [] } })
  );
  assert.deepEqual(emptyCmp.map((s) => s.role), ["top"]);
}

{
  // Dedup: mover resolves to the SAME ad as the top performer → ONE
  // card, both role labels, movement context preserved — never the
  // same creative twice.
  const spots = selectSpotlights(
    source({
      winners: [row("Hero")],
      loserRows: [row("L")],
      comparison: {
        improved: [
          {
            name: "  Hero ", // whitespace variant — identity still matches
            previousLabel: "2.00",
            currentLabel: "4.00",
            changeLabel: "+100% (better)",
            spendChangeLabel: "$100.00 → $200.00",
          },
        ],
        declined: [],
      },
    })
  );
  assert.equal(spots.length, 2, "merged: top+mover is one card, plus the loser");
  const hero = spots[0];
  assert.deepEqual(hero.roles, ["top", "mover"], "merged card carries every earned role");
  assert.equal(hero.role, "top", "primary (strongest) role kept for order/content");
  assert.equal(hero.changeLabel, "+100% (better)", "merged card keeps the movement context");
  assert.equal(spots.filter((s) => s.assetKey === hero.assetKey).length, 1, "no duplicate creative card");
}

{
  // Determinism + asset-independence: same source → identical output,
  // and the module has no way to receive assets (type has no such
  // field; source scan below proves no import sneaks one in).
  const src = source({ winners: [row("W")], loserRows: [row("L")] });
  assert.deepEqual(selectSpotlights(src), selectSpotlights(src), "selection is deterministic");

  const selectionSource = readFileSync(
    new URL("../components/debrief/creativeEvidence.ts", import.meta.url),
    "utf-8"
  );
  assert.ok(
    !/CreativeAssetRef|creativeAssets|objectURL|createObjectURL|blob:/i.test(selectionSource),
    "selection module never references creative assets — an image cannot influence spotlight choice"
  );
  const selectionImports = [...selectionSource.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    [...new Set(selectionImports)],
    ["../../modules/debrief"],
    "selection module imports engine types only"
  );
}

/* ===================== caveat / labels ===================== */

{
  assert.ok(
    CREATIVE_EVIDENCE_CAVEAT.buyer.includes("not why"),
    "buyer caveat separates identification from causation"
  );
  assert.ok(
    CREATIVE_EVIDENCE_CAVEAT.client.includes("not why"),
    "client caveat separates identification from causation"
  );
  const causal = /\b(because|caused|causing|due to|driven by|drove|led to|thanks to|resulted in)\b/i;
  const allStrings = [
    CREATIVE_EVIDENCE_CAVEAT.buyer,
    CREATIVE_EVIDENCE_CAVEAT.client,
    ...Object.values(SPOTLIGHT_ROLE_LABELS).flatMap((l) => [l.buyer, l.client]),
  ];
  const sampleSpots = selectSpotlights(
    source({ winners: [row("W")], loserRows: [row("L")] })
  );
  for (const s of sampleSpots) allStrings.push(s.takeaway.buyer, s.takeaway.client);
  for (const text of allStrings) {
    assert.ok(!causal.test(text), `causal vocabulary in creative-evidence copy: "${text}"`);
  }
  // Client-register strings stay jargon-free (same ban list as the
  // decision card's client copy).
  for (const s of sampleSpots) {
    for (const word of ["kill", "gate", "benchmark", "median", "judged"]) {
      assert.ok(
        !s.takeaway.client.toLowerCase().includes(word),
        `client takeaway must not contain "${word}"`
      );
    }
  }
}

/* ===================== engine isolation ===================== */

{
  // modules/debrief must remain completely unaware of creative assets.
  // Identifier-level scan (NOT the word "creative", which legitimately
  // appears throughout the engine as creativeNotes/creative briefs).
  const engineDir = new URL("../modules/debrief/", import.meta.url);
  const forbidden = /CreativeAssetRef|creativeAssets|createObjectURL|objectURL|thumbnail|blob:|sample-creatives|Spotlight/i;
  for (const file of readdirSync(engineDir)) {
    if (!file.endsWith(".ts")) continue;
    const text = readFileSync(new URL(file, engineDir), "utf-8");
    assert.ok(
      !forbidden.test(text),
      `modules/debrief/${file} references creative-asset machinery — the engine must stay image-blind`
    );
  }

  // The provider never sends assets to the API: the generate() body
  // builder must not append creativeAssets in any form.
  const providerSource = readFileSync(
    new URL("../components/workspace/DebriefProvider.tsx", import.meta.url),
    "utf-8"
  );
  const generateBody = providerSource.slice(
    providerSource.indexOf("const generate = useCallback"),
    providerSource.indexOf("}, [file, previousFile, fields, formatOverrides]")
  );
  assert.ok(generateBody.length > 0, "found the generate() body");
  assert.ok(
    !generateBody.includes("creativeAsset"),
    "creative assets are never appended to the /api/debrief request"
  );
}

console.log("creativeEvidence: all assertions passed");
