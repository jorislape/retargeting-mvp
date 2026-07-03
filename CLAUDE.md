# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

AdReports — Meta Ads client reporting & monitoring for freelance media buyers, built on Next.js (App Router) + React 19 + Tailwind v4 + TypeScript. The repo **pivoted from a retargeting-automation MVP**; the old module is frozen, not deleted (see below). Read `ARCHITECTURE.md` for the technical audit/structure and `product-spec.md` for product strategy and the milestone roadmap. `AGENTS.md` holds Vercel deployment best practices.

## Commands

```bash
npm run dev          # dev server at localhost:3000
npm run build        # production build
npx tsc --noEmit     # typecheck
npx eslint .          # lint (frozen module is excluded — see eslint.config.mjs)

npm run db:generate   # generate a SQL migration from modules/db/schema.ts
npm run db:migrate    # apply migrations to DATABASE_URL
npm run db:push       # push schema directly (dev iteration only)
npm run db:studio     # Drizzle Studio
```

There are no tests yet. The full check is `npm run build && npx tsc --noEmit && npx eslint .`

Requires `.env.local` — copy `.env.example`. Meta OAuth needs `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`. Persistence + monitoring need `DATABASE_URL` (Neon Postgres), `ENCRYPTION_KEY` (32-byte base64, `openssl rand -base64 32`), and `CRON_SECRET` (`openssl rand -hex 32`) — the app builds and runs without these, but persistence/monitoring routes degrade to "not configured" until they're set. `FEATURE_RETARGETING=true` revives the frozen module (default off).

## Architecture

Two products live in one repo, separated by a feature flag:

- **Active product** — `app/(app)/` (home, accounts/[id], reports, alerts, settings), `app/api/{accounts,insights,findings,monitoring,cron}/`, `app/api/meta/oauth/` + `app/api/meta/session/`, and everything in `modules/`.
- **Frozen retargeting module** — `app/{dashboard,launch}/`, most of `app/api/meta/*`, `components/LaunchReview.tsx`, `lib/meta/account-config.ts`. Gated in **one choke point**: `middleware.ts` (pages redirect to `/home`, APIs return 404 unless `FEATURE_RETARGETING=true`). These files are excluded from lint and carry pre-existing debt intentionally.

### Layering rules (enforced by convention, follow them)

- `modules/connectors/types.ts` is **the key abstraction**: a provider-agnostic ad-platform contract. Everything above the connector layer (metrics, routes, UI) depends on these types only — never on Meta Graph API shapes. This is what makes a future Google Ads connector an addition, not a rewrite.
- Routes stay thin; business logic lives in `modules/`.
- Modules expose a public `index.ts` only.
- **No new imports from frozen files.**
- The product is **read-only** over ad accounts. OAuth requests only `public_profile,ads_read` — never add `ads_management`; write access is a deliberate product/App Review boundary. Reviving the frozen retargeting module means re-adding its scopes in `app/api/meta/oauth/start`.

### Key pieces

- `modules/connectors/meta/client.ts` — the single Graph API client: unified API version (v23), normalized `ConnectorError` (`auth_expired`, `rate_limited`, …), exponential backoff, cursor pagination. Never hand-roll Graph fetches in routes.
- `modules/metrics/` — period presets (periods end *yesterday*, deliberately — today's partial data lies in comparisons), equal-length previous-period math, KPI aggregation with derived metrics recomputed from totals.
- `modules/db/` — Drizzle ORM + Neon (`@neondatabase/serverless`, HTTP driver). `client.ts` is a lazy singleton: importing it never throws, so DB-less builds/dev keep working; only the first real query requires `DATABASE_URL`. `crypto.ts` does AES-256-GCM token encryption keyed by `ENCRYPTION_KEY` — decryption only happens server-side; tokens must never reach API responses, non-httpOnly cookies, or client bundles. Schema: `users`/`workspaces`/`memberships` (Meta OAuth *is* the login — first login auto-creates a personal workspace), `sessions` (hashed session-id cookie), `connections` (encrypted tokens), `ad_accounts`, `monitor_settings`, `findings`, `job_runs`.
- `modules/auth/` — `resolveAccessToken(request)` is the one entry point data routes use to get a Meta access token: DB-backed session first, **legacy `meta_access_token` cookie fallback** second (pre-persistence sessions still work until they reconnect — remove this fallback once design partners have migrated). Never read `meta_access_token` directly in a new route.
- `modules/monitoring/` — deterministic, non-AI rule engine (`rules.ts`: CPA spike, ROAS drop, spend concentration, spend stopped, account disabled/connection expired) plus a cadence-agnostic `runner.ts` (3-day current vs 14-day baseline, windows ending yesterday, findings deduped per account/rule/day, `job_runs` as a crash-safe lock). Triggered by `GET /api/cron/monitor`, guarded by `CRON_SECRET`, scheduled in `vercel.json`. Currently daily (Hobby plan cap); switching to hourly is a one-line schedule change in `vercel.json` — the runner doesn't need touching. `maxDuration` on that route is capped at 60 (Hobby plan limit without Fluid Compute) — raise only after enabling Fluid or upgrading to Pro.
- `components/ui/data.tsx` — shared UI primitives: `StateWrapper` (loading/error/empty/ready states), `MetricCard`, `DeltaChip`, formatters. Cost metrics use inverted deltas (down = good).

### Design constraints to preserve

- `insights_daily` (historical sync) and `clients`/`client_ad_accounts` (many-to-many client mapping) are deliberately **not built yet** — deferred to M3/M4. `/api/insights` still reads live from Meta per request; its response shape was designed so pointing it at the DB later requires no UI changes. Don't change that shape casually.
- Monetary values are in the ad account's own currency; dates are in the account's timezone.
