/**
 * Bulletproof pass C1 — attribution by format.
 *
 * Meta's engaged-view attribution applies to video ads only (a view of
 * 5+ seconds); it was removed for image ads. So two attribution settings
 * that differ only in "1-day engaged view" count a static ad's results
 * identically — the difference is a comparability issue for video/UGC
 * ads alone. This file classifies an ad's format from what the export
 * shows (name tags — which already include [FOR] tokens and user-
 * confirmed formats — then a file extension in the name) and gives each
 * ad its EFFECTIVE window. Pure, no imports beyond types.
 */
import type { ParsedAd } from "./types";

export type FormatClass = "video" | "static" | "unknown";

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|avi)\b/i;
const STATIC_EXT = /\.(jpe?g|png|gif|webp|heic)\b/i;

/** "video" (video/UGC), "static" (image/static/carousel) or "unknown"
 *  when nothing in the export shows the format. An explicit video tag
 *  wins; a static tag or image extension beats a bare "UGC" (a UGC-style
 *  still image is still an image). */
export function adFormatClass(ad: Pick<ParsedAd, "name" | "nameTags">): FormatClass {
  const tags = ad.nameTags ?? [];
  if (tags.includes("video") || VIDEO_EXT.test(ad.name)) return "video";
  if (tags.includes("static") || tags.includes("carousel") || STATIC_EXT.test(ad.name)) return "static";
  if (tags.includes("ugc")) return "video";
  return "unknown";
}

const isEngagedView = (part: string) => /engaged view|engage-through/i.test(part);

/** A setting's parts ("7-day click", "1-day view", "1-day engaged view"). */
export function windowParts(setting: string): string[] {
  return setting.split(/,\s*|\s+or\s+/).map((p) => p.trim()).filter(Boolean);
}

/** The window as it applies to an ad of this format: engaged view drops
 *  out for static ads (Meta never counts it for them). */
export function effectiveWindow(setting: string, cls: FormatClass): string {
  const parts = windowParts(setting);
  return (cls === "static" ? parts.filter((p) => !isEngagedView(p)) : parts).join(", ");
}

/** True when every setting in the file reads the same once engaged view
 *  is dropped — the windows differ only for video ads. */
export function differOnlyInEngagedView(settings: readonly string[]): boolean {
  return new Set(settings.map((s) => effectiveWindow(s, "static"))).size === 1;
}
