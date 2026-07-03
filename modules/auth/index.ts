import { createHash, randomBytes } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import type { NextRequest } from "next/server";
import {
  connections,
  decryptToken,
  getDb,
  isDbConfigured,
  memberships,
  sessions,
  users,
} from "../db";

/* ------------------------------------------------------------------ */
/* Session + token resolution.                                         */
/*                                                                     */
/* New logins: httpOnly cookie carries a random session id only; the   */
/* Meta token lives encrypted in the DB.                               */
/*                                                                     */
/* Legacy fallback: sessions created before M2 stored the raw token in */
/* the meta_access_token cookie. Routes keep accepting it (read-only   */
/* fallback) so existing users aren't logged out; it is never written  */
/* for new logins and the fallback is scheduled for removal once       */
/* everyone has reconnected.                                           */
/* ------------------------------------------------------------------ */

export const SESSION_COOKIE = "adr_session";
export const LEGACY_TOKEN_COOKIE = "meta_access_token";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 60; // matches ~60d Meta token

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Create a DB session; returns the raw cookie value (never stored). */
export async function createSession(userId: string): Promise<string> {
  const raw = randomBytes(32).toString("hex");
  const db = getDb();
  await db.insert(sessions).values({
    tokenHash: hashSessionToken(raw),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
  });
  return raw;
}

export interface SessionContext {
  userId: string;
  workspaceId: string;
}

/** Resolve the session cookie to a user + workspace, or null. */
export async function getSession(
  request: NextRequest
): Promise<SessionContext | null> {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw || !isDbConfigured()) return null;

  try {
    const db = getDb();
    const rows = await db
      .select({
        userId: sessions.userId,
        workspaceId: memberships.workspaceId,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .innerJoin(memberships, eq(memberships.userId, users.id))
      .where(
        and(
          eq(sessions.tokenHash, hashSessionToken(raw)),
          gt(sessions.expiresAt, new Date())
        )
      )
      .limit(1);
    return rows[0] ?? null;
  } catch {
    // A DB outage must degrade to "not signed in", not a 500 on every page.
    return null;
  }
}

export interface ResolvedAccess {
  accessToken: string;
  /** "db" = session + encrypted DB token; "legacy" = pre-M2 cookie. */
  source: "db" | "legacy";
  workspaceId: string | null;
  connectionId: string | null;
}

/**
 * The single auth entry point for data routes: session-backed DB token
 * first, legacy raw-token cookie second, null when neither exists.
 */
export async function resolveAccessToken(
  request: NextRequest
): Promise<ResolvedAccess | null> {
  const session = await getSession(request);
  if (session) {
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(connections)
        .where(
          and(
            eq(connections.workspaceId, session.workspaceId),
            eq(connections.provider, "meta"),
            eq(connections.status, "active")
          )
        )
        .limit(1);
      const connection = rows[0];
      if (connection) {
        return {
          accessToken: decryptToken(connection.tokenCiphertext),
          source: "db",
          workspaceId: session.workspaceId,
          connectionId: connection.id,
        };
      }
    } catch {
      // fall through to the legacy cookie
    }
  }

  const legacy = request.cookies.get(LEGACY_TOKEN_COOKIE)?.value;
  if (legacy) {
    return {
      accessToken: legacy,
      source: "legacy",
      workspaceId: null,
      connectionId: null,
    };
  }

  return null;
}
