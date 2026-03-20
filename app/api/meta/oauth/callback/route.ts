import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {

  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json({
      ok: false,
      error: "No code received"
    });
  }

  const clientId = "1066356692282406";
  const clientSecret = "48587777fade0d059de7a70f318eeb91";

  const redirectUri = "http://localhost:3000/api/meta/oauth/callback";

  const tokenUrl =
    `https://graph.facebook.com/v19.0/oauth/access_token` +
    `?client_id=${clientId}` +
    `&client_secret=${clientSecret}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&code=${code}`;

  const response = await fetch(tokenUrl);
  const data = await response.json();

  return NextResponse.json({
    ok: true,
    tokenData: data
  });

}