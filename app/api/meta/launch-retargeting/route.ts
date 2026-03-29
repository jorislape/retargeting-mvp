import { NextRequest, NextResponse } from "next/server";
import { normalizeAccountId } from "@/lib/meta/account-config";

const META_API_VERSION = "v23.0";

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

    const body = await req.json().catch(() => ({}));

    const rawAdAccountId = body.adAccountId;
    const rawPageId = body.pageId;
    const rawCampaignId = body.campaignId;
    const rawPixelId = body.pixelId;

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

    if (typeof rawPageId !== "string" || !rawPageId.trim()) {
      return NextResponse.json(
        {
          ok: false,
          step: "validate_page_id",
          error: "Missing pageId",
        },
        { status: 400 }
      );
    }

    if (typeof rawCampaignId !== "string" || !rawCampaignId.trim()) {
      return NextResponse.json(
        {
          ok: false,
          step: "validate_campaign_id",
          error: "Missing campaignId",
        },
        { status: 400 }
      );
    }

    if (typeof rawPixelId !== "string" || !rawPixelId.trim()) {
      return NextResponse.json(
        {
          ok: false,
          step: "validate_pixel_id",
          error: "Missing pixelId",
        },
        { status: 400 }
      );
    }

    const adAccountId = normalizeAccountId(rawAdAccountId.trim());
    const pageId = rawPageId.trim();
    const campaignId = rawCampaignId.trim();
    const pixelId = rawPixelId.trim();

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
            error:
              adCheckData.error?.message || "Failed to validate existing ad",
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

    const campaignCheckUrl = new URL(
      `https://graph.facebook.com/${META_API_VERSION}/${campaignId}`
    );
    campaignCheckUrl.searchParams.set("fields", "account_id,status,name");
    campaignCheckUrl.searchParams.set("access_token", accessToken);

    const campaignCheckRes = await fetch(campaignCheckUrl.toString(), {
      method: "GET",
      cache: "no-store",
    });

    const campaignCheckData = await campaignCheckRes.json();

    if (!campaignCheckRes.ok || campaignCheckData.error) {
      return NextResponse.json(
        {
          ok: false,
          step: "validate_campaign",
          adAccountId,
          campaignId,
          error:
            campaignCheckData.error?.message || "Failed to validate campaign",
          raw: campaignCheckData,
        },
        { status: 400 }
      );
    }

    const campaignAccountId = normalizeAccountId(campaignCheckData.account_id);

    if (campaignAccountId !== adAccountId) {
      return NextResponse.json(
        {
          ok: false,
          step: "validate_campaign_account_mismatch",
          adAccountId,
          campaignId,
          error:
            "Selected campaign does not belong to the selected ad account. This launch was blocked.",
        },
        { status: 400 }
      );
    }

    const pixelCheckUrl = new URL(
      `https://graph.facebook.com/${META_API_VERSION}/${pixelId}`
    );
    pixelCheckUrl.searchParams.set("fields", "id,name");
    pixelCheckUrl.searchParams.set("access_token", accessToken);

    const pixelCheckRes = await fetch(pixelCheckUrl.toString(), {
      method: "GET",
      cache: "no-store",
    });

    const pixelCheckData = await pixelCheckRes.json();

    if (!pixelCheckRes.ok || pixelCheckData.error) {
      return NextResponse.json(
        {
          ok: false,
          step: "validate_pixel",
          adAccountId,
          pixelId,
          error: pixelCheckData.error?.message || "Failed to validate pixel",
          raw: pixelCheckData,
        },
        { status: 400 }
      );
    }

    const pageCheckUrl = new URL(
      `https://graph.facebook.com/${META_API_VERSION}/${pageId}`
    );
    pageCheckUrl.searchParams.set("fields", "id,name");
    pageCheckUrl.searchParams.set("access_token", accessToken);

    const pageCheckRes = await fetch(pageCheckUrl.toString(), {
      method: "GET",
      cache: "no-store",
    });

    const pageCheckData = await pageCheckRes.json();

    if (!pageCheckRes.ok || pageCheckData.error) {
      return NextResponse.json(
        {
          ok: false,
          step: "validate_page",
          adAccountId,
          pageId,
          error: pageCheckData.error?.message || "Failed to validate page",
          raw: pageCheckData,
        },
        { status: 400 }
      );
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
            custom_audiences: [{ id: audienceId }],
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
            page_id: pageId,
            link_data: {
              message,
              link,
              name,
              description: description || undefined,
            },
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
      pageId,
      campaignId,
      pixelId,
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