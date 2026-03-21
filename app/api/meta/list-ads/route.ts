import { NextResponse } from "next/server";

const META_API_VERSION = "v23.0";

export async function GET() {
  try {
    const accessToken = process.env.META_ACCESS_TOKEN;
    const adAccountId = process.env.META_AD_ACCOUNT_ID;

    if (!accessToken || !adAccountId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing META_ACCESS_TOKEN or META_AD_ACCOUNT_ID",
        },
        { status: 500 }
      );
    }

    // užtikrinam kad būtų act_ prefiksas
    const normalizedAccountId = adAccountId.startsWith("act_")
      ? adAccountId
      : `act_${adAccountId}`;

    const url = new URL(
      `https://graph.facebook.com/${META_API_VERSION}/${normalizedAccountId}/ads`
    );

    url.searchParams.set("fields", "id,name,status");
    url.searchParams.set("limit", "50");
    url.searchParams.set("access_token", accessToken);

    const res = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
    });

    const data = await res.json();

    // error iš Meta
    if (!res.ok || data.error) {
      return NextResponse.json(
        {
          ok: false,
          error: data.error?.message || "Failed to fetch ads",
          raw: data,
        },
        { status: 400 }
      );
    }

    const ads =
      data.data?.map((ad: any) => ({
        id: ad.id,
        name: ad.name || `Ad ${ad.id}`,
        status: ad.status || null,
      })) || [];

    return NextResponse.json({
      ok: true,
      ads,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Unexpected server error",
      },
      { status: 500 }
    );
  }
}