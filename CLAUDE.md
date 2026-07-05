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
npm run test:csv     # RFC 4180 escaping proof for the Meta virtual CSV (plain Node)
```

The full check is `npm run build && npx tsc --noEmit && npx eslint . && npm run test:csv`. There is no other test runner; behavioral verification is manual against the dev server — `TESTING.md` is the checklist, and the sample dataset's expected numbers (spend gate ≈ $120.91, 11 judged / 3 set aside, per-KPI medians) are documented in `modules/debrief/sampleCsv.ts` for asserting against.

No environment variables are required for the CSV-upload flow. The optional Meta data source needs `META_APP_ID` and `META_APP_SECRET`; the OAuth redirect URI is derived from the request origin per environment (`modules/meta/config.ts`), with `META_REDIRECT_URI` as an optional explicit override — see `.env.example`. `GET /api/meta/config` reports the resolved redirect URI (never the secret).

## Scope fence — read before adding anything

This product has a hard, deliberate scope: **no auth, no user accounts, no database or persistent storage of any kind, no saved history, no billing, no team workspaces, no analytics dashboards, no external AI calls, no scraping, no background jobs.** The whole flow is data in → KPI + context → deterministic analysis → one-page memo on the same page — nothing else is reachable, and nothing should become reachable as a "small addition." If a future version needs persistence, that is a new, explicit milestone to be requested — not something to add quietly while doing something else.

The CSV (and the generated memo) must never be written to a database, a file, a cache, or a log. `app/api/debrief/route.ts` only logs structural facts on error (an error code, a row count) — never CSV rows or memo content. Keep it that way. (Structured error *responses* may echo the CSV's own header names back to the user — headers are structural and go only to the person who uploaded them; still never log them.)

**Meta data source (the one approved exception to "no auth"):** the generator can also connect a Meta account via OAuth (`modules/meta/`, `app/api/meta/*`, `MetaProvider`/`MetaConnect`) and pull ad-level insights as a "virtual CSV" that feeds the identical debrief pipeline. Its constraints are part of the fence: scope is read-only `ads_read` (never widen); the access token lives only in browser memory (`MetaProvider`) and is forwarded per-request via the Authorization header — never a cookie, never storage, never a query param, never a log (the only cookie in the flow is the short-lived OAuth CSRF nonce); insights pulls set `use_unified_attribution_setting=true` so numbers match Ads Manager; the OAuth bridge (`modules/meta/bridge.ts`) posts to an exact origin and `MetaProvider` verifies `event.origin` with strict equality — no wildcards; the Graph API version is pinned in `modules/meta/graph.ts` — check deprecation runway when bumping.

**Market / competitor notes (manual input, plus ONE approved fetch):** the optional `marketContext` textarea is pasted text. No Ads Library scraping, no competitor watchlists, no monitoring, and never a claim about competitor spend or performance. The one approved network action is **Competitor Landing Page Fetch V1** (`modules/competitor/`, `POST /api/competitor/fetch-page`): a single user-triggered fetch of one public landing page per click of "Fetch page signals" on a competitor-source card. Its constraints are part of the fence: SSRF-guarded (http/https only, no credentials, standard ports, hostname blocklist, every DNS answer checked against private/reserved ranges, every redirect hop re-validated — see `modules/competitor/server.ts`), hard timeout + response-size cap, text/html only; Ads Library URLs are refused by policy with a "paste manually" message, never fetched; extraction is deterministic keyword work ("observed on page" wording only); the result is appended to that source's NOTES field for the user to review — it reaches the report only through the existing "Use as market notes" → `marketContext` path; nothing is stored, cached, or logged (no URLs, no page text). Never widen this into recurring fetches, watchlists, or Ads Library reading. Everything derived from it — the "Structure notes" button, the quality meter, the memo's Market signal section, market-flavored test/brief wording — is local, deterministic keyword matching (`modules/debrief/marketSignals.ts`), always marked "directional," and own account data stays the primary signal. An empty `marketContext` must leave the memo's content exactly as if the feature didn't exist (`marketSignal: null`, no market wording anywhere). The "Competitor sources" cards in the generator are the same rule wearing a form: manual fields (name / URL / Ads Library links / notes) that "Use as market notes" serializes into `marketContext` as plain text — append-only, restating only what the user typed, URLs never fetched or monitored. The engine and API never see competitor sources as a separate input.

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
                  # assessMarketNotes (quality meter: category count → strong/good/weak),
                  # plus competitor sources V1 (CompetitorSource, formatCompetitorSources,
                  # mergeCompetitorSourcesIntoNotes): manual structured competitor input
                  # serialized into the market-notes text — append-only, restates user
                  # input. URLs are fetched only by the explicit one-time "Fetch page
                  # signals" action (modules/competitor); watchlists/monitoring stay a
                  # future milestone, not a quiet addition
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
  index.ts        # client-safe surface (everything except server.ts)

modules/meta/                  # optional OAuth data source ("virtual CSV")
  graph.ts        # server-only Graph client; version pin; token via Authorization header
  config.ts       # redirect-URI resolution (request-derived, env override) + validation
  bridge.ts       # OAuth popup bridge page (postMessage to exact origin)
  insightsToCsv.ts# serializes insights into Ads-Manager-shaped CSV text
  index.ts        # public surface

app/api/debrief/route.ts       # the entire debrief backend — validate, parse, analyze,
                               # return. Every failure is a structured DebriefApiError
                               # (title/message/how-to-fix + detected headers + KPI
                               # switch suggestions), never a bare string. Route-level
                               # validation: binary/XLSX sniff, Ad name required
                               # ("export at ad level" guidance)
app/api/meta/{login,callback,config,ad-accounts,insights}/route.ts
app/api/competitor/fetch-page/route.ts  # one-time landing-page fetch (see scope fence)

app/(marketing)/               # home route only: conventional top-nav shell, no providers
  layout.tsx, page.tsx         # hero (frameless HeroProof demo), bento, KPI demo, CTAs
app/(workspace)/               # app shell: sidebar (desktop) / tab bar (mobile)
  layout.tsx                   # DebriefProvider + MetaProvider live here (see below)
  generator/, sample/, how-it-works/, privacy/
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

components/debrief/
  GeneratorPanel.tsx   # 3-stage workflow (Source / Framing / Run): dropzone, sample
                       # load + sample CSV download, CSV requirements helper, client-side
                       # upload preview (rows/columns/KPI check via the same parser +
                       # alias matcher — structure only, no analysis), market-notes field
                       # with Structure button + quality meter, competitor-sources cards
                       # (up to 5; "Use as market notes" appends, never overwrites),
                       # "Confirm creative formats" list (optional per-ad format dropdowns
                       # over the client-side preview; first 25 ads + show-all; sent as
                       # creativeFormatOverrides JSON, cleared whenever the file changes),
                       # structured-error display with one-click KPI switch
  MetaConnect.tsx      # connect button / connected controls; checks /api/meta/config first
  Report.tsx           # the memo document; Buyer/Client view toggle is display-only.
                       # Section numbering is computed (market + what-not-to-do sections
                       # exist conditionally). The queue checkboxes double as creative-
                       # brief selection ("Generate creative briefs", buyer view only)
  memoToText.ts        # view-aware plain-text serialization for the Copy button; takes
                       # briefIndices so briefs are included only while shown
```

### Layering rules

- Routes stay thin; domain logic lives in `modules/`. Import from each module's `index.ts` only. The debrief engine never imports from `modules/meta` and never learns where a CSV came from.
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

- No routes beyond `/` (home, in the `(marketing)` group), `/generator`, `/sample`, `/how-it-works`, `/privacy`. Don't add a history page, a second CSV's results, or anything account-shaped.
- Meta CSV column names vary by export configuration (`columns.ts` handles this via normalized alias matching) — if a required column can't be found for the selected KPI, the API returns a clear, structured 400 (with KPI switch suggestions when other KPI columns exist) rather than guessing. The alias groups documented in the generator's "CSV requirements" helper must stay true to what `columns.ts` actually resolves.
- `/sample` and the generator's "Load sample data" must stay on the same dataset AND context (`sampleCsv.ts`, including its `marketContext`) rendered by the real engine — the sample is a promise about what real data produces, not marketing copy. "Download sample CSV" serves that same `SAMPLE_CSV_TEXT` as a client-side blob.
- A Meta pull that returns zero rows is a guidance state ("no ads found — try a longer range, upload a CSV, or use sample data"), never an error state.
- Errors are product guides: title / message / "How to fix", structured as `DebriefApiError` end to end. Never surface a raw string or stack trace to the UI.
