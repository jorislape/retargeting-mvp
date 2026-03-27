import { NextRequest, NextResponse } from "next/server";

function normalizeAccountId(id: string) {
  return id.startsWith("act_") ? id : `act_${id}`;
}

// 🔴 LAIKINAS CONFIG (vėliau bus DB)
const ACCOUNT_CONFIG: Record<
  string,
  {
    pixelId?: string;
    campaignId?: string;
    pageId?: string;
  }
> = {
  "act_201748641892516": {
    pixelId: process.env.META_PIXEL_ID,
    campaignId: process.env.META_CAMPAIGN_ID,
    pageId: process.env.META_PAGE_ID,
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
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

    const adAccountId = normalizeAccountId(rawAdAccountId);

    const config = ACCOUNT_CONFIG[adAccountId] || {};

    const pixelConfigured = Boolean(config.pixelId);
    const campaignConfigured = Boolean(config.campaignId);
    const pageConfigured = Boolean(config.pageId);

    const configured =
      pixelConfigured && campaignConfigured && pageConfigured;

    return NextResponse.json({
      ok: true,
      adAccountId,
      configured,
      pixelConfigured,
      campaignConfigured,
      pageConfigured,
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