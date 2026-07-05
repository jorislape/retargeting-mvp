"use client";

import { useEffect, useRef, useState } from "react";
import type { CompetitorSource, KpiKey } from "@/modules/debrief";
import {
  assessMarketNotes,
  CREATIVE_FORMAT_OPTIONS,
  EMPTY_COMPETITOR_SOURCE,
  extractNameTags,
  HIGHER_IS_BETTER,
  KPI_LABELS,
  MAX_COMPETITOR_SOURCES,
  mergeCompetitorSourcesIntoNotes,
  parseCsv,
  requiredColumnsFor,
  resolveColumns,
  SAMPLE_CONTEXT,
  SAMPLE_CSV_FILENAME,
  SAMPLE_CSV_TEXT,
  structureMarketNotes,
} from "@/modules/debrief";
import {
  appendPageSignalsToNotes,
  formatPageSignalsAsNotes,
  type FetchPageResponse,
} from "@/modules/competitor";
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
/* The generator as a WORKFLOW: four stages, each opened by a light    */
/* step header (numbered chip that fills as the stage completes) —     */
/*   01 DATA     CSV upload is the primary path, Meta connect the     */
/*               integration alternative, sample data a helper row —  */
/*               whatever fills the pipeline lands in one shared strip */
/*   02 CONTEXT  the KPI (underline-selected, polarity shown), the    */
/*               required framing, and ONE combined optional market /  */
/*               competitor area (notes + sources + one-time page      */
/*               fetch + Structure notes + Use as market notes)        */
/*   03 VERIFY   optional creative-format confirmation over the        */
/*               loaded CSV — trust step, not a requirement            */
/*   04 RUN      one status line, one white action                     */
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

/** The alias groups documented in the "CSV requirements" helper —
 *  mirrors what columns.ts actually resolves. */
const KPI_ALIAS_DOC: [string, string][] = [
  ["ROAS", "ROAS · Website purchase ROAS · Return on ad spend"],
  ["CPA", "CPA · Cost per purchase · Cost per lead · Cost per result"],
  ["CTR", "CTR · Link CTR · Click-through rate"],
  ["CPC", "CPC · Cost per click · Link CPC"],
  ["Spend", "Amount spent · Spend · Amount Spent (USD) · Amount Spent (EUR)"],
  ["Ad name", "Ad name · Ad · Creative name"],
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

/** Per-card state of the one-time "Fetch page signals" action. Absent
 *  means idle. Session-only, like everything in the generator. */
type PageFetchState =
  | { status: "loading" }
  | { status: "done" }
  | { status: "error"; title: string; message: string; fix: string };

function MethodLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
      {children}
    </p>
  );
}

export function GeneratorPanel() {
  const {
    status,
    file,
    fields,
    competitorSources,
    formatOverrides,
    error,
    setFile,
    updateFields,
    setCompetitorSources,
    setFormatOverrides,
    generate,
    clearError,
  } = useDebrief();
  const { status: metaStatus } = useMeta();
  const [dragging, setDragging] = useState(false);
  /* "Structure notes" feedback: "done" shows the ✓ state, "empty" swaps
     the helper line for the nothing-to-structure notice. */
  const [noteState, setNoteState] = useState<"idle" | "done" | "empty">(
    "idle"
  );
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* "Use as market notes" feedback, same three-state pattern as the
     notes button above. */
  const [sourceState, setSourceState] = useState<"idle" | "done" | "empty">(
    "idle"
  );
  const sourceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* "Fetch page signals" state per competitor-source index. */
  const [pageFetch, setPageFetch] = useState<Record<number, PageFetchState>>(
    {}
  );
  const inputRef = useRef<HTMLInputElement>(null);

  /* Non-blocking quality read on the notes — local parsing only. */
  const marketQuality = assessMarketNotes(fields.marketContext);

  /* Lightweight client-side CSV preview: header + row count + which
     KPIs resolve, using the same parser/alias matcher the API uses —
     no analysis logic, just structure. Keyed to the File object so a
     stale read never shows for a newer file. */
  const [previewState, setPreviewState] = useState<{
    forFile: File;
    rows: number;
    cols: number;
    kpisFound: KpiKey[];
    /** Deduped ad names + their name-derived format tags, in file
     *  order — feeds the optional "Confirm creative formats" list.
     *  Structure only; no analysis. */
    ads: { name: string; tags: string[] }[];
  } | null>(null);
  /* "Confirm creative formats" list expansion past the first 25 ads —
     keyed to the File object so a new file starts collapsed without an
     effect-driven reset. */
  const [expandedFormatsFor, setExpandedFormatsFor] = useState<File | null>(
    null
  );
  const showAllFormats = expandedFormatsFor !== null && expandedFormatsFor === file;

  useEffect(() => {
    if (!file || file.size > 5 * 1024 * 1024) return;
    let cancelled = false;
    file
      .text()
      .then((text) => {
        if (cancelled) return;
        const matrix = parseCsv(text);
        const headers = matrix[0] ?? [];
        const columns = resolveColumns(headers);
        const kpisFound = KPI_OPTIONS.map((o) => o.value).filter(
          (k) => requiredColumnsFor(k, columns).length === 0
        );
        const nameIdx = columns.adName ? headers.indexOf(columns.adName) : -1;
        const seen = new Set<string>();
        const ads: { name: string; tags: string[] }[] = [];
        if (nameIdx >= 0) {
          for (const row of matrix.slice(1)) {
            const name = (row[nameIdx] ?? "").trim();
            if (name === "" || seen.has(name)) continue;
            seen.add(name);
            ads.push({ name, tags: extractNameTags(name) });
          }
        }
        setPreviewState({
          forFile: file,
          rows: Math.max(0, matrix.length - 1),
          cols: headers.length,
          kpisFound,
          ads,
        });
      })
      .catch(() => {
        /* Unreadable here just means no preview — the API gives the
           real, structured error on run. */
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  const preview =
    file && previewState?.forFile === file ? previewState : null;
  const previewKpiOk = preview?.kpisFound.includes(fields.kpi) ?? true;

  /* A real file download of the same synthetic dataset "Load the
     sample dataset" uses — so the expected format can be inspected
     outside the app. Client-side blob, no network. */
  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV_TEXT], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "debrief-sample-meta-ads.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

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

  /* Competitor sources: structured manual input that only ever becomes
     text in the market-notes field. Nothing here fetches a URL. */
  const addSource = () => {
    if (competitorSources.length >= MAX_COMPETITOR_SOURCES) return;
    setCompetitorSources([...competitorSources, EMPTY_COMPETITOR_SOURCE]);
  };

  const updateSource = (index: number, patch: Partial<CompetitorSource>) => {
    setCompetitorSources(
      competitorSources.map((s, i) => (i === index ? { ...s, ...patch } : s))
    );
    if (sourceState !== "idle") setSourceState("idle");
    /* A new URL invalidates the card's fetch state. */
    if ("url" in patch && pageFetch[index]) {
      setPageFetch((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  const removeSource = (index: number) => {
    setCompetitorSources(competitorSources.filter((_, i) => i !== index));
    if (sourceState !== "idle") setSourceState("idle");
    /* Reindex fetch states to follow the shifted cards. */
    setPageFetch((prev) => {
      const next: Record<number, PageFetchState> = {};
      for (const [key, value] of Object.entries(prev)) {
        const i = Number(key);
        if (i === index) continue;
        next[i > index ? i - 1 : i] = value;
      }
      return next;
    });
  };

  /* One-time, user-triggered fetch of the card's landing page URL.
     Success appends the extracted signals to the card's NOTES (the
     user reviews them there) — they reach the report only through the
     existing "Use as market notes" path. The server does the fetching
     with SSRF guards; nothing is stored or monitored. */
  const fetchPageSignals = async (index: number) => {
    const source = competitorSources[index];
    const url = source?.url.trim() ?? "";
    if (url === "" || pageFetch[index]?.status === "loading") return;
    setPageFetch((prev) => ({ ...prev, [index]: { status: "loading" } }));
    let state: PageFetchState;
    try {
      const res = await fetch("/api/competitor/fetch-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data: FetchPageResponse = await res.json();
      if (data.ok === true) {
        let host: string | undefined;
        try {
          host = new URL(url).hostname;
        } catch {
          /* display label only — omit if unparseable */
        }
        const block = formatPageSignalsAsNotes(data.signals ?? {}, host);
        /* Functional update: append to the notes as they are NOW, not
           as they were when the fetch started. */
        setCompetitorSources((prev) =>
          prev.map((s, i) =>
            i === index
              ? { ...s, notes: appendPageSignalsToNotes(s.notes, block) }
              : s
          )
        );
        state = { status: "done" };
      } else {
        state = {
          status: "error",
          title: typeof data.title === "string" ? data.title : "Fetch failed",
          message:
            typeof data.message === "string"
              ? data.message
              : "The page couldn't be fetched.",
          fix:
            typeof data.fix === "string"
              ? data.fix
              : "Try again, or paste the page's key points into Notes manually.",
        };
      }
    } catch {
      state = {
        status: "error",
        title: "Network error",
        message: "The request didn't reach Debrief.",
        fix: "Check your connection and try again.",
      };
    }
    setPageFetch((prev) => ({ ...prev, [index]: state }));
  };

  /* Serializes the filled-in sources and APPENDS them to the market
     notes — existing text is never overwritten, and a repeat click
     with the same sources is a no-op instead of a duplicate block. */
  const useAsMarketNotes = () => {
    const merged = mergeCompetitorSourcesIntoNotes(
      fields.marketContext,
      competitorSources
    );
    if (merged === null) {
      setSourceState("empty");
    } else {
      updateFields({ marketContext: merged });
      setSourceState("done");
      setNoteState("idle");
    }
    if (sourceTimer.current) clearTimeout(sourceTimer.current);
    sourceTimer.current = setTimeout(() => setSourceState("idle"), 2500);
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
          className="mb-8 rounded-lg border border-red-400/20 bg-red-400/[0.06] px-4 py-3.5"
        >
          <p className="flex items-center gap-2.5 text-[13px] font-semibold text-red-200">
            <AlertTriangleIcon className="h-4 w-4 shrink-0 text-red-400" />
            {error.title}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-red-200/90">
            {error.message}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-300">
            <span className="font-semibold text-zinc-100">How to fix: </span>
            {error.fix}
          </p>
          {error.suggestedKpis && error.suggestedKpis.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {error.suggestedKpis.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    updateFields({ kpi: k });
                    clearError();
                  }}
                  className={`cursor-pointer ${btnSecondary}`}
                >
                  Switch to {KPI_LABELS[k]}
                </button>
              ))}
            </div>
          )}
          {error.detectedColumns && error.detectedColumns.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-zinc-400 transition hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60">
                Columns detected in your CSV
              </summary>
              <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-zinc-400">
                {error.detectedColumns.join(" · ")}
              </p>
            </details>
          )}
        </div>
      )}

      <div className="space-y-12">
        {/* ---- Stage 01 · Data ---- */}
        <section>
          <StageHeader
            n="1"
            title="Data"
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
            — 14 synthetic ads for a full test run. Want to check the format
            first?
            <button
              type="button"
              onClick={downloadSample}
              className="cursor-pointer rounded-sm font-medium text-zinc-400 underline decoration-zinc-700 underline-offset-2 transition hover:text-accent-soft hover:decoration-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              Download sample CSV
            </button>
            .
          </p>

          {/* The shared landing strip: whichever method produced the
              data, this is the single source of truth for what's
              loaded. */}
          {file && (
            <div className="animate-settle mt-3 rounded-lg border border-accent/25 bg-accent/[0.06] px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
              {/* Lightweight structural preview — catches a missing-KPI
                  column BEFORE the run instead of after it. */}
              {preview && (
                <p
                  aria-live="polite"
                  className={`mt-2 text-xs leading-relaxed ${
                    previewKpiOk ? "text-zinc-400" : "text-amber-300"
                  }`}
                >
                  {previewKpiOk
                    ? `Detected ${preview.rows} row${preview.rows === 1 ? "" : "s"}, ${preview.cols} columns. ${KPI_LABELS[fields.kpi]} column found.`
                    : `${KPI_LABELS[fields.kpi]} was selected, but no ${KPI_LABELS[fields.kpi]}-like column was detected. You can still run, but Debrief may return a missing-column error.${
                        preview.kpisFound.length > 0
                          ? ` Columns found for: ${preview.kpisFound.map((k) => KPI_LABELS[k]).join(", ")}.`
                          : ""
                      }`}
                </p>
              )}
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
                CSV requirements
              </summary>
              <div className="space-y-3 pb-2 pt-1.5 text-xs leading-relaxed text-zinc-400">
                <p className="text-zinc-500">
                  From Meta Ads Manager, export ads at ad level. Include
                  delivery/performance columns and the KPI you want Debrief
                  to judge.
                </p>
                <div>
                  <p className="font-semibold text-zinc-200">Required</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    <li>Ad name</li>
                    <li>Amount spent</li>
                    <li>
                      The KPI you want to judge by — e.g. ROAS, CPA, CTR,
                      CPC, Leads, or Purchases
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-zinc-200">Recommended</p>
                  <p className="mt-1 font-mono text-[11px] leading-relaxed text-zinc-500">
                    Campaign name · Ad set name · Impressions · Clicks ·
                    Purchases or Leads · Cost per result · Website purchase
                    ROAS
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-zinc-200">
                    Supported KPI aliases
                  </p>
                  <dl className="mt-1 space-y-1">
                    {KPI_ALIAS_DOC.map(([kpiName, aliases]) => (
                      <div key={kpiName} className="flex gap-2">
                        <dt className="w-16 shrink-0 font-semibold text-zinc-300">
                          {kpiName}
                        </dt>
                        <dd className="font-mono text-[11px] leading-relaxed text-zinc-500">
                          {aliases}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <p className="text-zinc-500">
                  Missing something for your KPI? You&apos;ll get a clear
                  message naming the column, not a wrong answer.
                </p>
              </div>
            </details>
          </div>
        </section>

        {/* ---- Stage 02 · Context ---- */}
        <section>
          <StageHeader
            n="2"
            title="Context"
            done={contextDone}
            hint="The KPI the memo judges by, your framing, and optional market context."
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
          </div>
          <p className="mt-3 text-xs text-zinc-600">
            * Required — a target CPA sharpens the spend gate.
          </p>

          {/* ONE combined market/competitor context area: notes,
              competitor sources, the one-time page fetch, Structure
              notes, and Use as market notes all live here. The intro
              line carries the shared caveat so it isn't repeated under
              every field. */}
          <div className="mt-8 border-t border-white/[0.06] pt-6">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-[13px] font-semibold tracking-tight text-zinc-200">
                Market / competitor context
              </h3>
              <p className="text-xs text-zinc-600">
                Optional — add competitor pages, Ads Library examples, hooks,
                offers, or rough notes. Debrief uses this as directional
                market context only.
              </p>
            </div>

            <div className="mt-4">
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
              {/* One helper slot, three states (no layout shift):
                  the "nothing to structure" notice wins, then the local
                  deterministic quality meter once anything is typed,
                  else the default helper text. */}
              <p
                aria-live="polite"
                className={`mt-1.5 text-xs leading-relaxed ${
                  noteState === "empty" || marketQuality?.level === "weak"
                    ? "text-amber-300"
                    : marketQuality
                      ? "text-zinc-400"
                      : "text-zinc-600"
                }`}
              >
                {noteState === "empty"
                  ? "Add competitor notes or links first."
                  : marketQuality
                    ? `Market context: ${marketQuality.summary}`
                    : "Paste rough notes — “Structure notes” groups them into formats, hooks, offers, and links."}
              </p>
            </div>

            {/* Competitor sources: structured input that only ever
                becomes text in the notes field above. A landing-page
                URL can be fetched ONCE via the explicit "Fetch page
                signals" button — never automatically, never
                monitored. */}
            <div className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className={fieldLabel}>Competitor sources</p>
                <div className="flex flex-wrap items-center gap-2">
                  {competitorSources.length < MAX_COMPETITOR_SOURCES && (
                    <button
                      type="button"
                      onClick={addSource}
                      className={`cursor-pointer ${btnSecondary}`}
                    >
                      Add competitor source
                    </button>
                  )}
                  {competitorSources.length > 0 && (
                    <button
                      type="button"
                      onClick={useAsMarketNotes}
                      className={`min-w-[9.5rem] cursor-pointer ${btnSecondary}`}
                    >
                      {sourceState === "done" ? (
                        <span className="flex items-center gap-1.5 motion-safe:animate-settle">
                          <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                          Added to notes
                        </span>
                      ) : (
                        "Use as market notes"
                      )}
                    </button>
                  )}
                </div>
              </div>

              {competitorSources.length > 0 && (
                <div className="mt-2.5 space-y-3">
                  {competitorSources.map((source, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                          Source {i + 1}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeSource(i)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-sm text-xs font-medium text-zinc-500 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                        >
                          <XIcon className="h-3 w-3" />
                          Remove
                        </button>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor={`competitor-name-${i}`}
                            className={fieldLabel}
                          >
                            Competitor name
                          </label>
                          <input
                            id={`competitor-name-${i}`}
                            value={source.name}
                            onChange={(e) =>
                              updateSource(i, { name: e.target.value })
                            }
                            placeholder="GlowLab"
                            className={`mt-1.5 ${inputBase}`}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`competitor-url-${i}`}
                            className={fieldLabel}
                          >
                            Website / landing page URL
                          </label>
                          <div className="mt-1.5 flex gap-2">
                            <input
                              id={`competitor-url-${i}`}
                              value={source.url}
                              onChange={(e) =>
                                updateSource(i, { url: e.target.value })
                              }
                              placeholder="https://example.com"
                              className={`min-w-0 flex-1 ${inputBase}`}
                            />
                            <button
                              type="button"
                              onClick={() => void fetchPageSignals(i)}
                              disabled={
                                source.url.trim() === "" ||
                                pageFetch[i]?.status === "loading"
                              }
                              className={`shrink-0 cursor-pointer ${btnSecondary}`}
                            >
                              {pageFetch[i]?.status === "loading" ? (
                                <span className="motion-safe:animate-pulse">
                                  Fetching…
                                </span>
                              ) : pageFetch[i]?.status === "done" ? (
                                <span className="flex items-center gap-1.5 motion-safe:animate-settle">
                                  <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                                  Signals added
                                </span>
                              ) : (
                                "Fetch page signals"
                              )}
                            </button>
                          </div>
                          {pageFetch[i]?.status === "error" && (
                            <p
                              role="alert"
                              className="mt-1.5 text-xs leading-relaxed text-amber-300"
                            >
                              {pageFetch[i].title}: {pageFetch[i].message}{" "}
                              <span className="text-zinc-500">
                                {pageFetch[i].fix}
                              </span>
                            </p>
                          )}
                        </div>
                        <div>
                          <label
                            htmlFor={`competitor-ads-${i}`}
                            className={fieldLabel}
                          >
                            Ads Library links / examples
                          </label>
                          <textarea
                            id={`competitor-ads-${i}`}
                            rows={2}
                            value={source.adsLibraryLinks}
                            onChange={(e) =>
                              updateSource(i, {
                                adsLibraryLinks: e.target.value,
                              })
                            }
                            placeholder={"One per line:\nhttps://www.facebook.com/ads/library/?id=..."}
                            className={`mt-1.5 resize-none ${inputBase}`}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`competitor-notes-${i}`}
                            className={fieldLabel}
                          >
                            Notes
                          </label>
                          <textarea
                            id={`competitor-notes-${i}`}
                            rows={2}
                            value={source.notes}
                            onChange={(e) =>
                              updateSource(i, { notes: e.target.value })
                            }
                            placeholder="founder-led videos, first-order discount, problem-first hooks"
                            className={`mt-1.5 resize-none ${inputBase}`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p
                aria-live="polite"
                className={`mt-1.5 text-xs leading-relaxed ${
                  sourceState === "empty" ? "text-amber-300" : "text-zinc-600"
                }`}
              >
                {sourceState === "empty"
                  ? "Add a competitor name, link, or note first."
                  : competitorSources.length === 0
                    ? "List competitors by name, landing page, and Ads Library examples — “Use as market notes” merges them into the notes above."
                    : `Up to ${MAX_COMPETITOR_SOURCES} sources. “Use as market notes” appends a structured summary to the notes above — your existing notes are kept.`}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                &ldquo;Fetch page signals&rdquo; reads the public page once,
                when you click — no monitoring, no storage, no Ads Library
                fetching, and no competitor-performance inference.
              </p>
            </div>
          </div>
        </section>

        {/* ---- Stage 03 · Verify ---- */}
        {/* Creative Format Confirmation V1: optional per-ad format
            corrections for the loaded CSV. Local parsing only —
            corrections replace the ad-name guess as pattern context,
            never a performance number. */}
        <section>
          <StageHeader
            n="3"
            title="Verify"
            done={Object.keys(formatOverrides).length > 0}
            hint="Optional — confirm the creative format so Debrief does not rely only on ad names."
          />
          {preview && preview.ads.length > 0 ? (
            <details className="group mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] open:border-white/[0.09]">
              <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 [&::-webkit-details-marker]:hidden">
                <span className="text-sm font-semibold tracking-tight text-zinc-100">
                  Confirm creative formats
                </span>
                <span className="text-xs text-zinc-600">
                  Debrief guesses format from ad names — correct anything
                  important before generating.
                </span>
                <span className="ml-auto font-mono text-[11px] tabular-nums text-zinc-500">
                  {Object.keys(formatOverrides).length > 0
                    ? `${Object.keys(formatOverrides).length} confirmed`
                    : `${preview.ads.length} ad${preview.ads.length === 1 ? "" : "s"}`}
                </span>
              </summary>
              <div className="border-t border-white/[0.06] px-5 pb-5">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[540px] text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left">
                        <th className="py-2 pr-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                          Ad name
                        </th>
                        <th className="py-2 pr-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                          Detected format
                        </th>
                        <th className="w-52 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
                          Correct format
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(showAllFormats
                        ? preview.ads
                        : preview.ads.slice(0, 25)
                      ).map((ad) => (
                        <tr
                          key={ad.name}
                          className="border-b border-white/[0.06] last:border-0"
                        >
                          <td className="max-w-72 py-2.5 pr-4 align-middle">
                            <p className="truncate text-[13px] font-medium text-zinc-200">
                              {ad.name}
                            </p>
                          </td>
                          <td className="py-2.5 pr-4 align-middle text-xs text-zinc-500">
                            {ad.tags.length > 0 ? ad.tags.join(", ") : "—"}
                          </td>
                          <td className="py-2 align-middle">
                            <select
                              aria-label={`Correct format for ${ad.name}`}
                              value={formatOverrides[ad.name] ?? ""}
                              onChange={(e) => {
                                const next = { ...formatOverrides };
                                if (e.target.value === "") {
                                  delete next[ad.name];
                                } else {
                                  next[ad.name] = e.target.value;
                                }
                                setFormatOverrides(next);
                              }}
                              className={`${inputBase} py-1.5 text-xs`}
                            >
                              <option value="" className="bg-zinc-900">
                                Unknown / leave as-is
                              </option>
                              {CREATIVE_FORMAT_OPTIONS.map((opt) => (
                                <option
                                  key={opt.tag}
                                  value={opt.tag}
                                  className="bg-zinc-900"
                                >
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.ads.length > 25 && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedFormatsFor(showAllFormats ? null : file)
                      }
                      className={`cursor-pointer ${btnSecondary}`}
                    >
                      {showAllFormats
                        ? "Show first 25 ads"
                        : `Show all ${preview.ads.length} ads`}
                    </button>
                    {!showAllFormats && (
                      <p className="text-xs text-zinc-600">
                        Showing the first 25 of {preview.ads.length} ads.
                      </p>
                    )}
                  </div>
                )}
                {Object.keys(formatOverrides).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFormatOverrides({})}
                    className="mt-3 inline-flex cursor-pointer items-center gap-1 rounded-sm text-xs font-medium text-zinc-500 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  >
                    <XIcon className="h-3 w-3" />
                    Clear all confirmations
                  </button>
                )}
                <p className="mt-3 text-xs leading-relaxed text-zinc-600">
                  Format corrections are used as context for pattern
                  detection, next tests, and creative briefs. They do not
                  change your performance numbers.
                </p>
              </div>
            </details>
          ) : (
            <p className="mt-4 text-xs leading-relaxed text-zinc-600">
              Load your data in stage 1 — the detected ads and their formats
              will be listed here for review.
            </p>
          )}
        </section>

        {/* ---- Stage 04 · Run ---- */}
        <section>
          <StageHeader
            n="4"
            title="Run"
            done={false}
            hint="Turns your data and context into a buyer memo, client report, next tests, and creative briefs."
          />
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
