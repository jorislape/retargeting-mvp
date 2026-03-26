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

  const tokenUrl =
    `https://graph.facebook.com/v19.0/oauth/access_token` +
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

  const dashboardUrl = new URL("/dashboard", request.url);
  const response = NextResponse.redirect(dashboardUrl);

  response.cookies.set("meta_access_token", tokenData.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: tokenData.expires_in ?? 60 * 60,
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