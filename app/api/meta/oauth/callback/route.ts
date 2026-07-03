import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import {
  createSession,
  LEGACY_TOKEN_COOKIE,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "@/modules/auth";
import { metaConnector } from "@/modules/connectors/meta";
import {
  connections,
  encryptToken,
  getDb,
  isDbConfigured,
  memberships,
  upsertAdAccounts,
  users,
  workspaces,
} from "@/modules/db";

/**
 * Persist the login: user (keyed by Meta user id) → personal workspace
 * → encrypted connection token → initial ad-account sync → DB session.
 * Returns the raw session cookie value.
 */
async function persistLogin(
  accessToken: string,
  expiresIn: number
): Promise<string> {
  const db = getDb();

  const meResponse = await fetch(
    `https://graph.facebook.com/v23.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`
  );
  const me = await meResponse.json();
  if (!meResponse.ok || !me?.id) {
    throw new Error("Failed to resolve Meta user identity");
  }

  const [user] = await db
    .insert(users)
    .values({ metaUserId: String(me.id), name: me.name ?? null })
    .onConflictDoUpdate({
      target: users.metaUserId,
      set: { name: me.name ?? null },
    })
    .returning();

  let membership = (
    await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, user.id))
      .limit(1)
  )[0];

  if (!membership) {
    const [workspace] = await db
      .insert(workspaces)
      .values({ name: me.name ? `${me.name}'s workspace` : "Workspace" })
      .returning();
    [membership] = await db
      .insert(memberships)
      .values({ workspaceId: workspace.id, userId: user.id, role: "owner" })
      .returning();
  }

  const [connection] = await db
    .insert(connections)
    .values({
      workspaceId: membership.workspaceId,
      provider: "meta",
      metaUserId: String(me.id),
      tokenCiphertext: encryptToken(accessToken),
      tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
      status: "active",
    })
    .onConflictDoUpdate({
      target: [
        connections.workspaceId,
        connections.provider,
        connections.metaUserId,
      ],
      set: {
        tokenCiphertext: encryptToken(accessToken),
        tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        status: "active",
        updatedAt: new Date(),
      },
    })
    .returning();

  // Initial account sync — non-fatal: the monitor run repeats it.
  try {
    const accounts = await metaConnector.fetchAdAccounts(accessToken);
    await upsertAdAccounts(membership.workspaceId, connection.id, accounts);
  } catch (error) {
    console.error("oauth callback: initial ad-account sync failed", error);
  }

  return createSession(user.id);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  const expectedState = request.cookies.get("meta_oauth_state")?.value;

  const clientId = process.env.META_APP_ID;
  const clientSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing META_APP_ID, META_APP_SECRET, or META_REDIRECT_URI",
      },
      { status: 500 }
    );
  }

  if (!code) {
    return NextResponse.json(
      { ok: false, error: "No code received" },
      { status: 400 }
    );
  }

  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.json(
      { ok: false, error: "Invalid OAuth state" },
      { status: 400 }
    );
  }

  const GRAPH = "https://graph.facebook.com/v23.0";

  const tokenUrl =
    `${GRAPH}/oauth/access_token` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&client_secret=${encodeURIComponent(clientSecret)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&code=${encodeURIComponent(code)}`;

  const tokenResponse = await fetch(tokenUrl, { method: "GET" });
  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || tokenData.error || !tokenData.access_token) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to exchange code for token",
        details: tokenData,
      },
      { status: 400 }
    );
  }

  // Exchange the short-lived token (~1h) for a long-lived one (~60d).
  // Without this, every session silently died within the hour.
  let accessToken: string = tokenData.access_token;
  let expiresIn: number = tokenData.expires_in ?? 60 * 60;

  const exchangeUrl =
    `${GRAPH}/oauth/access_token` +
    `?grant_type=fb_exchange_token` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&client_secret=${encodeURIComponent(clientSecret)}` +
    `&fb_exchange_token=${encodeURIComponent(accessToken)}`;

  const exchangeResponse = await fetch(exchangeUrl, { method: "GET" });
  const exchangeData = await exchangeResponse.json().catch(() => null);

  if (exchangeResponse.ok && exchangeData?.access_token) {
    accessToken = exchangeData.access_token;
    expiresIn = exchangeData.expires_in ?? 60 * 60 * 24 * 60;
  }

  const homeUrl = new URL("/home", request.url);
  const response = NextResponse.redirect(homeUrl);

  const cookieBase = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };

  /* New logins: session-id cookie + encrypted DB token. The raw token
     is written to a cookie ONLY as a fallback when persistence isn't
     available (no DATABASE_URL / ENCRYPTION_KEY, or a DB outage), so
     local DB-less dev and existing behavior keep working. */
  let persisted = false;
  if (isDbConfigured() && process.env.ENCRYPTION_KEY) {
    try {
      const sessionToken = await persistLogin(accessToken, expiresIn);
      response.cookies.set(SESSION_COOKIE, sessionToken, {
        ...cookieBase,
        maxAge: SESSION_TTL_SECONDS,
      });
      // Retire the legacy raw-token cookie for this browser.
      response.cookies.set(LEGACY_TOKEN_COOKIE, "", {
        ...cookieBase,
        maxAge: 0,
      });
      persisted = true;
    } catch (error) {
      console.error("oauth callback: persistence failed, falling back", error);
    }
  }

  if (!persisted) {
    response.cookies.set(LEGACY_TOKEN_COOKIE, accessToken, {
      ...cookieBase,
      maxAge: expiresIn,
    });
  }

  response.cookies.set("meta_oauth_state", "", {
    ...cookieBase,
    maxAge: 0,
  });

  return response;
}