import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { adId } = await req.json();

    if (!adId) {
      return NextResponse.json({
        ok: false,
        error: "Missing adId",
      });
    }

    const accessToken = process.env.META_ACCESS_TOKEN;

    // 1. Get ad + creative
    const adRes = await fetch(
      `https://graph.facebook.com/v19.0/${adId}?fields=name,creative{id,object_story_spec}&access_token=${accessToken}`
    );

    const adData = await adRes.json();

    if (adData.error) {
      return NextResponse.json({
        ok: false,
        error: adData.error,
      });
    }

    const creative = adData.creative;

    const story = creative?.object_story_spec || {};
    const linkData = story.link_data || {};
    const message = story.message || "";
    const headline = linkData.name || "";
    const description = linkData.description || "";
    const imageUrl = linkData.picture || "";

    return NextResponse.json({
      ok: true,
      data: {
        adId,
        adName: adData.name,
        creativeId: creative?.id,
        message,
        headline,
        description,
        imageUrl,
      },
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: "Failed to fetch preview",
    });
  }
}