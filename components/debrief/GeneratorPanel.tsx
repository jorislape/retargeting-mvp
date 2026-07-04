"use client";

import { useEffect, useRef, useState } from "react";
import type { KpiKey } from "@/modules/debrief";
import {
  SAMPLE_CONTEXT,
  SAMPLE_CSV_FILENAME,
  SAMPLE_CSV_TEXT,
} from "@/modules/debrief";
import { useDebrief } from "@/components/workspace/DebriefProvider";
import { MetaConnect } from "@/components/debrief/MetaConnect";
import {
  AlertTriangleIcon,
  ArrowIcon,
  FileTextIcon,
  FlaskIcon,
  UploadIcon,
  XIcon,
} from "@/components/ui/icons";
import {
  btnPrimary,
  btnSecondary,
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
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-semibold transition ${
                i < step
                  ? "bg-amber-400 text-stone-950"
                  : i === step
                    ? "border border-amber-400/70 text-amber-300 motion-safe:animate-pulse"
                    : "border border-white/15 text-stone-600"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </span>
            <span
              className={`font-mono text-xs tracking-wide ${
                i === step ? "text-stone-100" : "text-stone-500"
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

  /* Loads the synthetic dataset as a virtual CSV — identical pipeline
     to an upload — and prefills any context field the user hasn't
     typed in, so "Generate debrief" is one click away. Never
     overwrites what they already entered. */
  const loadSample = () => {
    setFile(
      new File([SAMPLE_CSV_TEXT], SAMPLE_CSV_FILENAME, { type: "text/csv" })
    );
    updateFields({
      ...(fields.product.trim() === "" && { product: SAMPLE_CONTEXT.product }),
      ...(fields.offer.trim() === "" && { offer: SAMPLE_CONTEXT.offer }),
      ...(fields.goal.trim() === "" && { goal: SAMPLE_CONTEXT.goal }),
      ...(fields.creativeNotes.trim() === "" && {
        creativeNotes: SAMPLE_CONTEXT.creativeNotes,
      }),
    });
    if (inputRef.current) inputRef.current.value = "";
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
              className="flex items-start gap-2.5 border-b border-red-400/20 bg-red-400/[0.07] px-5 py-3.5 text-[13px] leading-relaxed text-red-200"
            >
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              {error}
            </div>
          )}

          <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[5fr_6fr] lg:gap-8">
            {/* ---- Left pane: data in ---- */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className={fieldLabel}>01 · Data source</p>
                <button
                  type="button"
                  onClick={loadSample}
                  className={`cursor-pointer ${btnSecondary}`}
                >
                  <FlaskIcon className="h-3.5 w-3.5 text-amber-300" />
                  Use sample data
                </button>
              </div>
              <p className="mt-3 font-mono text-[10px] font-semibold tracking-[0.14em] text-stone-500">
                A · UPLOAD ADS MANAGER EXPORT
              </p>
              {/* Dropzone states: rest (quiet well) → drag-over (amber
                  invitation) → accepted (settled, filed). Keyboard focus
                  on the hidden input lights the same ring via
                  focus-within. */}
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
                className={`mt-2 flex min-h-36 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg px-4 py-6 text-center transition focus-within:ring-2 focus-within:ring-amber-400/60 focus-within:ring-offset-2 focus-within:ring-offset-carbon motion-safe:duration-200 ${
                  dragging
                    ? "border-2 border-amber-400/80 bg-amber-400/[0.07] shadow-[0_0_32px_-8px_rgba(251,191,36,0.35)] motion-safe:-translate-y-0.5"
                    : file
                      ? "animate-settle border-2 border-amber-400/35 bg-amber-400/[0.05]"
                      : "border-2 border-dashed border-white/15 bg-well/50 hover:border-white/30 hover:bg-white/[0.03] active:border-amber-400/50"
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
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-400/25 bg-amber-400/10">
                      <FileTextIcon className="h-4.5 w-4.5 text-amber-300" />
                    </span>
                    <p className="mt-1 max-w-full truncate px-2 font-mono text-[13px] font-semibold text-stone-100">
                      {file.name}
                    </p>
                    <p className="font-mono text-[11px] text-amber-300/80">
                      {fmtBytes(file.size)} · ready
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setFile(null);
                        if (inputRef.current) inputRef.current.value = "";
                      }}
                      className="mt-0.5 inline-flex cursor-pointer items-center gap-1 rounded-sm text-xs font-medium text-stone-500 transition hover:text-white active:text-stone-300"
                    >
                      <XIcon className="h-3 w-3" />
                      Remove
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                        dragging
                          ? "border-amber-400/30 bg-amber-400/10"
                          : "border-white/10 bg-white/[0.04]"
                      }`}
                    >
                      <UploadIcon
                        className={`h-4.5 w-4.5 transition-colors ${
                          dragging ? "text-amber-300" : "text-stone-500"
                        }`}
                      />
                    </span>
                    <p className="mt-1 text-[13px] font-semibold text-stone-200">
                      {dragging ? "Drop to upload" : "Drop your Meta Ads CSV"}
                    </p>
                    <p className="font-mono text-[11px] text-stone-600">
                      or click to browse · max 5MB
                    </p>
                  </>
                )}
              </label>

              {/* Onboarding: how to get the CSV + what we can read.
                  <details> keeps both out of the way until needed. */}
              <div className="mt-2 space-y-1">
                <details className="group rounded-lg border border-transparent open:border-white/10 open:bg-white/[0.03]">
                  <summary className="cursor-pointer list-none rounded-sm px-1 py-1 text-xs font-medium text-stone-500 transition hover:text-stone-200 group-open:px-3 group-open:pt-2.5 group-open:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 [&::-webkit-details-marker]:hidden">
                    <span aria-hidden="true" className="mr-1.5 inline-block transition-transform group-open:rotate-90">
                      ›
                    </span>
                    How to export from Meta Ads Manager
                  </summary>
                  <ol className="space-y-1 px-3 pb-3 pt-1 text-xs leading-relaxed text-stone-400">
                    {[
                      "Open Meta Ads Manager",
                      "Switch to the Ads level (not Campaigns or Ad sets)",
                      "Select your date range (30–90 days reads best)",
                      "Choose your performance columns — spend plus your KPI",
                      "Export → Export table data → .csv",
                      "Drop the file above",
                    ].map((step, i) => (
                      <li key={step} className="flex gap-2">
                        <span className="font-mono text-[10px] font-semibold text-amber-300">
                          {i + 1}.
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </details>

                <details className="group rounded-lg border border-transparent open:border-white/10 open:bg-white/[0.03]">
                  <summary className="cursor-pointer list-none rounded-sm px-1 py-1 text-xs font-medium text-stone-500 transition hover:text-stone-200 group-open:px-3 group-open:pt-2.5 group-open:text-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 [&::-webkit-details-marker]:hidden">
                    <span aria-hidden="true" className="mr-1.5 inline-block transition-transform group-open:rotate-90">
                      ›
                    </span>
                    Columns we recognize
                  </summary>
                  <div className="px-3 pb-3 pt-1 text-xs leading-relaxed text-stone-400">
                    <p>
                      Only <span className="font-semibold text-stone-200">Amount spent</span>{" "}
                      plus the column for your chosen KPI are required. Naming
                      varies by export — all of these resolve automatically:
                    </p>
                    <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-stone-500">
                      Ad name · Amount spent · Impressions · Link clicks · CTR ·
                      CPC · Purchases / Results · Purchase conversion value ·
                      Purchase ROAS · Cost per purchase / result · Leads · Cost
                      per lead · Reporting starts / ends
                    </p>
                    <p className="mt-1.5 text-stone-500">
                      Missing something for your KPI? You&apos;ll get a clear
                      message naming the column, not a wrong answer.
                    </p>
                  </div>
                </details>
              </div>

              {/* Second data source: OAuth pull rendered as the same
                  virtual-CSV File the dropzone produces. */}
              <div
                className="my-4 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600"
                aria-hidden="true"
              >
                <span className="h-px flex-1 bg-white/10" />
                or
                <span className="h-px flex-1 bg-white/10" />
              </div>
              <p className="mb-2 font-mono text-[10px] font-semibold tracking-[0.14em] text-stone-500">
                B · CONNECT META ACCOUNT
              </p>
              <MetaConnect />

              <fieldset className="mt-6">
                <legend className={fieldLabel}>02 · Primary KPI</legend>
                <div role="group" className="mt-2.5 grid grid-cols-3 gap-1.5">
                  {KPI_OPTIONS.map((opt) => {
                    const active = fields.kpi === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => updateFields({ kpi: opt.value })}
                        className={`cursor-pointer rounded-lg border px-2 py-2 font-mono text-xs font-semibold transition motion-safe:duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-carbon ${
                          active
                            ? "border-amber-400 bg-amber-400 text-stone-950 shadow-[0_2px_12px_-2px_rgba(251,191,36,0.4)]"
                            : "border-white/10 bg-white/[0.03] text-stone-400 hover:border-white/25 hover:text-stone-100"
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
              <div className="mt-2.5 space-y-3">
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

                <div className="grid grid-cols-[7rem_1fr] gap-3 border-t border-white/[0.07] pt-3">
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
                <p className="font-mono text-[10px] leading-relaxed tracking-wide text-stone-600">
                  * REQUIRED · TARGET CPA SHARPENS THE SPEND GATE
                </p>
              </div>
            </div>
          </div>

          {/* ---- Action row: a quiet footer strip below the panel ---- */}
          <div className="flex flex-col gap-3 border-t border-white/[0.07] bg-black/25 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-stone-600">
              Parsed in memory · never stored · gone on refresh
            </p>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`cursor-pointer ${btnPrimary}`}
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
