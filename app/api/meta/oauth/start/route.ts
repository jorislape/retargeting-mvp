import { NextResponse } from "next/server";

export async function GET() {
  const clientId = "1066356692282406";

  const redirectUri = "http://localhost:3000/api/meta/oauth/callback";

  const url =
    `https://www.facebook.com/v19.0/dialog/oauth` +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=ads_read,ads_management,business_management,pages_show_list,pages_read_engagement`;

  return NextResponse.redirect(url);
}