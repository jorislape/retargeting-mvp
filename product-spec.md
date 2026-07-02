# Meta Ads Reporting & Monitoring Platform — Product Spec v1

**Status:** Decision document. Phases 1–3 complete. Phase 4 = implementation brief for execution inside the repo.
**Date:** July 2026

---

## 0. The Decision (read this first)

**The product is: automated client reporting + always-on account monitoring for Meta Ads, sold to freelance media buyers and small agencies, priced per client.**

One sentence for a media buyer: *"Connect your ad accounts once. Every client gets a live report link and a scheduled email with a written summary you'd be proud to send — and you get pinged before the client notices something broke."*

What it is **not** in v1: not a campaign launcher, not a creative library, not an optimization tool, not a multi-channel aggregator. Those are roadmap items, and two of them may never be built (see §1.9).

### Why this and not creative ops or launching/scaling

Your research ranked the pains: (1) data collection + reporting, (2) creative ops, (3) launching/scaling. The correct MVP is #1, and not just because it ranked first:

1. **Reporting is recurring and deadline-driven.** It happens weekly/monthly per client, forever, tied to the moment the client decides whether to keep paying the buyer. Pain that recurs on a schedule converts to subscriptions. Creative research is bursty; launching is episodic.
2. **Reporting is read-only.** Meta App Review for `ads_read` is dramatically easier than for `ads_management`. A tool that *reads* a client's account has a near-zero trust barrier; a tool that *writes* to accounts spending someone else's money has an enormous one. New vendors don't get write access to client money.
3. **Willingness to pay is already proven, and the incumbents are structurally beatable on this ICP.** AgencyAnalytics' real-world cost runs far above its sticker price — the advertised entry plan carries a 5-client minimum and reviewers report bills reaching $400+/month once clients, seats, and add-ons stack up, with per-client overages around $20–24/month and must-have features gated behind a ~$479/month top tier. Supermetrics charges per connector, per destination, and per seat, so agency costs escalate quickly. Looker Studio is "free" but has **no native Meta connector at all** — every Meta report in Looker requires a paid third-party connector plus hours of fragile template maintenance. The floor of this market is overpriced and overbuilt for a 5-client freelancer.
4. **Launching/scaling is a red-ocean knife fight** against Revealbot, Madgicx, and Meta itself (Advantage+ keeps absorbing this layer). Building there means competing with Meta's own roadmap. Bad idea for an MVP.
5. **Monitoring is the bridge.** Anomaly alerts ("CPA doubled overnight," "ad rejected," "campaign stopped delivering") use the exact same data pipeline as reporting, address the "performance monitoring" pain from your interviews, and create daily engagement — which is what stops churn on a tool that would otherwise be opened once a month.

### The uncomfortable truths (challenging your assumptions)

- **"Collecting data from multiple platforms" was the #1 pain — and the MVP is Meta-only.** This is a deliberate scope cut, not a blind spot. It's viable only if the ICP is Meta-first buyers (they exist in huge numbers: e-com and lead-gen freelancers whose spend is 80–100% Meta). It caps the initial market, and **Google Ads must be connector #2, shipped within ~2 months of launch**, or churn will come from exactly the pain you validated. Bake multi-source into the data model from day one (§3) so this is an addition, not a rewrite.
- **Interviews are complaints, not contracts.** People reliably say reporting is painful; that does not prove they'll pay *you*. Before building past the MVP milestone list in §4, get **10 design partners committed at a real price** (e.g., $29–49/mo, charged, refundable). If you can't get 10 media buyers to pay $29 for this, no amount of code fixes that.
- **The incumbent is not asleep.** AgencyAnalytics has already shipped AI insights, anomaly detection, benchmarks, even MCP access. "We have AI summaries" is not a moat by itself. The wedge is: **Meta-native depth** (breakdowns, creative-level reporting, delivery diagnostics that generic 85-connector tools flatten into generic widgets), **flat honest pricing**, and **summary quality good enough to send unedited**. If the AI summary needs rewriting every time, the product is dead — that quality bar is the actual moat, and it's an engineering/prompting problem you can win.
- **Retargeting module: freeze it.** Don't delete it (sunk knowledge of the Marketing API lives there), don't maintain it. Feature-flag it off, strip it from nav, harvest its API client code.

---

## PHASE 1 — Product Discovery

### 1.1 Jobs To Be Done

**Primary JTBD (reporting):**
> "When my client's reporting day approaches, help me produce a report that proves my value and explains what happened and why — so I keep the retainer without losing half a day per client in Ads Manager exports and spreadsheets."

**Secondary JTBD (monitoring):**
> "While I'm not looking at an account, watch it for me and tell me the moment something breaks or spikes — so my client never discovers a problem before I do."

**Tertiary JTBD (client communication):**
> "When my client asks 'how are things going?' mid-month, give me a link I can send in 10 seconds instead of a screenshot scramble."

Note the emotional job inside all three: **looking professional and in-control to the person paying the retainer.** The report is a retention artifact for the *buyer's* business. This is why white-label branding is MVP, not roadmap.

### 1.2 ICP

- Freelance Meta media buyers and micro-agencies, **1–10 people**
- Managing **3–25 client ad accounts**, mostly e-commerce and local lead-gen
- $5k–$500k/month aggregate spend; Meta is the dominant channel
- Bill monthly retainers ($500–$5,000/client); client reporting is contractual or expected
- Currently reporting via: Ads Manager exports → Google Sheets, Looker Studio + paid connector, screenshots into slides, or an expensive tool they resent
- Buying trigger: onboarding client #4–5, when manual reporting stops scaling

**Explicitly not the ICP (v1):** in-house brand teams (have BI), 50+ person agencies (need SSO, roles, procurement), pure SEO/social agencies (wrong channel), one-client freelancers (no aggregation pain — they're the free tier, not the customer).

### 1.3 Personas

**P1 — Solo freelancer "Milda"** (primary). 6 clients, ~$120k/mo total spend. Reports monthly, WhatsApps clients weekly. Loses the last Sunday of every month to reporting. Fears: a client churning because "we don't know what you actually do," and finding out about a disapproved ad from the client. Pays for: Canva, a Looker connector she hates, ChatGPT. Price tolerance: $30–80/mo total.

**P2 — Agency owner "Tomas"** (primary). 4-person shop, 18 clients. He no longer builds reports — his two account managers do, inconsistently. Wants: consistent quality without him reviewing every report, and to look bigger than he is (white-label). Price tolerance: $150–400/mo, prefers per-client pricing that maps to how *he* bills.

**P3 — Account manager "Greta"** (user, not buyer). Executes reports at Tomas' agency. Wants fewer tabs, a summary draft she edits instead of writes, and to never be the one who missed the anomaly. Her satisfaction drives P2's renewal.

### 1.4 Frequency × severity of the pains

| Pain | Frequency | Severity | In MVP? |
|---|---|---|---|
| Building client reports | Weekly–monthly per client | High (hours per client, tied to getting paid) | **Core** |
| Pulling data across platforms | Constant | High | Meta-only now; Google Ads = roadmap #1 |
| Explaining "why did X change" to clients | Weekly | High (anxiety-inducing) | **Core (AI)** |
| Performance monitoring / catching breakage | Daily | High but latent (rare, catastrophic) | **Core (alerts)** |
| Spreadsheet drudgery | Weekly | Medium | Solved implicitly + CSV export |
| Creative research | Weekly | Medium | Out |
| Creative launching / ad duplication | Weekly | Medium | Out |
| Campaign scaling decisions | Daily | Medium | Out (read-only recs later, never auto-actions in v1) |
| Test campaign creation | Bursty | Low-med | Out |

### 1.5 Competitors and why they lose this ICP

| Competitor | What it is | Why it loses the 3–25 client Meta buyer |
|---|---|---|
| **AgencyAnalytics** | All-in-one agency reporting, 85+ integrations | Priced for breadth the ICP doesn't use; real costs balloon via client minimums, per-client overages (~$20–24), and features gated at ~$479/mo. Meta depth is shallow — generic widgets, weak breakdowns, no creative-level storytelling. |
| **Supermetrics** | Data pipes into Looker/Sheets/BQ | It's plumbing, not a product. You still build and maintain every report yourself. Per-source, per-destination, per-seat pricing punishes agencies. |
| **Looker Studio** | Free dashboards | No native Meta connector — requires a paid third party. Fragile, slow, ugly by default, hours of template maintenance, no summaries, no alerts, no scheduling reliability. |
| **Whatagraph** | Cross-channel agency reporting | Starts around $229/mo — priced out of the ICP entirely. |
| **Swydo / Reporting Ninja / DashThis** | Budget reporting tools | Closest true competitors on price. Beat them on Meta-native depth, summary quality, and monitoring. Study their gaps; don't dismiss them. |
| **Madgicx / Revealbot / TripleWhale** | Optimization / automation / e-com attribution | Different job. They optimize; they don't produce the client-facing artifact. (They validate that buyers pay $50–300/mo for Meta tooling.) |
| **ChatGPT + exports** | The DIY threat | Real and growing. Beaten by: persistent connections, scheduling, alerting, white-label links, history — things a chat session can't hold. |

**Positioning line:** *"Meta-native client reporting that writes itself — and watches your accounts while you sleep. Flat per-client pricing, everything included."*

### 1.6 Where AI genuinely adds value vs. where automation suffices

**AI (LLM) — only where language/judgment is the product:**
- Report narrative: "What happened, why, what's next" per client per period, grounded strictly in the synced numbers (no hallucinated metrics — the prompt receives a computed fact sheet, not raw freedom)
- Anomaly *explanation*: detection is statistics; the "CPA rose 34%, driven by a 41% CPM increase concentrated in campaign X after audience fatigue" narrative is AI
- Plain-language Q&A over a client's data (post-MVP)

**Automation, no AI:**
- Data sync, scheduling, report generation/delivery, share links, PDF rendering
- Anomaly *detection*: rolling baselines + z-scores/threshold rules. Deterministic, explainable, cheap
- Status alerts: ad rejected, learning limited, zero delivery, budget cap hit — these are API facts, not intelligence

**Never (v1):** auto-changing budgets/bids, auto-pausing, "AI media buyer." Wrong trust level, wrong API permission tier, wrong fight.

### 1.7 MVP feature list (in)

1. Meta OAuth + multi-ad-account connection (largely exists)
2. **Clients** as the core object: map 1+ ad accounts → a client; logo, name, timezone, currency
3. **Portfolio home**: all clients, key metrics for the period, spend pacing, alert badges — the "morning coffee screen"
4. **Client detail**: metrics with period-vs-period comparison, trend charts, campaign table, breakdowns (age/gender/placement/platform), creative-level table with thumbnails
5. **Report generation**: pick client + period + template → rendered report with charts, tables, and an **editable AI summary**
6. **Scheduling & delivery**: weekly/monthly auto-generation; email to client list; **shareable live link** (tokenized, no login); PDF export
7. **White-label basics**: buyer's logo + accent color on reports and share pages
8. **Alerts**: spend spike/drop, CPA/ROAS deviation vs. rolling baseline, ad rejected, learning limited, zero-spend on active campaign → email digest + in-app inbox
9. **CSV export** everywhere there's a table
10. Settings: workspace, branding, billing (Stripe), Meta connection health

### 1.8 Explicitly NOT in MVP

Google Ads (roadmap #1), TikTok/GA4, campaign creation/editing/duplication, creative library/research, automation rules, client login portal (share links only), custom metric builder, drag-and-drop report designer (opinionated templates only — this is a feature, not a gap: Linear won by removing configurability), Slack integration, team roles/permissions (single workspace, multiple seats, all-equal), custom domains, agency benchmarks, retargeting module (frozen).

### 1.9 Roadmap after MVP proves retention

1. **Google Ads connector** (directly answers pain #1's cross-platform half) — within ~2 months
2. Slack/WhatsApp alert delivery
3. Client portal logins + comment threads on reports
4. GA4 + Shopify revenue join (true ROAS)
5. Report template marketplace / custom sections
6. Creative performance module (analysis-only: fatigue detection, hook-rate ranking) — the honest v1 of "creative ops"
7. *Maybe never:* campaign launching/scaling. Revisit only with distribution + trust + `ads_management` approval in hand.

---

## PHASE 2 — Product Design

### 2.1 Information architecture

```
Workspace (one per customer/agency)
└── Sidebar
    ├── Home            (portfolio overview + alert feed)
    ├── Clients         (list → Client detail)
    │     └── Client: Overview | Campaigns | Creatives | Breakdowns | Reports
    ├── Reports         (all reports across clients; drafts, scheduled, sent)
    ├── Alerts          (inbox: unread/all; per-alert detail w/ AI explanation)
    └── Settings        (Workspace, Branding, Connections, Members, Billing, Alert rules)
```

Command palette (⌘K): jump to client, generate report, search campaigns. This is the single cheapest "feels like Linear" investment.

### 2.2 Design principles (Linear/Vercel/Stripe register)

- Dense, quiet, monochrome-plus-one-accent; color reserved for data and status
- Numbers first: tabular figures, right-aligned metrics, delta chips (▲ 12.4% green / ▼ red, inverted for cost metrics — CPA down = green)
- Zero dashboards-for-dashboards'-sake: every screen answers a question a media buyer actually asks
- Speed as a feature: skeletons < 100ms, cached data instantly with a "synced 14 min ago" stamp, background refresh
- One primary action per screen, top right

### 2.3 Screens and states

**Home.** Grid/list of client cards: name, logo, spend (period), primary KPI + delta, pacing bar, alert badge. Right rail: latest alerts. Primary action: "Add client."
- *Empty:* illustration-free, one sentence — "Connect Meta and create your first client. Two minutes." → button.
- *Loading:* skeleton cards.
- *Error (Meta token expired):* inline banner per affected client, "Reconnect" button — never a dead full-page error.

**Client detail — Overview tab.** Period picker (last 7/14/30, MTD, custom) + compare toggle. KPI row (Spend, Purchases/Leads, CPA, ROAS, CTR, CPM) with deltas. Spend & KPI trend chart. Top campaigns table. "Generate report" primary button. AI insight strip: 2-sentence current-state summary with "Explain more."
- *Empty (just connected):* "Syncing 90 days of history — usually under 2 minutes" with real progress.
- *Partial data:* show what's synced, badge the rest.

**Campaigns / Creatives / Breakdowns tabs.** Sortable virtualized tables; creatives include thumbnail, hook rate, frequency; every table has CSV export. Status chips surface delivery problems (Learning limited, Rejected) — these link to the alert.

**Reports list.** Tabs: Drafts, Scheduled, Sent. Row: client, period, status, open count (share-link views — the "did my client even read it" feature buyers love). Primary: "New report."

**Report editor.** Left: the rendered report (client-branded). Right rail: section toggles, period, template. Summary section is editable rich text with "Regenerate" and tone presets (concise / detailed / non-technical client). Actions: Save draft, Send test, Schedule, Copy share link, Download PDF.
- *AI loading:* summary streams in; rest of report never blocks on it.
- *AI failure:* report renders with an empty summary + "Write manually or retry" — **the report must never be hostage to the LLM.**

**Share page (client-facing, no auth).** Buyer's branding only ("Powered by…" removable on paid tier). Read-only report + period switcher if enabled. This page is the growth loop: every report a client receives is a demo to whoever else sees it.

**Alerts inbox.** Rows: severity dot, client, headline ("CPA up 38% vs 14-day baseline"), time. Detail: mini-chart of the metric, affected entities, AI explanation, "Include in next report" toggle, resolve/mute.
- *Empty:* "All quiet. We check every account hourly." (Turns silence into perceived value.)

**Settings.** Connections (Meta account health, token expiry countdown, reconnect), Branding (logo, accent, sender name, reply-to), Alert rules (global defaults + per-client overrides, sane defaults on), Members, Billing (per-client Stripe metering), Workspace.

**Onboarding flow (the make-or-break funnel):** Sign up → Connect Meta (OAuth) → Pick ad accounts → Auto-create clients (1:1 default, mergeable) → historical sync with progress → land on Home with real data → "Generate your first report" callout. Target: **signup to first real report < 5 minutes.** Instrument every step.

### 2.4 System states policy

Every data surface implements the same four states via one wrapper component: `loading` (skeleton), `empty` (one sentence + one action), `error` (retry + cause), `stale` (data + "synced Xm ago" + refresh). No screen ships without all four.

---

## PHASE 3 — Architecture

> Written without repo access as decision rules + target structure. First implementation task is an audit mapping the actual repo onto this.

### 3.1 Keep / change / freeze / delete

**Keep as-is:** Next.js + TS + Tailwind shell; Meta OAuth flow and token storage (verify: long-lived token exchange + refresh + encryption at rest); design-system primitives (Button, Card, Table, Modal…); layout/navigation chrome; any generic Meta API client (auth headers, retries, error normalization).

**Keep but generalize:** the Meta API layer — extract from retargeting-specific calls into a provider-agnostic `connectors/` interface (`fetchAccounts`, `fetchInsights(level, breakdowns, range)`, `fetchEntities`, `fetchCreatives`) with Meta as the first implementation. **This single abstraction is what makes Google Ads a 2-week add instead of a rewrite.** Also: rate-limit handling (Meta Insights throttling is where naive implementations die — respect `x-business-use-case-usage`, queue + backoff).

**Freeze:** everything retargeting-specific → `modules/retargeting/`, behind a disabled feature flag, out of nav, excluded from new-code imports.

**Delete:** retargeting-only dashboard widgets, dead routes, any copy/branding tied to the old positioning.

**Add (the actual product):** sync engine, metrics service, report engine, AI service, alert engine, share pages, email delivery, billing.

### 3.2 Target structure

```
src/
├── app/                        # routes: (auth), (app)/{home,clients,reports,alerts,settings}, share/[token], api/
├── modules/
│   ├── connectors/             # provider interface + meta/ (+ google/ later)
│   ├── sync/                   # scheduler, jobs, backfill, incremental, status
│   ├── metrics/                # canonical metric registry, period math, comparisons, baselines
│   ├── reports/                # templates, builder, renderer (web + PDF), scheduler, delivery
│   ├── alerts/                 # detectors (statistical + status), rules, digests
│   ├── ai/                     # fact-sheet builder → prompt → summary; explanation service
│   ├── clients/                # client entity, account mapping
│   ├── retargeting/            # FROZEN
│   └── billing/
├── components/ui/              # primitives (existing)
├── components/data/            # MetricCard, DeltaChip, TrendChart, DataTable, StateWrapper
└── lib/                        # db, auth, email, feature flags
```

Rules: modules never import each other's internals (public `index.ts` only); `app/` routes are thin — logic lives in modules; every module owns its types.

### 3.3 Data model (core tables)

`workspaces`, `users`, `memberships` — existing auth likely maps here.
`connections` (workspace, provider, tokens encrypted, status, expiry).
`ad_accounts` (connection, external_id, name, currency, tz).
`clients` (workspace, name, branding, tz) + `client_ad_accounts` join — **many-to-many from day one** (one client, several accounts; later, several providers).
`insights_daily` (ad_account, date, level, entity_id, metrics jsonb + hot columns: spend, impressions, clicks, conversions, revenue) — **daily grain, entity level, provider-tagged**. This is the table everything reads. Never render a report from live API calls: sync → store → serve. That's what makes reports instant, historical, and immune to Meta latency.
`entities` (campaign/adset/ad metadata, status, creative refs, thumbnails cached).
`reports` (client, period, status, sections jsonb, summary text, share_token) / `report_schedules` / `report_deliveries` (+ open tracking).
`alerts` (client, type, severity, metric, baseline, observed, explanation, status) / `alert_rules`.

Baselines for anomaly detection are computed from `insights_daily` (rolling 14-day mean/σ per client per metric) — no extra infra.

### 3.4 Jobs & infra

Needs: hourly incremental sync, 90-day backfill on connect, scheduled report generation/sending, alert scans. If currently on Vercel-style serverless: cron routes + a jobs table with locking is enough for MVP (Inngest/QStash/Trigger.dev if you want durability cheap). Don't build a queue cluster for 10 design partners.

AI: server-side calls to Claude API; input is a **computed fact sheet** (top-line metrics, deltas, top movers, anomalies, notable entities) — never raw rows, never freedom to invent numbers; output validated against the fact sheet before display; temperature low; cache per (client, period, data-version).

PDF: render the share page via headless Chromium (or a service) — one source of truth for web and PDF. Do not build a parallel PDF layout engine.

### 3.5 Meta API specifics that will bite

- Insights API is heavily rate-limited per ad account per app tier — batch, queue, exponential backoff, and sync incrementally (yesterday ± 3-day attribution restatement window; re-pull trailing 3 days on every sync)
- Metric restatement: Meta revises recent conversions; store `synced_at`, expect small diffs, never alert off <24h-old data
- App Review: `ads_read` + `business_management` scopes; your existing approved app may already cover this — verify before assuming
- Token hygiene: long-lived user tokens expire (~60 days); surface expiry proactively in Settings and via email, because a silent dead token = missed client report = churn event

---

## PHASE 4 — Implementation brief (execute inside the repo)

Milestones, each ending green (`build` + `lint` + `typecheck` + app boots):

- **M0 — Audit & freeze (0.5d):** map repo to §3.1; move retargeting behind flag; write `ARCHITECTURE.md` with the actual keep/change/delete list; CI check green.
- **M1 — Data foundation (2–3d):** schema §3.3; connector interface + Meta implementation harvested from existing code; backfill + hourly incremental sync with rate-limit queue; sync status UI. *Exit test: connect a real account, see 90 days in `insights_daily`.*
- **M2 — Clients & portfolio (2d):** client CRUD + account mapping; onboarding flow; Home with real metrics; StateWrapper (all four states) everywhere.
- **M3 — Client analytics (2–3d):** Overview/Campaigns/Creatives/Breakdowns tabs; period compare; metric registry; CSV export. *Exit test: a media buyer can answer "how's this client doing" without Ads Manager.*
- **M4 — Reports (3–4d):** template + renderer; report editor; share page + token; PDF; email delivery + open tracking; scheduling. *Exit test: schedule a Monday-9am monthly report, receive it, open the live link.*
- **M5 — AI summaries (2d):** fact-sheet builder → Claude → editable streamed summary; tone presets; validation + graceful failure. *Exit test: summary is sendable-without-edits for 3 real accounts.*
- **M6 — Alerts (2–3d):** baselines; statistical + status detectors; inbox + email digest; per-client rule overrides; "include in report."
- **M7 — Commercial polish (2d):** Stripe per-client billing, branding settings, empty/error passes, ⌘K, landing copy.

Then: 10 design partners, charged. Watch three numbers: signup→first-report conversion, reports actually *sent* to clients (not just generated), and week-4 retention. Google Ads connector starts the day those look healthy.

**Definition of "I would actually use this":** a buyer connects their real account, and within 5 minutes holds a report they would forward to a client without embarrassment, and within a week gets one alert that saved them from an awkward client call. Everything in this spec serves those two moments.
