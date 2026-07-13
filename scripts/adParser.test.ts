/**
 * Bulk ad-example parser proofs (plain Node, no framework).
 *
 * Covers block-splitting strategies (separator lines, numbered labels,
 * blank-line fallback, single-block fallback), per-block field
 * extraction (explicit labels win, then verbatim pattern fallbacks for
 * CTA/offer/date/URL, then the shared keyword tables for themes), and
 * the honesty rule: nothing is invented when a field isn't present.
 */
import assert from "node:assert/strict";
import {
  parseAdExample,
  parseBulkAdExamples,
  splitAdBlocks,
} from "../modules/competitorDebrief/adParser.ts";

/* ------------------------------- splitAdBlocks ------------------------------ */

{
  assert.deepEqual(splitAdBlocks(""), []);
  assert.deepEqual(splitAdBlocks("   \n  "), []);
}

{
  // Blank-line fallback — no explicit markers present.
  const blocks = splitAdBlocks("First ad hook here.\n\nSecond ad hook here.\n\nThird ad hook here.");
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0], "First ad hook here.");
  assert.equal(blocks[2], "Third ad hook here.");
}

{
  // Separator-line markers.
  const blocks = splitAdBlocks("First ad.\n---\nSecond ad.\n===\nThird ad.");
  assert.equal(blocks.length, 3);
  assert.equal(blocks[1], "Second ad.");
}

{
  // Numbered/labeled markers, including trailing content on the label line.
  const blocks = splitAdBlocks(
    "Ad 1: hook about bloating\nOffer: 20% off\n\nAd 2\nHook: founder story\nExample 3 - a third one"
  );
  assert.equal(blocks.length, 3);
  assert.match(blocks[0], /hook about bloating/);
  assert.match(blocks[0], /20% off/);
  assert.match(blocks[1], /founder story/);
  assert.match(blocks[2], /a third one/);
}

{
  // No markers, no blank lines — a single ad pasted as one block.
  const single = "UGC video with a founder-led hook about bloating, 20% off first order.";
  assert.deepEqual(splitAdBlocks(single), [single]);
}

/* ------------------------------- parseAdExample ----------------------------- */

{
  const parsed = parseAdExample(
    "Hook: I used to feel bloated every day\nHeadline: Reset your gut in 30 days\nCTA: Shop Now\nOffer: 20% off first order\nFormat: UGC video\nStart date: 2026-05-01\nLanding page: https://colonbroom.com/offer"
  );
  assert.equal(parsed.hook, "I used to feel bloated every day");
  assert.equal(parsed.headline, "Reset your gut in 30 days");
  assert.equal(parsed.cta, "Shop Now");
  assert.equal(parsed.offer, "20% off first order");
  assert.equal(parsed.format, "UGC video");
  assert.equal(parsed.startDate, "2026-05-01");
  assert.equal(parsed.landingPage, "https://colonbroom.com/offer");
}

{
  // Unlabeled text still yields CTA/offer/date/URL via verbatim pattern
  // fallbacks — never a label requirement, never a guess.
  const parsed = parseAdExample(
    "Founder-led story about feeling bloated. shop now and get 20% off your first order. Posted March 3, 2026. More at https://colonbroom.com"
  );
  assert.equal(parsed.cta, "shop now");
  assert.match(parsed.offer ?? "", /20% off/);
  assert.match(parsed.startDate ?? "", /March 3, 2026/i);
  assert.equal(parsed.landingPage, "https://colonbroom.com");
  assert.equal(parsed.headline, undefined); // never guessed — no label, no fallback for this field
}

{
  // Keyword-table themes reuse the SAME tables the single-paste flow
  // uses — not a second judgment system.
  const parsed = parseAdExample(
    "Problem-first hook, UGC format, clinically tested claims with customer reviews and a guarantee."
  );
  assert.ok(parsed.detectedHooks.length > 0);
  assert.ok(parsed.detectedFormats.length > 0);
  assert.ok(parsed.detectedPositioning.length > 0);
  assert.ok(parsed.detectedTrust.length > 0);
}

{
  // Honesty: nothing recognizable in the text → every optional field
  // stays absent, nothing invented.
  const parsed = parseAdExample("just some notes with nothing recognizable in them at all");
  assert.equal(parsed.hook, undefined);
  assert.equal(parsed.headline, undefined);
  assert.equal(parsed.cta, undefined);
  assert.equal(parsed.offer, undefined);
  assert.equal(parsed.format, undefined);
  assert.equal(parsed.startDate, undefined);
  assert.equal(parsed.landingPage, undefined);
  assert.deepEqual(parsed.detectedHooks, []);
  assert.deepEqual(parsed.detectedFormats, []);
  assert.deepEqual(parsed.detectedOffers, []);
  assert.deepEqual(parsed.detectedPositioning, []);
  assert.deepEqual(parsed.detectedTrust, []);
  assert.deepEqual(parsed.detectedBenefits, []);
}

{
  // Raw is preserved verbatim (trimmed only).
  const raw = "  Some ad text with   internal spacing preserved.  ";
  const parsed = parseAdExample(raw);
  assert.equal(parsed.raw, raw.trim());
}

/* ---------------------------- parseBulkAdExamples --------------------------- */

{
  const bulk = parseBulkAdExamples(
    "Ad 1\n" +
      "UGC video, founder-led hook about bloating.\n" +
      "Offer: 20% off first order\n" +
      "CTA: Shop Now\n\n" +
      "Ad 2\n" +
      "Before/after carousel, clinically tested claims, customer reviews shown.\n" +
      "Landing page: https://colonbroom.com/reviews\n\n" +
      "Ad 3\n" +
      "Subscribe and save offer, money-back guarantee."
  );
  assert.equal(bulk.length, 3, `expected 3 ads, got ${bulk.length}`);
  assert.equal(bulk[0].cta, "Shop Now");
  assert.equal(bulk[0].offer, "20% off first order");
  assert.equal(bulk[1].landingPage, "https://colonbroom.com/reviews");
  assert.ok(bulk[1].detectedPositioning.includes("clinically tested"));
  assert.ok(bulk[2].detectedOffers.some((o) => o.includes("subscription")));
}

console.log("adParser: all assertions passed");
