"use client";

import { useEffect, useRef, useState } from "react";
import type { KpiKey } from "@/modules/debrief";
import {
  HIGHER_IS_BETTER,
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
import { btnPrimary, btnSecondary, fieldLabel, inputBase } from "@/components/ui/theme";

/* ------------------------------------------------------------------ */
/* The generator as a WORKFLOW, not a form-in-a-card: three stages     */
/* down a progress rail —                                              */
/*   01 SOURCE   three intentional input methods (CSV export, sample  */
/*               dataset, Meta API) as equal tiles; whatever method    */
/*               fills the pipeline lands in one shared "loaded" bar   */
/*   02 FRAMING  the KPI (underline-selected, polarity shown) and the */
/*               context the memo is written against                   */
/*   03 RUN      one status line, one brass action                     */
/* The rail fills as stages complete — live state, not decoration.     */
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
      className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-white/[0.08] bg-panel px-6 text-center"
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
                  ? "bg-brass text-[#141414]"
                  : i === step
                    ? "border border-brass/60 text-brass-soft motion-safe:animate-pulse"
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

/* One node of the progress rail. State is real: done = the stage's
   requirement is met, active = it's the next thing to do. */
function StageNode({
  n,
  state,
  last = false,
}: {
  n: string;
  state: "done" | "active" | "idle";
  last?: boolean;
}) {
  return (
    <div className="flex flex-col items-center self-stretch">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] font-semibold transition-colors ${
          state === "done"
            ? "border-brass bg-brass text-[#141414]"
            : state === "active"
              ? "border-brass/60 text-brass-soft"
              : "border-white/15 text-stone-600"
        }`}
      >
        {state === "done" ? "✓" : n}
      </span>
      {!last && (
        <span
          aria-hidden="true"
          className={`mt-2 w-px flex-1 ${
            state === "done" ? "bg-brass/40" : "bg-white/10"
          }`}
        />
      )}
    </div>
  );
}

function StageHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-0.5">
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-300">
        {title}
      </h2>
      {hint && <p className="text-xs text-stone-600">{hint}</p>}
    </div>
  );
}

const methodTile =
  "flex min-h-36 flex-col rounded-lg border border-white/[0.08] bg-panel p-4 transition-colors";

function MethodLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
      {children}
    </p>
  );
}

export function GeneratorPanel() {
  const { status, file, fields, error, setFile, updateFields, generate } =
    useDebrief();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const contextDone =
    fields.product.trim() !== "" &&
    fields.offer.trim() !== "" &&
    fields.goal.trim() !== "";
  const canSubmit = !!file && contextDone;

  const handleFiles = (files: FileList | null) => {
    const picked = files?.[0];
    if (picked) setFile(picked);
  };

  const removeFile = () => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
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

  if (status === "processing") {
    return <ProcessingPanel />;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) void generate();
      }}
    >
      {error && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2.5 border-l-2 border-red-400 bg-red-400/[0.06] px-4 py-3 text-[13px] leading-relaxed text-red-200"
        >
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          {error}
        </div>
      )}

      {/* ---- Stage 01 · Source ---- */}
      <section className="grid grid-cols-[2.25rem_1fr] gap-x-4 sm:gap-x-5">
        <StageNode n="01" state={file ? "done" : "active"} />
        <div className="pb-10">
          <StageHeading
            title="Source"
            hint="Three ways in — all land in the same pipeline."
          />

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {/* Method A: CSV export (the dropzone itself) */}
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
              className={`${methodTile} cursor-pointer items-start justify-between gap-3 focus-within:ring-2 focus-within:ring-brass/60 focus-within:ring-offset-2 focus-within:ring-offset-carbon ${
                dragging
                  ? "border-brass/70 bg-brass/[0.04]"
                  : "hover:border-white/20"
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
              <MethodLabel>
                <UploadIcon
                  className={`h-3.5 w-3.5 ${dragging ? "text-brass-soft" : "text-stone-500"}`}
                />
                A · CSV export
              </MethodLabel>
              <div>
                <p className="text-sm font-medium text-stone-200">
                  {dragging ? "Drop to load" : "Drop your Ads Manager export"}
                </p>
                <p className="mt-1 font-mono text-[11px] text-stone-600">
                  or click to browse · max 5MB
                </p>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-stone-600">
                Ad-level · any column set
              </span>
            </label>

            {/* Method B: sample dataset */}
            <div className={`${methodTile} items-start justify-between gap-3`}>
              <MethodLabel>
                <FlaskIcon className="h-3.5 w-3.5 text-stone-500" />
                B · Sample dataset
              </MethodLabel>
              <p className="text-sm leading-snug text-stone-400">
                14 synthetic ads with clear winners, losers, and thin-spend
                traps — built to exercise every rule.
              </p>
              <button
                type="button"
                onClick={loadSample}
                className={`cursor-pointer ${btnSecondary}`}
              >
                Load sample data
              </button>
            </div>

            {/* Method C: Meta API */}
            <div className={`${methodTile} justify-between gap-3`}>
              <MethodLabel>
                <span className="h-1.5 w-1.5 rounded-full bg-stone-500" />
                C · Meta API
              </MethodLabel>
              <MetaConnect />
            </div>
          </div>

          {/* The shared landing strip: whichever method produced the
              data, this is the single source of truth for what's
              loaded. */}
          {file && (
            <div className="animate-settle mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-l-2 border-brass bg-brass/[0.05] px-4 py-3">
              <FileTextIcon className="h-4 w-4 shrink-0 text-brass-soft" />
              <p className="min-w-0 flex-1 truncate font-mono text-[13px] font-medium text-stone-100">
                {file.name}
              </p>
              <span className="font-mono text-[11px] text-stone-500">
                {fmtBytes(file.size)} · ready
              </span>
              <button
                type="button"
                onClick={removeFile}
                className="inline-flex cursor-pointer items-center gap-1 rounded-sm text-xs font-medium text-stone-500 transition hover:text-white"
              >
                <XIcon className="h-3 w-3" />
                Remove
              </button>
            </div>
          )}

          <div className="mt-3 space-y-1">
            <details className="group border-l border-white/10 pl-3 open:border-brass/40">
              <summary className="cursor-pointer list-none py-0.5 text-xs font-medium text-stone-500 transition hover:text-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/60 [&::-webkit-details-marker]:hidden">
                How to export from Meta Ads Manager
              </summary>
              <ol className="space-y-1 pb-2 pt-1.5 text-xs leading-relaxed text-stone-400">
                {[
                  "Open Meta Ads Manager",
                  "Switch to the Ads level (not Campaigns or Ad sets)",
                  "Select your date range (30–90 days reads best)",
                  "Choose your performance columns — spend plus your KPI",
                  "Export → Export table data → .csv",
                  "Drop the file above",
                ].map((step, i) => (
                  <li key={step} className="flex gap-2">
                    <span className="font-mono text-[10px] font-semibold text-brass-soft">
                      {i + 1}.
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </details>

            <details className="group border-l border-white/10 pl-3 open:border-brass/40">
              <summary className="cursor-pointer list-none py-0.5 text-xs font-medium text-stone-500 transition hover:text-stone-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/60 [&::-webkit-details-marker]:hidden">
                Columns we recognize
              </summary>
              <div className="pb-2 pt-1.5 text-xs leading-relaxed text-stone-400">
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
        </div>

        {/* ---- Stage 02 · Framing ---- */}
        <StageNode
          n="02"
          state={contextDone ? "done" : file ? "active" : "idle"}
        />
        <div className="pb-10">
          <StageHeading
            title="Framing"
            hint="The KPI the memo judges by, and the context it's written against."
          />

          <fieldset className="mt-4">
            <legend className="sr-only">Primary KPI</legend>
            <div
              role="group"
              className="grid grid-cols-3 border-b border-white/10 sm:grid-cols-6"
            >
              {KPI_OPTIONS.map((opt) => {
                const active = fields.kpi === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => updateFields({ kpi: opt.value })}
                    className={`relative cursor-pointer px-2 pb-2.5 pt-1.5 font-mono text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/60 ${
                      active
                        ? "text-stone-100"
                        : "text-stone-500 hover:text-stone-300"
                    }`}
                  >
                    {opt.label}
                    <span
                      aria-hidden="true"
                      title={
                        HIGHER_IS_BETTER[opt.value]
                          ? "Higher is better"
                          : "Lower is better"
                      }
                      className={`ml-1 ${active ? "text-brass-soft" : "text-stone-600"}`}
                    >
                      {HIGHER_IS_BETTER[opt.value] ? "↑" : "↓"}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`absolute inset-x-2 -bottom-px h-0.5 transition-opacity ${
                        active ? "bg-brass opacity-100" : "opacity-0"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="product" className={fieldLabel}>
                Product / industry *
              </label>
              <input
                id="product"
                value={fields.product}
                onChange={(e) => updateFields({ product: e.target.value })}
                placeholder="Skincare, vitamin C serum"
                className={`mt-1.5 ${inputBase}`}
              />
            </div>
            <div>
              <label htmlFor="offer" className={fieldLabel}>
                Offer *
              </label>
              <input
                id="offer"
                value={fields.offer}
                onChange={(e) => updateFields({ offer: e.target.value })}
                placeholder="25% off first order"
                className={`mt-1.5 ${inputBase}`}
              />
            </div>
            <div>
              <label htmlFor="goal" className={fieldLabel}>
                Campaign goal *
              </label>
              <input
                id="goal"
                value={fields.goal}
                onChange={(e) => updateFields({ goal: e.target.value })}
                placeholder="Scale past $500/day"
                className={`mt-1.5 ${inputBase}`}
              />
            </div>
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
            <div className="sm:col-span-2">
              <label htmlFor="creativeNotes" className={fieldLabel}>
                Creative notes
              </label>
              <textarea
                id="creativeNotes"
                rows={2}
                value={fields.creativeNotes}
                onChange={(e) => updateFields({ creativeNotes: e.target.value })}
                placeholder="e.g. Ads 3 & 5 are UGC; rest are statics"
                className={`mt-1.5 resize-none ${inputBase}`}
              />
            </div>
          </div>
          <p className="mt-3 font-mono text-[10px] leading-relaxed tracking-[0.14em] text-stone-600">
            * REQUIRED · TARGET CPA SHARPENS THE SPEND GATE
          </p>
        </div>

        {/* ---- Stage 03 · Run ---- */}
        <StageNode n="03" state={canSubmit ? "active" : "idle"} last />
        <div>
          <StageHeading title="Run" />
          <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-[11px] leading-relaxed text-stone-500">
              {file ? (
                <>
                  <span className="text-stone-300">{file.name}</span>
                  {" · "}
                  {KPI_OPTIONS.find((o) => o.value === fields.kpi)?.label}
                  {contextDone ? " · ready" : " · context incomplete"}
                </>
              ) : (
                "Load data in stage 01 to run."
              )}
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
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-stone-600">
            Parsed in memory · never stored · gone on refresh
          </p>
        </div>
      </section>
    </form>
  );
}
