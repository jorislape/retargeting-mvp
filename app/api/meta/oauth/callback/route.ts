import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code) {
    return NextResponse.json({ ok: false, error: "No code" });
  }

  return NextResponse.json({
    ok: true,
    message: "CODE RECEIVED",
    code,
    state,
  });
}