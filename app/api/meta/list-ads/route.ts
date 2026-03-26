import { NextRequest, NextResponse } from "next/server";

const META_API_VERSION = "v23.0";

export async function GET(request: NextRequest) {
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

    // 1) Pasiimam user ad accounts
    const adAccountsUrl = new URL(
      `https://graph.facebook.com/${META_API_VERSION}/me/adaccounts`
    );
    adAccountsUrl.searchParams.set("fields", "id,name,account_status");
    adAccountsUrl.searchParams.set("access_token", accessToken);

    const adAccountsRes = await fetch(adAccountsUrl.toString(), {
      method: "GET",
      cache: "no-store",
    });

    const adAccountsData = await adAccountsRes.json();

    if (!adAccountsRes.ok || adAccountsData.error) {
      return NextResponse.json(
        {
          ok: false,
          step: "get_ad_accounts",
          error: adAccountsData.error?.message || "Failed to fetch ad accounts",
          raw: adAccountsData,
        },
        { status: 400 }
      );
    }

    const firstAdAccount = adAccountsData.data?.[0];

    if (!firstAdAccount?.id) {
      return NextResponse.json(
        {
          ok: false,
          step: "pick_ad_account",
          error: "No ad accounts found for this user",
          raw: adAccountsData,
        },
        { status: 404 }
      );
    }

    const normalizedAccountId = firstAdAccount.id.startsWith("act_")
      ? firstAdAccount.id
      : `act_${firstAdAccount.id}`;

    // 2) Su pirmu ad accountu pasiimam ads
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

    const ads =
      adsData.data?.map((ad: any) => ({
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