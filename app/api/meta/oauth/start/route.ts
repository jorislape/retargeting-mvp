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

  /* Read-only by design: ads_read only. ads_management and
     pages_show_list were removed with the retargeting freeze — reviving
     that module means adding its scopes back here (and re-consent). */
  const scope = ["public_profile", "ads_read"].join(",");

  // v23.0 matches META_API_VERSION in modules/connectors/meta/client.ts
  // (the dialog lives on www.facebook.com, so the constant isn't imported).
  const url =
    `https://www.facebook.com/v23.0/dialog/oauth` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}` +
    `&scope=${encodeURIComponent(scope)}` +
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