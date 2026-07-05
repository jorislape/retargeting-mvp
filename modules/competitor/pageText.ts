import type { PageTextParts } from "./types";

/**
 * HTML → text parts, by hand (no dependency, same spirit as the CSV
 * parser). Best-effort by design: marketing pages are messy, and the
 * goal is "visible-ish text for keyword scanning", not a DOM. Pure
 * string work — nothing is fetched or stored here.
 */

const MAX_HEADINGS = 8;
const MAX_CTA_CANDIDATES = 40;
const MAX_CTA_LENGTH = 60;
const MAX_BODY_CHARS = 20000;

/** Decode the handful of entities that matter for keyword scanning. */
function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return n > 0 && n < 0x10ffff ? String.fromCodePoint(n) : " ";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      const n = parseInt(code, 16);
      return n > 0 && n < 0x10ffff ? String.fromCodePoint(n) : " ";
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&(apos|#39|rsquo|lsquo);/gi, "'")
    .replace(/&(rdquo|ldquo);/gi, '"')
    .replace(/&(mdash|ndash);/gi, "—")
    .replace(/&hellip;/gi, "…")
    /* Any remaining named entity becomes a space — keyword scanning
       prefers a clean gap over a literal "&foo;". */
    .replace(/&[a-z][a-z0-9]{1,12};/gi, " ");
}

/** Strip tags, decode entities, collapse whitespace. */
function textOf(fragment: string): string {
  return decodeEntities(fragment.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function matchAll(html: string, re: RegExp, cap: number): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(re)) {
    const text = textOf(m[1] ?? "");
    if (text !== "") out.push(text);
    if (out.length >= cap) break;
  }
  return out;
}

/** Content of a <meta> tag matched by name/property, order-agnostic
 *  between the name and content attributes. */
function metaContent(html: string, key: string): string {
  const tag = html.match(
    new RegExp(
      `<meta\\b(?=[^>]*(?:name|property)=["']${key}["'])[^>]*>`,
      "i"
    )
  );
  if (!tag) return "";
  const content = tag[0].match(/content=["']([^"']*)["']/i);
  return content ? textOf(content[1]) : "";
}

export function extractPageText(html: string): PageTextParts {
  /* Title + meta come from the raw head, before any stripping. */
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? textOf(titleMatch[1]) : "";
  const metaDescription =
    metaContent(html, "description") || metaContent(html, "og:description");

  /* Drop non-visible and noisy regions. Regex-level, best effort —
     a nav that survives just adds a few stray words to bodyText. */
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(
      /<(script|style|noscript|template|svg|iframe|nav|footer)\b[\s\S]*?<\/\1\s*>/gi,
      " "
    );

  const headings = [
    ...matchAll(cleaned, /<h1[^>]*>([\s\S]*?)<\/h1\s*>/gi, MAX_HEADINGS),
    ...matchAll(cleaned, /<h2[^>]*>([\s\S]*?)<\/h2\s*>/gi, MAX_HEADINGS),
  ].slice(0, MAX_HEADINGS);

  /* Short button/anchor texts are where CTAs live. */
  const seen = new Set<string>();
  const ctaCandidates: string[] = [];
  for (const raw of [
    ...matchAll(cleaned, /<button[^>]*>([\s\S]*?)<\/button\s*>/gi, 120),
    ...matchAll(cleaned, /<a\b[^>]*>([\s\S]*?)<\/a\s*>/gi, 400),
  ]) {
    const text = raw.slice(0, MAX_CTA_LENGTH + 1);
    if (text.length === 0 || text.length > MAX_CTA_LENGTH) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ctaCandidates.push(text);
    if (ctaCandidates.length >= MAX_CTA_CANDIDATES) break;
  }

  const bodyText = textOf(cleaned).slice(0, MAX_BODY_CHARS);

  return { title, metaDescription, headings, ctaCandidates, bodyText };
}
