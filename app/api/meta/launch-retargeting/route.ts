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
    const pixelId = requireEnv(
      "META_PIXEL_ID",
      process.env.META_PIXEL_ID
    );
    const campaignId = requireEnv(
      "META_CAMPAIGN_ID",
      process.env.META_CAMPAIGN_ID
    );
    const pageId = requireEnv(
      "META_PAGE_ID",
      process.env.META_PAGE_ID
    );

    const body = await req.json().catch(() => ({}));

    const audienceName = body.audienceName || "Website Visitors 30 Days";
    const audienceDescription =
      body.audienceDescription || "Website visitors from the last 30 days";
    const retentionSeconds = body.retentionSeconds || 2592000;
    const eventName = body.eventName || "PageView";

    const adsetName = body.adsetName || "Retargeting Ad Set";
    const dailyBudget = body.dailyBudget || 100;

    const adName = body.adName || "Retargeting Ad";
    const existingAdId = body.existingAdId || "";
    const message = body.message || "Check this out 🔥";
    const link = body.link || "https://example.com";
    const name = body.name || "My Product";
    const description = body.description || "";

    const audienceRule = {
      inclusions: {
        operator: "or",
        rules: [
          {
            event_sources: [
              {
                id: pixelId,
                type: "pixel",
              },
            ],
            retention_seconds: retentionSeconds,
            filter: {
              operator: "and",
              filters: [
                {
                  field: "event",
                  operator: "eq",
                  value: eventName,
                },
              ],
            },
          },
        ],
      },
    };

    const audienceRes = await fetch(
      `https://graph.facebook.com/v19.0/${adAccountId}/customaudiences`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: audienceName,
          description: audienceDescription,
          rule: JSON.stringify(audienceRule),
          prefill: true,
          access_token: accessToken,
        }),
      }
    );

    const audienceData = await audienceRes.json();

    if (!audienceRes.ok || audienceData.error) {
      return NextResponse.json(
        {
          ok: false,
          step: "create_audience",
          error: audienceData.error || audienceData,
        },
        { status: 500 }
      );
    }

    const audienceId = audienceData.id;

    const adsetRes = await fetch(
      `https://graph.facebook.com/v19.0/${adAccountId}/adsets`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: adsetName,
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
      }
    );

    const adsetData = await adsetRes.json();

    if (!adsetRes.ok || adsetData.error) {
      return NextResponse.json(
        {
          ok: false,
          step: "create_adset",
          audienceId,
          error: adsetData.error || adsetData,
        },
        { status: 500 }
      );
    }

    const adsetId = adsetData.id;

    let adPayload: any;
    let reusedCreativeId: string | null = null;

    if (existingAdId.trim()) {
      const existingAdRes = await fetch(
        `https://graph.facebook.com/v19.0/${existingAdId}?fields=creative&access_token=${accessToken}`
      );

      const existingAdData = await existingAdRes.json();

      if (!existingAdRes.ok || existingAdData.error) {
        return NextResponse.json(
          {
            ok: false,
            step: "get_existing_ad_creative",
            audienceId,
            adsetId,
            error: existingAdData.error || existingAdData,
          },
          { status: 500 }
        );
      }

      const creativeId = existingAdData?.creative?.id;

      if (!creativeId) {
        return NextResponse.json(
          {
            ok: false,
            step: "get_existing_ad_creative",
            audienceId,
            adsetId,
            error: "Existing ad does not have a usable creative ID.",
          },
          { status: 500 }
        );
      }

      reusedCreativeId = creativeId;

      adPayload = {
        name: adName,
        adset_id: adsetId,
        creative: {
          creative_id: creativeId,
        },
        status: "PAUSED",
        access_token: accessToken,
      };
    } else {
      adPayload = {
        name: adName,
        adset_id: adsetId,
        creative: {
          object_story_spec: {
            link_data: {
              message,
              link,
              name,
              description: description || undefined,
            },
            page_id: pageId,
          },
        },
        status: "PAUSED",
        access_token: accessToken,
      };
    }

    const adRes = await fetch(
      `https://graph.facebook.com/v19.0/${adAccountId}/ads`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(adPayload),
      }
    );

    const adData = await adRes.json();

    if (!adRes.ok || adData.error) {
      return NextResponse.json(
        {
          ok: false,
          step: "create_ad",
          audienceId,
          adsetId,
          reusedCreativeId,
          error: adData.error || adData,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      audienceId,
      adsetId,
      adId: adData.id,
      reusedCreativeId,
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