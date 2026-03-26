import { NextRequest, NextResponse } from "next/server";

const META_API_VERSION = "v23.0";

type MetaAdAccount = {
  id: string;
  name?: string;
  account_status?: number | string;
};

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("meta_access_token")?.value;

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "No meta_access_token cookie found" },
        { status: 401 }
      );
    }

    const url = new URL(
      `https://graph.facebook.com/${META_API_VERSION}/me/adaccounts`
    );
    url.searchParams.set("fields", "id,name,account_status");
    url.searchParams.set("access_token", token);

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      return NextResponse.json(
        {
          ok: false,
          step: "get_ad_accounts",
          error: data?.error?.message || "Failed to fetch ad accounts",
          raw: data,
        },
        { status: 400 }
      );
    }

    const adAccounts: MetaAdAccount[] = Array.isArray(data?.data)
      ? data.data.map((account: MetaAdAccount) => ({
          id: account.id,
          name: account.name || account.id,
          account_status: account.account_status ?? null,
        }))
      : [];

    return NextResponse.json({
      ok: true,
      adAccounts,
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