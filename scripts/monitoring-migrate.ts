/**
 * Guarded migration runner for the monitoring schema.
 *
 *   DATABASE_URL=postgres://... npm run monitoring:migrate
 *
 * Deliberately does NOT load .env.local: the repo's .env.local may
 * still contain a stale pre-pivot DATABASE_URL, and pointing a
 * migration at the wrong database is exactly the mistake this script
 * exists to prevent. Pass the URL explicitly in the environment.
 *
 * Safety check (required at Checkpoint 1): before applying anything,
 * the target database is inspected. If it contains ANY table we don't
 * expect — i.e. it isn't a fresh database or one that already holds
 * exactly this monitoring schema — the script stops without touching
 * it and tells you what it found. That makes running it against the
 * old pre-pivot database (or any unrelated database) a loud no-op.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const EXPECTED_PUBLIC_TABLES = new Set([
  "workspaces",
  "monitored_competitors",
  "snapshots",
  "check_events",
  "rate_events",
]);
/** Drizzle's bookkeeping table lives in its own "drizzle" schema. */
const EXPECTED_DRIZZLE_TABLES = new Set(["__drizzle_migrations"]);

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || url.trim() === "") {
    fail(
      "DATABASE_URL is not set. Run as:\n" +
        "  DATABASE_URL=postgres://... npm run monitoring:migrate\n" +
        "(.env.local is intentionally not read — see header comment.)"
    );
  }

  // Show where we're about to connect — host + db name only, never
  // credentials — so a stale URL is caught by eye as well as by guard.
  let host = "(unparseable)";
  let dbName = "(unparseable)";
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    dbName = parsed.pathname.replace(/^\//, "") || "(default)";
  } catch {
    fail("DATABASE_URL is not a parseable URL.");
  }
  console.log(`Target: host=${host} database=${dbName}`);

  const sql = neon(url);

  // ---- Guard: refuse to touch a database with unexpected tables ----
  const tables = (await sql`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_type = 'BASE TABLE'
      AND table_schema IN ('public', 'drizzle')
  `) as { table_schema: string; table_name: string }[];

  const unexpected = tables.filter((t) =>
    t.table_schema === "public"
      ? !EXPECTED_PUBLIC_TABLES.has(t.table_name)
      : !EXPECTED_DRIZZLE_TABLES.has(t.table_name)
  );

  if (unexpected.length > 0) {
    fail(
      "Refusing to migrate: the target database contains tables this " +
        "project does not expect:\n" +
        unexpected
          .map((t) => `  - ${t.table_schema}.${t.table_name}`)
          .join("\n") +
        "\nThis looks like the wrong database (a pre-pivot or unrelated " +
        "one). Point DATABASE_URL at a fresh Neon database and re-run. " +
        "Nothing was changed."
    );
  }

  const existing = tables.filter((t) => t.table_schema === "public").length;
  console.log(
    existing === 0
      ? "Guard passed: database is empty."
      : `Guard passed: found ${existing} expected monitoring table(s).`
  );

  // ---- Apply committed migrations from ./drizzle ----
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✓ Migrations applied.");
}

main().catch((e) => {
  // Print the error message only — never echo the connection string.
  fail(e instanceof Error ? e.message : String(e));
});
