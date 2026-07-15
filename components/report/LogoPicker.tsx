"use client";

import { useRef, useState } from "react";
import { UploadIcon, XIcon } from "@/components/ui/icons";
import { btnSecondary, fieldLabel } from "@/components/ui/theme";
import { ALLOWED_LOGO_MIME_TYPES } from "./logoValidation";
import type { LogoAsset } from "./reportCustomization";

/**
 * V1A: one logo picker, reused for the agency logo only (no client
 * logo this phase). Browser-local only — `onSelect` is
 * useReportCustomization's setAgencyLogoFile, which validates and
 * creates/revokes the object URL; this component owns no file data
 * itself, only the inline error message and the hidden <input>.
 */
export function LogoPicker({
  label,
  logo,
  onSelect,
}: {
  label: string;
  logo: LogoAsset | null;
  onSelect: (file: File | null) => { ok: boolean; error?: string };
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    const result = onSelect(file);
    setError(result.ok ? null : (result.error ?? "Couldn't use that file."));
    // Reset the input value so selecting the SAME file again (e.g.
    // after fixing and re-picking) still fires a change event.
    e.target.value = "";
  }

  function handleRemove() {
    onSelect(null);
    setError(null);
  }

  return (
    <div>
      <label className={`${fieldLabel} mb-1.5 block`}>{label}</label>
      {logo ? (
        <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
          {/* Blob: object URL — next/image has no loader for these
              (client-only, ephemeral), so a plain <img> is correct
              here, not a lint oversight. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo.url}
            alt={`${label} preview`}
            className="h-10 w-auto max-w-[120px] shrink-0 object-contain"
          />
          <span className="min-w-0 flex-1 truncate text-xs text-zinc-400">{logo.name}</span>
          <button
            type="button"
            onClick={handleRemove}
            aria-label={`Remove ${label.toLowerCase()}`}
            className="shrink-0 cursor-pointer text-zinc-500 hover:text-red-300"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`flex w-full cursor-pointer items-center justify-center gap-2 ${btnSecondary} py-2.5`}
        >
          <UploadIcon className="h-3.5 w-3.5" />
          Upload logo
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_LOGO_MIME_TYPES.join(",")}
        onChange={handleChange}
        className="hidden"
      />
      <p className="mt-1 text-[10px] text-zinc-500">PNG, JPEG, WebP, or SVG — up to 2 MB.</p>
      {error && <p className="mt-1 text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
