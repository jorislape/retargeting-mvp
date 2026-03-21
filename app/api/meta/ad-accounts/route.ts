import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("meta_access_token")?.value;

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "No token" },
        { status: 401 }
      );
    }

    const url =
      `https://graph.facebook.com/v19.0/me/adaccounts` +
      `?fields=id,name,account_status` +
      `&access_token=${encodeURIComponent(token)}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.error) {
      return NextResponse.json(
        {
          ok: false,
          step: "get_ad_accounts",
          error: data.error || data,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      adAccounts: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}