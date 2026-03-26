import { NextRequest, NextResponse } from "next/server";

const META_API_VERSION = "v23.0";

type MetaAd = {
  id: string;
  name?: string;
  status?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("meta_access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        {
          ok: false,
          error: "No meta_access_token cookie found",
        },
        { status: 401 }
      );
    }

    let body: any;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid JSON body",
        },
        { status: 400 }
      );
    }

    const rawAdAccountId = body?.adAccountId;

    if (typeof rawAdAccountId !== "string" || !rawAdAccountId.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing adAccountId",
        },
        { status: 400 }
      );
    }

    const adAccountId = rawAdAccountId.trim();

    const normalizedAccountId = adAccountId.startsWith("act_")
      ? adAccountId
      : `act_${adAccountId}`;

    const adsUrl = new URL(
      `https://graph.facebook.com/${META_API_VERSION}/${normalizedAccountId}/ads`
    );
    adsUrl.searchParams.set("fields", "id,name,status");
    adsUrl.searchParams.set("limit", "50");
    adsUrl.searchParams.set("access_token", accessToken);

    const adsRes = await fetch(adsUrl.toString(), {
      method: "GET",
      cache: "no-store",
    });

    const adsData = await adsRes.json();

    if (!adsRes.ok || adsData.error) {
      return NextResponse.json(
        {
          ok: false,
          step: "get_ads",
          error: adsData.error?.message || "Failed to fetch ads",
          raw: adsData,
          adAccountId: normalizedAccountId,
        },
        { status: 400 }
      );
    }

    const ads: MetaAd[] =
      adsData?.data?.map((ad: MetaAd) => ({
        id: ad.id,
        name: ad.name || `Ad ${ad.id}`,
        status: ad.status || null,
      })) || [];

    return NextResponse.json({
      ok: true,
      adAccountId: normalizedAccountId,
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