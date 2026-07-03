"use client";

import { useEffect, useRef, useState } from "react";
import type { KpiKey } from "@/modules/debrief";
import { useDebrief } from "@/components/workspace/DebriefProvider";
import {
  AlertTriangleIcon,
  ArrowIcon,
  FileTextIcon,
  UploadIcon,
  XIcon,
} from "@/components/ui/icons";
import {
  btnPrimary,
  card,
  fieldLabel,
  inputBase,
} from "@/components/ui/theme";

/* ------------------------------------------------------------------ */
/* The working tool: a two-pane workbench, not a landing form.         */
/* Left: data in (dropzone + KPI). Right: context. One action row.     */
/* ------------------------------------------------------------------ */

const KPI_OPTIONS: { value: KpiKey; label: string }[] = [
  { value: "roas", label: "ROAS" },
  { value: "cpa", label: "CPA" },
  { value: "ctr", label: "CTR" },
  { value: "cpc", label: "CPC" },
  { value: "leads", label: "Leads" },
  { value: "purchases", label: "Purchases" },
];

const PROCESSING_STEPS = [
  "Reading ads",
  "Applying the spend gate",
  "Finding winners and losers",
  "Writing the debrief",
];

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ProcessingPanel() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setStep((s) => Math.min(s + 1, PROCESSING_STEPS.length - 1)),
      380
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="flex min-h-[380px] flex-col items-center justify-center px-6 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-xs">
        {PROCESSING_STEPS.map((label, i) => (
          <div
            key={label}
            className={`flex items-center gap-3 py-2 transition-opacity ${
              i <= step ? "opacity-100" : "opacity-30"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-semibold ${
                i < step
                  ? "bg-blue-600 text-white"
                  : i === step
                    ? "border border-blue-400/60 text-blue-300 motion-safe:animate-pulse"
                    : "border border-white/15 text-zinc-600"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </span>
            <span
              className={`font-mono text-xs tracking-wide ${
                i === step ? "text-zinc-100" : "text-zinc-500"
              }`}
            >
              {label}…
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GeneratorPanel() {
  const { status, file, fields, error, setFile, updateFields, generate } =
    useDebrief();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const canSubmit =
    !!file &&
    fields.product.trim() !== "" &&
    fields.offer.trim() !== "" &&
    fields.goal.trim() !== "";

  const handleFiles = (files: FileList | null) => {
    const picked = files?.[0];
    if (picked) setFile(picked);
  };

  return (
    <div className={`${card} overflow-hidden`}>
      {status === "processing" ? (
        <ProcessingPanel />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) void generate();
          }}
        >
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 border-b border-red-500/20 bg-red-500/[0.06] px-5 py-3.5 text-[13px] leading-relaxed text-red-200"
            >
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              {error}
            </div>
          )}

          <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[5fr_6fr] lg:gap-8">
            {/* ---- Left pane: data in ---- */}
            <div>
              <p className={fieldLabel}>01 · Data</p>
              <label
                htmlFor="csv-input"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  handleFiles(e.dataTransfer.files);
                }}
                className={`mt-2 flex min-h-36 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
                  dragging
                    ? "border-blue-400/60 bg-blue-500/[0.06]"
                    : "border-white/15 hover:border-white/25 hover:bg-white/[0.02]"
                }`}
              >
                <input
                  ref={inputRef}
                  id="csv-input"
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                {file ? (
                  <>
                    <FileTextIcon className="h-5 w-5 text-blue-300" />
                    <p className="max-w-full truncate px-2 font-mono text-[13px] font-semibold text-zinc-100">
                      {file.name}
                    </p>
                    <p className="font-mono text-[11px] text-zinc-500">
                      {fmtBytes(file.size)}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setFile(null);
                        if (inputRef.current) inputRef.current.value = "";
                      }}
                      className="mt-0.5 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-zinc-400 transition hover:text-white"
                    >
                      <XIcon className="h-3 w-3" />
                      Remove
                    </button>
                  </>
                ) : (
                  <>
                    <UploadIcon className="h-5 w-5 text-zinc-500" />
                    <p className="text-[13px] font-semibold text-zinc-200">
                      Drop your Meta Ads CSV
                    </p>
                    <p className="font-mono text-[11px] text-zinc-500">
                      or click to browse · max 5MB
                    </p>
                  </>
                )}
              </label>

              <fieldset className="mt-5">
                <legend className={fieldLabel}>02 · Primary KPI</legend>
                <div
                  role="group"
                  className="mt-2 grid grid-cols-3 gap-1.5"
                >
                  {KPI_OPTIONS.map((opt) => {
                    const active = fields.kpi === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => updateFields({ kpi: opt.value })}
                        className={`cursor-pointer rounded-lg border px-2 py-2 font-mono text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${
                          active
                            ? "border-blue-400/40 bg-blue-500/10 text-white shadow-[0_0_14px_rgba(59,130,246,0.25)]"
                            : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            {/* ---- Right pane: context ---- */}
            <div>
              <p className={fieldLabel}>03 · Context</p>
              <div className="mt-2 space-y-3">
                <div>
                  <label htmlFor="product" className="sr-only">
                    Product / industry (required)
                  </label>
                  <input
                    id="product"
                    value={fields.product}
                    onChange={(e) => updateFields({ product: e.target.value })}
                    placeholder="Product / industry — e.g. Skincare, vitamin C serum *"
                    className={inputBase}
                  />
                </div>
                <div>
                  <label htmlFor="offer" className="sr-only">
                    Offer (required)
                  </label>
                  <input
                    id="offer"
                    value={fields.offer}
                    onChange={(e) => updateFields({ offer: e.target.value })}
                    placeholder="Offer — e.g. 25% off first order *"
                    className={inputBase}
                  />
                </div>
                <div>
                  <label htmlFor="goal" className="sr-only">
                    Campaign goal (required)
                  </label>
                  <input
                    id="goal"
                    value={fields.goal}
                    onChange={(e) => updateFields({ goal: e.target.value })}
                    placeholder="Campaign goal — e.g. Scale past $500/day *"
                    className={inputBase}
                  />
                </div>

                <div className="grid grid-cols-[7rem_1fr] gap-3 border-t border-white/5 pt-3">
                  <div>
                    <label htmlFor="targetCpa" className={fieldLabel}>
                      Target CPA
                    </label>
                    <input
                      id="targetCpa"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={fields.targetCpa}
                      onChange={(e) => updateFields({ targetCpa: e.target.value })}
                      placeholder="25"
                      className={`mt-1.5 ${inputBase}`}
                    />
                  </div>
                  <div>
                    <label htmlFor="creativeNotes" className={fieldLabel}>
                      Creative notes
                    </label>
                    <textarea
                      id="creativeNotes"
                      rows={2}
                      value={fields.creativeNotes}
                      onChange={(e) =>
                        updateFields({ creativeNotes: e.target.value })
                      }
                      placeholder="e.g. Ads 3 & 5 are UGC; rest are statics"
                      className={`mt-1.5 resize-none ${inputBase}`}
                    />
                  </div>
                </div>
                <p className="font-mono text-[10px] leading-relaxed tracking-wide text-zinc-600">
                  * REQUIRED · TARGET CPA SHARPENS THE SPEND GATE
                </p>
              </div>
            </div>
          </div>

          {/* ---- Action row ---- */}
          <div className="flex flex-col gap-3 border-t border-white/5 bg-white/[0.02] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">
              Parsed in memory · never stored · gone on refresh
            </p>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${btnPrimary}`}
            >
              Generate debrief
              <ArrowIcon className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
