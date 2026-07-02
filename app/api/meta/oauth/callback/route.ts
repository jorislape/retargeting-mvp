import { NextRequest, NextResponse } from "next/server";

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

  response.cookies.set("meta_access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn,
  });

  response.cookies.set("meta_oauth_state", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}