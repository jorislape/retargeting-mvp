# Debrief — Meta Ads creative debrief

Load your ad-level Meta Ads data — upload a CSV export, use the built-in
sample dataset, or connect a read-only Meta account — add a line of
context, and get a one-page decision-first debrief: what worked, what
failed, and what to test next, in two audiences (buyer memo and a visual
client report). Built for media buyers and small agencies who don't have
time to build this analysis by hand every week.

> This repo pivoted from an earlier Meta Ads reporting/monitoring
> product (OAuth, a database, scheduled monitoring). All of that was
> removed, not frozen — see `ARCHITECTURE.md` for what changed and why.

## Quickstart

```bash
npm install
npm run dev
```

Open http://localhost:3000, load your ad-level data (CSV export, sample
dataset, or an optional read-only Meta pull), pick a KPI, add context,
and get your debrief. The CSV-upload flow needs no `.env.local`, no
signup, no setup; the optional Meta data source needs `META_APP_ID` and
`META_APP_SECRET` (see `.env.example`).

## The whole product, in one flow

1. Load ad-level data: upload a Meta Ads CSV, load the sample dataset,
   or pull read-only insights (`ads_read`) from a connected Meta account.
2. Pick the KPI that matters this period (ROAS, CPA, CTR, CPC, Leads,
   Purchases) and add context (product, offer, goal, optional target
   CPA). Optionally add directional market / competitor signals — a
   guided signal builder, pasted notes, competitor source cards, a
   browser-local watchlist, and a one-time public-page fetch — and
   review the creative format detected for each ad.
3. The data is parsed and scored in memory — a spend gate excludes ads
   with too little data, a median benchmark separates winners from
   losers, and a templated memo is generated.
4. Read, copy, or print the one-page debrief as a buyer memo or a
   client-ready report, with selected tests expandable into creative
   briefs. Your ads data is never saved on our servers: refresh the
   page and the CSV, context, and memo are gone. Two optional
   competitor features persist data: the watchlist (browser
   localStorage only) and the flagged monitoring beta (competitor URLs
   + extracted page signals server-side, under an anonymous cookie —
   see the privacy page).

There is exactly one path. No login, no dashboard, no history page —
see `ARCHITECTURE.md` for the scope rules this was built under.

## Checks

```bash
npm run build && npx tsc --noEmit && npx eslint . \
  && npm run test:csv && npm run test:watchlist && npm run test:signals
```
