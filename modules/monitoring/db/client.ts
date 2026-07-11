import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import {
  drizzle as drizzleWs,
  type NeonDatabase,
} from "drizzle-orm/neon-serverless";
import * as schema from "./schema.ts";

/**
 * The ONLY place a database client is created in this codebase.
 *
 * Lazy on purpose: importing this module does nothing; the client is
 * built on first getDb() call. Core product code never imports
 * anything under modules/monitoring (enforced by the isolation test),
 * so the entire product runs with DATABASE_URL unset — monitoring
 * routes catch MonitoringUnavailableError and degrade to an honest
 * "temporarily unavailable" response instead of breaking anything.
 */

/** Thrown when monitoring infrastructure (the DB) is unreachable or
 *  unconfigured. Routes map this to a degraded-but-harmless response;
 *  it must never escape into core rendering. */
export class MonitoringUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MonitoringUnavailableError";
  }
}

export type MonitoringDb = NeonHttpDatabase<typeof schema>;

let cached: MonitoringDb | null = null;

export function getDb(): MonitoringDb {
  const url = process.env.DATABASE_URL;
  if (!url || url.trim() === "") {
    throw new MonitoringUnavailableError(
      "DATABASE_URL is not set — monitoring storage is unavailable."
    );
  }
  if (cached === null) {
    // neon() over HTTP: no connection pool to manage, suits serverless.
    cached = drizzle(neon(url), { schema });
  }
  return cached;
}

export type MonitoringTx = Parameters<
  Parameters<NeonDatabase<typeof schema>["transaction"]>[0]
>[0];

/**
 * Interactive transaction support — the neon HTTP driver can't do
 * SELECT ... FOR UPDATE inside a transaction, so the one operation
 * that needs it (the race-free 3-per-workspace competitor cap) runs
 * over the same package's WebSocket Pool driver.
 *
 * Runtime requirement (verified, fail-closed): a global WebSocket
 * constructor — present in Node >= 21 (local Node 24 ✓, Vercel's
 * default Node runtime >= 22 ✓). If a runtime ever lacks it, this
 * throws MonitoringUnavailableError rather than degrading; we do NOT
 * ship a ws polyfill dependency.
 *
 * A fresh single-use Pool per call, always ended in finally — no
 * connection can leak past the request.
 */
export async function withTransaction<T>(
  fn: (tx: MonitoringTx) => Promise<T>
): Promise<T> {
  const url = process.env.DATABASE_URL;
  if (!url || url.trim() === "") {
    throw new MonitoringUnavailableError(
      "DATABASE_URL is not set — monitoring storage is unavailable."
    );
  }
  const ws = (globalThis as { WebSocket?: unknown }).WebSocket;
  if (typeof ws !== "function") {
    throw new MonitoringUnavailableError(
      "No global WebSocket constructor in this runtime — transactional " +
        "monitoring operations are unavailable (Node >= 21 required)."
    );
  }
  neonConfig.webSocketConstructor = ws as typeof WebSocket;

  const pool = new Pool({ connectionString: url });
  try {
    const db = drizzleWs(pool, { schema });
    return await db.transaction(fn);
  } finally {
    await pool.end();
  }
}
