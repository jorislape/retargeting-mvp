#!/usr/bin/env node
/**
 * Migration runner with unambiguous output.
 *
 * `drizzle-kit migrate` prints the same "[✓] migrations applied
 * successfully!" text whether it applied 0 or N migrations, and its
 * spinner writes carriage-return frames that some terminals/IDE panes
 * swallow — together that reads as "nothing happened" even on success.
 * This wraps the same underlying primitive Drizzle recommends for
 * programmatic migrations (drizzle-orm/node-postgres/migrator) with an
 * explicit before/after count so the result is never ambiguous.
 *
 * Uses `pg` (plain TCP), matching drizzle.config.ts's CLI driver choice
 * — deterministic across Node versions, no WebSocket dependency. The
 * app's runtime queries are untouched (modules/db/client.ts keeps using
 * @neondatabase/serverless's HTTP driver).
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (check .env.local).");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });

async function migrationCount() {
  try {
    const { rows } = await pool.query(
      'SELECT count(*)::int AS n FROM "drizzle"."__drizzle_migrations"'
    );
    return rows[0].n;
  } catch {
    // Table doesn't exist yet — that's "0 applied", not an error.
    return 0;
  }
}

const before = await migrationCount();
const db = drizzle(pool);

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
} catch (error) {
  console.error("✗ Migration failed:", error instanceof Error ? error.message : error);
  await pool.end();
  process.exit(1);
}

const after = await migrationCount();
const applied = after - before;

if (applied > 0) {
  console.log(`✓ Applied ${applied} migration${applied === 1 ? "" : "s"} (${before} → ${after} total).`);
} else {
  console.log(`✓ No migrations to apply — database already up to date (${after} total).`);
}

await pool.end();
