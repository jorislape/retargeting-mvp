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
    const pageId = requireEnv(
      "META_PAGE_ID",
      process.env.META_PAGE_ID
    );

    const url = `https://graph.facebook.com/v19.0/${pageId}/posts?access_token=${accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.error) {
      return NextResponse.json(
        {
          ok: false,
          step: "get_page_posts",
          error: data.error || data,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      posts: data,
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