import { NextRequest, NextResponse } from "next/server";
import { normalizeAccountId } from "@/lib/meta/account-config";

const META_API_VERSION = "v23.0";

/**
 * Activates the ad set + ad that were just created by launch-retargeting.
 *
 * Safety rules (consistent with the rest of the product):
 * - Only flips status PAUSED -> ACTIVE on the two IDs the client passes in.
 * - Verifies both objects belong to the selected ad account AND to the
 *   expected campaign before touching anything.
 * - Never modifies the campaign itself or any other existing object.
 *   If the parent campaign is paused, we report that back instead of
 *   silently activating someone's existing campaign.
 */
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
    const rawAdsetId = body.adsetId;
    const rawAdId = body.adId;
    const rawCampaignId = body.campaignId;

    if (typeof rawAdAccountId !== "string" || !rawAdAccountId.trim()) {
      return NextResponse.json(
        { ok: false, step: "validate_ad_account", error: "Missing adAccountId" },
        { status: 400 }
      );
    }

    if (typeof rawAdsetId !== "string" || !rawAdsetId.trim()) {
      return NextResponse.json(
        { ok: false, step: "validate_adset_id", error: "Missing adsetId" },
        { status: 400 }
      );
    }

    if (typeof rawAdId !== "string" || !rawAdId.trim()) {
      return NextResponse.json(
        { ok: false, step: "validate_ad_id", error: "Missing adId" },
        { status: 400 }
      );
    }

    const adAccountId = normalizeAccountId(rawAdAccountId.trim());
    const adsetId = rawAdsetId.trim();
    const adId = rawAdId.trim();
    const campaignId =
      typeof rawCampaignId === "string" ? rawCampaignId.trim() : "";

    /* ------------------------------------------------------------ */
    /* 1. Verify the ad set belongs to the selected account/campaign  */
    /* ------------------------------------------------------------ */

    const adsetCheckUrl = new URL(
      `https://graph.facebook.com/${META_API_VERSION}/${adsetId}`
    );
    adsetCheckUrl.searchParams.set("fields", "account_id,campaign_id,status");
    adsetCheckUrl.searchParams.set("access_token", accessToken);

    const adsetCheckRes = await fetch(adsetCheckUrl.toString(), {
      method: "GET",
      cache: "no-store",
    });

    const adsetCheckData = await adsetCheckRes.json();

    if (!adsetCheckRes.ok || adsetCheckData.error) {
      return NextResponse.json(
        {
          ok: false,
          step: "validate_adset",
          adsetId,
          error: adsetCheckData.error?.message || "Failed to validate ad set",
          raw: adsetCheckData,
        },
        { status: 400 }
      );
    }

    if (normalizeAccountId(adsetCheckData.account_id) !== adAccountId) {
      return NextResponse.json(
        {
          ok: false,
          step: "validate_adset_account_mismatch",
          adAccountId,
          adsetId,
          error:
            "Ad set does not belong to the selected ad account. Activation was blocked.",
        },
        { status: 400 }
      );
    }

    if (campaignId && String(adsetCheckData.campaign_id) !== campaignId) {
      return NextResponse.json(
        {
          ok: false,
          step: "validate_adset_campaign_mismatch",
          adsetId,
          campaignId,
          error:
            "Ad set does not belong to the expected campaign. Activation was blocked.",
        },
        { status: 400 }
      );
    }

    /* ------------------------------------------------------------ */
    /* 2. Verify the ad belongs to the same account and ad set        */
    /* ------------------------------------------------------------ */

    const adCheckUrl = new URL(
      `https://graph.facebook.com/${META_API_VERSION}/${adId}`
    );
    adCheckUrl.searchParams.set("fields", "account_id,adset_id,status");
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
          step: "validate_ad",
          adId,
          error: adCheckData.error?.message || "Failed to validate ad",
          raw: adCheckData,
        },
        { status: 400 }
      );
    }

    if (normalizeAccountId(adCheckData.account_id) !== adAccountId) {
      return NextResponse.json(
        {
          ok: false,
          step: "validate_ad_account_mismatch",
          adAccountId,
          adId,
          error:
            "Ad does not belong to the selected ad account. Activation was blocked.",
        },
        { status: 400 }
      );
    }

    if (String(adCheckData.adset_id) !== adsetId) {
      return NextResponse.json(
        {
          ok: false,
          step: "validate_ad_adset_mismatch",
          adId,
          adsetId,
          error:
            "Ad does not belong to the expected ad set. Activation was blocked.",
        },
        { status: 400 }
      );
    }

    /* ------------------------------------------------------------ */
    /* 3. Activate the ad set                                         */
    /* ------------------------------------------------------------ */

    const adsetActivateRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${adsetId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "ACTIVE",
          access_token: accessToken,
        }),
      }
    );

    const adsetActivateData = await adsetActivateRes.json();

    if (!adsetActivateRes.ok || adsetActivateData.error) {
      return NextResponse.json(
        {
          ok: false,
          step: "activate_adset",
          adsetId,
          error: adsetActivateData.error || adsetActivateData,
        },
        { status: 500 }
      );
    }

    /* ------------------------------------------------------------ */
    /* 4. Activate the ad                                             */
    /* ------------------------------------------------------------ */

    const adActivateRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${adId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "ACTIVE",
          access_token: accessToken,
        }),
      }
    );

    const adActivateData = await adActivateRes.json();

    if (!adActivateRes.ok || adActivateData.error) {
      return NextResponse.json(
        {
          ok: false,
          step: "activate_ad",
          adsetId,
          adId,
          adsetActivated: true,
          error: adActivateData.error || adActivateData,
        },
        { status: 500 }
      );
    }

    /* ------------------------------------------------------------ */
    /* 5. Check the parent campaign status (read-only, never changed) */
    /*    If it's paused, the UI must tell the user delivery won't    */
    /*    start until the campaign itself is activated.               */
    /* ------------------------------------------------------------ */

    let campaignStatus: string | null = null;
    const campaignToCheck = campaignId || String(adsetCheckData.campaign_id);

    if (campaignToCheck) {
      try {
        const campaignCheckUrl = new URL(
          `https://graph.facebook.com/${META_API_VERSION}/${campaignToCheck}`
        );
        campaignCheckUrl.searchParams.set("fields", "status,effective_status");
        campaignCheckUrl.searchParams.set("access_token", accessToken);

        const campaignCheckRes = await fetch(campaignCheckUrl.toString(), {
          method: "GET",
          cache: "no-store",
        });

        const campaignCheckData = await campaignCheckRes.json();

        if (campaignCheckRes.ok && !campaignCheckData.error) {
          campaignStatus = campaignCheckData.status || null;
        }
      } catch {
        // Non-fatal: activation already succeeded, status check is informational.
      }
    }

    return NextResponse.json({
      ok: true,
      adAccountId,
      adsetId,
      adId,
      campaignId: campaignToCheck || null,
      campaignStatus,
      adsetStatus: "ACTIVE",
      adStatus: "ACTIVE",
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