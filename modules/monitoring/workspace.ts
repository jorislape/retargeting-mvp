import { and, eq, lt } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDb } from "./db/client.ts";
import { workspaces } from "./db/schema.ts";
import { consumeRateLimit, MINT_PER_IP } from "./ratelimit.ts";

/**
 * Pseudonymous workspace ownership — the monitoring beta's substitute
 * for accounts.
 *
 * The token: 32 random bytes (256-bit), base64url, minted server-side.
 * It exists in exactly one place: an httpOnly, Secure, SameSite=Lax
 * cookie. Never in localStorage, never in a URL, never readable by
 * client JS, never logged. The database stores only SHA-256(token) as
 * the workspace id, so a leaked database cannot impersonate anyone.
 *
 * Consequences the user must be told (and the UI copy does):
 *   - Clearing cookies PERMANENTLY orphans the workspace: there is no
 *     account to log back into, no recovery. The orphaned rows stop
 *     being scheduled once last_seen_at ages past 30 days and are
 *     eligible for deletion after 90 (deletion is a documented
 *     follow-up, not implemented in V1).
 *   - A future accounts milestone migrates cleanly: a logged-in user
 *     whose browser still carries the cookie "claims" the workspace
 *     (add user_id to workspaces, backfill from the claim) — nothing
 *     in this model blocks that.
 *
 * Minting policy: a workspace is created ONLY when the user takes a
 * monitoring action (adding a competitor), never on a read. Visitors
 * who ignore the beta get no cookie and no row. Minting is
 * rate-limited per IP (see ratelimit.ts).
 */

export const WORKSPACE_COOKIE = "debrief_ws";

/** 32 bytes base64url — always 43 chars, no padding. */
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

const TOUCH_AFTER_MS = 60 * 60 * 1000; // refresh last_seen at most hourly
export const WORKSPACE_ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30d

export function mintToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashWorkspaceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cookie attributes. `secure` is relaxed only for local dev over
 *  plain http — production always sets Secure. */
export function workspaceCookieOptions() {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    // Chrome's maximum cookie lifetime; refreshed on monitoring use.
    maxAge: 400 * 24 * 60 * 60,
  };
}

export type ResolvedWorkspace =
  | {
      status: "ok";
      workspaceId: string;
      /** Non-null when the route must (re)set the cookie. */
      setCookieToken: string | null;
    }
  | { status: "none" } // no usable cookie and creation not requested
  | { status: "rate_limited" }; // mint denied for this IP right now

/** Client IP for rate limiting only — hashed before storage, never
 *  logged. Prefers the platform-set headers over the spoofable one. */
export function clientIpKey(request: NextRequest): string {
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/**
 * Resolves the request's workspace.
 *
 * - Valid cookie + existing row: returns it (touching last_seen_at at
 *   most hourly — this is the "visit" that keeps scheduling alive).
 * - Valid-format cookie but no row (e.g. data deleted): with
 *   `create`, re-adopts the same token as a fresh workspace so the
 *   cookie doesn't churn; without, treated as none.
 * - No/invalid cookie: with `create`, mints a new token; without,
 *   returns none.
 *
 * Every creation path (mint or re-adopt) passes the per-IP rate limit.
 * May throw MonitoringUnavailableError (DB down) — callers map it to
 * the degraded response.
 */
export async function resolveWorkspace(
  request: NextRequest,
  opts: { create: boolean }
): Promise<ResolvedWorkspace> {
  const raw = request.cookies.get(WORKSPACE_COOKIE)?.value ?? "";
  const token = TOKEN_RE.test(raw) ? raw : null;

  /* No DB touch until a branch actually needs it — a cookie-less
     read resolves to "none" even when the database is down, so the
     empty state renders instead of a degraded card. */
  if (token !== null) {
    const db = getDb();
    const id = hashWorkspaceToken(token);
    const [row] = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .limit(1);

    if (row) {
      // Throttled touch: one UPDATE per hour per workspace, max.
      await db
        .update(workspaces)
        .set({ lastSeenAt: new Date() })
        .where(
          and(
            eq(workspaces.id, id),
            lt(workspaces.lastSeenAt, new Date(Date.now() - TOUCH_AFTER_MS))
          )
        );
      return { status: "ok", workspaceId: id, setCookieToken: null };
    }
  }

  // A valid-format cookie whose row no longer exists is treated
  // EXACTLY like no cookie. Re-adopting the client-supplied value as a
  // new workspace id is forbidden: the cookie is client-controlled
  // input, and accepting it would let a client create a workspace
  // under a PREDICTABLE token of its choosing (shareable/plantable),
  // breaking the invariant that every live token is 256 bits of
  // server-generated entropy. Nothing is preserved by re-adoption
  // anyway — the old row is already gone.
  if (!opts.create) return { status: "none" };

  const db = getDb();
  const allowed = await consumeRateLimit(db, MINT_PER_IP, clientIpKey(request));
  if (!allowed) return { status: "rate_limited" };

  const freshToken = mintToken();
  const id = hashWorkspaceToken(freshToken);
  await db
    .insert(workspaces)
    .values({ id })
    .onConflictDoNothing({ target: workspaces.id });

  return { status: "ok", workspaceId: id, setCookieToken: freshToken };
}
