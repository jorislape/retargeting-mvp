/**
 * Competitor Landing Page Fetch V1 — domain types.
 *
 * One user-triggered fetch of one public competitor page, turned into
 * deterministic, directional text signals. Nothing here is persisted:
 * the page HTML lives only for the request, the signals live only in
 * the response, and the URL lives only in the generator's React state.
 * This is NOT monitoring and NOT a scraper — one click, one page, once.
 */

/** Deterministic signals extracted from one fetched page. Every field
 *  is optional — only what the page actually shows is returned, and
 *  all of it is "observed on page" wording, never a performance or
 *  traffic claim. */
export interface CompetitorPageSignals {
  headline?: string;
  cta?: string;
  offer?: string;
  positioning?: string;
  benefits?: string[];
  trustSignals?: string[];
  rawSummary?: string;
}

/** Response contract for POST /api/competitor/fetch-page. Errors are
 *  flat (title/message/fix) per this route's contract. */
export type FetchPageResponse =
  | { ok: true; signals: CompetitorPageSignals }
  | { ok: false; title: string; message: string; fix: string };

/** Intermediate result of HTML → text extraction (pageText.ts). */
export interface PageTextParts {
  title: string;
  metaDescription: string;
  /** h1s first, then h2s — capped. */
  headings: string[];
  /** Short button/anchor texts — CTA candidates, deduped, capped. */
  ctaCandidates: string[];
  /** Tag-stripped visible-ish text, whitespace-collapsed, capped. */
  bodyText: string;
}
