import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

/* Next.js loads .env.local itself, but drizzle-kit does not — pull it
   in here so db:migrate / db:push / db:studio work locally. */
config({ path: ".env.local" });

/* drizzle-kit's CLI (migrate/push/studio) picks a Postgres client by
   checking installed packages in order: pg → postgres → @vercel/postgres
   → @neondatabase/serverless. Without `pg` installed it falls through to
   the Neon serverless driver, which for CLI/migration use needs a
   WebSocket constructor — only available via Node's native `WebSocket`
   (stable since ~Node 22) or the `ws` package, neither of which this
   repo can assume. That path also produces the "can only connect
   through a websocket" warning and can hang/exit silently on older
   Node. `pg` (devDependency only) makes drizzle-kit use a plain TCP
   connection instead — deterministic across Node versions, and Neon's
   pooled connection string works over plain TCP just fine.
   The app's RUNTIME queries are untouched: modules/db/client.ts still
   uses @neondatabase/serverless's HTTP driver, the right choice for
   Vercel's serverless/edge functions. */

export default defineConfig({
  dialect: "postgresql",
  schema: "./modules/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
