import { NextRequest, NextResponse } from "next/server";

const META_API_VERSION = "v23.0";

function requireEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

function normalizeAccountId(adAccountId: string) {
  return adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
}

export async function POST(req: NextRequest) {
  try {
    const accessToken = req.cookies.get("meta_access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        {
          ok: false,
          step: "auth",
          error: "No meta_access_token cookie found",
        },
        { status: 401 }
      );
    }

    const pixelId = requireEnv("META_PIXEL_ID", process.env.META_PIXEL_ID);
    const campaignId = requireEnv(
      "META_CAMPAIGN_ID",
      process.env.META_CAMPAIGN_ID
    );
    const pageId = requireEnv("META_PAGE_ID", process.env.META_PAGE_ID);

    const body = await req.json().catch(() => ({}));

    const rawAdAccountId = body.adAccountId;

    if (typeof rawAdAccountId !== "string" || !rawAdAccountId.trim()) {
      return NextResponse.json(
        {
          ok: false,
          step: "validate_ad_account",
          error: "Missing adAccountId",
        },
        { status: 400 }
      );
    }

    const adAccountId = normalizeAccountId(rawAdAccountId.trim());

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

    const mode = existingAdId.trim() ? "existing" : "new";

    console.log("[launch-retargeting] start", {
      mode,
      adAccountId,
      campaignId,
      pixelId,
      pageId,
      existingAdId: existingAdId || null,
      dailyBudget,
      retentionSeconds,
      eventName,
    });

    // VALIDATION 1:
    // jei naudojamas existing ad, patikrinam ar jis tikrai priklauso pasirinktam ad account
    if (existingAdId.trim()) {
      const adCheckUrl = new URL(
        `https://graph.facebook.com/${META_API_VERSION}/${existingAdId}`
      );
      adCheckUrl.searchParams.set("fields", "account_id");
      adCheckUrl.searchParams.set("access_token", accessToken);

      const adCheckRes = await fetch(adCheckUrl.toString(), {
        method: "GET",
        cache: "no-store",
      });

      const adCheckData = await adCheckRes.json();

      if (!adCheckRes.ok || adCheckData.error) {
        return NextResponse.json(
          {
            ok: false,
            step: "validate_existing_ad",
            adAccountId,
            error: adCheckData.error?.message || "Failed to validate existing ad",
            raw: adCheckData,
          },
          { status: 400 }
        );
      }

      const adAccountFromAd = normalizeAccountId(adCheckData.account_id);

      if (adAccountFromAd !== adAccountId) {
        return NextResponse.json(
          {
            ok: false,
            step: "validate_ad_account_mismatch",
            adAccountId,
            existingAdId,
            error:
              "Selected ad does not belong to the selected ad account. This launch was blocked.",
          },
          { status: 400 }
        );
      }
    }

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
      `https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/customaudiences`,
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
          adAccountId,
          error: audienceData.error || audienceData,
        },
        { status: 500 }
      );
    }

    const audienceId = audienceData.id;

    const adsetRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/adsets`,
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
          adAccountId,
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
        `https://graph.facebook.com/${META_API_VERSION}/${existingAdId}?fields=creative&access_token=${encodeURIComponent(
          accessToken
        )}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const existingAdData = await existingAdRes.json();

      if (!existingAdRes.ok || existingAdData.error) {
        return NextResponse.json(
          {
            ok: false,
            step: "get_existing_ad_creative",
            adAccountId,
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
            adAccountId,
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
      `https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/ads`,
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
          adAccountId,
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
      adAccountId,
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