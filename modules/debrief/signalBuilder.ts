/**
 * Market signal builder — the guided way into the market-notes field.
 *
 * First-time users often don't know what to WRITE, but they can
 * recognize patterns when named: the builder shows selectable chips in
 * four fixed groups, and "Add selected signals to notes" serializes
 * the selection into a structured text block appended to the same
 * Market / competitor notes textarea the rest of the flow reads. From
 * there it's ordinary notes text: Structure notes, the quality meter,
 * and the memo's market signal all pick it up through existing logic —
 * nothing downstream knows the builder exists.
 *
 * Same honesty policy as everything market-flavored: the block only
 * restates what the USER selected, is always marked directional, and
 * never implies competitor spend, traffic, or performance.
 *
 * This file must stay free of runtime imports (type-only is fine) so
 * scripts/signal-builder.test.ts can run it directly under Node.
 */

export interface SignalBuilderGroup {
  key: string;
  label: string;
  chips: string[];
}

/** Chip labels are unique ACROSS groups — selection state is a flat
 *  set of labels, and formatting derives the grouping from this table. */
export const SIGNAL_BUILDER_GROUPS: SignalBuilderGroup[] = [
  {
    key: "formats",
    label: "Observed formats",
    chips: [
      "UGC / creator content",
      "Founder-led",
      "Testimonials",
      "Product demo",
      "Static product visual",
      "Before / after",
      "Comparison creative",
    ],
  },
  {
    key: "hooks",
    label: "Repeated hooks",
    chips: [
      "Problem-first",
      "Social proof",
      "Education-led",
      "Objection handling",
      "Routine / use-case",
      "Price / value",
      "Authority / expert-led",
    ],
  },
  {
    key: "offers",
    label: "Offer patterns",
    chips: [
      "First-order discount",
      "Bundle offer",
      "Free shipping",
      "Limited-time offer",
      "Trial / sample",
      "Subscription",
      "Premium / quality positioning",
    ],
  },
  {
    key: "landing",
    label: "Landing page / market signals",
    chips: [
      "Strong product education",
      "Reviews / ratings",
      "Clinical / proof claims",
      "Simple CTA",
      "Multiple CTAs",
      "Out-of-stock / availability signal",
      "Ingredient / feature-led messaging",
    ],
  },
];

export interface SignalPreset {
  key: string;
  label: string;
  chips: string[];
}

/** Example selections — clicking one fills the chips; the user still
 *  reviews and clicks "Add selected signals to notes" themselves.
 *  Every chip here MUST exist in SIGNAL_BUILDER_GROUPS (asserted in
 *  the test). */
export const SIGNAL_PRESETS: SignalPreset[] = [
  {
    key: "skincare",
    label: "Skincare example",
    chips: [
      "UGC / creator content",
      "Product demo",
      "Testimonials",
      "Problem-first",
      "Education-led",
      "Routine / use-case",
      "Bundle offer",
      "First-order discount",
      "Reviews / ratings",
      "Ingredient / feature-led messaging",
      "Clinical / proof claims",
    ],
  },
  {
    key: "ecommerce",
    label: "E-commerce example",
    chips: [
      "Product demo",
      "Static product visual",
      "Comparison creative",
      "Price / value",
      "Social proof",
      "Objection handling",
      "Free shipping",
      "Limited-time offer",
      "Bundle offer",
      "Multiple CTAs",
      "Reviews / ratings",
      "Simple CTA",
    ],
  },
  {
    key: "saas",
    label: "SaaS example",
    chips: [
      "Product demo",
      "Comparison creative",
      "Testimonials",
      "Problem-first",
      "Objection handling",
      "Education-led",
      "Trial / sample",
      "Price / value",
      "Strong product education",
      "Simple CTA",
      "Reviews / ratings",
    ],
  },
  {
    key: "local-service",
    label: "Local service example",
    chips: [
      "Testimonials",
      "Before / after",
      "Founder-led",
      "Authority / expert-led",
      "Problem-first",
      "Social proof",
      "Limited-time offer",
      "Price / value",
      "Reviews / ratings",
      "Simple CTA",
      "Multiple CTAs",
    ],
  },
];

export const SIGNAL_BUILDER_CAVEAT =
  "These are user-selected directional signals. Debrief uses them as creative context only and does not infer competitor spend, traffic, or performance.";

/**
 * Serializes the selected chip labels into the notes block, grouped in
 * the table's order; groups with no selection are omitted. Unknown
 * labels are ignored. Returns null when nothing valid is selected.
 * Append the result with the shared dedupe-append helper — the same
 * selection added twice is a no-op.
 */
export function formatSelectedSignals(selected: string[]): string | null {
  const chosen = new Set(selected);
  const sections: string[] = [];
  for (const group of SIGNAL_BUILDER_GROUPS) {
    const hits = group.chips.filter((chip) => chosen.has(chip));
    if (hits.length === 0) continue;
    sections.push(`${group.label}:\n${hits.map((c) => `- ${c}`).join("\n")}`);
  }
  if (sections.length === 0) return null;
  return [
    "Selected market signals — directional only:",
    ...sections,
    `Caveat: ${SIGNAL_BUILDER_CAVEAT}`,
  ].join("\n");
}
