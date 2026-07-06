/**
 * Competitor Signal Summary V2 — deterministic interpretation of fetched
 * page signals into structured categories for creative decision-making.
 *
 * Rules-based (no AI), conservative (says "weak" when it is), directional
 * (never infers performance or spend). Reuses all existing signal fields
 * from pageSignals.ts extraction.
 *
 * This file must stay free of runtime imports (type-only is fine) so it
 * can be tested under Node.
 */

import type { CompetitorPageSignals } from "./types";

/* --------- Signal Interpretation --------- */

export interface CompetitorSignalSummary {
  /** Problem/benefit angle (problem-first, founder-led, ingredient-led, etc.) */
  angleOrMessage: string;
  /** Offer structure and CTA type */
  offerCTAPattern: string;
  /** Trust/proof approach (reviews, clinical, guarantees, etc.) */
  proofTrustPattern: string;
  /** What the page emphasizes visually/structurally */
  landingPageEmphasis: string;
  /** Suggested creative angle to test based on observed pattern */
  creativeInspiration: string;
  /** Overall signal quality assessment */
  signalStrength: "strong" | "moderate" | "weak";
}

export interface GroupedSignalChange {
  category: string; // "Headline/message", "CTA/offer", "Positioning", "Benefits/proof", "No change"
  changes: string[];
  whyItMatters: string;
}

/**
 * Interprets fetched signals into categories for creative decisions.
 * Conservative: if signals are thin, says so honestly.
 */
export function summarizePageSignals(
  signals: CompetitorPageSignals
): CompetitorSignalSummary {
  const positioning = (signals.positioning ?? "").toLowerCase();
  const benefits = (signals.benefits ?? []).map((b) => b.toLowerCase());
  const trust = (signals.trustSignals ?? []).map((t) => t.toLowerCase());
  const offerText = (signals.offer ?? "").toLowerCase();
  const ctaText = (signals.cta ?? "").toLowerCase();

  // Count available signal fields for strength assessment
  const fieldCount = Object.keys(signals).filter((k) => {
    const v = signals[k as keyof CompetitorPageSignals];
    return v !== undefined && v !== null && v !== "";
  }).length;

  /* Angle / Message: what's the core narrative? */
  let angleOrMessage = "";
  const angleClues: string[] = [];

  if (positioning.includes("problem-first")) {
    angleClues.push("Problem-first / use-case driven");
  } else if (positioning.includes("founder-led")) {
    angleClues.push("Founder-led / personal story");
  } else if (positioning.includes("ingredient-led")) {
    angleClues.push("Ingredient / feature-led education");
  } else if (positioning.includes("routine-based")) {
    angleClues.push("Routine / ritual framing");
  } else if (positioning.includes("sustainable")) {
    angleClues.push("Sustainability / ethics focus");
  } else if (positioning.includes("science") || positioning.includes("dermatologist") || positioning.includes("clinical")) {
    angleClues.push("Science-backed / clinical validation");
  }

  if (benefits.some((b) => b.includes("natural") || b.includes("clean"))) {
    angleClues.push("Natural / clean claim emphasis");
  }

  if (angleClues.length > 0) {
    angleOrMessage = angleClues.slice(0, 2).join(" + ");
  } else if (fieldCount >= 2 && signals.headline) {
    // Fallback: describe the headline tone if available
    const h = signals.headline.toLowerCase();
    if (h.length > 40) {
      angleOrMessage = "Long-form educational headline";
    } else {
      angleOrMessage = "Direct / benefit-first headline";
    }
  } else {
    angleOrMessage = "Limited angle signal detected";
  }

  /* Offer / CTA Pattern: transaction type */
  let offerCTAPattern = "";
  const offerClues: string[] = [];

  if (
    ctaText.includes("shop") ||
    ctaText.includes("buy") ||
    ctaText.includes("add to cart")
  ) {
    offerClues.push("Product-led shopping CTA");
  } else if (
    ctaText.includes("start") ||
    ctaText.includes("try") ||
    ctaText.includes("subscribe")
  ) {
    offerClues.push("Free trial / subscription CTA");
  } else if (ctaText.includes("sign up") || ctaText.includes("join")) {
    offerClues.push("Signup / registration focus");
  } else if (ctaText.includes("book") || ctaText.includes("demo")) {
    offerClues.push("B2B / demo request CTA");
  }

  if (
    offerText.includes("off") ||
    offerText.includes("sale") ||
    offerText.includes("discount")
  ) {
    offerClues.push("Discount-led offer");
  } else if (offerText.includes("free")) {
    offerClues.push("Free / trial offer");
  } else if (offerText.includes("subscribe")) {
    offerClues.push("Subscription savings");
  } else if (offerText.includes("bundle") || offerText.includes("and")) {
    offerClues.push("Bundle offer");
  } else if (offerText.includes("out")) {
    // Out of stock pattern
    offerClues.push("Availability signal (may be out of stock)");
  }

  if (offerClues.length > 0) {
    offerCTAPattern = offerClues.join(" · ");
  } else if (signals.cta) {
    offerCTAPattern = `CTA: "${signals.cta}"`;
  } else {
    offerCTAPattern = "Limited CTA/offer signal";
  }

  /* Proof / Trust Pattern: how does it establish credibility? */
  let proofTrustPattern = "";
  const trustClues: string[] = [];

  if (trust.some((t) => t.includes("review") || t.includes("rating"))) {
    trustClues.push("Customer reviews/ratings");
  }
  if (trust.some((t) => t.includes("testimonial"))) {
    trustClues.push("Testimonials");
  }
  if (
    trust.some((t) => t.includes("dermatologist")) ||
    positioning.includes("dermatologist")
  ) {
    trustClues.push("Dermatologist endorsement");
  }
  if (trust.some((t) => t.includes("clinical"))) {
    trustClues.push("Clinical claims / studies");
  }
  if (trust.some((t) => t.includes("guarantee"))) {
    trustClues.push("Money-back guarantee");
  }
  if (trust.some((t) => t.includes("award")) || trust.some((t) => t.includes("press"))) {
    trustClues.push("Awards / press mentions");
  }
  if (trust.some((t) => t.includes("before"))) {
    trustClues.push("Before/after proof");
  }
  if (trust.some((t) => t.includes("customer count"))) {
    trustClues.push("Customer count / scale");
  }

  if (trustClues.length > 0) {
    proofTrustPattern = trustClues.join(", ");
  } else {
    proofTrustPattern = "Limited proof/trust signal";
  }

  /* Landing Page Emphasis: what does the page prioritize? */
  let landingPageEmphasis = "";
  const emphasisClues: string[] = [];

  const signalCount = [
    signals.headline,
    signals.cta,
    signals.offer,
    signals.positioning,
    signals.benefits?.length,
    signals.trustSignals?.length,
  ].filter(Boolean).length;

  if (signalCount >= 5) {
    emphasisClues.push("Multi-layered messaging");
  } else if (signalCount <= 2) {
    emphasisClues.push("Minimal / focused messaging");
  } else {
    emphasisClues.push("Balanced positioning");
  }

  if (benefits.length > 2) {
    emphasisClues.push("Multiple benefits listed");
  }

  if (offerText) {
    emphasisClues.push("Offer-led (discount/value emphasized)");
  } else if (trust.length > 2) {
    emphasisClues.push("Trust-led (proof emphasized)");
  } else if (positioning) {
    emphasisClues.push("Positioning-led (brand story emphasized)");
  }

  landingPageEmphasis = emphasisClues.join(" + ");

  /* Creative Inspiration */
  let creativeInspiration = "";
  const inspirationClues: string[] = [];

  if (angleClues.includes("Problem-first / use-case driven")) {
    inspirationClues.push("Test problem-first angle or use-case variant");
  }
  if (angleClues.includes("Founder-led / personal story")) {
    inspirationClues.push("Test founder/creator authenticity hook");
  }
  if (angleClues.includes("Ingredient / feature-led education")) {
    inspirationClues.push("Test ingredient/feature deep-dive angle");
  }
  if (
    offerClues.some((o) => o.includes("Discount")) ||
    offerClues.some((o) => o.includes("Bundle"))
  ) {
    inspirationClues.push("Test offer-led variant");
  }
  if (trustClues.length >= 2) {
    inspirationClues.push("Test credibility-first creative (reviews, credentials)");
  }

  if (inspirationClues.length > 0) {
    creativeInspiration = inspirationClues.slice(0, 2).join(" · ");
  } else {
    creativeInspiration = "Test variations of observed patterns";
  }

  /* Signal Strength */
  let signalStrength: "strong" | "moderate" | "weak" = "moderate";
  if (fieldCount >= 6) signalStrength = "strong";
  if (fieldCount <= 2) signalStrength = "weak";

  return {
    angleOrMessage,
    offerCTAPattern,
    proofTrustPattern,
    landingPageEmphasis,
    creativeInspiration,
    signalStrength,
  };
}

/**
 * Groups changes between two signal snapshots by meaningful category,
 * with a "why this may matter" explanation for each group.
 * Returns changes grouped + explanations, or null if no changes.
 */
export function groupSignalChanges(
  prev: CompetitorPageSignals,
  curr: CompetitorPageSignals
): GroupedSignalChange[] {
  const norm = (s: string | undefined): string =>
    (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

  const changes: GroupedSignalChange[] = [];

  /* Headline / Message */
  if (norm(prev.headline) !== norm(curr.headline)) {
    changes.push({
      category: "Headline / message",
      changes: [
        prev.headline ? `Was: "${prev.headline}"` : "Was: (none)",
        curr.headline ? `Now: "${curr.headline}"` : "Now: (none)",
      ],
      whyItMatters:
        "Core messaging changed — may indicate new angle test, seasonal pivot, or A/B refinement.",
    });
  }

  /* CTA / Offer */
  const ctaChanged = norm(prev.cta) !== norm(curr.cta);
  const offerChanged = norm(prev.offer) !== norm(curr.offer);
  if (ctaChanged || offerChanged) {
    const ctaLines = ctaChanged
      ? [
          prev.cta ? `Was: "${prev.cta}"` : "Was: (none)",
          curr.cta ? `Now: "${curr.cta}"` : "Now: (none)",
        ]
      : [];
    const offerLines = offerChanged
      ? [
          prev.offer ? `Was: "${prev.offer}"` : "Was: (none)",
          curr.offer ? `Now: "${curr.offer}"` : "Now: (none)",
        ]
      : [];
    changes.push({
      category: "CTA / offer",
      changes: [...ctaLines, ...offerLines],
      whyItMatters:
        "Offer or CTA changed — may indicate new promotion, availability change, or conversion test.",
    });
  }

  /* Positioning */
  if (norm(prev.positioning) !== norm(curr.positioning)) {
    changes.push({
      category: "Positioning",
      changes: [
        prev.positioning ? `Was: ${prev.positioning}` : "Was: (none)",
        curr.positioning ? `Now: ${curr.positioning}` : "Now: (none)",
      ],
      whyItMatters:
        "Brand positioning updated — may signal new target audience, value proposition shift, or identity refresh.",
    });
  }

  /* Benefits / Proof */
  const seenBenefits = new Set(
    (prev.benefits ?? []).map((b) => norm(b))
  );
  const newBenefits = (curr.benefits ?? []).filter((b) => !seenBenefits.has(norm(b)));

  const seenTrust = new Set((prev.trustSignals ?? []).map((t) => norm(t)));
  const newTrust = (curr.trustSignals ?? []).filter((t) => !seenTrust.has(norm(t)));

  if (newBenefits.length > 0 || newTrust.length > 0) {
    const items: string[] = [];
    if (newBenefits.length > 0) items.push(`Benefits: ${newBenefits.join(", ")}`);
    if (newTrust.length > 0) items.push(`Trust signals: ${newTrust.join(", ")}`);

    changes.push({
      category: "Benefits / proof",
      changes: items,
      whyItMatters:
        "New benefits or trust claims added — may indicate expanded product features or new credibility angle.",
    });
  }

  /* No changes */
  if (changes.length === 0) {
    changes.push({
      category: "No meaningful change",
      changes: ["Page signals remain consistent"],
      whyItMatters: "Competitor messaging stable — same angle and offer as last refresh.",
    });
  }

  return changes;
}

/**
 * Formats a comprehensive competitor signal block for market notes,
 * including raw observed signals, interpretation, changes, and caveat.
 * Ready to append to marketContext.
 */
export function formatCompetitorSignalNotes(
  signals: CompetitorPageSignals,
  summary: CompetitorSignalSummary,
  changes: GroupedSignalChange[],
  competitorName: string,
  url: string,
  refreshedAt: string | null
): string {
  const lines: string[] = [];

  lines.push("Competitor signal summary — directional only:");
  lines.push(`Competitor: ${competitorName}`);
  if (url.trim() !== "") lines.push(`URL: ${url.trim()}`);
  if (refreshedAt) lines.push(`Last refreshed: ${refreshedAt.slice(0, 10)}`);

  lines.push("");
  lines.push("Observed on page:");
  if (signals.headline) lines.push(`- Headline: ${signals.headline}`);
  const offerCta = [signals.offer, signals.cta ? `CTA "${signals.cta}"` : null].filter(
    Boolean
  );
  if (offerCta.length > 0) lines.push(`- Offer / CTA: ${offerCta.join(" · ")}`);
  if (signals.positioning) lines.push(`- Positioning: ${signals.positioning}`);
  if (signals.benefits && signals.benefits.length > 0) {
    lines.push(`- Claims / benefits: ${signals.benefits.join(", ")}`);
  }
  if (signals.trustSignals && signals.trustSignals.length > 0) {
    lines.push(`- Trust signals: ${signals.trustSignals.join(", ")}`);
  }

  lines.push("");
  lines.push("Interpretation (signal strength: " + summary.signalStrength + "):");
  lines.push(`- Angle / message: ${summary.angleOrMessage}`);
  lines.push(`- Offer / CTA pattern: ${summary.offerCTAPattern}`);
  lines.push(`- Proof / trust pattern: ${summary.proofTrustPattern}`);
  lines.push(`- Landing page emphasis: ${summary.landingPageEmphasis}`);
  lines.push(`- Possible creative inspiration: ${summary.creativeInspiration}`);

  if (changes.length > 0) {
    lines.push("");
    lines.push("Changes since last refresh:");
    for (const group of changes) {
      lines.push(`- ${group.category}: ${group.changes.join(", ")}`);
      lines.push(`  → ${group.whyItMatters}`);
    }
  }

  lines.push("");
  lines.push(
    "Caveat: These signals are observed from public pages only. Debrief uses them as directional creative context, but does not infer competitor spend, traffic, or performance."
  );

  return lines.join("\n");
}
