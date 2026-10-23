/**
 * Real-account fix 5 — long ad names on screen and in print.
 *
 * Agency naming conventions produce 120–200-character names
 * ("[VAR]ORG_[SKU]00229_[FOR]UGC_[AN]QUAL_[STG]TOFU_…"). Inside a
 * sentence (the Next move headline, budget lists, test titles, client
 * copy) they swamp the text and blow out narrow cards, so those
 * surfaces show a MIDDLE-truncated name — the start and the end both
 * carry meaning in these conventions — with the full name in a
 * tooltip. Pure string work, no React, so it runs under the plain-Node
 * test runner. TXT/Copy never call it: exports keep full names.
 */

/** Names longer than this are middle-truncated in running text. */
export const NAME_DISPLAY_MAX = 60;

/** Tighter cap for print/PDF (Real-account fix 6): a page is narrower
 *  than a screen and every extra line costs paper. */
export const NAME_PRINT_MAX = 40;

/** "start…end", exactly `max` characters (60% head, 40% tail). Names
 *  at or under `max` come back unchanged. */
export function middleTruncate(name: string, max: number = NAME_DISPLAY_MAX): string {
  if (name.length <= max) return name;
  const keep = max - 1;
  const head = Math.ceil(keep * 0.6);
  return `${name.slice(0, head)}…${name.slice(name.length - (keep - head))}`;
}

export type NamePart = { text: string } | { name: string; short: string };

/** Splits an engine sentence into plain text and the quoted ad names
 *  ("…") too long to show in full. Quotes are read strictly in PAIRS
 *  (open, close, open, close…), so the text BETWEEN two names is never
 *  mistaken for a name — the bug a regex scan had when a short name sat
 *  before a long one. An unpaired trailing quote stays plain text.
 *  Engine copy always quotes names with straight double quotes; shorter
 *  quoted text stays plain. Joining the parts back (text, or
 *  `"${name}"`) reproduces the input exactly. */
export function splitLongNames(text: string, max: number = NAME_DISPLAY_MAX): NamePart[] {
  const segments = text.split('"');
  /* Even segments are plain text, odd ones quoted. With an odd number
     of quotes the last segment has no closing quote: plain. */
  const unpaired = segments.length % 2 === 0 ? segments.length - 1 : -1;
  const parts: NamePart[] = [];
  let plain = "";
  segments.forEach((seg, i) => {
    if (i % 2 === 0) plain += seg;
    else if (i === unpaired) plain += `"${seg}`;
    else if (seg.length > max) {
      if (plain) parts.push({ text: plain });
      plain = "";
      parts.push({ name: seg, short: middleTruncate(seg, max) });
    } else plain += `"${seg}"`;
  });
  if (plain) parts.push({ text: plain });
  return parts;
}
