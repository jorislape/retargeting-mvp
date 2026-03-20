import { NextResponse } from "next/server";

function requireEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

export async function GET() {
  try {
    const accessToken = requireEnv(
      "META_ACCESS_TOKEN",
      process.env.META_ACCESS_TOKEN
    );
    const adAccountId = requireEnv(
      "META_AD_ACCOUNT_ID",
      process.env.META_AD_ACCOUNT_ID
    );

    const url = `https://graph.facebook.com/v19.0/${adAccountId}/adspixels`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Retargeting MVP Pixel",
        access_token: accessToken,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      return NextResponse.json(
        {
          ok: false,
          step: "create_pixel",
          error: data.error || data,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      pixel: data,
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