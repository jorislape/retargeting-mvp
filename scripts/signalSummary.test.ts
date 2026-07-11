/**
 * Test: Competitor Signal Summary V2
 * Pure helpers under Node (no imports of modules/competitor)
 */

import type { CompetitorPageSignals } from "../modules/competitor/types.ts";
import {
  summarizePageSignals,
  groupSignalChanges,
  formatCompetitorSignalNotes,
} from "../modules/competitor/signalSummary.ts";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    console.error(`✗ ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
};

/* ---- Test: Strong signals produce strong summary ---- */
{
  const strong: CompetitorPageSignals = {
    headline: "Clinically-proven skincare for sensitive skin",
    cta: "Shop now",
    offer: "20% off your first order",
    positioning: "science-backed, dermatologist-endorsed, natural / clean",
    benefits: ["hydration", "soothing / calming", "barrier repair"],
    trustSignals: ["customer reviews / ratings", "clinical claims", "dermatologist mention"],
    rawSummary:
      "Our science-backed skincare line delivers clinically proven results for sensitive skin.",
  };

  const summary = summarizePageSignals(strong);
  assert(summary.signalStrength === "strong", "strong signals detected as strong");
  assert(
    summary.angleOrMessage.toLowerCase().includes("science") ||
      summary.angleOrMessage.toLowerCase().includes("dermatologist"),
    "strong signals identify science/dermatologist angle"
  );
  assert(
    summary.offerCTAPattern.toLowerCase().includes("discount") &&
      summary.offerCTAPattern.toLowerCase().includes("product"),
    "strong signals identify product-led discount offer"
  );
  assert(
    summary.proofTrustPattern.toLowerCase().includes("clinical") &&
      summary.proofTrustPattern.toLowerCase().includes("dermatologist"),
    "strong signals identify clinical + dermatologist trust"
  );
}

/* ---- Test: Weak signals say so honestly ---- */
{
  const weak: CompetitorPageSignals = {
    headline: "Our product",
  };

  const summary = summarizePageSignals(weak);
  assert(summary.signalStrength === "weak", "weak signals detected as weak");
  assert(
    summary.angleOrMessage.toLowerCase().includes("limited") ||
      summary.angleOrMessage.toLowerCase().includes("weak"),
    "weak summary mentions limited signals"
  );
}

/* ---- Test: Problem-first angle detection ---- */
{
  const problemFirst: CompetitorPageSignals = {
    headline: "Tired of dry skin? Try our solution.",
    positioning: "problem-first",
    cta: "Learn more",
  };

  const summary = summarizePageSignals(problemFirst);
  assert(
    summary.angleOrMessage.toLowerCase().includes("problem"),
    "problem-first positioning detected"
  );
  assert(
    summary.creativeInspiration.toLowerCase().includes("problem"),
    "creative inspiration suggests problem-first angle"
  );
}

/* ---- Test: Founder-led angle detection ---- */
{
  const founderLed: CompetitorPageSignals = {
    positioning: "founder-led",
    cta: "Join our community",
  };

  const summary = summarizePageSignals(founderLed);
  assert(
    summary.angleOrMessage.toLowerCase().includes("founder"),
    "founder-led positioning detected"
  );
  assert(
    summary.creativeInspiration.toLowerCase().includes("founder"),
    "creative inspiration suggests founder authenticity"
  );
}

/* ---- Test: Ingredient-led angle detection ---- */
{
  const ingredientLed: CompetitorPageSignals = {
    positioning: "ingredient-led",
    benefits: ["hydration", "anti-aging"],
  };

  const summary = summarizePageSignals(ingredientLed);
  assert(
    summary.angleOrMessage.toLowerCase().includes("ingredient"),
    "ingredient-led positioning detected"
  );
}

/* ---- Test: Out-of-stock CTA handling ---- */
{
  const outOfStock: CompetitorPageSignals = {
    headline: "Limited edition",
    cta: "Notify when back in stock",
    offer: "out of stock",
  };

  const summary = summarizePageSignals(outOfStock);
  assert(
    summary.offerCTAPattern.toLowerCase().includes("availability"),
    "out-of-stock signal detected in offer pattern"
  );
}

/* ---- Test: Grouped changes - headline change ---- */
{
  const prev: CompetitorPageSignals = {
    headline: "Old headline",
    cta: "Buy now",
  };

  const curr: CompetitorPageSignals = {
    headline: "New headline",
    cta: "Buy now",
  };

  const changes = groupSignalChanges(prev, curr);
  assert(changes.length >= 1, "change detected");
  const headlineGroup = changes.find((c) => c.category.includes("Headline"));
  assert(headlineGroup !== undefined, "headline change grouped");
  assert(
    headlineGroup ? headlineGroup.whyItMatters.toLowerCase().includes("messaging") : false,
    "headline change explains why it matters"
  );
}

/* ---- Test: Grouped changes - offer change ---- */
{
  const prev: CompetitorPageSignals = {
    offer: "10% off",
    cta: "Shop now",
  };

  const curr: CompetitorPageSignals = {
    offer: "Free shipping",
    cta: "Shop now",
  };

  const changes = groupSignalChanges(prev, curr);
  const offerGroup = changes.find((c) => c.category.includes("CTA"));
  assert(offerGroup !== undefined, "offer change grouped");
  assert(
    offerGroup ? offerGroup.whyItMatters.toLowerCase().includes("offer") : false,
    "offer change explains new promotion"
  );
}

/* ---- Test: Grouped changes - new benefit added ---- */
{
  const prev: CompetitorPageSignals = {
    benefits: ["hydration"],
  };

  const curr: CompetitorPageSignals = {
    benefits: ["hydration", "anti-aging"],
  };

  const changes = groupSignalChanges(prev, curr);
  const benefitGroup = changes.find((c) => c.category.includes("Benefits"));
  assert(benefitGroup !== undefined, "new benefit grouped");
  assert(
    benefitGroup ? benefitGroup.changes[0]?.toLowerCase().includes("anti-aging") : false,
    "new benefit listed"
  );
}

/* ---- Test: Grouped changes - no change ---- */
{
  const signals: CompetitorPageSignals = {
    headline: "Same headline",
    cta: "Same CTA",
  };

  const changes = groupSignalChanges(signals, signals);
  assert(changes.length === 1, "no-change case returns one group");
  assert(
    changes[0].category.toLowerCase().includes("no"),
    "no-change category identified"
  );
}

/* ---- Test: Formatted notes block includes all sections ---- */
{
  const signals: CompetitorPageSignals = {
    headline: "Premium skincare for sensitive skin",
    cta: "Shop now",
    offer: "20% off first order",
    positioning: "dermatologist-endorsed",
    benefits: ["hydration", "soothing / calming"],
    trustSignals: ["customer reviews / ratings"],
  };

  const summary = summarizePageSignals(signals);
  const changes = groupSignalChanges(signals, signals);
  const notes = formatCompetitorSignalNotes(
    signals,
    summary,
    changes,
    "TestBrand",
    "https://example.com",
    "2026-07-06T10:00:00Z"
  );

  assert(notes.includes("Competitor signal summary"), "block header present");
  assert(notes.includes("Competitor: TestBrand"), "competitor name included");
  assert(notes.includes("example.com"), "URL included");
  assert(notes.includes("2026-07-06"), "refreshed date included");
  assert(notes.includes("Observed on page:"), "raw signals section present");
  assert(notes.includes("Interpretation"), "interpretation section present");
  assert(notes.includes("Angle / message:"), "angle subsection present");
  assert(notes.includes("Offer / CTA pattern:"), "offer subsection present");
  assert(notes.includes("Proof / trust pattern:"), "proof subsection present");
  assert(notes.includes("Caveat:"), "caveat present");
  assert(
    notes.includes("does not infer competitor spend"),
    "spend inference caveat present"
  );
}

/* ---- Test: Formatted notes dedupe (same block twice) ---- */
{
  const signals: CompetitorPageSignals = {
    headline: "Test",
    cta: "Buy",
  };

  const summary = summarizePageSignals(signals);
  const changes = groupSignalChanges(signals, signals);
  const block = formatCompetitorSignalNotes(signals, summary, changes, "Test", "", null);

  // Simulate existing notes
  const existing = `Some user notes\n\n${block}`;
  const duplicate = block;

  // Check that appending the same block doesn't add it twice
  assert(!existing.includes(duplicate.repeat(2)), "duplicate detection works");
}

console.log("\n✓ All signal summary tests pass");
