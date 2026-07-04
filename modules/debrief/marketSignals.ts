/**
 * Market / competitor notes: shared keyword map and helpers.
 *
 * One term table serves both sides of the feature so they can never
 * drift apart:
 *   - memo.ts scans pasted notes for these terms to build the
 *     directional "Market signal" bullets and reframe next tests;
 *   - the generator's "Structure notes" button uses the same table to
 *     reformat the textarea locally.
 *
 * Everything here is pure, deterministic string work — no fetching,
 * no scraping, no storage, and no engine imports (client-safe). The
 * honesty policy matches ad-name tags: we only restate what the user
 * wrote, grouped; never a claim about competitor spend or performance.
 */

export interface MarketSignals {
  formats: string[];
  hooks: string[];
  offers: string[];
  has: (key: string) => boolean;
}

const MARKET_TERMS: {
  key: string;
  label: string;
  group: "formats" | "hooks" | "offers";
  re: RegExp;
}[] = [
  { key: "founder-led", label: "founder-led video", group: "formats", re: /founder[\s-]?led|founder\s+(stor|video)/i },
  { key: "ugc", label: "UGC / creator content", group: "formats", re: /\bugc\b|creator[\s-]shot|user[\s-]generated/i },
  { key: "testimonial", label: "testimonials", group: "formats", re: /testimonial|customer\s+review/i },
  { key: "video", label: "video", group: "formats", re: /\bvideos?\b/i },
  { key: "static", label: "statics", group: "formats", re: /\bstatics?\b/i },
  { key: "carousel", label: "carousels", group: "formats", re: /carousel/i },
  { key: "meme", label: "meme-style creative", group: "formats", re: /\bmeme/i },
  { key: "problem-first", label: "problem-first hooks", group: "hooks", re: /problem[\s-](first|led)|pain[\s-]?point/i },
  { key: "before-after", label: "before/after framing", group: "hooks", re: /before[\s/&-]*after/i },
  { key: "question", label: "question hooks", group: "hooks", re: /question\s+hook/i },
  { key: "pov", label: "POV-style hooks", group: "hooks", re: /\bpov\b/i },
  { key: "comparison", label: "comparison angles", group: "hooks", re: /comparison|\bversus\b|\bvs\.?\b/i },
  { key: "social-proof", label: "social-proof hooks", group: "hooks", re: /social[\s-]?proof/i },
  { key: "guarantee", label: "guarantee / risk-reversal", group: "hooks", re: /guarante|money[\s-]?back|risk[\s-]?free/i },
  { key: "bundle", label: "bundle offers", group: "offers", re: /bundle/i },
  { key: "discount", label: "discounts", group: "offers", re: /discount|%\s?off|\bsale\b/i },
  { key: "first-order", label: "first-order offers", group: "offers", re: /first[\s-]order|new[\s-]customer\s+offer/i },
  { key: "free-shipping", label: "free shipping", group: "offers", re: /free\s+shipping/i },
  { key: "subscription", label: "subscription / trial offers", group: "offers", re: /subscri|free\s+trial|\btrial\b/i },
  { key: "limited-time", label: "limited-time offers", group: "offers", re: /limited[\s-]?time|flash\s+sale|\b24[\s-]?hour/i },
];

export function extractMarketSignals(text: string): MarketSignals {
  const matched = MARKET_TERMS.filter((t) => t.re.test(text));
  const keys = new Set(matched.map((t) => t.key));
  const labels = (group: string) =>
    matched
      .filter((t) => t.group === group)
      // "video" adds nothing when a specific video format also matched
      .filter((t) => t.key !== "video" || !(keys.has("founder-led") || keys.has("ugc")))
      .map((t) => t.label);
  return {
    formats: labels("formats"),
    hooks: labels("hooks"),
    offers: labels("offers"),
    has: (key) => keys.has(key),
  };
}

/* ------------------------------------------------------------------ */
/* "Structure notes": local, deterministic reformatting of the pasted  */
/* textarea. Groups recognized signals, keeps every URL, and carries   */
/* anything unrecognized verbatim under "Raw notes" — nothing is       */
/* invented and no line of the user's own meaning is silently          */
/* upgraded into a claim. Idempotent: running it on its own output     */
/* yields the same text.                                               */
/* ------------------------------------------------------------------ */

const URL_RE = /https?:\/\/[^\s)>"'\]]+/g;

/** Headers this structurer emits — recognized (and skipped as raw
 *  fragments) on re-runs so the operation is idempotent. */
const STRUCTURE_HEADERS = [
  "Observed formats:",
  "Repeated hooks:",
  "Offer patterns:",
  "Links / examples:",
  "Raw notes:",
];

/**
 * Returns the structured version of the notes, or null when there is
 * nothing recognizable to structure (empty text, or no links and no
 * known signals). Never deletes a URL; duplicates are kept as pasted.
 */
export function structureMarketNotes(rawText: string): string | null {
  const text = rawText.trim();
  if (text === "") return null;

  const urls = text.match(URL_RE) ?? [];
  const withoutUrls = text.replace(URL_RE, " ");
  const signals = extractMarketSignals(withoutUrls);

  const hasSignals =
    signals.formats.length > 0 || signals.hooks.length > 0 || signals.offers.length > 0;
  if (urls.length === 0 && !hasSignals) return null;

  /* Line-level fragments, minus bullet markers, empties, and our own
     previously-emitted headers/category lines. */
  const fragments = withoutUrls
    .split(/\n+/)
    .map((line) => line.replace(/^[\s•*·-]+/, "").trim())
    .filter((line) => line !== "")
    .filter((line) => !STRUCTURE_HEADERS.some((h) => line.startsWith(h)));

  /* A fragment is "captured" when it contains a recognized term (the
     category lines restate it); everything else stays verbatim. */
  const rawNotes = fragments.filter((f) => !MARKET_TERMS.some((t) => t.re.test(f)));

  const out: string[] = [];
  if (signals.formats.length > 0) out.push(`Observed formats: ${signals.formats.join(", ")}`);
  if (signals.hooks.length > 0) out.push(`Repeated hooks: ${signals.hooks.join(", ")}`);
  if (signals.offers.length > 0) out.push(`Offer patterns: ${signals.offers.join(", ")}`);
  if (urls.length > 0) {
    out.push(`Links / examples:\n${urls.map((u) => `- ${u}`).join("\n")}`);
  }
  if (rawNotes.length > 0) {
    out.push(`Raw notes:\n${rawNotes.map((f) => `- ${f}`).join("\n")}`);
  }
  return out.join("\n");
}
