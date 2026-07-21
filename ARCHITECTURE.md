# Architecture

Pivot: **Meta Ads reporting/monitoring SaaS → Meta Ads Creative Debrief, a single-flow creative debrief tool.**

> This doc's lasting job is §1 — what was deleted in the pivot and why.
> For the *current* module/component tree and the live scope fence, read
> `CLAUDE.md`, which is kept in sync with the code; the sections below
> describe the shape of the flow, not an exhaustive file list.

## 1. What changed

The repo previously held a reporting/monitoring product: Meta OAuth,
Postgres (Drizzle + Neon), encrypted token storage, a scheduled
monitoring cron, an account dashboard, alerts, settings, and a frozen
retargeting-automation module underneath all of that.

**All of it was removed, not frozen.** The v1 scope fence for this
product is explicit: no auth, no user accounts, no database or
persistent storage of any kind, no saved history, no billing, no team
workspaces, no analytics dashboards. If a future version needs any of
that, it's a new, explicit milestone — not something to quietly carry
forward "just in case." Concretely, this pivot deleted:

- `app/(app)/*` (the account dashboard: home, accounts/[id], reports, alerts, settings)
- `app/dashboard/`, `app/launch/`, `components/LaunchReview.tsx`, `lib/meta/account-config.ts` (the frozen retargeting-automation module)
- `app/api/meta/*` (OAuth, session, and every Graph API proxy route)
- `app/api/accounts/`, `app/api/insights/`, `app/api/findings/`, `app/api/monitoring/`, `app/api/cron/`
- `modules/connectors/`, `modules/metrics/`, `modules/portfolio/`, `modules/auth/`, `modules/db/`, `modules/monitoring/`
- `middleware.ts`, `lib/flags.ts`, `drizzle/`, `drizzle.config.ts`, `scripts/db-migrate.mjs`, `vercel.json`
- The `drizzle-orm`, `@neondatabase/serverless`, `drizzle-kit`, `pg`, `dotenv` dependencies

**Kept:** the dark, trust-oriented visual language (`components/ui/theme.ts`, `icons.tsx`, `brand.tsx`), the scroll-reveal helper (`components/landing/fx.tsx`), and the Next.js/Tailwind/TypeScript scaffold itself.

## 2. What this is now

The entire product is one flow, with nothing reachable outside it:

**CSV upload → KPI + context form → deterministic analysis → one-page memo, rendered on the same page.**

No routing beyond `/` and `/privacy` — the upload form, the processing
state, and the memo result are three states of one client component,
not three pages. There is no way to navigate to a second CSV's results,
a history of past debriefs, or an account of any kind, because none of
that exists.

## 3. Data handling (the actual privacy guarantee, not just a policy)

The CSV is parsed in memory for the lifetime of one `POST /api/debrief`
request and never written to a database, a file, a cache, or a log.
The route logs only structural facts on error (an error code, a row
count) — never CSV rows or memo content. When the response is sent,
nothing about that upload exists anywhere. Refreshing the browser tab
clears the in-memory React state too. Don't add persistence to this
route as a "small" addition — read the scope fence above first.

The in-memory guarantee is scoped to ADS DATA. The one approved
server-side store is the flag-gated Competitor Monitoring Beta
(`modules/monitoring/`, `MONITORING_ENABLED` default off): user-entered
competitor URLs, deterministic extracted page signals (never full page
copies), and a pruned check-outcome history, keyed to a pseudonymous
httpOnly-cookie workspace. It is isolated by rule and by test — core
modules never import it, the DB client exists only inside it, and the
whole core product runs with `DATABASE_URL` unset. Its own boundaries
(weekly ceiling, no alerts, no evasion, no Ads Library) live in the
CLAUDE.md fence.

## 4. Structure

```
modules/debrief/
  csv.ts          # hand-written RFC4180-ish parser (no dependency —
                   # Meta's exports are simple; a one-request in-memory
                   # parse doesn't need a library)
  columns.ts       # resolves Meta's varying export column names
                   # ("Purchases" vs "Website purchases", etc.) to
                   # logical fields via normalized alias matching
  extract.ts       # turns raw rows into ParsedAd[], deriving a KPI's
                   # value from whichever columns are actually present
  analysis.ts      # the deterministic rules: spend gate, median
                   # benchmark, winners/losers, ad-name pattern hints
  decision.ts      # the "Next move" layer: turns an AnalysisResult
                   # into ONE committed call (buildDecision). Pure —
                   # analysis computes, this chooses, the report
                   # renders. See §5.
  format.ts        # money/count/KPI value formatting
  memo.ts          # assembles the 6-section memo from AnalysisResult —
                   # every sentence is templated from real numbers
  types.ts         # the shared domain types
  index.ts         # public exports — routes/UI import only from here

app/api/debrief/route.ts   # the entire backend: validate → parse →
                             # analyze → generate → return. No writes.

components/debrief/
  DebriefApp.tsx    # the state machine: form → processing → result
  Hero.tsx          # landing copy above the upload card
  UploadForm.tsx    # CSV dropzone, KPI selector, context fields
  ProcessingState.tsx
  MemoResult.tsx    # renders the memo; "Copy memo" uses memoToText.ts
  memoToText.ts     # plain-text serialization for the copy button
```

## 5. Calculation rules (the part that must stay honest)

- **Spend gate** — decides which ads have enough data to judge. If a
  target CPA is given: `gate = 3 × targetCpa`. Otherwise:
  `gate = max(DEFAULT_SPEND_FLOOR, 0.5 × mean spend per ad)`
  (`DEFAULT_SPEND_FLOOR` in `analysis.ts`, currently 10 — change the
  constant if your floor differs). Ads below the gate are **set aside**,
  never called winners or losers.
- **Benchmark** = median KPI value across gated ("judged") ads only.
- **Polarity** — ROAS/CTR/Leads/Purchases: higher is better. CPA/CPC:
  lower is better. (`HIGHER_IS_BETTER` in `types.ts`.)
- **Winners/losers** = up to 5 judged ads strictly better/worse than
  the median, ranked by distance from it. Fewer than 3 qualifying ads
  is shown honestly as fewer than 3, never padded.
- **Combined below-benchmark spend** in the kill list is summed across
  *all* judged ads worse than the median, not just the displayed rows.
- **Patterns/angle claims** are structural (spend comparisons, ad-name
  keyword hints) unless the user supplied creative notes. When neither
  is available, the memo says so explicitly ("metrics only — angle
  unknown") rather than inventing a creative narrative.
- **Confidence level** (`high`/`medium`/`low`) and its notes are derived
  from how much data actually supported the read — see
  `buildConfidence` in `memo.ts`.
- **Next move** (`buildDecision` in `decision.ts`) — the memo commits to
  one call instead of offering a menu. The pipeline splits cleanly:
  `analysis.ts` **computes**, `decision.ts` **chooses**, `Report.tsx`
  **renders**. Four rules, first match wins:
  1. fewer than `DECISION_MIN_JUDGED` (5) judged ads → an explicit hold;
  2. a budget move — scale, cut, or shift — which requires clearing
     `SCALE_TEST_MIN_DELTA_PCT` (30%, **defined in `decision.ts`** and
     imported by `memo.ts` so the two can't disagree) and, for a cut,
     `CUT_MIN_SPEND_SHARE_PCT` (25%) of judged spend;
  3. every judged ad within `FLAT_FIELD_DELTA_PCT` (±15%) of the median
     → a hold, because another change won't separate a flat field;
  4. otherwise, run the top next test.
  The honesty rules are the point: weak evidence yields a hold rather
  than a forced call, the rationale always cites the exact numbers and
  bars that decided, every reassess line ends in a numeric trigger, and
  the concentration guardrail (`CONCENTRATION_GUARDRAIL_PCT`, 50%) is
  copy-only — it can add a caution but can never change the action.

## 6. The AI seam (not built yet, on purpose)

`generateMemo(analysis, context)` in `modules/debrief/memo.ts` is
template-based, not an LLM call — deterministic, free to run, and fast.
It's structured as the seam for a future LLM-backed version: swap the
function body for a call that takes the same `(AnalysisResult,
DebriefContext)` fact sheet and returns a `Memo` of the same shape, and
nothing in the route or UI needs to change. Don't build that yet; it's
explicitly out of scope for this version.

## 7. Environment

None. `npm install && npm run dev` is the entire setup — see
`.env.example` for the one-line confirmation of that.

## 8. Verification status

`next build` ✓ · `tsc --noEmit` ✓ · `eslint` ✓ (0 errors, 0 warnings) ·
deterministic analysis hand-verified against a synthetic CSV for both a
direct-column KPI (ROAS) and a derived KPI (CPA = spend ÷ purchases),
including the target-CPA spend-gate path and the missing-required-
column error path · full browser flow verified (upload → form → memo)
at desktop and 375px, including the copy-to-clipboard output · server
log confirmed to contain no CSV or memo content after a request.
