import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  const clientId = process.env.META_APP_ID;
  const redirectUri = process.env.META_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { ok: false, error: "Missing META_APP_ID or META_REDIRECT_URI" },
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(16).toString("hex");

  const url =
    `https://www.facebook.com/v19.0/dialog/oauth` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}` +
    `&scope=${encodeURIComponent("public_profile,ads_read")}` +
    `&response_type=code`;

  const response = NextResponse.redirect(url);

  response.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}