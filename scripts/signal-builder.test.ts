/**
 * Market signal builder — pure-function proofs.
 *
 * Runs under plain `node` like the other script tests: `npm run
 * test:signals`. Covers table integrity (preset chips must exist),
 * block formatting, append-dedupe semantics, the downstream contract
 * (Structure notes + quality meter read the block), and the quality
 * meter's new measurable counts.
 */
import assert from "node:assert/strict";
import {
  formatSelectedSignals,
  SIGNAL_BUILDER_CAVEAT,
  SIGNAL_BUILDER_GROUPS,
  SIGNAL_PRESETS,
} from "../modules/debrief/signalBuilder.ts";
import { appendPageSignalsToNotes } from "../modules/competitor/pageSignals.ts";
import {
  assessMarketNotes,
  structureMarketNotes,
} from "../modules/debrief/marketSignals.ts";

/* ---- table integrity ---- */

const allChips = SIGNAL_BUILDER_GROUPS.flatMap((g) => g.chips);
assert.equal(SIGNAL_BUILDER_GROUPS.length, 4, "exactly four groups");
assert.equal(
  new Set(allChips).size,
  allChips.length,
  "chip labels are unique across groups (flat selection depends on it)"
);

// Every preset chip must exist in the groups table.
for (const preset of SIGNAL_PRESETS) {
  for (const chip of preset.chips) {
    assert.ok(
      allChips.includes(chip),
      `preset "${preset.key}" references unknown chip "${chip}"`
    );
  }
  assert.ok(preset.chips.length >= 8, `preset "${preset.key}" too thin`);
}
assert.equal(SIGNAL_PRESETS.length, 4, "four example presets");

/* ---- formatting ---- */

assert.equal(formatSelectedSignals([]), null);
assert.equal(formatSelectedSignals(["Not a real chip"]), null);

const block = formatSelectedSignals([
  "Founder-led",
  "UGC / creator content",
  "Problem-first",
  "Social proof",
  "Bundle offer",
  "First-order discount",
  "Reviews / ratings",
  "Ingredient / feature-led messaging",
]);
assert.ok(block !== null);
assert.ok(block.startsWith("Selected market signals — directional only:"));
// Groups render in table order; chips in group order regardless of
// selection order.
assert.ok(
  block.indexOf("Observed formats:") < block.indexOf("Repeated hooks:") &&
    block.indexOf("Repeated hooks:") < block.indexOf("Offer patterns:") &&
    block.indexOf("Offer patterns:") < block.indexOf("Landing page / market signals:")
);
assert.ok(block.includes("- UGC / creator content\n- Founder-led"));
assert.ok(block.includes(`Caveat: ${SIGNAL_BUILDER_CAVEAT}`));

// A partial selection omits empty groups entirely.
const hooksOnly = formatSelectedSignals(["Education-led"]);
assert.ok(hooksOnly !== null && !hooksOnly.includes("Observed formats:"));
assert.ok(hooksOnly.includes("Repeated hooks:\n- Education-led"));

/* ---- append semantics ---- */

const existing = "my own manual notes";
const appended = appendPageSignalsToNotes(existing, block);
assert.ok(appended.startsWith(existing), "existing notes preserved");
assert.equal(
  appendPageSignalsToNotes(appended, block),
  appended,
  "same selection appended twice is a no-op"
);
assert.equal(appendPageSignalsToNotes("", block), block);

/* ---- downstream contract: Structure notes + quality meter ---- */

const structured = structureMarketNotes(appended);
assert.ok(structured !== null, "Structure notes handles the block");
assert.equal(
  structureMarketNotes(structured),
  structured,
  "structuring stays idempotent after the block"
);

const quality = assessMarketNotes(appended);
assert.ok(quality !== null);
assert.ok(
  ["good", "strong"].includes(quality.level),
  `selected signals should register (got ${quality.level})`
);
assert.match(
  quality.summary,
  /^Recognized market signals: .*\d+ \w+/,
  "summary carries measurable counts, neutral wording (Input Honesty V1 — never 'quality')"
);

/* ---- quality meter counts (Input Honesty V1: neutral counts, never a
   "Strong/Good/Weak" quality judgment) ---- */

const strong = assessMarketNotes(
  "founder-led videos, ugc clips, problem-first hooks, bundle offers and discounts, https://example.com"
);
assert.equal(strong?.level, "strong");
assert.match(strong.summary, /^Recognized market signals: /);
assert.ok(!/\bstrong\b|\bgood\b|\bweak\b/i.test(strong.summary), "no quality-judgment words in the summary");
assert.ok(/\d+ formats?/.test(strong.summary), "format count present");
assert.ok(/\d+ hooks?/.test(strong.summary), "hook count present");
assert.ok(/\d+ offers?/.test(strong.summary), "offer count present");
assert.ok(/1 link\/source/.test(strong.summary), "link count present");

const weakOne = assessMarketNotes("they run carousels");
assert.equal(weakOne?.level, "weak");
assert.equal(weakOne.summary, "Recognized market signals: 1 format.");

const weakNone = assessMarketNotes("some vague text with no known terms");
assert.equal(weakNone?.level, "weak");
assert.equal(weakNone.summary, "No recognized formats, hooks, offers, or links.");

console.log("signal-builder: all assertions passed");
