# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Debrief — a single-flow Meta Ads creative debrief tool, built on Next.js (App Router) + React 19 + Tailwind v4 + TypeScript. Upload a Meta Ads Manager CSV export, add context, get a one-page decision-first memo: what worked, what failed, what to test next. Read `ARCHITECTURE.md` for what this pivoted from and why almost everything from the prior version was deleted rather than kept "just in case."

## Commands

```bash
npm run dev          # dev server at localhost:3000
npm run build        # production build
npx tsc --noEmit     # typecheck
npx eslint .         # lint
```

The full check is `npm run build && npx tsc --noEmit && npx eslint . && npm run test:csv` (the last runs the RFC 4180 escaping proof for the Meta virtual CSV under plain Node).

No environment variables are required for the CSV-upload flow. The optional Meta data source needs `META_APP_ID` and `META_APP_SECRET`; the OAuth redirect URI is derived from the request origin per environment (`modules/meta/config.ts`), with `META_REDIRECT_URI` as an optional explicit override — see `.env.example`. `GET /api/meta/config` reports the resolved redirect URI (never the secret).

## Scope fence — read before adding anything

This product has a hard, deliberate scope: **no auth, no user accounts, no database or persistent storage of any kind, no saved history, no billing, no team workspaces, no analytics dashboards.** The whole flow is CSV upload → KPI + context form → deterministic analysis → one-page memo rendered on the same page — nothing else is reachable, and nothing should become reachable as a "small addition." If a future version needs persistence, that is a new, explicit milestone to be requested — not something to add quietly while doing something else.

The CSV (and the generated memo) must never be written to a database, a file, a cache, or a log. `app/api/debrief/route.ts` only logs structural facts on error (an error code, a row count) — never CSV rows or memo content. Keep it that way.

**Meta data source (the one approved exception to "no auth"):** the generator can also connect a Meta account via OAuth (`modules/meta/`, `app/api/meta/*`, `MetaProvider`/`MetaConnect`) and pull ad-level insights as a "virtual CSV" that feeds the identical debrief pipeline. Its constraints are part of the fence: scope is read-only `ads_read` (never widen); the access token lives only in browser memory (`MetaProvider`) and is forwarded per-request via the Authorization header — never a cookie, never storage, never a query param, never a log (the only cookie in the flow is the short-lived OAuth CSRF nonce); insights pulls set `use_unified_attribution_setting=true` so numbers match Ads Manager; the OAuth bridge posts to an exact origin and `MetaProvider` verifies `event.origin` with strict equality — no wildcards; the Graph API version is pinned in `modules/meta/graph.ts` — check deprecation runway when bumping.

## Architecture

```
modules/debrief/
  csv.ts        # hand-written CSV parser (no dependency)
  columns.ts    # resolves Meta's varying export column names to logical fields
  extract.ts    # raw rows -> ParsedAd[], deriving each KPI's value
  analysis.ts   # spend gate, median benchmark, winners/losers, pattern hints
  format.ts     # money/count/KPI value formatting
  memo.ts       # assembles the 6-section memo — templated, not an LLM call (see below)
  types.ts      # shared domain types
  index.ts      # public exports — import only from here, not the internal files

app/api/debrief/route.ts   # the entire backend — validate, parse, analyze, generate, return

components/debrief/
  DebriefApp.tsx        # state machine: form -> processing -> result (no routing between them)
  Hero.tsx, UploadForm.tsx, ProcessingState.tsx, MemoResult.tsx, memoToText.ts
```

### Layering rules

- Routes stay thin; the domain logic lives in `modules/debrief/`. Import from its `index.ts` only.
- `modules/debrief/memo.ts`'s `generateMemo(analysis, context)` is deterministic template code, not an LLM call — documented as the seam for a future LLM-backed version (same `(AnalysisResult, DebriefContext)` in, same `Memo` shape out, so the route/UI wouldn't need to change). Do not add an actual AI call here unless explicitly asked; it's out of scope for this version.
- `components/ui/theme.ts`, `icons.tsx`, `brand.tsx` are the shared design tokens (dark "creative signal": carbon `#0a0a0c` canvas, cool graphite gradient panels, fuchsia→pink gradient = real action / fuchsia tint = state, cyan as the sparing data accent, amber only for warnings, emerald/red only for win/loss, `.tape`/`.tape-red`/`.tape-emerald` hazard strips as the film-slate motif) — reuse them rather than inventing new visual patterns.

### Calculation rules (keep these honest — see `ARCHITECTURE.md` §5 for the full spec)

- Spend gate: `3 × targetCpa` if given, else `max(DEFAULT_SPEND_FLOOR, 0.5 × mean spend)` (`DEFAULT_SPEND_FLOOR` in `analysis.ts`). Ads below the gate are **set aside**, never winners/losers.
- Benchmark = median KPI across gated ads only. Polarity per KPI is in `HIGHER_IS_BETTER` (`types.ts`).
- Combined below-benchmark spend in the kill list sums *all* judged ads worse than the median, not just the displayed rows.
- When there's no creative-notes context and no ad-name keyword signal, the memo must say so plainly ("metrics only — angle unknown") rather than inventing a creative narrative.

## Design constraints to preserve

- No routes beyond `/` and `/privacy`. Don't add a history page, a second CSV's results, or anything account-shaped.
- Meta CSV column names vary by export configuration (`columns.ts` handles this via normalized alias matching) — if a required column can't be found for the selected KPI, the API returns a clear 400 rather than guessing.
