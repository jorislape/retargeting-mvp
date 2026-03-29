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

    const url = new URL(
      `https://graph.facebook.com/${META_API_VERSION}/me/accounts`
    );
    url.searchParams.set("fields", "id,name");
    url.searchParams.set("access_token", accessToken);

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      return NextResponse.json(
        {
          ok: false,
          step: "get_pages",
          error: data.error?.message || "Failed to fetch pages",
          raw: data,
        },
        { status: 400 }
      );
    }

    const pages =
      data.data?.map((page: any) => ({
        id: page.id,
        name: page.name || `Page ${page.id}`,
      })) || [];

    return NextResponse.json({
      ok: true,
      pages,
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