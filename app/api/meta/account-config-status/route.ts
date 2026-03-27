import { NextRequest, NextResponse } from "next/server";
import {
  getAccountConfig,
  normalizeAccountId,
} from "@/lib/meta/account-config";

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
    const config = getAccountConfig(adAccountId);

    const pixelConfigured = Boolean(config?.pixelId);
    const campaignConfigured = Boolean(config?.campaignId);
    const pageConfigured = Boolean(config?.pageId);

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