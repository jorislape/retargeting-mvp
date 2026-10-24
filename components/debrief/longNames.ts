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

/**
 * Bulletproof pass B1 — collision-safe display names. Middle truncation
 * alone made 86 different ads of a real export share a displayed name at
 * 60 characters (147 at 40): agency names differ only in a middle token
 * ("[SKU]00147"). For a universe of ad names and a length cap, every
 * name gets a display form that no other name shares:
 *  - names that don't collide keep the plain middle truncation;
 *  - colliding names show the segment where they differ, widened to its
 *    whole token ("[SKU]00147_"), between a short head and tail — the
 *    distinguishing token stays visible even if that runs past the cap;
 *  - anything still ambiguous falls back to the full name.
 */
export function disambiguateNames(universe: readonly string[], max: number): Map<string, string> {
  const names = [...new Set(universe)];
  const out = new Map<string, string>();
  const groups = new Map<string, string[]>();
  for (const n of names) {
    const short = middleTruncate(n, max);
    groups.set(short, [...(groups.get(short) ?? []), n]);
  }
  for (const [short, group] of groups) {
    if (group.length === 1) {
      out.set(group[0], short);
      continue;
    }
    for (const name of group) out.set(name, distinguish(name, group.filter((o) => o !== name), max));
  }
  /* Final guard: any display shared by two names → both get full names. */
  const seen = new Map<string, string[]>();
  for (const [name, d] of out) seen.set(d, [...(seen.get(d) ?? []), name]);
  for (const [, shared] of seen) if (shared.length > 1) for (const n of shared) out.set(n, n);
  return out;
}

/** `name` shown so it differs from every name in `others`. */
function distinguish(name: string, others: readonly string[], max: number): string {
  let start = name.length;
  let end = 0;
  for (const o of others) {
    let p = 0;
    while (p < name.length && p < o.length && name[p] === o[p]) p++;
    let q = 0;
    while (q < name.length - p && q < o.length - p && name[name.length - 1 - q] === o[o.length - 1 - q]) q++;
    start = Math.min(start, p);
    end = Math.max(end, name.length - q);
  }
  if (end <= start) return name;
  /* Widen to whole tokens: back to the "[" (or separator) that opens the
     token, forward to the separator that closes it. */
  const open = Math.max(name.lastIndexOf("[", start), name.lastIndexOf("_", start - 1) + 1, name.lastIndexOf(" ", start - 1) + 1, 0);
  const closeAt = (i: number) => {
    const cands = ["_", " ", "["].map((c) => name.indexOf(c, i)).filter((x) => x >= 0);
    return cands.length > 0 ? Math.min(...cands) : name.length;
  };
  const close = closeAt(Math.max(end, open + 1));
  const mid = name.slice(open, close);
  const room = Math.max(8, max - mid.length - 2);
  const headLen = Math.min(open, Math.ceil(room * 0.6));
  const tailLen = Math.min(name.length - close, room - headLen);
  const head = open === 0 ? "" : open <= headLen ? name.slice(0, open) : `${name.slice(0, headLen)}…`;
  const tail = close >= name.length ? "" : name.length - close <= tailLen ? name.slice(close) : `…${name.slice(name.length - tailLen)}`;
  return `${head}${mid}${tail}`;
}

/** A shortener over one report's ads: `(name, max) → display`. */
export function buildNameShortener(universe: readonly string[]): (name: string, max?: number) => string {
  const cache = new Map<number, Map<string, string>>();
  return (name: string, max: number = NAME_DISPLAY_MAX) => {
    let m = cache.get(max);
    if (!m) {
      m = disambiguateNames(universe, max);
      cache.set(max, m);
    }
    return m.get(name) ?? middleTruncate(name, max);
  };
}

/**
 * Bulletproof pass B3 — readable client labels. A name that carries
 * `[KEY]VALUE` tokens reads, for a client, as its format, angle, SKU and
 * date ("UGC · QUAL · SKU 00147 · 2025-02-13") instead of the raw
 * string. Collision-safe like the buyer names: when two ads would share
 * a label, more tokens join (hook, file number, variant, concept, …), then
 * a "copy" marker; if they still tie, the label carries the raw name's
 * distinguishing segment. Untokened names get no label (null) — callers
 * show the collision-safe raw name instead.
 */
const LABEL_TOKEN = /\[([A-Z][A-Z0-9]{0,7})\]([^[]*)/g;
const FORMAT_WORDS: Record<string, string> = { UGC: "UGC", IMG: "Image", IMAGE: "Image", VID: "Video", VIDEO: "Video", CAR: "Carousel", STATIC: "Static" };
const BASE_KEYS = ["FOR", "AN", "SKU", "DTE"];
const EXTRA_KEYS = ["HK", "FN", "VAR", "CN", "PR", "STG", "AUD", "PLT", "TP", "CR", "EM", "CTA", "OLD", "CD", "ED"];

function nameTokens(name: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of name.matchAll(LABEL_TOKEN)) {
    const v = m[2].replace(/\s*[-–—]\s*Copy(?:\s*\d+)?\s*$/i, "").replace(/^[\s_\-.]+|[\s_\-.]+$/g, "");
    if (v !== "" && !out.has(m[1])) out.set(m[1], v);
  }
  return out;
}

function tokenPart(key: string, value: string): string {
  if (key === "FOR") return FORMAT_WORDS[value.toUpperCase()] ?? value;
  if (key === "SKU") return `SKU ${value}`;
  if (key === "DTE") {
    const d = value.match(/^(?:20)?(\d{2})(\d{2})(\d{2})$/);
    return d ? `20${d[1]}-${d[2]}-${d[3]}` : value;
  }
  if (["AN", "CN", "PR", "STG", "AUD", "PLT", "TP", "CR", "EM", "CTA"].includes(key)) return value.replace(/_/g, " ");
  return `${key} ${value}`;
}

/** name → label for every tokened name in `universe` (collision-safe
 *  against every other label AND every untokened raw name). Within a
 *  colliding group only the FIRST token whose values differ joins (then
 *  "copy" when only copy status differs), so labels stay short. */
export function buildClientLabels(universe: readonly string[]): Map<string, string> {
  const names = [...new Set(universe)];
  const tokens = new Map(names.map((n) => [n, nameTokens(n)] as const).filter(([, t]) => t.size > 0));
  const tokened = [...tokens.keys()];
  const isCopy = (n: string) => /[-–—]\s*Copy(?:\s*\d+)?\s*$/i.test(n);
  const extras = new Map<string, string[]>(tokened.map((n) => [n, []]));
  const copyMark = new Set<string>();
  const rawTail = new Map<string, string>();
  const labelOf = (n: string) => {
    const t = tokens.get(n)!;
    const parts = [...BASE_KEYS, ...extras.get(n)!].filter((k) => t.has(k)).map((k) => tokenPart(k, t.get(k)!));
    if (copyMark.has(n)) parts.push("copy");
    if (rawTail.has(n)) parts.push(rawTail.get(n)!);
    return parts.join(" · ");
  };
  const taken = new Set(names.filter((n) => !tokens.has(n)));
  for (let round = 0; round < 40; round++) {
    const by = new Map<string, string[]>();
    for (const n of tokened) by.set(labelOf(n), [...(by.get(labelOf(n)) ?? []), n]);
    let changed = false;
    for (const [l, group] of by) {
      if (group.length === 1 && !taken.has(l)) continue;
      const used = new Set(extras.get(group[0])!);
      const candidates = [...EXTRA_KEYS, ...[...new Set(group.flatMap((n) => [...tokens.get(n)!.keys()]))].sort()].filter(
        (k) => !BASE_KEYS.includes(k) && !used.has(k)
      );
      const key = candidates.find((k) => new Set(group.map((n) => tokens.get(n)!.get(k) ?? "")).size > 1);
      if (key) {
        for (const n of group) extras.get(n)!.push(key);
        changed = true;
      } else if (group.some(isCopy) && group.some((n) => !isCopy(n)) && !group.some((n) => copyMark.has(n))) {
        for (const n of group) if (isCopy(n)) copyMark.add(n);
        changed = true;
      } else if (!group.some((n) => rawTail.has(n))) {
        const raw = disambiguateNames(group, 40);
        for (const n of group) rawTail.set(n, raw.get(n)!);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return new Map(tokened.map((n) => [n, labelOf(n)]));
}
