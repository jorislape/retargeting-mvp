import { NextRequest, NextResponse } from "next/server";

function firstNonEmpty(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function imageFromCallToAction(linkData: any) {
  return linkData?.child_attachments?.[0]?.picture || "";
}

export async function POST(req: NextRequest) {
  try {
    const { adId } = await req.json();

    if (!adId) {
      return NextResponse.json({
        ok: false,
        error: "Missing adId",
      });
    }

    const accessToken = req.cookies.get("meta_access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        {
          ok: false,
          error: "No meta_access_token cookie found",
        },
        { status: 401 }
      );
    }

    const fields =
      "name,creative{id,object_story_spec,asset_feed_spec,title,body,image_url,thumbnail_url,effective_object_story_id}";

    const adRes = await fetch(
      `https://graph.facebook.com/v19.0/${adId}?fields=${encodeURIComponent(
        fields
      )}&access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const adData = await adRes.json();

    if (!adRes.ok || adData.error) {
      return NextResponse.json(
        {
          ok: false,
          error: adData.error || "Failed to fetch ad preview",
        },
        { status: 400 }
      );
    }

    const creative = adData.creative || {};
    const story = creative.object_story_spec || {};

    const linkData = story.link_data || {};
    const videoData = story.video_data || {};
    const photoData = story.photo_data || {};
    const templateData = story.template_data || {};
    const assetFeedSpec = creative.asset_feed_spec || {};

    const assetBodies = Array.isArray(assetFeedSpec.bodies)
      ? assetFeedSpec.bodies
      : [];
    const assetTitles = Array.isArray(assetFeedSpec.titles)
      ? assetFeedSpec.titles
      : [];
    const assetDescriptions = Array.isArray(assetFeedSpec.descriptions)
      ? assetFeedSpec.descriptions
      : [];
    const assetImages = Array.isArray(assetFeedSpec.images)
      ? assetFeedSpec.images
      : [];

    const message = firstNonEmpty(
      story.message,
      linkData.message,
      videoData.message,
      templateData.message,
      photoData.message,
      photoData.caption,
      creative.body,
      assetBodies[0]?.text
    );

    const headline = firstNonEmpty(
      linkData.name,
      videoData.title,
      templateData.name,
      templateData.title,
      creative.title,
      assetTitles[0]?.text
    );

    const description = firstNonEmpty(
      linkData.description,
      templateData.description,
      assetDescriptions[0]?.text
    );

    const imageUrl = firstNonEmpty(
      linkData.picture,
      imageFromCallToAction(linkData),
      creative.image_url,
      creative.thumbnail_url,
      assetImages[0]?.url
    );

    return NextResponse.json({
      ok: true,
      data: {
        adId,
        adName: adData.name || "",
        creativeId: creative.id || "",
        message: message || null,
        headline: headline || null,
        description: description || null,
        imageUrl: imageUrl || null,
        debug: {
          hasObjectStorySpec: !!creative.object_story_spec,
          hasAssetFeedSpec: !!creative.asset_feed_spec,
          storyKeys: Object.keys(story || {}),
        },
      },
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to fetch preview",
      },
      { status: 500 }
    );
  }
}