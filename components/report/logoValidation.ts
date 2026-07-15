/**
 * Pure logo-file validation — no DOM, no URL.createObjectURL (that's
 * a browser-only side effect, deliberately kept out of this file so
 * the validation RULES are unit-testable in plain Node; the actual
 * object-URL create/revoke lifecycle lives in
 * useReportCustomization.ts). Accepts a minimal, duck-typed shape
 * rather than the real File type so this file has zero environment
 * dependency either way.
 */

export const ALLOWED_LOGO_MIME_TYPES: readonly string[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
];

export const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

export interface LogoFileLike {
  type: string;
  size: number;
  name: string;
}

export type LogoValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Checked in this order deliberately: an unsupported type is rejected
 * before size is even considered, so the error always names the more
 * fundamental problem first.
 */
export function validateLogoFile(file: LogoFileLike): LogoValidationResult {
  if (!ALLOWED_LOGO_MIME_TYPES.includes(file.type)) {
    return {
      ok: false,
      error: `"${file.name}" isn't a supported image type — use PNG, JPEG, WebP, or SVG.`,
    };
  }
  if (file.size > MAX_LOGO_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      error: `"${file.name}" is ${mb} MB — logos must be under 2 MB.`,
    };
  }
  return { ok: true };
}
