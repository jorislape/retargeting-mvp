import { and, eq, gte, lt, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { rateEvents } from "./db/schema.ts";
import { MonitoringUnavailableError, type MonitoringDb } from "./db/client.ts";

/**
 * DB-backed sliding-window rate limiting. Serverless instances share
 * no memory, so counters live in the rate_events table.
 *
 * Privacy: keys are stored as SHA-256 hashes, salted with a value
 * derived from CRON_SECRET (below) — this is a coarse abuse brake,
 * not an identity system; rows for a key are pruned once they age
 * past the largest window (48h ceiling), so nothing accumulates.
 *
 * Honesty note on concurrency: count-then-insert has a small race
 * window (two parallel requests can both pass the check). Acceptable
 * for these coarse limits; the hard caps (3 URLs/workspace via a
 * row-locking transaction, global ceiling approximate) are enforced
 * separately at write time.
 */

const PRUNE_AFTER_MS = 48 * 60 * 60 * 1000;

/**
 * Salt for rate-limit key hashing, derived as
 * SHA-256("debrief-ip-salt:" + CRON_SECRET).
 *
 * Why derived and not a repo constant: the salt must be identical
 * across serverless instances (a per-boot random value would give
 * every instance its own hash space and break the sliding window),
 * but must not be public in the repo (an unsalted or public-salted
 * IPv4 hash is reversible by brute force over the address space).
 *
 * Purpose separation: CRON_SECRET's primary job is authenticating the
 * cron route. The one-way, prefixed derivation means the stored
 * hashes reveal nothing about CRON_SECRET, and knowing CRON_SECRET
 * grants nothing beyond what it already grants. Rotating CRON_SECRET
 * rotates the salt, which merely resets in-flight rate windows —
 * harmless.
 *
 * Fails closed: monitoring already requires CRON_SECRET (the cron is
 * the product), so an unset value means the beta is misconfigured and
 * rate-limited actions refuse rather than run unsalted.
 */
let cachedSalt: string | null = null;
function rateSalt(): string {
  if (cachedSalt !== null) return cachedSalt;
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (secret === "") {
    throw new MonitoringUnavailableError(
      "CRON_SECRET is not set — monitoring rate limiting is unavailable."
    );
  }
  cachedSalt = createHash("sha256")
    .update(`debrief-ip-salt:${secret}`)
    .digest("hex");
  return cachedSalt;
}

export function hashRateKey(raw: string): string {
  return createHash("sha256").update(`${rateSalt()}:${raw}`).digest("hex");
}

export interface RateLimitSpec {
  /** Namespace, e.g. "mint_ip" | "retry_ws". */
  kind: string;
  /** Max events allowed inside the window. */
  max: number;
  windowMs: number;
}

/** Workspace minting: 5 per IP per hour. Generous for a legitimate
 *  user (who needs exactly one), tight enough to stop cookie-clearing
 *  loops from mass-minting rows. Shared-NAT users may collide — the
 *  UI copy for a rejected mint says "try again later". */
export const MINT_PER_IP: RateLimitSpec = {
  kind: "mint_ip",
  max: 5,
  windowMs: 60 * 60 * 1000,
};

/** Manual retries: 10 per workspace per day (per-competitor cooldowns
 *  are derived from last_attempt_at, not stored here). */
export const RETRY_PER_WORKSPACE: RateLimitSpec = {
  kind: "retry_ws",
  max: 10,
  windowMs: 24 * 60 * 60 * 1000,
};

/**
 * Returns true (and records the event) when the action is allowed,
 * false when the limit is exhausted. Also opportunistically prunes
 * this key's expired rows so the table stays small without a job.
 */
export async function consumeRateLimit(
  db: MonitoringDb,
  spec: RateLimitSpec,
  rawKey: string
): Promise<boolean> {
  const keyHash = hashRateKey(rawKey);
  const windowStart = new Date(Date.now() - spec.windowMs);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rateEvents)
    .where(
      and(
        eq(rateEvents.kind, spec.kind),
        eq(rateEvents.keyHash, keyHash),
        gte(rateEvents.at, windowStart)
      )
    );

  if (count >= spec.max) return false;

  await db.insert(rateEvents).values({ kind: spec.kind, keyHash });

  // Opportunistic prune — same key only, bounded work.
  await db
    .delete(rateEvents)
    .where(
      and(
        eq(rateEvents.kind, spec.kind),
        eq(rateEvents.keyHash, keyHash),
        lt(rateEvents.at, new Date(Date.now() - PRUNE_AFTER_MS))
      )
    );

  return true;
}
