import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasAppId: !!process.env.META_APP_ID,
    redirectUri: process.env.META_REDIRECT_URI ?? null,
    nodeEnv: process.env.NODE_ENV,
  });
}