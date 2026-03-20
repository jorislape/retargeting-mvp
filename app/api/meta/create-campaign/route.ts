import { NextResponse } from "next/server";

function requireEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

export async function POST(req: Request) {
  try {
    const accessToken = requireEnv(
      "META_ACCESS_TOKEN",
      process.env.META_ACCESS_TOKEN
    );
    const adAccountId = requireEnv(
      "META_AD_ACCOUNT_ID",
      process.env.META_AD_ACCOUNT_ID
    );

    const body = await req.json().catch(() => ({}));
    const name = body.name || "Retargeting Campaign";
    const objective = body.objective || "OUTCOME_TRAFFIC";

    const url = `https://graph.facebook.com/v19.0/${adAccountId}/campaigns`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        objective,
        status: "PAUSED",
        special_ad_categories: [],
        is_adset_budget_sharing_enabled: false,
        access_token: accessToken,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      return NextResponse.json(
        {
          ok: false,
          step: "create_campaign",
          error: data.error || data,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      campaign: data,
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