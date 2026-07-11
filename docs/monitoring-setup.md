# Competitor Monitoring Beta — provisioning & deployment steps

Operator runbook for enabling the monitoring beta. With none of this
done, the deployed product is exactly the pre-beta app (flag defaults
off; no DB connection is attempted).

## 1. Provision a FRESH Neon Postgres database

Do **not** reuse any existing `DATABASE_URL` (the one lingering in
older `.env.local` files points at the pre-pivot database). The
migration script will refuse a non-empty database, but start clean
anyway:

1. Vercel Dashboard → your project → **Storage** tab → **Create
   Database** → choose **Neon** (Marketplace) → pick a region near your
   Vercel function region → Create.
2. In the "Connect Project" step, connect it to this project. Vercel
   injects `DATABASE_URL` into the project's environment automatically
   (all environments you select — Production is enough for the beta).
3. Copy the same `DATABASE_URL` locally ONLY for running the migration
   (step 2 below). Do not commit it; do not add it to `.env.local`
   unless you also intend to run the beta locally.

## 2. Apply the schema (guarded migration)

```bash
DATABASE_URL="postgres://...neon.tech/neondb?sslmode=require" npm run monitoring:migrate
```

The script prints the target host/database, then **verifies the
database contains no unexpected tables** before applying
`drizzle/*.sql`. If it finds any foreign table it stops without
touching anything — that means the URL points at the wrong database.

Re-running is safe (drizzle tracks applied migrations).

## 3. Set the remaining environment variables (Vercel → Settings → Environment Variables)

| Variable | Value | Scope |
|---|---|---|
| `MONITORING_ENABLED` | `true` (set to `false`/remove to instantly disable the beta) | Production |
| `CRON_SECRET` | output of `openssl rand -base64 32` | Production |
| `MONITORING_MAX_ACTIVE_URLS` | optional; default `500` | Production |
| `DATABASE_URL` | set automatically by the Neon integration in step 1 | Production |

Redeploy after changing env vars (Vercel only applies them to new
deployments).

## 4. Cron

`vercel.json` registers the daily cron (added in Phase 3). Vercel
reads it at deploy time — after the first deploy with the file,
confirm under Project → Settings → **Cron Jobs** that
`/api/monitoring/cron` appears with the daily schedule. Vercel invokes
it with `Authorization: Bearer $CRON_SECRET` automatically when
`CRON_SECRET` is set.

Plan note: daily cron fits the Hobby plan's limits (timing within the
day is loose on Hobby, exact on Pro). Confirm your plan before relying
on precise run times.

## 5. Rollback tiers

1. **Flag off:** set `MONITORING_ENABLED=false` (or remove it) and
   redeploy. Routes return `{disabled:true}`, cron no-ops, UI hides.
2. **Stop the cron:** remove the `crons` entry from `vercel.json` and
   redeploy.
3. **Drop the data:** delete the Neon database (beta data loss is
   acceptable and disclosed to users). The localStorage watchlist and
   manual one-time fetch are untouched by all three tiers.
