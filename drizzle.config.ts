import { defineConfig } from "drizzle-kit";

/**
 * Drizzle-kit config for the monitoring schema — used ONLY to generate
 * SQL migration files into ./drizzle (committed to the repo).
 *
 * Deliberately no dbCredentials: migrations are applied exclusively by
 * `npm run monitoring:migrate` (scripts/monitoring-migrate.ts), which
 * refuses to touch a database containing unexpected tables. Never use
 * `drizzle-kit push` against this project.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./modules/monitoring/db/schema.ts",
  out: "./drizzle",
});
