# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Debrief — a single-flow Meta Ads creative debrief tool, built on Next.js (App Router) + React 19 + Tailwind v4 + TypeScript (plus `motion` for the marketing page only). Load ad-level performance data (CSV upload, built-in sample dataset, or read-only Meta OAuth pull), add context (KPI, product/offer/goal, optional pasted market/competitor notes), get a one-page decision-first memo: what worked, what failed, what to test next, what NOT to do, why the confidence level is what it is — rendered in two audiences (buyer memo / client report), with selected tests expandable into hand-off creative briefs. Read `ARCHITECTURE.md` for what this pivoted from and why almost everything from the prior version was deleted rather than kept "just in case."

## Commands

```bash
npm run dev          # dev server at localhost:3000
npm run build        # production build
npx tsc --noEmit     # typecheck
npx eslint .         # lint
npm test             # every script test in one run (list below)
```

The full check is `npm run build && npx tsc --noEmit && npx eslint . && npm test`. There is no other test runner; behavioral verification is manual against the dev server — `TESTING.md` is the checklist, and the sample dataset's expected numbers (spend gate ≈ $120.91, 11 judged / 3 set aside, per-KPI medians) are documented in `modules/debrief/sampleCsv.ts` for asserting against. Every `scripts/*.test.ts` is a plain-Node script (no Jest/Vitest) — run one directly with `node scripts/<name>.test.ts`, or via its `npm run test:<name>` alias in `package.json`:

- `test:csv`, `test:watchlist`, `test:signals`, `test:signal-summary` — the debrief/competitor engine proofs (RFC 4180 escaping, watchlist sanitize/diff/format/append, signal-builder tables, signal-summary interpretation).
- `test:competitor-debrief` — Competitor Debrief V1 engine proofs: insufficient-evidence handling, category detection, no forbidden performance/spend claims outside the fixed caveat, and a source-scan asserting the engine imports no network/fetch code.
- `test:ad-parser` — the labeled/plain bulk ad-example parser (block splitting, per-field extraction, duplicate detection, mode-aware completeness).
- `test:ads-library-parser` — the native (unlabeled) Ads Library copy pipeline: the `looksLikeAdsLibraryCopy` detection heuristic, hook/benefit/proof/offer/CTA extraction from real-world-shaped samples, disclaimer-paragraph exclusion, and that labeled input always wins routing even when bullets are also present.
- `test:internal-learnings` — Internal Learnings MVP: line parsing/dedup, the conservative `termsOverlap` matcher in isolation, all three next-test adjustment paths (suppress/adjust, comparative reframe, builds-on tag) against hand-built fixtures, and full end-to-end health-product/SaaS runs proving no cross-domain contamination.
- `test:monitoring-ssrf` — exhaustive SSRF validator matrix (private v4/v6 ranges, IPv4-mapped v6, redirect-hop re-validation, connect-time pinning contract) for `modules/competitor/guardedFetch.ts` + `ssrf.ts`.
- `test:monitoring-differ`, `test:monitoring-scheduler`, `test:monitoring-status` — pure logic proofs for content-hashing/dedup, the failure-matrix/auto-pause state machine, and the outcome→label/next-check presentation helpers.
- `test:monitoring-isolation` — import-graph check (nothing outside `modules/monitoring`, `app/api/monitoring`, `components/monitoring` may import monitoring code), confirms core routes work with `DATABASE_URL` unset, and enforces "no `<form>`, every `<button>` is `type=\"button\"`" inside `components/monitoring/*` (a nested `<form>` inside `GeneratorPanel`'s page-wide form caused a real production bug — native full-page reload on submit).
- `test:monitoring-routes` — HTTP-level integration test that boots the real dev server twice (flag off / flag on with no DB) and asserts on live responses, since `next/server` has no plain-Node import path.

No environment variables are required for the CSV-upload flow. The optional Meta data source needs `META_APP_ID` and `META_APP_SECRET`; the OAuth redirect URI is derived from the request origin per environment (`modules/meta/config.ts`), with `META_REDIRECT_URI` as an optional explicit override — see `.env.example`. `GET /api/meta/config` reports the resolved redirect URI (never the secret).

The optional Competitor Monitoring Beta (flag default OFF — see the fence below) needs `MONITORING_ENABLED`, `DATABASE_URL` (a **fresh** Neon Postgres database — never point it at an existing/pre-pivot one), and `CRON_SECRET`; `MONITORING_MAX_ACTIVE_URLS` is optional (default 500). `npm run monitoring:generate` regenerates the Drizzle migration in `drizzle/` after a schema change; `npm run monitoring:migrate` applies it and **refuses to run** if the target database already contains unexpected tables. Full provisioning steps (Neon via the Vercel Marketplace, cron registration, rollback tiers): `docs/monitoring-setup.md`.

## Scope fence — read before adding anything

This product has a hard, deliberate scope: **no auth, no user accounts, no saved history, no billing, no team workspaces, no analytics dashboards, no external AI calls, no scraping — and ADS DATA (CSVs, memos, reports, Meta tokens) is NEVER persisted server-side, in any form.** There are exactly TWO approved persistence exceptions, each with its own fenced section below: the browser-local competitor watchlist (localStorage, `modules/competitor/watchlist.ts` — user-entered competitor info and fetched public-page signal summaries only; never CSV data, memos, reports, or tokens; do not add other localStorage keys) and the flag-gated **Competitor Monitoring Beta V1** (server-side, `modules/monitoring/` — see its fence below). The whole core flow is data in → KPI + context → deterministic analysis → one-page memo on the same page — nothing else is reachable, and nothing should become reachable as a "small addition." Any further persistence is a new, explicit milestone to be requested — not something to add quietly while doing something else.

The CSV (and the generated memo) must never be written to a database, a file, a cache, or a log. `app/api/debrief/route.ts` only logs structural facts on error (an error code, a row count) — never CSV rows or memo content. Keep it that way. (Structured error *responses* may echo the CSV's own header names back to the user — headers are structural and go only to the person who uploaded them; still never log them.)

**Meta data source (the one approved exception to "no auth"):** the generator can also connect a Meta account via OAuth (`modules/meta/`, `app/api/meta/*`, `MetaProvider`/`MetaConnect`) and pull ad-level insights as a "virtual CSV" that feeds the identical debrief pipeline. Its constraints are part of the fence: scope is read-only `ads_read` (never widen); the access token lives only in browser memory (`MetaProvider`) and is forwarded per-request via the Authorization header — never a cookie, never storage, never a query param, never a log (the only cookie in the flow is the short-lived OAuth CSRF nonce); insights pulls set `use_unified_attribution_setting=true` so numbers match Ads Manager; the OAuth bridge (`modules/meta/bridge.ts`) posts to an exact origin and `MetaProvider` verifies `event.origin` with strict equality — no wildcards; the Graph API version is pinned in `modules/meta/graph.ts` — check deprecation runway when bumping.

**Market / competitor notes (manual input, plus ONE approved fetch):** the optional `marketContext` textarea is pasted text — on its own, no network action, no schedule, never a claim about competitor spend or performance. (Two features layer network/persistence on top of it, each separately approved below: the one-time page fetch, and Competitor Watchlist V1. Neither implies Ads Library scraping, which stays refused everywhere in this product.) The one approved network action is **Competitor Landing Page Fetch V1** (`modules/competitor/`, `POST /api/competitor/fetch-page`): a single user-triggered fetch of one public landing page per click of "Fetch page signals" on a competitor-source card. Its constraints are part of the fence: SSRF-guarded (http/https only, no credentials, standard ports, hostname blocklist, every DNS answer checked against private/reserved ranges, every redirect hop re-validated — see `modules/competitor/server.ts`), hard timeout + response-size cap, text/html only; Ads Library URLs are refused by policy with a "paste manually" message, never fetched; extraction is deterministic keyword work ("observed on page" wording only); the result is appended to that source's NOTES field for the user to review — it reaches the report only through the existing "Use as market notes" → `marketContext` path; nothing is stored, cached, or logged (no URLs, no page text). Never widen this into Ads Library reading; the ONLY approved recurring fetch is the flag-gated Monitoring Beta below, which has its own fence. **Competitor Watchlist V1** layers on top of this fetch, not around it: up to 5 competitor pages saved in localStorage (browser-only — see the exception above; session memory if unavailable), each refreshed ONLY by an explicit "Refresh signals"/"Refresh all" click through the same guarded route ("Refresh all" is sequential, one failure never stops the rest); the latest and previous signal snapshots enable a simple normalized-string diff ("Headline changed", "No meaningful change detected") shown in the UI and in the notes block; nothing reaches the report until the user clicks "Add refreshed signals to market notes" (append-only, dedupe on identical block, caveat line included). The watchlist itself has no schedules, no alerts, no background refresh — ever; the separate, flag-gated Monitoring Beta (below) is the only scheduled path, and it never touches the watchlist. Everything derived from it — the "Structure notes" button, the quality meter, the memo's Market signal section, market-flavored test/brief wording — is local, deterministic keyword matching (`modules/debrief/marketSignals.ts`), always marked "directional," and own account data stays the primary signal. An empty `marketContext` must leave the memo's content exactly as if the feature didn't exist (`marketSignal: null`, no market wording anywhere). The "Competitor sources" cards in the generator are the same rule wearing a form: manual fields (name / URL / Ads Library links / notes) that "Use as market notes" serializes into `marketContext` as plain text — append-only, restating only what the user typed, URLs never fetched or monitored. The engine and API never see competitor sources as a separate input.

**Competitor Monitoring Beta V1 (approved milestone — the ONLY server-side persistence, flag-default-OFF):** an optional beta behind `MONITORING_ENABLED` (unset/anything-but-true ⇒ routes return `{disabled:true}`, cron no-ops, UI renders nothing). What it may do — and ALL it may do: store up to 3 user-entered competitor page URLs per pseudonymous workspace (an httpOnly-cookie token whose SHA-256 is the DB key — see `modules/monitoring/workspace.ts`), re-check them AT MOST WEEKLY via one daily Vercel cron (`app/api/monitoring/cron`, `CRON_SECRET`, bounded batch) plus rate-limited manual retries, and keep extracted page signals (never full HTML) + a pruned outcome history in the five `modules/monitoring/db/schema.ts` tables. Hard boundaries that are part of this fence: **no alerts or notifications; no sub-weekly cadence; no Ads Library; no headless browsers, proxies, or anti-bot evasion (403/429/challenge ⇒ recorded as `blocked`, full stop); no competitor spend/traffic/performance inference; no expansion of what is stored (never ads data, never page copies).** Fetches go through the shared pinned pipeline (`modules/competitor/guardedFetch.ts` + `ssrf.ts`). Isolation is mandatory and test-enforced: ALL monitoring server code lives in `modules/monitoring/` + `app/api/monitoring/*` + `components/monitoring/*`; core modules NEVER import monitoring (the single UI mount in `GeneratorPanel` imports `components/monitoring` only); the DB client exists ONLY inside `modules/monitoring/db/client.ts` and the whole core product must run with `DATABASE_URL` unset. Failed checks never modify stored snapshots. Rollback tiers: flag off → remove cron from `vercel.json` → drop the tables (beta data loss is disclosed in the UI). Any expansion — alerts, more URLs, faster checks, new stored fields — is a NEW explicit milestone, not an amendment.

**Competitor Debrief V1 (approved milestone — a second, CSV-free flow, `/competitor-debrief`):** a separate route from the performance debrief, sharing no state with `DebriefProvider`/`GeneratorPanel`. The user pastes a competitor name, a Meta Ads Library URL, an optional website URL, and free-text ad observations; `modules/competitorDebrief/engine.ts` turns that into a structured, directional read (recurring hooks, creative formats, offer patterns, positioning themes, what stands out, 3–5 next tests, what to monitor next) by reusing the existing keyword tables — `extractMarketSignals` (`modules/debrief/marketSignals.ts`) for hooks/formats/offers, and the exported `POSITIONING_TERMS`/`TRUST_TERMS`/`BENEFIT_TERMS`/`detect` from `modules/competitor/pageSignals.ts` — rather than a second interpretation system. Hard boundaries: **the engine and the manual paste modes never fetch** — the Ads Library URL and website URL are validated for shape only and echoed back as source references; neither is passed to `guardedFetch`/`server.ts` or any network call from the engine (test-enforced by `scripts/competitorDebrief.test.ts`, which scans `engine.ts` for network imports). **Meta Ad Library API Integration V1 (approved milestone — the ONE fetching path in this flow):** the optional "Search advertiser — EU/UK beta" input mode queries Meta's official Ad Library API server-side (`modules/metaAdLibrary/`, `app/api/meta-ad-library/{search,page-ads}`): keyword discovery reduced to deduplicated candidate Pages (never presented as the competitor's ads — `search_terms` matches ad text, not ownership), mandatory exact-Page selection (never auto-selected), a page-scoped ACTIVE-ads fetch via `search_page_ids` with per-ad `page_id` re-validation and per-ad text caps, all stateless and in-memory (nothing stored, cached, or logged; `META_AD_LIBRARY_ACCESS_TOKEN` is server-env only — never `NEXT_PUBLIC_` — and is stripped from Meta's token-bearing `ad_snapshot_url` before any response). Fetched ads reach the engine as the same plain `adTexts`/`observations` strings the paste flows produce, plus a wording-only `sourceMode: "adsLibraryApi"` flag so the report says "selected Meta Ads Library ads" instead of paste phrasing — analysis rules are identical for both modes and the engine still imports no network code (test-enforced by `scripts/metaAdLibraryIntegration.test.ts`). This is the official API, not scraping — no headless browsers, no evasion — and it widens no other fence; expansions (more markets, auto-refresh, storing fetched ads) are new explicit milestones. No spend/conversion/ROAS/performance/winning-ad claim is ever generated — every output field is keyword-table-derived, so this holds by construction; the one place those words legitimately appear is the fixed caveat that disclaims them. When nothing recognizable is pasted, `insufficientEvidence: true` is returned instead of invented categories or tests — mirrors the CSV engine's "metrics only — angle unknown" honesty rule. Stateless like `/api/debrief`: nothing about the request is stored, cached, or logged. This flow does not read or write the Competitor Watchlist or Monitoring Beta in any way — a future "monitor this competitor debrief" link between the two is a new explicit milestone, not an amendment. **Internal Learnings MVP** layers on top, still stateless and manual-input-only: an optional "Internal learnings" textarea (one "Worked:"/"Failed:"/"Avoid:"/"Learning:" line each) that `modules/competitorDebrief/internalLearnings.ts` uses to adjust — never fabricate — the generated `nextTests`, so a flagged angle is never recommended as-is and a validated one is presented as building on prior results rather than as new. No database, no account memory, no LLM; see the module's own doc comment and `modules/competitorDebrief/engine.ts` for how it's wired in as a pure post-processing step.

## Architecture

```
modules/debrief/               # the engine — pure, deterministic, no I/O
  csv.ts          # hand-written CSV parser (no dependency)
  columns.ts      # resolves Meta's varying export column names via normalized alias
                  # matching. Hardening rules: aliases < 3 chars ("ad") are exact-match
                  # only (as substrings they hit "leads"/"return on ad spend"), and the
                  # generic "spend" alias never resolves into ROAS-shaped headers —
                  # a spend-less CSV must error, not silently misuse the ROAS column
  extract.ts      # raw rows -> ParsedAd[], KPI value derivation, ad-name tag extraction,
                  # applyFormatOverrides (Creative Format Confirmation V1: user-confirmed
                  # formats replace the ad-name tag GUESS and set formatConfirmed — they
                  # feed pattern/test/brief wording only, never spend/KPI/gate/ranking;
                  # no overrides in → the same array back out, output byte-identical)
  analysis.ts     # spend gate, median benchmark, winners/losers, pattern hints
  memo.ts         # assembles the memo — templated, not an LLM call (see below)
  marketSignals.ts# ONE keyword map (formats/hooks/offers) shared by memo generation and
                  # the generator UI: extractMarketSignals, structureMarketNotes (the
                  # local "Structure notes" reformat, idempotent, never drops a URL),
                  # assessMarketNotes (quality meter: category count → strong/good/weak;
                  # summary carries measurable per-category counts, e.g. "Strong — 3
                  # formats, 2 hooks…" — also rendered in the report's context-quality
                  # line),
                  # plus competitor sources V1 (CompetitorSource, formatCompetitorSources,
                  # mergeCompetitorSourcesIntoNotes): manual structured competitor input
                  # serialized into the market-notes text — append-only, restates user
                  # input. URLs are fetched only by the explicit one-time "Fetch page
                  # signals" action (modules/competitor); watchlists/monitoring stay a
                  # future milestone, not a quiet addition
  signalBuilder.ts# Market signal builder tables (4 chip groups, 4 example presets —
                  # presets only FILL the selection, never auto-append) +
                  # formatSelectedSignals ("Selected market signals — directional
                  # only:" block + caveat). Pure, runtime-import-free (node-tested);
                  # output is ordinary notes text — nothing downstream knows the
                  # builder exists
  format.ts       # money/count/KPI value formatting
  sampleCsv.ts    # THE sample dataset (client-safe, no engine imports) — tuned to the
                  # rules engine; its header comment lists invariants to keep when
                  # editing. SAMPLE_CONTEXT includes a marketContext so the sample
                  # demonstrates the market-signal path
  sample.ts       # server-side: sample memo via the real engine (renders /sample)
  types.ts        # domain types: Memo (both registers), MemoTest (with signals + brief),
                  # MemoBrief, MemoMarketSignal, avoid lists, confidence reasons,
                  # DebriefApiError (the structured error contract)
  index.ts        # public surface — import only from here, not the internal files

modules/competitor/            # Competitor Landing Page Fetch V1 (one-time, user-triggered)
  types.ts        # CompetitorPageSignals, FetchPageResponse (flat ok/title/message/fix)
  pageText.ts     # hand-written HTML → text parts (title, meta, h1/h2, CTA candidates,
                  # capped body text) — pure string work, no dependency
  pageSignals.ts  # deterministic keyword extraction (CTA/offer/positioning/benefits/
                  # trust) + formatPageSignalsAsNotes / appendPageSignalsToNotes —
                  # "observed on page" wording only, never performance claims
  server.ts       # SERVER-ONLY (node:dns/net): SSRF guard + guarded capped fetch;
                  # import from API routes only (same rule as modules/meta/graph.ts)
  watchlist.ts    # Competitor Watchlist V1: WatchlistItem, sanitizeWatchlist (hostile
                  # localStorage → safe shape), the browser-local store (localStorage
                  # key debrief.competitorWatchlist.v1 via useSyncExternalStore; session
                  # memory when unavailable), diffPageSignals (normalized-string diff),
                  # formatWatchlistSignalsAsNotes (+ caveat). Runtime-import-free so
                  # scripts/watchlist.test.ts runs it under plain Node
  index.ts        # client-safe surface (everything except server.ts)

modules/competitorDebrief/     # Competitor Debrief V1 — a second, CSV-free flow (see fence above)
  types.ts        # CompetitorDebriefInput/Output, CompetitorDebriefApiError (flat, matches
                  # modules/competitor's own error shape rather than reusing debrief's)
  adParser.ts     # "Paste ads" bulk splitting + per-ad field extraction. parseAdExample is a
                  # ROUTER over two pipelines: explicit field labels ("Headline:"/"CTA:") always
                  # win (mode "labeled", original logic, unchanged); otherwise text with the
                  # STRUCTURAL shape of raw Meta Ads Library copy (emoji/checkmark bullets, a
                  # bare CTA line) goes to adsLibraryParser.ts (mode "native"); anything else
                  # falls back to this file's own unlabeled extraction (mode "plain", unchanged).
                  # Also: duplicate detection (normalizeForDedupe/findDuplicateIndices/
                  # dedupeAdTexts — whitespace/case-normalized exact match, never fuzzy, so a
                  # pasted duplicate can't inflate strategicPatterns.ts's cross-ad recurrence
                  # count), mode-aware completeness (computeAdCompleteness: the classic 4-field
                  # Headline/CTA/Offer/Format checklist for "labeled" input; an evidence-based
                  # Hook/Story/Benefits/Proof/Offer/Explicit-CTA checklist for "native"/"plain", since
                  # judging natural-language paste against labels it was never going to have was
                  # the exact bug this pipeline exists to fix), and textForAnalysis (raw with any
                  # ignoredDisclaimers paragraphs removed — what should actually be SENT to the
                  # engine, since the engine re-scans whatever text it receives and would
                  # otherwise treat a shared disclaimer footer as a "recurring" pattern)
  adsLibraryParser.ts # The native pipeline — structure-aware, not format-aware: real long-form
                  # story/testimonial ads (AG1/Huel/ColonBroom-style — an opening line, several
                  # testimonial paragraphs, sometimes a "Week 1... Week 4..." timeline) are just
                  # as "Ads Library shaped" as a short bulleted one, AND a single punchy one/two-
                  # line sentence is a complete ad unit too (looksLikeShortNativeAd) — not gated
                  # on length in EITHER direction. looksLikeAdsLibraryCopy's four signals: emoji/
                  # checkmark bullet lists, a bare short CTA line on its own, 2+ genuine prose
                  # paragraphs within generous length bounds, or 1-2 short lines within a narrower
                  # word range (never "absence of labels" alone) + parseAdsLibraryExample
                  # (paragraph-split → drop disclaimer/legal/footnote/copyright paragraphs (kept
                  # verbatim in ignoredDisclaimers, never silently dropped) → infer hook/body from
                  # prose paragraphs → classify bullet LINES into offer/trust/benefit, and (the
                  # generalization of that same idea to unbulleted prose) classify prose UNITS
                  # (lines where line breaks already exist, else sentences) the same way against
                  # the SAME shared tables — offer/trust/benefit/positioning verbatim quotes
                  # extracted from ordinary sentences whenever they're explicitly present, never a
                  # "everything is a benefit" default the way bullets get (a bullet list is
                  # discrete claims by construction; a prose sentence isn't, so an unmatched one
                  # stays uncaptured) → story/narrative recognition: first-person testimonial
                  # paragraphs ("I used to...", "My journey...", "Since 2020...") and "Week N"/
                  # "Day N"/"Month N" timeline entries become verbatim `story` evidence instead of
                  # being ignored or silently folded into `body`; the FIRST prose paragraph always
                  # defaults to `hook` unless it's disclaimer-shaped (isDisclaimerParagraph already
                  # excludes it, so no separate carve-out was needed) → for a SHORT ad specifically
                  # (isShortAd, computed from the disclaimer-free text), two more narrow, additive
                  # fallbacks: a curated positive-outcome pattern ("keep you supported"/"feel
                  # lighter"/"sleep better" — deliberately excludes negative/ambiguous outcomes like
                  # "feel exhausted", which stay honestly uncaptured rather than mislabeled) becomes
                  # a benefit even with no BENEFIT_TERMS keyword hit, and a short non-personal,
                  # non-CTA, non-outcome-shaped fragment ("daily foundational nutrition") becomes
                  # positioning by elimination — both OFF by default for longer/multi-paragraph ads,
                  # where the existing conservative "no default bucket for prose" rule stays intact
                  # → same keyword-table scan over the disclaimer-free text). No AI, no OCR — every
                  # field is still a verbatim quote, a fixed regex match, or a keyword-table hit
                  # (or, for the two short-ad fallbacks, a narrow structural/lexical pattern with a
                  # curated word list — never open-ended); "missing" is always preferred over
                  # a guess, which is why unmatched prose sentences outside a recognized story
                  # paragraph stay uncaptured rather than defaulting to some category
  engine.ts       # generateCompetitorDebrief(input) — templated, not an LLM call (same seam
                  # pattern as modules/debrief/memo.ts). Zero network imports (test-enforced).
                  # Reuses extractMarketSignals + the pageSignals.ts term tables rather than
                  # a second keyword judgment system. Ends by calling internalLearnings.ts's
                  # applyInternalLearnings() as a pure post-processing pass — every synthesis/
                  # strategic-pattern rule above it is unchanged and unaware the feature exists
  internalLearnings.ts # Internal Learnings MVP (manual input only, no DB, no account memory,
                  # no LLM): parseInternalLearnings splits pasted text into one learning per
                  # line ("Worked:"/"Failed:"/"Avoid:"/"Learning:" — unrecognized lines become
                  # outcome "unknown", shown but never actionable), deduped by normalized text.
                  # applyInternalLearnings adjusts the ALREADY-GENERATED nextTests array only —
                  # competitor-evidence arrays always pass through untouched. Matching
                  # (termsOverlap) is deliberately narrow: stemmed, stopword-filtered
                  # significant-term overlap between a learning's text and ONLY a test's
                  # hookOrAngle/offerOrCta (never the boilerplate-heavy hypothesis/
                  # whatYoullLearn prose, and never competitor-evidence labels directly —
                  # that would make one generic shared word tag every test that happens to
                  # reuse a fallback value). A failed/avoid overlap always rewrites the
                  # conflicting field specifically (never left as-is) — substituting an
                  # alternative angle from the debrief's own other evidence fields when one is
                  # available, else an honest "no alternative in evidence yet" placeholder,
                  # never a fabricated alternative. A "Learning:" line phrased as "X
                  # outperforms Y" matched against a test's "A vs. B" hookOrAngle reframes it to
                  # lead with the validated side rather than presenting an untested toss-up. A
                  # plain worked/learning overlap only tags the test (content unchanged) so it
                  # reads as building on validated ground rather than a new idea
  index.ts        # public surface

modules/meta/                  # optional OAuth data source ("virtual CSV")
  graph.ts        # server-only Graph client; version pin; token via Authorization header
  config.ts       # redirect-URI resolution (request-derived, env override) + validation
  bridge.ts       # OAuth popup bridge page (postMessage to exact origin)
  insightsToCsv.ts# serializes insights into Ads-Manager-shaped CSV text
  index.ts        # public surface

modules/monitoring/            # Competitor Monitoring Beta V1 — see the fence above for
                               # what it may/may not do. No barrel index.ts; import each
                               # file directly (matches how the files import each other).
  db/schema.ts    # the 5 Drizzle tables (workspaces, monitored_competitors, snapshots,
                  # check_events, rate_events) + the check_outcome pg enum. Additive-only
                  # migrations live in drizzle/, generated via `npm run monitoring:generate`
  db/client.ts    # the ONLY place a DB client is instantiated in this codebase. getDb()
                  # is lazy (importing the module does nothing) and throws a typed
                  # MonitoringUnavailableError if DATABASE_URL is unset — routes catch
                  # that and degrade instead of crashing. withTransaction() opens a
                  # separate WebSocket Pool connection (the HTTP driver can't do
                  # SELECT...FOR UPDATE) only for the race-free 3-per-workspace cap check
  flag.ts         # monitoringEnabled() — true only for the exact env values "true"/"1";
                  # every route checks this FIRST and returns {disabled:true} otherwise
  workspace.ts    # the pseudonymous ownership model: mints a 256-bit token, stores only
                  # SHA-256(token) as the workspace id (a leaked DB can't impersonate),
                  # cookie is httpOnly/Secure/SameSite=Lax. A cookie whose row no longer
                  # exists is NEVER re-adopted (would let a client plant a chosen token)
                  # — a fresh token is minted instead. Minting only happens on a
                  # mutating action (adding a competitor), never on a read, and is
                  # IP-rate-limited. Dormancy (30d unseen) is computed at query time from
                  # last_seen_at, not stored as a flag, so any visit auto-resumes
                  # scheduling — contrast with per-competitor auto-pause, which is
                  # manual-resume only
  ratelimit.ts    # DB-backed sliding-window limits (serverless has no shared memory).
                  # Keys are SHA-256(salt + raw value); the salt is derived from
                  # CRON_SECRET, never a repo constant, so it's identical across
                  # instances but not public
  outcomes.ts     # the 12-value check_outcome vocabulary, OUTCOME_LABELS, and
                  # isFailureOutcome()/isTransientAttempt() — pure, zero imports, so it's
                  # the one monitoring module safe to import from a "use client" component
  fetcher.ts      # the scheduled-check worker: runs the SAME pinned fetch pipeline as
                  # the one-time competitor fetch (modules/competitor/guardedFetch.ts),
                  # maps its outcome to the check_outcome enum. 403/429/challenge ->
                  # `blocked`, never retried, never evaded
  differ.ts       # canonical content-hash (whitespace/case/dedup-insensitive, so page
                  # noise never triggers a false "changed") + meaningful-change diff,
                  # reusing modules/competitor/watchlist.ts's diffPageSignals rather than
                  # a second interpretation of the same signals
  scheduler.ts    # PURE planning: weekly cadence + jitter, the failure-matrix state
                  # machine (auto-pause after 4 consecutive failures), and
                  # buildCompetitorUpdate() — whose failure-path return value physically
                  # cannot contain last-success fields, so a failed check cannot touch
                  # the retained snapshot by construction (test-enforced). SERVER-ONLY:
                  # imports fetcher.ts -> guardedFetch.ts -> node:http/node:dns
  service.ts      # applies the scheduler's plans against the DB: add (workspace-row-
                  # locked transaction for the 3-per-workspace cap; global ceiling stays
                  # approximate count-then-insert by design) / list / remove / retry
                  # (rate-limited, longer cooldown after `blocked`) / resume /
                  # processDueBatch (the cron's bounded, concurrency-capped batch —
                  # one poisoned URL never aborts the rest; an unfinished batch is
                  # harmless because next_check_at only advances per-row after its own
                  # check persists)
  http.ts         # route-layer glue: uniform {disabled:true}/{unavailable:true} bodies,
                  # error mapping that never leaks internals

components/monitoring/         # the ONLY sanctioned monitoring import into core — a
                               # single mount in GeneratorPanel.tsx (`<MonitoringErrorBoundary><MonitoringSection /></MonitoringErrorBoundary>`)
  MonitoringSection.tsx  # the whole client surface. Talks only to /api/monitoring/*.
                         # Collapsed by default (a compact heading + tagline), auto-opens
                         # via the same `open={condition}` idiom used elsewhere in
                         # GeneratorPanel once the workspace already has competitors —
                         # but the full warning list always renders before the URL input
                         # on every expansion, satisfying "shown before enabling." NOT a
                         # <form> — it's mounted inside the generator's own page-wide
                         # form, so it uses plain onClick/onKeyDown (see
                         # test:monitoring-isolation)
  MonitoringErrorBoundary.tsx  # class component isolation fuse — any render/runtime
                               # failure here becomes an inline card; the rest of the
                               # generator is provably unaffected
  copy.ts         # every monitoring string in one place, incl. the 5 beta-warning
                  # bullets (disclosure — do not shorten or hide behind a click) and the
                  # persistence/scheduling/ownership copy
  status.ts       # client-safe presentation helpers: deriveMonitoringStatus() reduces
                  # the 12 outcomes to 5 truthful states (Pending/Checked/Blocked/Failed/
                  # Paused) built directly on outcomes.ts's isFailureOutcome so it can't
                  # drift from the server's own classification; formatNextCheck() never
                  # shows a precise time (checks run on the next DAILY cron pass, not at
                  # an exact minute) — deliberately NOT in scheduler.ts, which is
                  # server-only (see above)

app/api/monitoring/{competitors,competitors/[id],competitors/[id]/retry,competitors/[id]/resume,cron}/route.ts
                               # cron is GET/POST with constant-time CRON_SECRET
                               # comparison; registered in vercel.json (daily). Every
                               # route checks the flag first and degrades to
                               # {unavailable:true} on any infra failure rather than 500

app/api/debrief/route.ts       # the entire debrief backend — validate, parse, analyze,
                               # return. Every failure is a structured DebriefApiError
                               # (title/message/how-to-fix + detected headers + KPI
                               # switch suggestions), never a bare string. Route-level
                               # validation: binary/XLSX sniff, Ad name required
                               # ("export at ad level" guidance)
app/api/meta/{login,callback,config,ad-accounts,insights}/route.ts
app/api/competitor/fetch-page/route.ts  # one-time landing-page fetch (see scope fence)
app/api/competitor-debrief/route.ts     # Competitor Debrief V1 backend — validates shape,
                               # normalizes URLs (never fetches them), calls the engine

app/(marketing)/               # home route only: conventional top-nav shell, no providers
  layout.tsx, page.tsx         # hero (frameless HeroProof demo), bento, KPI demo, CTAs
app/(workspace)/               # app shell: sidebar (desktop) / tab bar (mobile)
  layout.tsx                   # DebriefProvider + MetaProvider live here (see below)
  generator/, competitor-debrief/, sample/, how-it-works/, privacy/
app/opengraph-image.tsx        # generated OG card (next/og); app/icon.svg = tab glyph

components/marketing/
  TopNav.tsx           # marketing navbar (wordmark / links / CTA, mobile menu)
  HeroProof.tsx        # hero demo: CSV rows FLIP-sort into SCALE/CUT on a slow loop;
                       # SSR renders the static sorted state; reduced-motion = no loop
  KpiDemo.tsx          # ROAS/CPA/CTR toggle re-ranking fixed sample data
  BlurFade.tsx         # scroll entrance — CSS + IntersectionObserver; the hidden state
                       # exists only under motion-safe (no hydration branch on reduced)
  motionFeatures.ts    # async domMax chunk for LazyMotion consumers

components/workspace/
  DebriefProvider.tsx  # generator/session state — React state ONLY; refresh wipes (by
                       # design). Holds the structured error + clearError
  MetaProvider.tsx     # Meta connection state; token in memory only; strict-origin postMessage
  Nav.tsx              # sidebar (desktop) / top bar + bottom tabs (mobile); wordmark-only
                       # brand (components/ui/brand.tsx — glyph is for icon surfaces only)

components/competitorDebrief/  # Competitor Debrief V1 UI — no relation to components/debrief
  CompetitorDebriefPanel.tsx   # the one input section + one Generate action; local useState
                               # only, no provider (unlike the CSV flow's DebriefProvider)
  CompetitorDebriefResult.tsx  # renders the structured output; insufficient-evidence state
                               # replaces the interpretation sections with an explicit note

components/debrief/
  GeneratorPanel.tsx   # 4-stage workflow (Data / Context / Verify / Run): dropzone, sample
                       # load + sample CSV download, CSV requirements helper, client-side
                       # upload preview (rows/columns/spend total/date range/KPI columns
                       # via the same parser + alias matcher — display only, the API
                       # recomputes everything), a "Fast path" helper naming the
                       # required route up front, ONE combined
                       # "Optional competitor context" area in stage 2 (Market signal
                       # builder — selectable chips + example presets feeding the notes
                       # field as structured text — then the notes field with
                       # Structure button + quality meter, then an "Advanced competitor
                       # context" collapsible — auto-open when it has content — holding
                       # competitor-sources cards — up
                       # to 5, "Use as market notes" appends, never overwrites — the
                       # one-time "Fetch page signals" action, and the competitor
                       # watchlist: up to 5 browser-saved pages, manual per-item /
                       # sequential "Refresh all" refreshes, diff display, "Add
                       # refreshed signals to market notes"; the shared directional
                       # caveat lives once in the area's intro line), stage 3 Verify =
                       # "Review creative formats" (optional per-ad format dropdowns
                       # over the client-side preview; first 25 ads + show-all; sent as
                       # creativeFormatOverrides JSON, cleared whenever the file changes),
                       # structured-error display with one-click KPI switch
  MetaConnect.tsx      # connect button / connected controls; checks /api/meta/config first
  Report.tsx           # the memo document; Buyer/Client view toggle is display-only.
                       # Client view adds presentation-only blocks over existing memo
                       # fields (executive stat cards replacing the stat row, a
                       # prominent "What this means" box around clientSummary, a
                       # worked/needs-improvement/not-enough-data split, next tests
                       # as cards) — never new calculations; buyer view untouched.
                       # Section numbering is computed (market + what-not-to-do sections
                       # exist conditionally). The queue checkboxes double as creative-
                       # brief selection ("Generate creative briefs", buyer view only)
  memoToText.ts        # view-aware plain-text serialization for the Copy button; takes
                       # briefIndices so briefs are included only while shown
```

### Layering rules

- Routes stay thin; domain logic lives in `modules/`. Import from each module's `index.ts` only. The debrief engine never imports from `modules/meta` and never learns where a CSV came from.
- `modules/competitor/guardedFetch.ts` is the ONE fetch pipeline shared by both network features — the one-time competitor-page fetch (`modules/competitor/server.ts`) and the monitoring beta's scheduled checks (`modules/monitoring/fetcher.ts`). SSRF validation (`ssrf.ts`) happens per redirect hop, and the resolved IPs are then pinned at the socket layer via a custom `node:http(s)` `lookup` (not undici — evaluated and rejected: not an installed/vendored dependency here) so a DNS answer that changes after validation can't redirect the connection. Changing timeout/redirect/size limits or the SSRF rules changes both features at once.
- `modules/debrief/memo.ts`'s `generateMemo(analysis, context)` is deterministic template code, not an LLM call — documented as the seam for a future LLM-backed version (same `(AnalysisResult, DebriefContext)` in, same `Memo` shape out, so the route/UI wouldn't need to change). Do not add an actual AI call here unless explicitly asked; it's out of scope for this version.
- The Buyer/Client report views are one memo, two renderings: `memo.ts` generates both registers (`tldr` + `clientSummary`, `killInstruction` + `clientInstruction`, `avoid.buyer` + `avoid.client`, `confidence.reasons` + `confidence.clientWhy`, `kpiExplainer`), and `Report.tsx`/`memoToText.ts` pick per view. Client copy must stay jargon-free — no "kill", "benchmark", or "spend gate"; client view shows top-3 performers only and never shows Patterns or creative briefs. Print/PDF and Copy follow the active view (and include briefs only while they're on screen).
- Everything the memo asserts must trace to data: each next test carries `signals` (own numbers first, market notes suffixed "— directional", guardrails last) and a `brief` built from those same facts; "What not to do" bullets render only when their condition holds; confidence `reasons` derive from the exact conditions that set the level. Creative briefs contain structural direction only — never invented product claims, quotes, discounts, guarantees, or competitor facts.
- Next-tests rule (`buildNextTests`): tests are creative/angle tests tied to named ads and numbers. A budget action may occupy at most the third slot, and only when the top winner beats the median by ≥30% (`SCALE_TEST_MIN_DELTA_PCT`). Market context may *reframe* a test (founder-led variant, problem-first hook, bundle offer variant in the non-scale T3 slot) but never adds a budget action or a competitor-performance claim. Budget movement otherwise lives in the verdict and losers section.
- `components/ui/theme.ts`, `icons.tsx`, `brand.tsx` are the shared design tokens (modern dark SaaS: carbon `#0b0c0f` canvas, soft translucent surfaces (`bg-white/[0.03]` + hairline borders), WHITE primary actions with dark text, icy-cyan accent (`bg-accent`/`text-accent-soft`) only for markers/selection/focus, emerald/red = win/loss only as plain colored text, amber only for warnings; Geist everywhere with Geist Mono reserved for numerals/data) — reuse them rather than inventing new visual patterns. Print CSS in `globals.css` flattens everything to ink-on-paper; keep `.print-hidden`/`.print-win`/`.print-loss` semantics intact. Motion is transform/opacity only and gated behind motion-safe / `useReducedMotion`; the marketing page loads motion via LazyMotion + the async `motionFeatures` chunk.

### Calculation rules (keep these honest — see `ARCHITECTURE.md` §5 for the full spec)

- Spend gate: `3 × targetCpa` if given, else `max(DEFAULT_SPEND_FLOOR, 0.5 × mean spend)` (`DEFAULT_SPEND_FLOOR` in `analysis.ts`). Ads below the gate are **set aside**, never winners/losers.
- Benchmark = median KPI across gated ads only. Polarity per KPI is in `HIGHER_IS_BETTER` (`types.ts`) — higher wins for ROAS/CTR/Leads/Purchases, lower wins for CPA/CPC.
- Combined below-benchmark spend in the kill list sums *all* judged ads worse than the median, not just the displayed rows.
- When there's no creative-notes context and no ad-name keyword signal, the memo must say so plainly ("metrics only — angle unknown") rather than inventing a creative narrative. Name tags are extracted with separators (`_-./`) normalized to spaces (`extract.ts`) — real exports use underscore naming.
- Creative format confirmations (`creativeFormatOverrides`, optional request field) upgrade the wording from "Ad name suggests…" to "Format confirmed as… — user-provided context, not proof of why it performed", and count into pattern/test/brief tag detection. They must never touch spend, KPI values, the gate, the median, or ranking — and a run without them must stay byte-identical to the pre-feature engine. No asset upload, no vision, no fetching: the user is just stating what their own creative is.
- The stat row in the report masthead steps long values down in size and wraps as a last resort (`min-w-0` + `break-words`) — long non-USD spend values overlapped in A4 PDF export once; don't reintroduce fixed 22px values there.

## Design constraints to preserve

- No routes beyond `/` (home, in the `(marketing)` group), `/generator`, `/competitor-debrief`, `/sample`, `/how-it-works`, `/privacy`. Don't add a history page, a second CSV's results, or anything account-shaped.
- Meta CSV column names vary by export configuration (`columns.ts` handles this via normalized alias matching) — if a required column can't be found for the selected KPI, the API returns a clear, structured 400 (with KPI switch suggestions when other KPI columns exist) rather than guessing. The alias groups documented in the generator's "CSV requirements" helper must stay true to what `columns.ts` actually resolves.
- `/sample` and the generator's "Load sample data" must stay on the same dataset AND context (`sampleCsv.ts`, including its `marketContext`) rendered by the real engine — the sample is a promise about what real data produces, not marketing copy. "Download sample CSV" serves that same `SAMPLE_CSV_TEXT` as a client-side blob.
- A Meta pull that returns zero rows is a guidance state ("no ads found — try a longer range, upload a CSV, or use sample data"), never an error state.
- Errors are product guides: title / message / "How to fix", structured as `DebriefApiError` end to end. Never surface a raw string or stack trace to the UI.
