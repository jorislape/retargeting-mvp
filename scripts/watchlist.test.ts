/**
 * Competitor Watchlist V1 — pure-function proofs.
 *
 * Runs under plain `node` like csv-escaping.test.ts: `npm run
 * test:watchlist`. Covers the parts that don't need a browser: stored-
 * shape sanitization (corrupted localStorage can't crash), the
 * deterministic signal diff, the market-notes block format, and the
 * append-dedupe semantics shared with the one-time page fetch.
 */
import assert from "node:assert/strict";
import {
  diffPageSignals,
  formatWatchlistSignalsAsNotes,
  MAX_WATCHLIST_ITEMS,
  sanitizeWatchlist,
  WATCHLIST_CAVEAT,
  type WatchlistItem,
} from "../modules/competitor/watchlist.ts";
import { appendPageSignalsToNotes } from "../modules/competitor/pageSignals.ts";

/* ---- sanitizeWatchlist: hostile/corrupted storage degrades safely ---- */

assert.deepEqual(sanitizeWatchlist(null), []);
assert.deepEqual(sanitizeWatchlist("garbage"), []);
assert.deepEqual(sanitizeWatchlist({ not: "an array" }), []);

const sanitized = sanitizeWatchlist([
  { name: "GlowLab", url: "https://glowlab.example", notes: "n", signals: { headline: "H", benefits: ["a", 5, "b"] }, previousSignals: null, refreshedAt: "2026-07-05T14:30:00.000Z" },
  { name: 42, url: null, signals: "not-an-object", refreshedAt: 99 },
]);
assert.equal(sanitized.length, 2);
assert.equal(sanitized[0].name, "GlowLab");
assert.deepEqual(sanitized[0].signals, { headline: "H", benefits: ["a", "b"] });
assert.equal(sanitized[1].name, "");
assert.equal(sanitized[1].url, "");
assert.equal(sanitized[1].signals, null);
assert.equal(sanitized[1].refreshedAt, null);

// Cap: more than 5 stored items are truncated.
assert.equal(
  sanitizeWatchlist(Array.from({ length: 9 }, () => ({}))).length,
  MAX_WATCHLIST_ITEMS
);

/* ---- diffPageSignals: simple, deterministic, honest ---- */

const base = {
  headline: "Brighter skin in 14 days",
  cta: "Shop Now",
  offer: "20% off",
  positioning: "science-backed",
  benefits: ["hydration"],
  trustSignals: ["customer reviews / ratings"],
};
assert.deepEqual(diffPageSignals(base, { ...base }), [
  "No meaningful change detected",
]);
// Whitespace/case-only differences are NOT changes.
assert.deepEqual(
  diffPageSignals(base, { ...base, headline: "  BRIGHTER skin   in 14 days " }),
  ["No meaningful change detected"]
);
assert.deepEqual(
  diffPageSignals(base, {
    ...base,
    headline: "New headline",
    cta: "Buy Now",
    benefits: ["hydration", "SPF / sun protection"],
  }),
  [
    "Headline changed",
    "CTA changed",
    "New benefit detected: SPF / sun protection",
  ]
);

/* ---- formatWatchlistSignalsAsNotes ---- */

const item: WatchlistItem = {
  name: "The Ordinary",
  url: "https://theordinary.com",
  notes: "",
  signals: { ...base },
  previousSignals: { ...base, headline: "Old headline" },
  refreshedAt: "2026-07-05T14:30:00.000Z",
};
const empty: WatchlistItem = {
  name: "No refresh yet",
  url: "https://x.example",
  notes: "",
  signals: null,
  previousSignals: null,
  refreshedAt: null,
};

assert.equal(formatWatchlistSignalsAsNotes([]), null);
assert.equal(formatWatchlistSignalsAsNotes([empty]), null, "unrefreshed items are skipped");

const block = formatWatchlistSignalsAsNotes([item, empty]);
assert.ok(block !== null);
assert.ok(block.startsWith("Competitor watchlist signals — directional only:"));
assert.ok(block.includes("- Competitor: The Ordinary"));
assert.ok(block.includes("  URL: https://theordinary.com"));
assert.ok(block.includes("  Last refreshed: 2026-07-05"));
assert.ok(block.includes("  - Headline: Brighter skin in 14 days"));
assert.ok(block.includes(`  - CTA / offer: 20% off · CTA "Shop Now"`));
assert.ok(block.includes("  Changes:"));
assert.ok(block.includes("  - Headline changed"));
assert.ok(block.includes(`Caveat: ${WATCHLIST_CAVEAT}`));
assert.ok(!block.includes("No refresh yet"), "unrefreshed item must not appear");

// Unnamed item falls back to its hostname.
const unnamed = formatWatchlistSignalsAsNotes([
  { ...item, name: "", url: "https://theordinary.com/serums" },
]);
assert.ok(unnamed !== null && unnamed.includes("- Competitor: theordinary.com"));

/* ---- append semantics: existing notes kept, duplicates avoided ---- */

const existing = "my manual market notes";
const appended = appendPageSignalsToNotes(existing, block);
assert.ok(appended.startsWith(existing), "existing notes preserved");
assert.ok(appended.includes(block));
assert.equal(
  appendPageSignalsToNotes(appended, block),
  appended,
  "same refreshed data appended twice is a no-op"
);
assert.equal(appendPageSignalsToNotes("", block), block);

console.log("watchlist: all assertions passed");
