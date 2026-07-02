# AdReports — Meta Ads client reporting & monitoring

Automated client reports and always-on account monitoring for Meta Ads,
built for freelance media buyers and small agencies.

> This repo pivoted from a retargeting-automation MVP. The retargeting
> module is frozen behind `FEATURE_RETARGETING` — see `ARCHITECTURE.md`
> for the full technical audit and `product-spec.md` for product strategy.

## Quickstart

```bash
npm install
cp .env.example .env.local   # fill in Meta app credentials
npm run dev
```

Open http://localhost:3000, hit **Connect Meta**, and you'll land on `/home`
with your ad accounts. Click any account for KPIs, deltas, trend, and the
campaign table.

## Env

| Var | Purpose |
|---|---|
| `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI` | Meta OAuth |
| `FEATURE_RETARGETING` | `true` revives the frozen retargeting module |

## Checks

```bash
npm run build && npx tsc --noEmit && npx eslint .
```
