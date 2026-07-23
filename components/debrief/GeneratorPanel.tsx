"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CompetitorSource, KpiKey } from "@/modules/debrief";
import {
  assessMarketNotes,
  CREATIVE_FORMAT_OPTIONS,
  EMPTY_COMPETITOR_SOURCE,
  extractNameTags,
  fmtMoney,
  HIGHER_IS_BETTER,
  KPI_LABELS,
  MAX_COMPETITOR_SOURCES,
  mergeCompetitorSourcesIntoNotes,
  parseCsv,
  parseNumericCell,
  requiredColumnsFor,
  resolveColumns,
  SAMPLE_CONTEXT,
  SAMPLE_CSV_FILENAME,
  SAMPLE_CSV_TEXT,
  formatSelectedSignals,
  SIGNAL_BUILDER_GROUPS,
  SIGNAL_PRESETS,
  structureMarketNotes,
} from "@/modules/debrief";
import {
  appendPageSignalsToNotes,
  EMPTY_WATCHLIST_ITEM,
  formatCompetitorSignalNotes,
  formatPageSignalsAsNotes,
  getWatchlistServerSnapshot,
  getWatchlistSnapshot,
  groupSignalChanges,
  MAX_WATCHLIST_ITEMS,
  setWatchlist,
  subscribeWatchlist,
  summarizePageSignals,
  type FetchPageResponse,
  type WatchlistItem,
} from "@/modules/competitor";
import { useDebrief, type GeneratorFields } from "@/components/workspace/DebriefProvider";
import { useMeta } from "@/components/workspace/MetaProvider";
import { MetaConnect } from "@/components/debrief/MetaConnect";
import { MonitoringErrorBoundary } from "@/components/monitoring/MonitoringErrorBoundary";
import { MonitoringSection } from "@/components/monitoring/MonitoringSection";
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
  badgeAccent,
  badgeMuted,
  btnPrimary,
  btnSecondary,
  btnSecondaryMd,
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
      className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04] px-6 text-center"
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
   is complete, title, a status pill (Required / Optional / Ready /
   Complete — real state, same material as the tile badges), and an
   optional hint. No rail, no weight. */
function StageHeader({
  n,
  title,
  done,
  status,
  statusTone = "muted",
  hint,
}: {
  n: string;
  title: string;
  done: boolean;
  /** Short state label; accent tone for Complete/Ready, muted for
   *  Required/Optional. */
  status?: string;
  statusTone?: "muted" | "accent";
  hint?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-md font-mono text-[10px] font-semibold transition-colors ${
          done
            ? "bg-accent text-zinc-950"
            : "border border-white/12 text-zinc-400"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
        {title}
      </h2>
      {status && (
        <span className={statusTone === "accent" ? badgeAccent : badgeMuted}>
          {status}
        </span>
      )}
      {hint && <p className="text-xs text-zinc-400 sm:ml-1">{hint}</p>}
    </div>
  );
}

const methodTile =
  "flex min-h-40 flex-col rounded-xl border border-white/[0.08] bg-white/[0.045] p-5 transition-colors";

/** Per-card state of the one-time "Fetch page signals" action. Absent
 *  means idle. Session-only, like everything in the generator. */
type PageFetchState =
  | { status: "loading" }
  | { status: "done" }
  | { status: "error"; title: string; message: string; fix: string };

function MethodLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
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
  /* Market signal builder: a flat set of selected chip labels (labels
     are unique across groups) + the usual three-state feedback. */
  const [selectedSignals, setSelectedSignals] = useState<Set<string>>(
    () => new Set()
  );
  const [builderState, setBuilderState] = useState<"idle" | "done" | "empty">(
    "idle"
  );
  const builderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* "Fetch page signals" state per competitor-source index. */
  const [pageFetch, setPageFetch] = useState<Record<number, PageFetchState>>(
    {}
  );
  /* Competitor watchlist: browser-local store (localStorage when
     available, session memory otherwise). Server snapshot is empty,
     so saved items appear right after hydration — no mismatch. */
  const watchlist = useSyncExternalStore(
    subscribeWatchlist,
    getWatchlistSnapshot,
    getWatchlistServerSnapshot
  );
  const [watchFetch, setWatchFetch] = useState<Record<number, PageFetchState>>(
    {}
  );
  const [watchNoteState, setWatchNoteState] = useState<
    "idle" | "done" | "empty"
  >("idle");
  const watchNoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);
  /* In-flight refresh guard by index — refs, not render state, so a
     double click can't race a second fetch. */
  const watchInFlight = useRef<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  /* A failed "Generate debrief" is a real state change, but the button
     that triggered it sits at the bottom of a page that can run pages
     long (competitor/monitoring section expanded, etc.) while the
     error banner renders at the very top of the form. Without this,
     the error is silently invisible to anyone who doesn't manually
     scroll up — scroll it into view and focus it so it's impossible
     to miss. preventScroll on focus() avoids fighting the smooth
     scroll already in flight. */
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      errorRef.current.focus({ preventScroll: true });
    }
  }, [error]);

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
    /** Total of the spend column (display only — the API recomputes
     *  everything) and the file's reporting range, when present. */
    spendTotal: number | null;
    currency: string | null;
    dateRange: { start: string; stop: string } | null;
    /** Deduped ad names + their name-derived format tags, in file
     *  order — feeds the optional "Review creative formats" list.
     *  Structure only; no analysis. */
    ads: { name: string; tags: string[] }[];
  } | null>(null);
  /* "Review creative formats" list expansion past the first 25 ads —
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
        /* Display-only extras (the API recomputes everything): spend
           column total and the file's reporting range. */
        const spendIdx = columns.spend ? headers.indexOf(columns.spend) : -1;
        let spendTotal: number | null = null;
        if (spendIdx >= 0) {
          for (const row of matrix.slice(1)) {
            const v = parseNumericCell(row[spendIdx] ?? "");
            if (v != null) spendTotal = (spendTotal ?? 0) + v;
          }
        }
        const startIdx = columns.reportingStarts
          ? headers.indexOf(columns.reportingStarts)
          : -1;
        const stopIdx = columns.reportingEnds
          ? headers.indexOf(columns.reportingEnds)
          : -1;
        let dateRange: { start: string; stop: string } | null = null;
        if (startIdx >= 0 && stopIdx >= 0) {
          let start = "";
          let stop = "";
          for (const row of matrix.slice(1)) {
            const s = (row[startIdx] ?? "").trim();
            const e = (row[stopIdx] ?? "").trim();
            if (s !== "" && (start === "" || s < start)) start = s;
            if (e !== "" && (stop === "" || e > stop)) stop = e;
          }
          if (start !== "" && stop !== "") dateRange = { start, stop };
        }
        setPreviewState({
          forFile: file,
          rows: Math.max(0, matrix.length - 1),
          cols: headers.length,
          kpisFound,
          spendTotal,
          currency: columns.currency,
          dateRange,
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

  /* Market signal builder: chips → structured text in the notes field.
     Pure selection state until "Add selected signals to notes". */
  const toggleSignal = (chip: string) => {
    setSelectedSignals((prev) => {
      const next = new Set(prev);
      if (next.has(chip)) {
        next.delete(chip);
      } else {
        next.add(chip);
      }
      return next;
    });
    if (builderState !== "idle") setBuilderState("idle");
  };

  /* Presets FILL the selection; the user still reviews and appends. */
  const applyPreset = (chips: string[]) => {
    setSelectedSignals(new Set(chips));
    if (builderState !== "idle") setBuilderState("idle");
  };

  const clearSelectedSignals = () => {
    setSelectedSignals(new Set());
    if (builderState !== "idle") setBuilderState("idle");
  };

  const addSelectedSignals = () => {
    const block = formatSelectedSignals([...selectedSignals]);
    if (block === null) {
      setBuilderState("empty");
    } else {
      updateFields({
        marketContext: appendPageSignalsToNotes(fields.marketContext, block),
      });
      setBuilderState("done");
      setNoteState("idle");
    }
    if (builderTimer.current) clearTimeout(builderTimer.current);
    builderTimer.current = setTimeout(() => setBuilderState("idle"), 2500);
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

  /* ---- Competitor watchlist (browser-local, manual refresh only) ---- */

  const addWatchItem = () => {
    const current = getWatchlistSnapshot();
    if (current.length >= MAX_WATCHLIST_ITEMS) return;
    setWatchlist([...current, EMPTY_WATCHLIST_ITEM]);
  };

  const updateWatchItem = (index: number, patch: Partial<WatchlistItem>) => {
    setWatchlist(
      getWatchlistSnapshot().map((item, i) =>
        i === index ? { ...item, ...patch } : item
      )
    );
    if (watchNoteState !== "idle") setWatchNoteState("idle");
    if ("url" in patch && watchFetch[index]) {
      setWatchFetch((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  const removeWatchItem = (index: number) => {
    setWatchlist(getWatchlistSnapshot().filter((_, i) => i !== index));
    setWatchFetch((prev) => {
      const next: Record<number, PageFetchState> = {};
      for (const [key, value] of Object.entries(prev)) {
        const i = Number(key);
        if (i === index) continue;
        next[i > index ? i - 1 : i] = value;
      }
      return next;
    });
  };

  /* One manual refresh of one watchlist page — the same guarded
     one-time fetch route the sources use. The previous signals become
     the diff baseline; the new signals + timestamp are saved locally.
     Never runs unless the user just clicked. */
  const refreshWatchItem = async (index: number) => {
    const item = getWatchlistSnapshot()[index];
    const url = item?.url.trim() ?? "";
    if (url === "" || watchInFlight.current.has(index)) return;
    watchInFlight.current.add(index);
    setWatchFetch((prev) => ({ ...prev, [index]: { status: "loading" } }));
    let state: PageFetchState;
    try {
      const res = await fetch("/api/competitor/fetch-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data: FetchPageResponse = await res.json();
      if (data.ok === true) {
        setWatchlist(
          getWatchlistSnapshot().map((it, i) =>
            i === index
              ? {
                  ...it,
                  previousSignals: it.signals,
                  signals: data.signals ?? {},
                  refreshedAt: new Date().toISOString(),
                }
              : it
          )
        );
        state = { status: "done" };
      } else {
        state = {
          status: "error",
          title: typeof data.title === "string" ? data.title : "Refresh failed",
          message:
            typeof data.message === "string"
              ? data.message
              : "The page couldn't be fetched.",
          fix:
            typeof data.fix === "string"
              ? data.fix
              : "Try again, or paste the page's key points into the item's notes.",
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
    watchInFlight.current.delete(index);
    setWatchFetch((prev) => ({ ...prev, [index]: state }));
  };

  /* Sequential on purpose — one page at a time, and one item failing
     never stops the rest. */
  const refreshAllWatch = async () => {
    if (refreshingAll) return;
    setRefreshingAll(true);
    const count = getWatchlistSnapshot().length;
    for (let i = 0; i < count; i++) {
      if ((getWatchlistSnapshot()[i]?.url.trim() ?? "") !== "") {
        await refreshWatchItem(i);
      }
    }
    setRefreshingAll(false);
  };

  /* Appends the refreshed-signals block to the market notes — same
     append-dedupe semantics as everything else: existing notes kept,
     an identical block is a no-op. */
  const addWatchSignalsToNotes = () => {
    const watchlist = getWatchlistSnapshot();
    const refreshed = watchlist.filter((i) => i.signals !== null);
    if (refreshed.length === 0) {
      setWatchNoteState("empty");
    } else {
      // Build improved blocks for each refreshed item with signal summary
      let notes = fields.marketContext;
      for (const item of refreshed) {
        if (item.signals === null) continue;
        const summary = summarizePageSignals(item.signals);
        const changes = item.previousSignals
          ? groupSignalChanges(item.previousSignals, item.signals)
          : [];
        const block = formatCompetitorSignalNotes(
          item.signals,
          summary,
          changes,
          item.name || new URL(item.url).hostname,
          item.url,
          item.refreshedAt
        );
        notes = appendPageSignalsToNotes(notes, block);
      }
      updateFields({ marketContext: notes });
      setWatchNoteState("done");
      setNoteState("idle");
    }
    if (watchNoteTimer.current) clearTimeout(watchNoteTimer.current);
    watchNoteTimer.current = setTimeout(() => setWatchNoteState("idle"), 2500);
  };

  const clearWatchlist = () => {
    setWatchlist([]);
    setWatchFetch({});
    watchInFlight.current.clear();
    setWatchNoteState("idle");
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
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="mb-8 rounded-lg border border-red-400/20 bg-red-400/[0.06] px-4 py-3.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
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

      {/* The required path, stated once up front — everything else on
          this page is an optional enhancement. */}
      <p className="mb-10 border-l-2 border-accent/40 pl-3 text-xs leading-relaxed text-zinc-400">
        Required: load data, then fill in product / offer / goal below —
        everything else on this page is optional.
      </p>

      {/* space-y-14 is the one shared rhythm between stages — larger
          than any spacing used within a stage, so a stage boundary
          always reads as a bigger jump than a stage's own internal
          spacing. */}
      <div className="space-y-14">
        {/* ---- Stage 01 · Start here ---- */}
        <section>
          <StageHeader
            n="1"
            title="Start here"
            done={!!file}
            status={file ? "Complete" : "Required"}
            statusTone={file ? "accent" : "muted"}
            hint="Connect Meta, upload a CSV, or try the sample — pick one to begin."
          />

          {/* Three parallel entry paths, equal weight, one sentence each —
              CSV keeps the "Recommended" badge, sample is framed as the
              zero-setup option. Same handlers as before; layout only. */}
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
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
              className={`${methodTile} group relative cursor-pointer justify-between gap-4 overflow-hidden lg:min-h-48 focus-within:ring-2 focus-within:ring-accent/60 focus-within:ring-offset-2 focus-within:ring-offset-carbon ${
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
                    className={`h-3.5 w-3.5 ${dragging ? "text-accent-soft" : "text-zinc-400"}`}
                  />
                  CSV export
                </MethodLabel>
                <span className={badgeAccent}>Best for exports</span>
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
                <p className="mt-1 text-xs text-zinc-400">
                  Ad-level export, any column set — click to browse, max 5MB.
                </p>
              </div>
            </label>

            {/* The alternative: Meta as a real integration, not a
                side button. Status lives in the card header (hidden
                once connected — MetaConnect shows its own). */}
            <div className={`${methodTile} justify-between gap-4 lg:min-h-48`}>
              <div className="flex items-center justify-between gap-2">
                <MethodLabel>
                  <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04]">
                    <ZapIcon className="h-3.5 w-3.5 text-accent-soft" />
                  </span>
                  Meta Ads
                </MethodLabel>
                {metaStatus !== "connected" && (
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-400">
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

            {/* Method C: the sample dataset — zero setup, a full debrief
                to look at before committing to real data. Same
                loadSample/downloadSample handlers as before. */}
            <div
              className={`${methodTile} justify-between gap-4 lg:min-h-48`}
            >
              <div className="flex items-center justify-between gap-2">
                <MethodLabel>
                  <FlaskIcon className="h-3.5 w-3.5 text-accent-soft" />
                  Sample data
                </MethodLabel>
                <span className={badgeMuted}>No setup</span>
              </div>
              <p className="text-xs leading-relaxed text-zinc-400">
                See a full debrief on 14 synthetic ads — one click, nothing
                to upload.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={loadSample}
                  className={`w-full cursor-pointer ${btnSecondaryMd}`}
                >
                  Load sample into generator
                </button>
                <button
                  type="button"
                  onClick={downloadSample}
                  className="cursor-pointer self-start rounded-sm text-xs font-medium text-zinc-400 underline decoration-zinc-700 underline-offset-2 transition hover:text-accent-soft hover:decoration-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  Download sample CSV
                </button>
              </div>
            </div>
          </div>

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
                <span className="font-mono text-[11px] text-zinc-400">
                  {fmtBytes(file.size)} · ready
                </span>
                <button
                  type="button"
                  onClick={removeFile}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-sm text-xs font-medium text-zinc-400 transition hover:text-white"
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
                    ? `Detected ${preview.rows} row${preview.rows === 1 ? "" : "s"}, ${preview.cols} columns${
                        preview.spendTotal != null
                          ? ` · ${fmtMoney(preview.spendTotal, preview.currency)} total spend`
                          : ""
                      }${
                        preview.dateRange
                          ? ` · ${preview.dateRange.start} → ${preview.dateRange.stop}`
                          : ""
                      }. KPI columns: ${
                        preview.kpisFound.map((k) => KPI_LABELS[k]).join(", ") ||
                        "none detected"
                      } — ${KPI_LABELS[fields.kpi]} selected.`
                    : `${KPI_LABELS[fields.kpi]} was selected, but no ${KPI_LABELS[fields.kpi]}-like column was detected. You can still run, but Debrief may return a missing-column error.${
                        preview.kpisFound.length > 0
                          ? ` Columns found for: ${preview.kpisFound.map((k) => KPI_LABELS[k]).join(", ")}.`
                          : ""
                      }`}
                </p>
              )}
            </div>
          )}

          {/* Grouped tight to the cards above (help content is CSV-
              specific), not floating as its own section — the bigger
              gap belongs after this block, before Stage 2. */}
          <div className="mt-3 space-y-1.5">
            <details className="group border-l border-white/10 pl-3 open:border-accent/40">
              <summary className="cursor-pointer list-none py-0.5 text-xs font-medium text-zinc-400 transition hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 [&::-webkit-details-marker]:hidden">
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
              <summary className="cursor-pointer list-none py-0.5 text-xs font-medium text-zinc-400 transition hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 [&::-webkit-details-marker]:hidden">
                CSV requirements
              </summary>
              <div className="space-y-3 pb-2 pt-1.5 text-xs leading-relaxed text-zinc-400">
                <p className="text-zinc-400">
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
                  <p className="mt-1 font-mono text-[11px] leading-relaxed text-zinc-400">
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
                        <dd className="font-mono text-[11px] leading-relaxed text-zinc-400">
                          {aliases}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <p className="text-zinc-400">
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
            status={contextDone ? "Complete" : "Required"}
            statusTone={contextDone ? "accent" : "muted"}
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
                        : "text-zinc-400 hover:text-zinc-300"
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
                      className={`ml-1 ${active ? "text-accent-soft" : "text-zinc-400"}`}
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
          </div>
          <p className="mt-3 text-xs text-zinc-400">* Required.</p>

          {/* Optional refinements stay out of the required path: collapsed
              by default, auto-opened when either field already has content
              (a returning session, or a sample load that prefills creative
              notes). React re-applies `open` only when the computed value
              changes, so a manual toggle wins between renders. Values are
              preserved either way — collapsing only hides the inputs. */}
          <details
            open={
              fields.targetCpa.trim() !== "" ||
              fields.creativeNotes.trim() !== ""
            }
            className="group mt-4 rounded-xl border border-white/[0.07] bg-white/[0.04] open:border-white/[0.09]"
          >
            <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 [&::-webkit-details-marker]:hidden">
              <span className="text-sm font-semibold tracking-tight text-zinc-100">
                Refine analysis
              </span>
              <span className="text-xs text-zinc-400">Optional</span>
            </summary>
            <div className="border-t border-white/[0.06] px-4 pb-4 pt-3">
              <p className="text-xs text-zinc-400">
                Add targets or brand constraints only when they matter for
                this debrief.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
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
                    onChange={(e) =>
                      updateFields({ targetCpa: e.target.value })
                    }
                    placeholder="25"
                    className={`mt-1.5 ${inputBase}`}
                  />
                  <p className="mt-1.5 text-xs text-zinc-400">
                    Sharpens the spend gate when set.
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="creativeNotes" className={fieldLabel}>
                    Creative / brand constraints
                  </label>
                  <textarea
                    id="creativeNotes"
                    rows={2}
                    value={fields.creativeNotes}
                    onChange={(e) =>
                      updateFields({ creativeNotes: e.target.value })
                    }
                    placeholder="e.g. brand tone, country restrictions, segment limits, claims to avoid, required offer language"
                    className={`mt-1.5 resize-none ${inputBase}`}
                  />
                  <p className="mt-1.5 text-xs text-zinc-400">
                    Carries into creative briefs as guardrails — doesn&apos;t
                    affect scoring or ranking.
                  </p>
                </div>
              </div>

              {/* Evidence Inputs V1 — compact, fully optional test-quality
                  context. Default "not answered" (never "no"); answers
                  ONLY add honesty caveats to the report's evidence limits
                  — they never change the recommendation, ranking, or any
                  number. Kept light: three short dropdowns, one line of
                  help. */}
              <div className="mt-5 border-t border-white/[0.06] pt-4">
                <p className={fieldLabel}>Test quality (optional)</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Tells the report how much to trust the comparison. Answers
                  only add honesty notes — they never change the
                  recommendation or the numbers.
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="controlledTest" className={fieldLabel}>
                      Was this a controlled test?
                    </label>
                    <select
                      id="controlledTest"
                      value={fields.controlledTest}
                      onChange={(e) =>
                        updateFields({
                          controlledTest: e.target
                            .value as GeneratorFields["controlledTest"],
                        })
                      }
                      className={`mt-1.5 ${inputBase}`}
                    >
                      <option value="" className="bg-zinc-900">
                        Not answered
                      </option>
                      <option value="yes" className="bg-zinc-900">
                        Yes
                      </option>
                      <option value="no" className="bg-zinc-900">
                        No
                      </option>
                      <option value="unsure" className="bg-zinc-900">
                        Not sure
                      </option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="trackingChanged" className={fieldLabel}>
                      Did tracking change?
                    </label>
                    <select
                      id="trackingChanged"
                      value={fields.trackingChanged}
                      onChange={(e) =>
                        updateFields({
                          trackingChanged: e.target
                            .value as GeneratorFields["trackingChanged"],
                        })
                      }
                      className={`mt-1.5 ${inputBase}`}
                    >
                      <option value="" className="bg-zinc-900">
                        Not answered
                      </option>
                      <option value="yes" className="bg-zinc-900">
                        Yes
                      </option>
                      <option value="no" className="bg-zinc-900">
                        No
                      </option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="setupChanged" className={fieldLabel}>
                      Offer / page / audience / budget change?
                    </label>
                    <select
                      id="setupChanged"
                      value={fields.setupChanged}
                      onChange={(e) =>
                        updateFields({
                          setupChanged: e.target
                            .value as GeneratorFields["setupChanged"],
                        })
                      }
                      className={`mt-1.5 ${inputBase}`}
                    >
                      <option value="" className="bg-zinc-900">
                        Not answered
                      </option>
                      <option value="yes" className="bg-zinc-900">
                        Yes
                      </option>
                      <option value="no" className="bg-zinc-900">
                        No
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </details>

          {/* ONE consolidated, collapsed-by-default competitor/market
              area. The parent gate keeps all of this out of the
              first-time path; inside, three lettered sub-steps (A notes →
              B one-time page read → C manual watchlist) make the sequence
              obvious rather than presenting the mechanisms as equal peers.
              Everything here only ever becomes text in the market-notes
              field and never changes performance numbers. Auto-opens when
              any input already holds content (returning session / sample);
              React re-applies `open` only when the computed value changes,
              so a manual toggle wins between renders and entered values
              are always preserved when collapsed. */}
          <details
            open={
              fields.marketContext.trim() !== "" ||
              selectedSignals.size > 0 ||
              competitorSources.length > 0 ||
              watchlist.length > 0
            }
            className="group mt-8 rounded-xl border border-white/[0.07] bg-white/[0.04] open:border-white/[0.09]"
          >
            <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 [&::-webkit-details-marker]:hidden">
              <span className="text-sm font-semibold tracking-tight text-zinc-100">
                Competitor &amp; market context
              </span>
              <span className="text-xs text-zinc-400">Optional</span>
            </summary>
            <div className="border-t border-white/[0.06] px-4 pb-5 pt-4">
              <p className="text-xs leading-relaxed text-zinc-400">
                Add directional context only when it helps explain what to
                test next. It never changes performance metrics.
              </p>

              {/* A · Add or structure notes */}
              <p className="mt-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-300">
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 items-center justify-center rounded-md border border-white/12 font-mono text-[10px] text-accent-soft"
                >
                  A
                </span>
                Add or structure notes
              </p>

              <div className="mt-3">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="marketContext" className={fieldLabel}>
                    Market / competitor notes
                  </label>
                  <button
                    type="button"
                    onClick={structureNotes}
                    title="Use after adding rough notes or competitor sources."
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
                      : marketQuality?.level === "strong"
                        ? "font-medium text-accent-soft"
                        : marketQuality
                          ? "text-zinc-300"
                          : "text-zinc-400"
                  }`}
                >
                  {noteState === "empty"
                    ? "Add competitor notes or links first."
                    : marketQuality
                      ? `Market context: ${marketQuality.summary}`
                      : "Market context: Optional — add notes, selected signals, competitor sources, or watchlist signals to improve creative test suggestions."}
                </p>
              </div>

              {/* Market signal builder: guided chips → the same notes
                  field. Selection is UI state only until the user clicks
                  "Add selected signals to notes". Collapsed by default,
                  auto-opens once something is selected so a returning user
                  doesn't lose sight of their picks. */}
              <details
                open={selectedSignals.size > 0}
                className="group mt-3 rounded-lg border border-white/[0.05] bg-white/[0.02] open:border-white/[0.09]"
              >
                <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 [&::-webkit-details-marker]:hidden">
                  <span className="text-[13px] font-semibold tracking-tight text-zinc-100">
                    Market signal builder
                  </span>
                  <span className="text-xs text-zinc-400">
                    Optional — turn what you notice into structured notes.
                  </span>
                  {selectedSignals.size > 0 && (
                    <span className="ml-auto font-mono text-[11px] tabular-nums text-accent-soft">
                      {selectedSignals.size} selected
                    </span>
                  )}
                </summary>
                <div className="border-t border-white/[0.06] px-4 pb-4 pt-3">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-400">
                    Examples:
                    {SIGNAL_PRESETS.map((preset) => (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => applyPreset(preset.chips)}
                        className="cursor-pointer rounded-sm font-medium text-zinc-400 underline decoration-zinc-700 underline-offset-2 transition hover:text-accent-soft hover:decoration-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </p>

                  <div className="mt-3 space-y-3">
                    {SIGNAL_BUILDER_GROUPS.map((group) => (
                      <div key={group.key}>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                          {group.label}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {group.chips.map((chip) => {
                            const active = selectedSignals.has(chip);
                            return (
                              <button
                                key={chip}
                                type="button"
                                aria-pressed={active}
                                onClick={() => toggleSignal(chip)}
                                className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                                  active
                                    ? "border-accent bg-accent/15 font-semibold text-accent-soft"
                                    : "border-white/10 font-medium text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                                }`}
                              >
                                {chip}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <button
                      type="button"
                      onClick={addSelectedSignals}
                      className={`min-w-[12rem] cursor-pointer ${btnSecondary}`}
                    >
                      {builderState === "done" ? (
                        <span className="flex items-center gap-1.5 motion-safe:animate-settle">
                          <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                          Added to notes
                        </span>
                      ) : (
                        `Add selected signals to notes${selectedSignals.size > 0 ? ` (${selectedSignals.size})` : ""}`
                      )}
                    </button>
                    {selectedSignals.size > 0 && (
                      <button
                        type="button"
                        onClick={clearSelectedSignals}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-sm text-xs font-medium text-zinc-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                      >
                        <XIcon className="h-3 w-3" />
                        Clear selected signals
                      </button>
                    )}
                    {builderState === "empty" && (
                      <p aria-live="polite" className="text-xs text-amber-300">
                        Select at least one signal first.
                      </p>
                    )}
                  </div>
                </div>
              </details>

              {/* B · Read a competitor page once */}
              <p className="mt-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-300">
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 items-center justify-center rounded-md border border-white/12 font-mono text-[10px] text-accent-soft"
                >
                  B
                </span>
                Read a competitor page once
              </p>

            {/* Competitor sources: structured input that only ever
                becomes text in the notes field above. A landing-page
                URL can be fetched ONCE via the explicit "Fetch page
                signals" button — never automatically, never
                monitored. */}
            <div className="mt-3">
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
                      title="Adds competitor source details into the notes above. Existing notes are kept."
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
                      className="rounded-lg border border-white/[0.07] bg-white/[0.04] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                          Source {i + 1}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeSource(i)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-sm text-xs font-medium text-zinc-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
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
                              <span className="text-zinc-400">
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
                  sourceState === "empty" ? "text-amber-300" : "text-zinc-400"
                }`}
              >
                {sourceState === "empty"
                  ? "Add a competitor name, link, or note first."
                  : competitorSources.length === 0
                    ? "One-off context for this debrief — paste notes, Ads Library examples, or fetch one page for this report."
                    : `“Use as market notes” adds competitor source details into the notes above — existing notes are kept. Up to ${MAX_COMPETITOR_SOURCES} sources.`}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                &ldquo;Fetch page signals&rdquo; reads the public page once,
                when you click — nothing is stored on our servers and the
                fetch is never repeated automatically, no Ads Library
                fetching, and no competitor-performance inference.
              </p>
            </div>

              {/* C · Track selected competitors manually */}
              <p className="mt-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-300">
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 items-center justify-center rounded-md border border-white/12 font-mono text-[10px] text-accent-soft"
                >
                  C
                </span>
                Track selected competitors manually
              </p>

            {/* Competitor watchlist: up to 5 pages saved in THIS
                browser (localStorage; session memory if unavailable),
                refreshed only by explicit clicks through the same
                guarded fetch route. Signals reach the report only via
                "Add refreshed signals to market notes". */}
            <div className="mt-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className={fieldLabel}>Competitor watchlist</p>
                <div className="flex flex-wrap items-center gap-2">
                  {watchlist.length < MAX_WATCHLIST_ITEMS && (
                    <button
                      type="button"
                      onClick={addWatchItem}
                      className={`cursor-pointer ${btnSecondary}`}
                    >
                      Add watchlist item
                    </button>
                  )}
                  {watchlist.some((w) => w.url.trim() !== "") && (
                    <button
                      type="button"
                      onClick={() => void refreshAllWatch()}
                      disabled={refreshingAll}
                      className={`cursor-pointer ${btnSecondary}`}
                    >
                      {refreshingAll ? (
                        <span className="motion-safe:animate-pulse">
                          Refreshing…
                        </span>
                      ) : (
                        "Refresh all"
                      )}
                    </button>
                  )}
                  {watchlist.some((w) => w.signals !== null) && (
                    <button
                      type="button"
                      onClick={addWatchSignalsToNotes}
                      className={`cursor-pointer ${btnSecondary}`}
                      title="Appends the refreshed signals to the market notes above. Existing notes are kept."
                    >
                      {watchNoteState === "done" ? (
                        <span className="flex items-center gap-1.5 motion-safe:animate-settle">
                          <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                          Added to notes
                        </span>
                      ) : (
                        "Add refreshed signals to market notes"
                      )}
                    </button>
                  )}
                  {watchlist.length > 0 && (
                    <button
                      type="button"
                      onClick={clearWatchlist}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-sm text-xs font-medium text-zinc-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                    >
                      <XIcon className="h-3 w-3" />
                      Clear watchlist
                    </button>
                  )}
                </div>
              </div>

              {watchlist.length > 0 && (
                <div className="mt-2.5 space-y-3">
                  {watchlist.map((item, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-white/[0.07] bg-white/[0.04] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                          Watch {i + 1}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeWatchItem(i)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-sm text-xs font-medium text-zinc-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                        >
                          <XIcon className="h-3 w-3" />
                          Remove
                        </button>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor={`watch-name-${i}`}
                            className={fieldLabel}
                          >
                            Competitor name
                          </label>
                          <input
                            id={`watch-name-${i}`}
                            value={item.name}
                            onChange={(e) =>
                              updateWatchItem(i, { name: e.target.value })
                            }
                            placeholder="The Ordinary"
                            className={`mt-1.5 ${inputBase}`}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`watch-url-${i}`}
                            className={fieldLabel}
                          >
                            Website / landing page URL
                          </label>
                          <div className="mt-1.5 flex gap-2">
                            <input
                              id={`watch-url-${i}`}
                              value={item.url}
                              onChange={(e) =>
                                updateWatchItem(i, { url: e.target.value })
                              }
                              placeholder="https://example.com"
                              className={`min-w-0 flex-1 ${inputBase}`}
                            />
                            <button
                              type="button"
                              onClick={() => void refreshWatchItem(i)}
                              disabled={
                                item.url.trim() === "" ||
                                watchFetch[i]?.status === "loading"
                              }
                              className={`shrink-0 cursor-pointer ${btnSecondary}`}
                            >
                              {watchFetch[i]?.status === "loading" ? (
                                <span className="motion-safe:animate-pulse">
                                  Refreshing…
                                </span>
                              ) : watchFetch[i]?.status === "done" ? (
                                <span className="flex items-center gap-1.5 motion-safe:animate-settle">
                                  <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                                  Refreshed
                                </span>
                              ) : (
                                "Refresh signals"
                              )}
                            </button>
                          </div>
                          {watchFetch[i]?.status === "error" && (
                            <p
                              role="alert"
                              className="mt-1.5 text-xs leading-relaxed text-amber-300"
                            >
                              {watchFetch[i].title}: {watchFetch[i].message}{" "}
                              <span className="text-zinc-400">
                                {watchFetch[i].fix}
                              </span>
                            </p>
                          )}
                        </div>
                        <div className="sm:col-span-2">
                          <label
                            htmlFor={`watch-notes-${i}`}
                            className={fieldLabel}
                          >
                            Notes
                          </label>
                          <textarea
                            id={`watch-notes-${i}`}
                            rows={2}
                            value={item.notes}
                            onChange={(e) =>
                              updateWatchItem(i, { notes: e.target.value })
                            }
                            placeholder="Why this competitor matters"
                            className={`mt-1.5 resize-none ${inputBase}`}
                          />
                        </div>
                      </div>

                      {/* Improved result card: signal summary + raw signals + grouped changes */}
                      {item.signals && (
                        <div className="mt-3 border-t border-white/[0.06] pt-3">
                          {item.refreshedAt && (
                            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-400">
                              Last refreshed:{" "}
                              {new Date(item.refreshedAt).toLocaleString()}
                            </p>
                          )}

                          {/* Signal Summary: interpreted categories */}
                          {(() => {
                            const summary = summarizePageSignals(item.signals);
                            return (
                              <div className="mt-2.5 space-y-1.5 rounded border border-accent/20 bg-accent/[0.04] p-2.5">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-soft">
                                  Interpretation (signal strength:{" "}
                                  {summary.signalStrength})
                                </p>
                                <ul className="space-y-1 text-xs leading-relaxed text-zinc-400">
                                  <li>
                                    <strong>Angle / message:</strong>{" "}
                                    {summary.angleOrMessage}
                                  </li>
                                  <li>
                                    <strong>Offer / CTA pattern:</strong>{" "}
                                    {summary.offerCTAPattern}
                                  </li>
                                  <li>
                                    <strong>Proof / trust pattern:</strong>{" "}
                                    {summary.proofTrustPattern}
                                  </li>
                                  <li>
                                    <strong>Landing page emphasis:</strong>{" "}
                                    {summary.landingPageEmphasis}
                                  </li>
                                  <li>
                                    <strong>Creative inspiration:</strong>{" "}
                                    {summary.creativeInspiration}
                                  </li>
                                </ul>
                              </div>
                            );
                          })()}

                          {/* Raw Observed Signals: collapsible for detail */}
                          <details className="mt-2.5">
                            <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400 hover:text-zinc-300">
                              Raw observed signals
                            </summary>
                            <ul className="mt-1 space-y-1 text-xs leading-relaxed text-zinc-400">
                              {item.signals.headline && (
                                <li>Headline: {item.signals.headline}</li>
                              )}
                              {(item.signals.offer || item.signals.cta) && (
                                <li>
                                  CTA / offer:{" "}
                                  {[
                                    item.signals.offer,
                                    item.signals.cta
                                      ? `CTA "${item.signals.cta}"`
                                      : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </li>
                              )}
                              {item.signals.positioning && (
                                <li>
                                  Positioning: {item.signals.positioning}
                                </li>
                              )}
                              {item.signals.benefits &&
                                item.signals.benefits.length > 0 && (
                                  <li>
                                    Claims / benefits:{" "}
                                    {item.signals.benefits.join(", ")}
                                  </li>
                                )}
                              {item.signals.trustSignals &&
                                item.signals.trustSignals.length > 0 && (
                                  <li>
                                    Trust signals:{" "}
                                    {item.signals.trustSignals.join(", ")}
                                  </li>
                                )}
                            </ul>
                          </details>

                          {/* Grouped Changes: with explanations */}
                          {item.previousSignals && (
                            <div className="mt-2.5">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                                Changes since last refresh
                              </p>
                              <ul className="mt-1 space-y-1.5 text-xs leading-relaxed text-zinc-400">
                                {groupSignalChanges(
                                  item.previousSignals,
                                  item.signals
                                ).map((group) => (
                                  <li key={group.category}>
                                    <div className="font-medium text-zinc-400">
                                      {group.category}
                                    </div>
                                    <div className="mt-0.5 ml-2 space-y-0.5">
                                      {group.changes.map((change) => (
                                        <div
                                          key={change}
                                          className="text-zinc-400"
                                        >
                                          – {change}
                                        </div>
                                      ))}
                                      <div className="text-zinc-400 italic">
                                        → {group.whyItMatters}
                                      </div>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <p
                aria-live="polite"
                className={`mt-1.5 text-xs leading-relaxed ${
                  watchNoteState === "empty" ? "text-amber-300" : "text-zinc-400"
                }`}
              >
                {watchNoteState === "empty"
                  ? "Refresh at least one competitor page first."
                  : "Local watchlist for later — keep a few competitor pages in this browser and manually refresh them when needed."}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                The watchlist is stored locally in this browser only — Debrief
                does not save it on a server, and nothing is sent to the
                report until you add it to market notes. It never refreshes
                by itself; the separate weekly-monitoring beta below is the
                only thing that checks pages on a schedule, and only for
                URLs you explicitly add to it.
              </p>
            </div>

              {/* D · Optional server-side monitoring beta. The ONLY
                  core→monitoring touchpoint is this mount: flag off ⇒
                  the section renders nothing; any monitoring failure ⇒
                  the boundary's inline card. Deleting the beta =
                  removing this block + the two imports. */}
              <p className="mt-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-300">
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 items-center justify-center rounded-md border border-white/12 font-mono text-[10px] text-accent-soft"
                >
                  D
                </span>
                Monitor weekly (beta)
              </p>
              <div className="mt-3">
                <MonitoringErrorBoundary>
                  <MonitoringSection />
                </MonitoringErrorBoundary>
              </div>
            </div>
          </details>
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
            status={
              Object.keys(formatOverrides).length > 0
                ? "Complete"
                : "Optional accuracy step"
            }
            statusTone={
              Object.keys(formatOverrides).length > 0 ? "accent" : "muted"
            }
            hint="Debrief auto-detects creative formats from ad names. Review or edit only if something looks wrong."
          />
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            {preview &&
            preview.ads.length > 0 &&
            Object.keys(formatOverrides).length === 0
              ? "Auto-detected — Debrief will use ad names unless you edit formats."
              : "Recommended for better pattern detection, but not required."}
          </p>
          {preview && preview.ads.length > 0 ? (
            <details className="group mt-3 rounded-xl border border-white/[0.07] bg-white/[0.04] open:border-white/[0.09]">
              <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 [&::-webkit-details-marker]:hidden">
                <span className="text-sm font-semibold tracking-tight text-zinc-100">
                  Review creative formats
                </span>
                <span className="text-xs text-zinc-400">
                  Auto-detected from ad names — edit anything that looks
                  wrong.
                </span>
                <span className="ml-auto font-mono text-[11px] tabular-nums text-zinc-400">
                  {Object.keys(formatOverrides).length > 0
                    ? `${Object.keys(formatOverrides).length} edited`
                    : `${preview.ads.length} ad${preview.ads.length === 1 ? "" : "s"}`}
                </span>
              </summary>
              <div className="border-t border-white/[0.06] px-5 pb-5">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[540px] text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left">
                        <th className="py-2 pr-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                          Ad name
                        </th>
                        <th className="py-2 pr-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
                          Detected format
                        </th>
                        <th className="w-52 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
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
                          <td className="py-2.5 pr-4 align-middle text-xs text-zinc-400">
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
                      <p className="text-xs text-zinc-400">
                        Showing the first 25 of {preview.ads.length} ads.
                      </p>
                    )}
                  </div>
                )}
                {Object.keys(formatOverrides).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFormatOverrides({})}
                    className="mt-3 inline-flex cursor-pointer items-center gap-1 rounded-sm text-xs font-medium text-zinc-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                  >
                    <XIcon className="h-3 w-3" />
                    Clear all format edits
                  </button>
                )}
                <p className="mt-3 text-xs leading-relaxed text-zinc-400">
                  Auto-detected formats are used by default. Your edits
                  improve pattern wording but do not change performance
                  numbers.
                </p>
              </div>
            </details>
          ) : (
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">
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
            status={canSubmit ? "Ready" : undefined}
            statusTone="accent"
          />
          {/* What happens next — one compact line, shown once. */}
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-zinc-400">
            Generates a buyer memo, client report, next tests, and creative
            briefs from what you loaded above.
          </p>
          <div className="mt-4 flex flex-col gap-4 rounded-xl border border-white/[0.07] bg-white/[0.04] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[13px] leading-relaxed text-zinc-400">
                {file ? (
                  <>
                    <span className="font-mono text-zinc-200">{file.name}</span>
                    {" · "}
                    {KPI_OPTIONS.find((o) => o.value === fields.kpi)?.label}
                    {contextDone
                      ? " · ready"
                      : " · fill product, offer, and goal in stage 2"}
                  </>
                ) : (
                  "Load data in stage 1 to run."
                )}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
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
