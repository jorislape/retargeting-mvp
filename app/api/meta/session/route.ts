import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("meta_access_token")?.value;

  return NextResponse.json({
    ok: true,
    connected: !!token,
  });
}