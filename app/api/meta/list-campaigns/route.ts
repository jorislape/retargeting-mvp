import { NextRequest, NextResponse } from "next/server";

const META_API_VERSION = "v23.0";

function normalizeAccountId(adAccountId: string) {
  return adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
}

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

    const body = await request.json().catch(() => ({}));
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

    const adAccountId = normalizeAccountId(rawAdAccountId.trim());

    const url = new URL(
      `https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/campaigns`
    );
    url.searchParams.set("fields", "id,name,status,objective");
    url.searchParams.set("limit", "100");
    url.searchParams.set("access_token", accessToken);

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      return NextResponse.json(
        {
          ok: false,
          step: "get_campaigns",
          error: data.error?.message || "Failed to fetch campaigns",
          raw: data,
          adAccountId,
        },
        { status: 400 }
      );
    }

    const campaigns =
      data.data?.map((campaign: any) => ({
        id: campaign.id,
        name: campaign.name || `Campaign ${campaign.id}`,
        status: campaign.status || null,
        objective: campaign.objective || null,
      })) || [];

    return NextResponse.json({
      ok: true,
      adAccountId,
      campaigns,
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