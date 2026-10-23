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
 *  ("…") too long to show in full. Engine copy always quotes names with
 *  straight double quotes; shorter quoted text stays plain. Joining the
 *  parts back (text, or `"${name}"`) reproduces the input exactly. */
export function splitLongNames(text: string, max: number = NAME_DISPLAY_MAX): NamePart[] {
  const parts: NamePart[] = [];
  const re = new RegExp(`"([^"]{${max + 1},})"`, "g");
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ text: text.slice(last, at) });
    parts.push({ name: m[1], short: middleTruncate(m[1], max) });
    last = at + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
