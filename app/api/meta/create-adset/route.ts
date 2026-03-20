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
    const defaultCampaignId = requireEnv(
      "META_CAMPAIGN_ID",
      process.env.META_CAMPAIGN_ID
    );
    const defaultAudienceId = requireEnv(
      "META_AUDIENCE_ID",
      process.env.META_AUDIENCE_ID
    );

    const body = await req.json().catch(() => ({}));

    const campaignId = body.campaignId || defaultCampaignId;
    const audienceId = body.audienceId || defaultAudienceId;
    const dailyBudget = body.dailyBudget || 100;

    const url = `https://graph.facebook.com/v19.0/${adAccountId}/adsets`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Retargeting Ad Set",
        campaign_id: campaignId,
        daily_budget: dailyBudget,
        billing_event: "IMPRESSIONS",
        optimization_goal: "LINK_CLICKS",
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        targeting: {
          custom_audiences: [
            {
              id: audienceId,
            },
          ],
        },
        status: "PAUSED",
        access_token: accessToken,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      return NextResponse.json(
        {
          ok: false,
          step: "create_adset",
          error: data.error || data,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      adset: data,
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