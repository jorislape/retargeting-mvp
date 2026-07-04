"use client";

import { useEffect, useRef, useState } from "react";
import type { KpiKey } from "@/modules/debrief";
import {
  HIGHER_IS_BETTER,
  SAMPLE_CONTEXT,
  SAMPLE_CSV_FILENAME,
  SAMPLE_CSV_TEXT,
  structureMarketNotes,
} from "@/modules/debrief";
import { useDebrief } from "@/components/workspace/DebriefProvider";
import { useMeta } from "@/components/workspace/MetaProvider";
import { MetaConnect } from "@/components/debrief/MetaConnect";
import {
  AlertTriangleIcon,
  ArrowIcon,
  CheckIcon,
  FileTextIcon,
  FlaskIcon,
  UploadIcon,
  XIcon,
  ZapIcon,
} from "@/components/ui/icons";
import {
  btnPrimary,
  btnSecondary,
  fieldLabel,
  inputBase,
} from "@/components/ui/theme";

/* ------------------------------------------------------------------ */
/* The generator as a WORKFLOW: three stages, each opened by a light   */
/* step header (numbered chip that fills as the stage completes) —     */
/*   01 SOURCE   CSV upload is the primary path, Meta connect the     */
/*               integration alternative, sample data a helper row —  */
/*               whatever fills the pipeline lands in one shared strip */
/*   02 FRAMING  the KPI (underline-selected, polarity shown) and the */
/*               context the memo is written against                   */
/*   03 RUN      one status line, one white action                     */
/* Stage completion is real state, not decoration.                     */
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
      className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 text-center"
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
                  ? "bg-accent text-zinc-950"
                  : i === step
                    ? "border border-accent/60 text-accent-soft motion-safe:animate-pulse"
                    : "border border-white/15 text-zinc-600"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </span>
            <span
              className={`text-[13px] font-medium ${
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

/* A light step header: small numbered chip that fills when the stage
   is complete, title, and an optional hint. No rail, no weight. */
function StageHeader({
  n,
  title,
  done,
  hint,
}: {
  n: string;
  title: string;
  done: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-md font-mono text-[10px] font-semibold transition-colors ${
          done
            ? "bg-accent text-zinc-950"
            : "border border-white/12 text-zinc-500"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
        {title}
      </h2>
      {hint && <p className="text-xs text-zinc-600 sm:ml-1">{hint}</p>}
    </div>
  );
}

const methodTile =
  "flex min-h-40 flex-col rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 transition-colors";

function MethodLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
      {children}
    </p>
  );
}

export function GeneratorPanel() {
  const { status, file, fields, error, setFile, updateFields, generate } =
    useDebrief();
  const { status: metaStatus } = useMeta();
  const [dragging, setDragging] = useState(false);
  /* "Structure notes" feedback: "done" shows the ✓ state, "empty" swaps
     the helper line for the nothing-to-structure notice. */
  const [noteState, setNoteState] = useState<"idle" | "done" | "empty">(
    "idle"
  );
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Local, deterministic reformat of the pasted notes — no network,
     no external service, just the shared keyword map. */
  const structureNotes = () => {
    const structured = structureMarketNotes(fields.marketContext);
    if (structured === null) {
      setNoteState("empty");
    } else {
      updateFields({ marketContext: structured });
      setNoteState("done");
    }
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNoteState("idle"), 2500);
  };

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
      ...(fields.marketContext.trim() === "" && {
        marketContext: SAMPLE_CONTEXT.marketContext,
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
          className="mb-8 flex items-start gap-2.5 rounded-lg border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-[13px] leading-relaxed text-red-200"
        >
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          {error}
        </div>
      )}

      <div className="space-y-12">
        {/* ---- Stage 01 · Source ---- */}
        <section>
          <StageHeader
            n="1"
            title="Source"
            done={!!file}
            hint="Upload your export, or pull straight from Meta."
          />

          <div className="mt-5 grid gap-3 lg:grid-cols-5">
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
              className={`${methodTile} group relative cursor-pointer justify-between gap-4 overflow-hidden lg:col-span-3 lg:min-h-48 focus-within:ring-2 focus-within:ring-accent/60 focus-within:ring-offset-2 focus-within:ring-offset-carbon ${
                dragging
                  ? "border-accent/60 bg-accent/[0.06]"
                  : "hover:border-white/[0.12] hover:bg-white/[0.05]"
              }`}
            >
              {/* Decorative grid — wakes on hover, lit while dragging. */}
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_78%)] transition-opacity duration-300 ${
                  dragging ? "opacity-100" : "opacity-35 group-hover:opacity-70"
                }`}
              />
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.12),transparent_62%)] transition-opacity duration-300 ${
                  dragging ? "opacity-100" : "opacity-0"
                }`}
              />
              <input
                ref={inputRef}
                id="csv-input"
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <div className="relative flex w-full items-center justify-between gap-2">
                <MethodLabel>
                  <UploadIcon
                    className={`h-3.5 w-3.5 ${dragging ? "text-accent-soft" : "text-zinc-500"}`}
                  />
                  CSV export
                </MethodLabel>
                <span className="rounded-full border border-accent/25 bg-accent/[0.08] px-2 py-0.5 text-[10px] font-medium text-accent-soft">
                  Recommended
                </span>
              </div>
              <div className="relative py-2 text-center lg:py-3">
                <div
                  aria-hidden="true"
                  className={`mx-auto flex h-11 w-11 items-center justify-center rounded-lg border shadow-[0_8px_16px_-8px_rgba(0,0,0,0.6)] transition motion-safe:duration-200 ${
                    dragging
                      ? "border-accent/50 bg-panel text-accent-soft motion-safe:scale-110 motion-safe:-rotate-2"
                      : "border-white/[0.09] bg-panel text-zinc-400 motion-safe:group-hover:-translate-y-1 group-hover:text-zinc-200"
                  }`}
                >
                  <FileTextIcon className="h-5 w-5" />
                </div>
                <p className="mt-3 text-[15px] font-medium text-zinc-100">
                  {dragging ? "Drop to load" : "Drop your Ads Manager export"}
                </p>
                <p className="mt-1 text-xs text-zinc-600">
                  or click to browse · max 5MB
                </p>
              </div>
              <span className="relative text-[11px] text-zinc-600">
                Ad-level · any column set
              </span>
            </label>

            {/* The alternative: Meta as a real integration, not a
                side button. Status lives in the card header (hidden
                once connected — MetaConnect shows its own). */}
            <div
              className={`${methodTile} justify-between gap-4 lg:col-span-2 lg:min-h-48`}
            >
              <div className="flex items-center justify-between gap-2">
                <MethodLabel>
                  <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04]">
                    <ZapIcon className="h-3.5 w-3.5 text-accent-soft" />
                  </span>
                  Meta Ads
                </MethodLabel>
                {metaStatus !== "connected" && (
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-600">
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 rounded-full ${
                        metaStatus === "connecting"
                          ? "bg-amber-400"
                          : "bg-zinc-600"
                      }`}
                    />
                    {metaStatus === "connecting" ? "Connecting…" : "Not connected"}
                  </span>
                )}
              </div>
              <MetaConnect />
            </div>
          </div>

          {/* Helper path, deliberately quiet: sample data is a demo
              aid, not a workflow. */}
          <p className="mt-3 flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-600">
            <FlaskIcon className="h-3.5 w-3.5 text-zinc-600" />
            No CSV handy?
            <button
              type="button"
              onClick={loadSample}
              className="cursor-pointer rounded-sm font-medium text-zinc-400 underline decoration-zinc-700 underline-offset-2 transition hover:text-accent-soft hover:decoration-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              Load the sample dataset
            </button>
            — 14 synthetic ads for a full test run.
          </p>

          {/* The shared landing strip: whichever method produced the
              data, this is the single source of truth for what's
              loaded. */}
          {file && (
            <div className="animate-settle mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-accent/25 bg-accent/[0.06] px-4 py-3">
              <FileTextIcon className="h-4 w-4 shrink-0 text-accent-soft" />
              <p className="min-w-0 flex-1 truncate font-mono text-[13px] font-medium text-zinc-100">
                {file.name}
              </p>
              <span className="font-mono text-[11px] text-zinc-500">
                {fmtBytes(file.size)} · ready
              </span>
              <button
                type="button"
                onClick={removeFile}
                className="inline-flex cursor-pointer items-center gap-1 rounded-sm text-xs font-medium text-zinc-500 transition hover:text-white"
              >
                <XIcon className="h-3 w-3" />
                Remove
              </button>
            </div>
          )}

          <div className="mt-4 space-y-1">
            <details className="group border-l border-white/10 pl-3 open:border-accent/40">
              <summary className="cursor-pointer list-none py-0.5 text-xs font-medium text-zinc-500 transition hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 [&::-webkit-details-marker]:hidden">
                How to export from Meta Ads Manager
              </summary>
              <ol className="space-y-1 pb-2 pt-1.5 text-xs leading-relaxed text-zinc-400">
                {[
                  "Open Meta Ads Manager",
                  "Switch to the Ads level (not Campaigns or Ad sets)",
                  "Select your date range (30–90 days reads best)",
                  "Choose your performance columns — spend plus your KPI",
                  "Export → Export table data → .csv",
                  "Drop the file above",
                ].map((step, i) => (
                  <li key={step} className="flex gap-2">
                    <span className="font-mono text-[10px] font-semibold text-accent-soft">
                      {i + 1}.
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </details>

            <details className="group border-l border-white/10 pl-3 open:border-accent/40">
              <summary className="cursor-pointer list-none py-0.5 text-xs font-medium text-zinc-500 transition hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 [&::-webkit-details-marker]:hidden">
                Columns we recognize
              </summary>
              <div className="pb-2 pt-1.5 text-xs leading-relaxed text-zinc-400">
                <p>
                  Only <span className="font-semibold text-zinc-200">Amount spent</span>{" "}
                  plus the column for your chosen KPI are required. Naming
                  varies by export — all of these resolve automatically:
                </p>
                <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-zinc-500">
                  Ad name · Amount spent · Impressions · Link clicks · CTR ·
                  CPC · Purchases / Results · Purchase conversion value ·
                  Purchase ROAS · Cost per purchase / result · Leads · Cost
                  per lead · Reporting starts / ends
                </p>
                <p className="mt-1.5 text-zinc-500">
                  Missing something for your KPI? You&apos;ll get a clear
                  message naming the column, not a wrong answer.
                </p>
              </div>
            </details>
          </div>
        </section>

        {/* ---- Stage 02 · Framing ---- */}
        <section>
          <StageHeader
            n="2"
            title="Framing"
            done={contextDone}
            hint="The KPI the memo judges by, and the context it's written against."
          />

          <fieldset className="mt-5">
            <legend className="sr-only">Primary KPI</legend>
            <div
              role="group"
              className="grid grid-cols-3 border-b border-white/[0.08] sm:grid-cols-6"
            >
              {KPI_OPTIONS.map((opt) => {
                const active = fields.kpi === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => updateFields({ kpi: opt.value })}
                    className={`relative cursor-pointer px-2 pb-2.5 pt-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                      active
                        ? "text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300"
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
                      className={`ml-1 ${active ? "text-accent-soft" : "text-zinc-600"}`}
                    >
                      {HIGHER_IS_BETTER[opt.value] ? "↑" : "↓"}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-opacity ${
                        active ? "bg-accent opacity-100" : "opacity-0"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
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
            <div className="sm:col-span-3">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="marketContext" className={fieldLabel}>
                  Market / competitor notes
                </label>
                <button
                  type="button"
                  onClick={structureNotes}
                  className={`min-w-[8rem] cursor-pointer ${btnSecondary}`}
                >
                  {noteState === "done" ? (
                    <span className="flex items-center gap-1.5 motion-safe:animate-settle">
                      <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                      Structured
                    </span>
                  ) : (
                    "Structure notes"
                  )}
                </button>
              </div>
              <textarea
                id="marketContext"
                rows={5}
                value={fields.marketContext}
                onChange={(e) => {
                  updateFields({ marketContext: e.target.value });
                  if (noteState !== "idle") setNoteState("idle");
                }}
                placeholder={`Example:
- Competitor A is running founder-led videos around trust
- Competitor B repeats bundle offers and first-order discounts
- Several ads lead with problem-first hooks
- Ads Library links:
  https://www.facebook.com/ads/library/...`}
                className={`mt-1.5 resize-none ${inputBase}`}
              />
              {/* Helper line doubles as the non-blocking "nothing to
                  structure" notice, so no layout ever shifts. */}
              <p
                aria-live="polite"
                className={`mt-1.5 text-xs leading-relaxed ${
                  noteState === "empty" ? "text-amber-300" : "text-zinc-600"
                }`}
              >
                {noteState === "empty"
                  ? "Add competitor notes or links first."
                  : "Optional — paste Ads Library links, competitor ad copy, hooks, offers, formats, or rough notes."}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                Used as directional context only — competitor
                spend/performance is not inferred.
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-600">
            * Required — a target CPA sharpens the spend gate.
          </p>
        </section>

        {/* ---- Stage 03 · Run ---- */}
        <section>
          <StageHeader n="3" title="Run" done={false} />
          <div className="mt-4 flex flex-col gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[13px] leading-relaxed text-zinc-400">
                {file ? (
                  <>
                    <span className="font-mono text-zinc-200">{file.name}</span>
                    {" · "}
                    {KPI_OPTIONS.find((o) => o.value === fields.kpi)?.label}
                    {contextDone ? " · ready" : " · context incomplete"}
                  </>
                ) : (
                  "Load data in stage 1 to run."
                )}
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Parsed in memory — never stored, gone on refresh.
              </p>
            </div>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`cursor-pointer ${btnPrimary}`}
            >
              Generate debrief
              <ArrowIcon className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>
    </form>
  );
}
