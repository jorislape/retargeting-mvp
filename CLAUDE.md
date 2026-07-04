# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Debrief — a single-flow Meta Ads creative debrief tool, built on Next.js (App Router) + React 19 + Tailwind v4 + TypeScript. Load ad-level performance data (CSV upload, built-in sample dataset, or read-only Meta OAuth pull), add context, get a one-page decision-first memo: what worked, what failed, what to test next — rendered in two audiences (buyer memo / client report). Read `ARCHITECTURE.md` for what this pivoted from and why almost everything from the prior version was deleted rather than kept "just in case."

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

This product has a hard, deliberate scope: **no auth, no user accounts, no database or persistent storage of any kind, no saved history, no billing, no team workspaces, no analytics dashboards.** The whole flow is data in → KPI + context → deterministic analysis → one-page memo on the same page — nothing else is reachable, and nothing should become reachable as a "small addition." If a future version needs persistence, that is a new, explicit milestone to be requested — not something to add quietly while doing something else.

The CSV (and the generated memo) must never be written to a database, a file, a cache, or a log. `app/api/debrief/route.ts` only logs structural facts on error (an error code, a row count) — never CSV rows or memo content. Keep it that way.

**Meta data source (the one approved exception to "no auth"):** the generator can also connect a Meta account via OAuth (`modules/meta/`, `app/api/meta/*`, `MetaProvider`/`MetaConnect`) and pull ad-level insights as a "virtual CSV" that feeds the identical debrief pipeline. Its constraints are part of the fence: scope is read-only `ads_read` (never widen); the access token lives only in browser memory (`MetaProvider`) and is forwarded per-request via the Authorization header — never a cookie, never storage, never a query param, never a log (the only cookie in the flow is the short-lived OAuth CSRF nonce); insights pulls set `use_unified_attribution_setting=true` so numbers match Ads Manager; the OAuth bridge (`modules/meta/bridge.ts`) posts to an exact origin and `MetaProvider` verifies `event.origin` with strict equality — no wildcards; the Graph API version is pinned in `modules/meta/graph.ts` — check deprecation runway when bumping.

## Architecture

```
modules/debrief/               # the engine — pure, deterministic, no I/O
  csv.ts        # hand-written CSV parser (no dependency)
  columns.ts    # resolves Meta's varying export column names via normalized alias matching
  extract.ts    # raw rows -> ParsedAd[], KPI value derivation, ad-name tag extraction
  analysis.ts   # spend gate, median benchmark, winners/losers, pattern hints
  memo.ts       # assembles the memo — templated, not an LLM call (see below)
  format.ts     # money/count/KPI value formatting
  sampleCsv.ts  # THE sample dataset (client-safe, no engine imports) — tuned to the
                # rules engine; its header comment lists invariants to keep when editing
  sample.ts     # server-side: sample memo via the real engine (renders /sample)
  types.ts      # domain types incl. Memo (carries BOTH buyer + client-language fields)
  index.ts      # public surface — import only from here, not the internal files

modules/meta/                  # optional OAuth data source ("virtual CSV")
  graph.ts        # server-only Graph client; version pin; token via Authorization header
  config.ts       # redirect-URI resolution (request-derived, env override) + validation
  bridge.ts       # OAuth popup bridge page (postMessage to exact origin)
  insightsToCsv.ts# serializes insights into Ads-Manager-shaped CSV text
  index.ts        # public surface

app/api/debrief/route.ts       # the entire debrief backend — validate, parse, analyze, return
app/api/meta/{login,callback,config,ad-accounts,insights}/route.ts

app/(workspace)/               # shell route group: sidebar/tab-bar around every page
  layout.tsx                   # DebriefProvider + MetaProvider live here (see below)
  page.tsx (/ home), generator/, sample/, how-it-works/, privacy/

components/workspace/
  DebriefProvider.tsx  # generator/session state — React state ONLY; refresh wipes (by design)
  MetaProvider.tsx     # Meta connection state; token in memory only; strict-origin postMessage
  Nav.tsx              # sidebar (desktop) / top bar + bottom tabs (mobile)

components/debrief/
  GeneratorPanel.tsx   # 3-stage workflow (Source / Framing / Run); step chips fill on completion
  MetaConnect.tsx      # connect button / connected controls; checks /api/meta/config first
  Report.tsx           # the memo document; Buyer/Client view toggle is display-only
  memoToText.ts        # view-aware plain-text serialization for the Copy button
```

### Layering rules

- Routes stay thin; domain logic lives in `modules/`. Import from each module's `index.ts` only. The debrief engine never imports from `modules/meta` and never learns where a CSV came from.
- `modules/debrief/memo.ts`'s `generateMemo(analysis, context)` is deterministic template code, not an LLM call — documented as the seam for a future LLM-backed version (same `(AnalysisResult, DebriefContext)` in, same `Memo` shape out, so the route/UI wouldn't need to change). Do not add an actual AI call here unless explicitly asked; it's out of scope for this version.
- The Buyer/Client report views are one memo, two renderings: `memo.ts` generates both registers (`tldr` + `clientSummary`, `killInstruction` + `clientInstruction`, `kpiExplainer`), and `Report.tsx`/`memoToText.ts` pick per view. Client copy must stay jargon-free — no "kill", "benchmark", or "spend gate"; client view shows top-3 performers only. Print/PDF and Copy follow the active view.
- Next-tests rule (`buildNextTests`): tests are creative/angle tests tied to named ads and numbers. A budget action may occupy at most the third slot, and only when the top winner beats the median by ≥30% (`SCALE_TEST_MIN_DELTA_PCT`). Budget movement otherwise lives in the verdict and losers section.
- `components/ui/theme.ts`, `icons.tsx`, `brand.tsx` are the shared design tokens (modern dark SaaS: carbon `#0b0c0f` canvas, soft translucent surfaces (`bg-white/[0.03]` + hairline borders), WHITE primary actions with dark text, icy-cyan accent (`bg-accent`/`text-accent-soft`) only for markers/selection/focus, emerald/red = win/loss only as plain colored text, amber only for warnings; Geist everywhere with Geist Mono reserved for numerals/data) — reuse them rather than inventing new visual patterns. Print CSS in `globals.css` flattens everything to ink-on-paper; keep `.print-hidden`/`.print-win`/`.print-loss` semantics intact.

### Calculation rules (keep these honest — see `ARCHITECTURE.md` §5 for the full spec)

- Spend gate: `3 × targetCpa` if given, else `max(DEFAULT_SPEND_FLOOR, 0.5 × mean spend)` (`DEFAULT_SPEND_FLOOR` in `analysis.ts`). Ads below the gate are **set aside**, never winners/losers.
- Benchmark = median KPI across gated ads only. Polarity per KPI is in `HIGHER_IS_BETTER` (`types.ts`) — higher wins for ROAS/CTR/Leads/Purchases, lower wins for CPA/CPC.
- Combined below-benchmark spend in the kill list sums *all* judged ads worse than the median, not just the displayed rows.
- When there's no creative-notes context and no ad-name keyword signal, the memo must say so plainly ("metrics only — angle unknown") rather than inventing a creative narrative. Name tags are extracted with separators (`_-./`) normalized to spaces (`extract.ts`) — real exports use underscore naming.

## Design constraints to preserve

- No routes beyond `/` (home), `/generator`, `/sample`, `/how-it-works`, `/privacy`. Don't add a history page, a second CSV's results, or anything account-shaped.
- Meta CSV column names vary by export configuration (`columns.ts` handles this via normalized alias matching) — if a required column can't be found for the selected KPI, the API returns a clear 400 rather than guessing.
- `/sample` and the generator's "Load sample data" must stay on the same dataset (`sampleCsv.ts`) rendered by the real engine — the sample is a promise about what real data produces, not marketing copy.
- A Meta pull that returns zero rows is a guidance state ("no ads found — try a longer range, upload a CSV, or use sample data"), never an error state.
