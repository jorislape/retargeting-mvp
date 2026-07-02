# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

AdReports — Meta Ads client reporting & monitoring for freelance media buyers, built on Next.js (App Router) + React 19 + Tailwind v4 + TypeScript. The repo **pivoted from a retargeting-automation MVP**; the old module is frozen, not deleted (see below). Read `ARCHITECTURE.md` for the technical audit/structure and `product-spec.md` for product strategy and the milestone roadmap. `AGENTS.md` holds Vercel deployment best practices.

## Commands

```bash
npm run dev          # dev server at localhost:3000
npm run build        # production build
npx tsc --noEmit     # typecheck
npx eslint .         # lint (frozen module is excluded — see eslint.config.mjs)
```

There are no tests yet. The full check is `npm run build && npx tsc --noEmit && npx eslint .`

Requires `.env.local` with `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`. `FEATURE_RETARGETING=true` revives the frozen module (default off).

## Architecture

Two products live in one repo, separated by a feature flag:

- **Active product** — `app/(app)/` (home, accounts/[id], reports, alerts, settings), `app/api/{accounts,insights}/`, `app/api/meta/oauth/` + `app/api/meta/session/`, and everything in `modules/`.
- **Frozen retargeting module** — `app/{dashboard,launch}/`, most of `app/api/meta/*`, `components/LaunchReview.tsx`, `lib/meta/account-config.ts`. Gated in **one choke point**: `middleware.ts` (pages redirect to `/home`, APIs return 404 unless `FEATURE_RETARGETING=true`). These files are excluded from lint and carry pre-existing debt intentionally.

### Layering rules (enforced by convention, follow them)

- `modules/connectors/types.ts` is **the key abstraction**: a provider-agnostic ad-platform contract. Everything above the connector layer (metrics, routes, UI) depends on these types only — never on Meta Graph API shapes. This is what makes a future Google Ads connector an addition, not a rewrite.
- Routes stay thin; business logic lives in `modules/`.
- Modules expose a public `index.ts` only.
- **No new imports from frozen files.**

### Key pieces

- `modules/connectors/meta/client.ts` — the single Graph API client: unified API version (v23), normalized `ConnectorError` (`auth_expired`, `rate_limited`, …), exponential backoff, cursor pagination. Never hand-roll Graph fetches in routes.
- `modules/metrics/` — period presets (periods end *yesterday*, deliberately — today's partial data lies in comparisons), equal-length previous-period math, KPI aggregation with derived metrics recomputed from totals.
- `components/ui/data.tsx` — shared UI primitives: `StateWrapper` (loading/error/empty/ready states), `MetricCard`, `DeltaChip`, formatters. Cost metrics use inverted deltas (down = good).
- Auth: Meta OAuth with long-lived token exchange (~60-day sessions), token stored in an httpOnly cookie. No database yet — all data is read live from Meta per request.

### Design constraints to preserve

- **No persistence yet, by design.** The persistence milestone (Postgres + Drizzle, per `ARCHITECTURE.md` §4) is planned; `/api/insights`'s response shape was designed so the DB swap requires no UI changes. Don't change that shape casually.
- The product is **read-only** over ad accounts (`ads_read`); avoid adding features that need `ads_management` — write access is a deliberate product/App Review boundary.
- Monetary values are in the ad account's own currency; dates are in the account's timezone.
