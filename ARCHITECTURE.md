# Architecture & Technical Audit

Pivot: **retargeting automation → Meta Ads client reporting & monitoring platform.**
Full product rationale, IA, and roadmap live in `product-spec.md` (companion doc).

## 1. Audit findings (state of the repo before this restructure)

| Area | Finding | Verdict |
|---|---|---|
| Auth/session | Short-lived Meta token stored raw in an httpOnly cookie; **no long-lived exchange**, so every session died within ~1 hour. No user accounts. | Fixed (long-lived exchange added). User accounts required at M-persist. |
| Persistence | **None.** No database, no state. All 20 routes are stateless Graph API proxies. | Blocker for scheduled reports/alerts — see §4. |
| Secrets | `lib/meta/account-config.ts` hardcoded real pixel/campaign/page IDs in source. | Purged; env-driven now. |
| API client | Same fetch/error boilerplate copy-pasted across ~20 routes; API version inconsistent (v19 in OAuth, v23 elsewhere); no retry/rate-limit handling. | Replaced by `modules/connectors/meta/client.ts`. |
| OAuth scopes | Already includes `ads_read` (all the pivot needs) plus `ads_management` (only retargeting needs). | Consider dropping `ads_management` from the scope request until the module returns — lighter App Review, less scary consent screen. |
| UI | Landing page: solid dark design language, kept. Dashboard: single 2,132-line client component, ~35 `useState` hooks — retargeting-specific. | Dashboard frozen, not refactored. Design language carried into the new shell. |
| Quality | 18 lint errors (all in retargeting files), `any` throughout API routes, no tests, no CI. | Frozen files excluded from lint (documented in `eslint.config.mjs`); new code is strict-clean. |
| Debug | `/api/meta/debug-env` exposed env presence info. | Deleted. |

**Honest reuse tally:** OAuth flow (kept, upgraded), Graph API call patterns (harvested into the connector), landing page + design idioms (kept), retargeting business logic (~2,600 lines: frozen). The prior framing of "existing backend + dashboard" overstated reusability — the backend was stateless glue and the dashboard was single-purpose. That's not a criticism of the MVP (it did its job: proving the API integration); it just sets expectations for what "reuse" means.

## 2. What changed in this restructure

**Frozen (not deleted):** all retargeting pages (`/dashboard`, `/launch`) and API routes, gated in one place — `middleware.ts` — behind `FEATURE_RETARGETING=true`. Pages redirect to `/home`; APIs return 404. Unfreezing is a one-line env change.

**New modules:**
- `modules/connectors/` — provider-agnostic interface (`types.ts`) + Meta implementation. Unified API version (v23), normalized errors (`ConnectorError` with `auth_expired` / `rate_limited` / …), exponential backoff on retryable failures, cursor pagination. **Everything above this layer must depend on these types, never on Graph shapes** — this is what makes Google Ads connector #2 an addition, not a rewrite.
- `modules/metrics/` — period presets (ending *yesterday* — today's partial data lies in comparisons), equal-length previous-period math, KPI aggregation with derived metrics recomputed from totals, pct-change.

**New routes:** `GET /api/accounts`, `GET /api/insights?accountId&period` (KPIs + deltas + daily series + campaign table).

**New UI:** app shell (`app/(app)/layout.tsx`) with the target IA — Home, Reports, Alerts, Settings; Home (account portfolio, connect flow, all four states via `StateWrapper`); Account performance page (KPI row with inverted-delta cost metrics, spend sparkline, campaign table, period switcher); Settings (live connection status + reconnect); Reports/Alerts (designed empty states, ship at M4/M6).

**Fixes:** long-lived token exchange in OAuth callback (~60d sessions); landing CTAs → `/home`; metadata → new positioning; fonts decoupled from Google Fonts build-time fetch (revert path documented in `app/layout.tsx`).

## 3. Structure

```
middleware.ts                 # freeze gate for the retargeting module
lib/flags.ts                  # feature flags
modules/
  connectors/types.ts         # provider-agnostic contract (the key abstraction)
  connectors/meta/            # client.ts (fetch/retry/errors) + index.ts (connector)
  metrics/                    # period math, KPI aggregation
components/ui/data.tsx        # StateWrapper, MetricCard, DeltaChip, formatters
app/(app)/                    # new product: home, accounts/[id], reports, alerts, settings
app/api/{accounts,insights}/  # new product APIs
app/api/meta/                 # OAuth + session (active) + frozen retargeting routes
app/{dashboard,launch}/       # FROZEN retargeting UI
```

Rules going forward: routes stay thin — logic lives in `modules/`; modules expose a public `index.ts` only; no new imports from frozen files.

## 4. The persistence milestone (next, and non-negotiable)

The interim data path reads live from Meta per page view. Fine for one user demoing; wrong for the product: scheduled reports and hourly alert scans must run **without a browser session**, and reports need history + instant loads.

Decision (per single-founder constraints + Vercel guidance in AGENTS.md): **Marketplace Postgres (e.g. Neon) + Drizzle. No queue infra yet** — Vercel Cron + a `jobs` table with row-locking covers hourly sync and scheduled sends at design-partner scale.

Order of work: (1) `users`/`workspaces` + real login (Meta OAuth as identity is fine initially), (2) `connections` with **encrypted long-lived tokens in DB** (cookie becomes session-only), (3) `clients` + `client_ad_accounts` (many-to-many from day one), (4) `insights_daily` + sync engine (90-day backfill, hourly incremental, re-pull trailing 3 days for Meta's attribution restatement), (5) point `/api/insights` at the DB — the response shape was designed so **no UI changes** are needed when this swap happens.

Then M4 reports (share links, PDF, scheduling, delivery), M5 AI summaries (fact-sheet → Claude, validated output, never blocks report render), M6 alerts (rolling 14-day baselines + status detectors).

## 5. Environment

```
META_APP_ID / META_APP_SECRET / META_REDIRECT_URI   # existing
FEATURE_RETARGETING=false                            # freeze gate (default off)
META_ACCOUNT_CONFIG={}                               # only if retargeting revived
```

## 6. Verification status

`next build` ✓ · `tsc --noEmit` ✓ · `eslint` ✓ (0 errors, 0 warnings; frozen module excluded, documented) · live smoke test ✓ (`/home` 200, `/dashboard` → 307 `/home`, frozen API → 404, `/api/accounts` → 401 unauthenticated).
