# Debrief — Meta Ads creative debrief

Upload your Meta Ads CSV export, add a line of context, and get a
one-page decision-first debrief: what worked, what failed, and what to
test next. Built for media buyers and small agencies who don't have
time to build this analysis by hand every week.

> This repo pivoted from an earlier Meta Ads reporting/monitoring
> product (OAuth, a database, scheduled monitoring). All of that was
> removed, not frozen — see `ARCHITECTURE.md` for what changed and why.

## Quickstart

```bash
npm install
npm run dev
```

Open http://localhost:3000, upload a Meta Ads Manager CSV export, pick
a KPI, add context, and get your debrief. No `.env.local`, no signup,
no setup.

## The whole product, in one flow

1. Upload a Meta Ads CSV.
2. Pick the KPI that matters this period (ROAS, CPA, CTR, CPC, Leads,
   Purchases) and add context (product, offer, goal, optional target
   CPA, optional creative notes).
3. The CSV is parsed and scored in memory — a spend gate excludes ads
   with too little data, a median benchmark separates winners from
   losers, and a templated memo is generated.
4. Read (or copy) the one-page debrief. Nothing is saved: refresh the
   page and it's gone.

There is exactly one path. No login, no dashboard, no history page —
see `ARCHITECTURE.md` for the scope rules this was built under.

## Checks

```bash
npm run build && npx tsc --noEmit && npx eslint .
```
