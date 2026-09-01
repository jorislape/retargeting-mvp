"use client";

import {
  Dispatch,
  ReactNode,
  SetStateAction,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CompetitorSource,
  CreativeFormatOverrides,
  DebriefApiError,
  KpiKey,
  Memo,
} from "@/modules/debrief";
import { validateLogoFile } from "@/components/report/logoValidation";

/** Creative Evidence V1 — one attached creative image, keyed by
 *  normalized ad name. Browser-only: `url` is either an object URL
 *  (manual attach — created/revoked here) or a same-origin public
 *  path (the sample's bundled demo creatives). Never sent to any API,
 *  never part of the memo — presentation over existing evidence. */
export interface CreativeAssetRef {
  url: string;
  /** Original filename (manual) or a demo label (sample) — used for
   *  alt/replace UI, never rendered as report content. */
  name: string;
}

/* ------------------------------------------------------------------ */
/* Session state for the generator, lifted to the workspace layout so  */
/* a generated report survives client-side navigation between          */
/* sections. Deliberately React state only: no localStorage, no        */
/* cookies, no storage APIs — a refresh wipes everything, which is the */
/* product's privacy guarantee, not a limitation.                      */
/* ------------------------------------------------------------------ */

export interface GeneratorFields {
  kpi: KpiKey;
  /** Report-identification/framing only — required so the report has a
   *  label, but never analyzed and never affects scoring. */
  product: string;
  /** Report/framing context only — optional; empty uses a neutral
   *  fallback ("the current offer"). Never interpreted. */
  offer: string;
  targetCpa: string;
  /** Define/Context Foundation V1 — the ROAS analog to targetCpa.
   *  Display + success-criterion wording only; never feeds the spend
   *  gate. Empty = not supplied. */
  targetRoas: string;
  creativeNotes: string;
  /** Optional pasted market/competitor notes — never required. */
  marketContext: string;
  /* Evidence Inputs V1 — optional test-quality self-report. Default
     "unanswered"; never required, and an unanswered set is a full no-op
     on the memo (only appends limits lines when explicitly answered). */
  controlledTest: "" | "yes" | "no" | "unsure";
  trackingChanged: "" | "yes" | "no";
  setupChanged: "" | "yes" | "no";
  /* Input Honesty V1 — optional structured objective. Default "not
     specified"; a full no-op on the memo unless explicitly set, and
     even then it only frames wording / appends limits caveats — it
     never changes action, evidenceState, ranking, or any number. */
  objective: "" | "efficiency" | "growth" | "learning";
  /* Decision Criteria V2 — the user's own decision bars, both optional.
     spendGateOverride replaces the default evidence gate; minOutcomeCount
     is the minimum purchases/leads on the leading ad before a scaling
     move is recommended (only applied when the export can verify it).
     Empty = Debrief defaults. */
  spendGateOverride: string;
  minOutcomeCount: string;
  /* Evidence Sufficiency V1 — Brief Readiness's own two criteria.
     Separate from minOutcomeCount above (a different question — is an
     observed win/loss worth briefing creative against, not whether
     the scale/shift budget action fires). Empty = Debrief's own
     disclosed practitioner-informed default applies, never a silent
     no-op the way an empty minOutcomeCount is. */
  minBriefOutcomeCount: string;
  minLossSpendMultiple: string;
}

/* Competitor sources are an input aid for the market-notes field, not
   a request field: they reach the engine only after the user merges
   them into marketContext ("Use as market notes"). Same privacy rules
   as everything else here — React state only, gone on refresh. The
   URLs they hold are fetched ONLY by the explicit one-time "Fetch page
   signals" action (POST /api/competitor/fetch-page) — never
   automatically, never monitored, never stored. */

export type GeneratorStatus = "idle" | "processing" | "ready";

const DEFAULT_FIELDS: GeneratorFields = {
  kpi: "roas",
  product: "",
  offer: "",
  targetCpa: "",
  targetRoas: "",
  creativeNotes: "",
  marketContext: "",
  controlledTest: "",
  trackingChanged: "",
  setupChanged: "",
  objective: "",
  spendGateOverride: "",
  minOutcomeCount: "",
  minBriefOutcomeCount: "",
  minLossSpendMultiple: "",
};

/* The engine is deterministic and fast (~50ms); a sub-100ms flash of
   "processing" reads as a glitch. A short floor keeps the staged
   status readable without faking work beyond that. */
const MIN_PROCESSING_MS = 1200;

/** Anything the API hands back that isn't already a structured error
 *  (legacy strings, malformed bodies) becomes one, so the UI always
 *  renders the same guide-shaped block. */
function normalizeError(raw: unknown): DebriefApiError {
  if (
    raw !== null &&
    typeof raw === "object" &&
    typeof (raw as DebriefApiError).title === "string" &&
    typeof (raw as DebriefApiError).message === "string"
  ) {
    return raw as DebriefApiError;
  }
  return {
    title: "Something went wrong",
    message:
      typeof raw === "string" && raw.trim() !== ""
        ? raw
        : "The debrief couldn't be generated.",
    fix: "Try again — if it keeps happening, re-export the CSV from Meta Ads Manager.",
  };
}

interface DebriefContextValue {
  status: GeneratorStatus;
  file: File | null;
  /** Period Comparison V2 — optional previous-period CSV. Independent
   *  of the primary file (swapping the primary keeps it; the API's
   *  currency check guards against mismatched accounts). Same privacy
   *  rules: React state only, gone on refresh, sent per-request. */
  previousFile: File | null;
  fields: GeneratorFields;
  competitorSources: CompetitorSource[];
  /** Creative Format Confirmation: ad name → confirmed format tag.
   *  Keyed to the loaded file — changing the file clears them. Sent to
   *  the API as an optional JSON field; never stored anywhere. */
  formatOverrides: CreativeFormatOverrides;
  /** Creative Evidence V1: normalized ad name → attached creative
   *  image. Browser-only; cleared (and object URLs revoked) whenever
   *  the file changes, on reset, and on unmount. NEVER appended to the
   *  /api/debrief request. */
  creativeAssets: Record<string, CreativeAssetRef>;
  memo: Memo | null;
  error: DebriefApiError | null;
  generatedAt: number | null;
  setFile: (file: File | null) => void;
  setPreviousFile: (file: File | null) => void;
  updateFields: (patch: Partial<GeneratorFields>) => void;
  setCompetitorSources: Dispatch<SetStateAction<CompetitorSource[]>>;
  setFormatOverrides: (overrides: CreativeFormatOverrides) => void;
  /** Attach (File), replace (File), or remove (null) one ad's creative
   *  image. Validates via the shared image rules; returns the result so
   *  the Verify UI can show an inline error. `key` must already be the
   *  normalized ad name (normalizeAdName). */
  setCreativeAsset: (key: string, file: File | null) => { ok: boolean; error?: string };
  /** Bulk-set non-blob assets (the sample's bundled demo creatives).
   *  Replaces the whole map; revokes any existing object URLs first. */
  setSampleCreativeAssets: (assets: Record<string, CreativeAssetRef>) => void;
  generate: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const DebriefContext = createContext<DebriefContextValue | null>(null);

export function DebriefProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GeneratorStatus>("idle");
  const [file, setFileState] = useState<File | null>(null);
  const [fields, setFields] = useState<GeneratorFields>(DEFAULT_FIELDS);
  const [competitorSources, setCompetitorSources] = useState<
    CompetitorSource[]
  >([]);
  const [formatOverrides, setFormatOverrides] =
    useState<CreativeFormatOverrides>({});

  /* Creative Evidence V1 — attached images, keyed by normalized ad
     name. Object URLs are tracked in a ref so every path that discards
     an entry (replace, remove, file change, reset, unmount) revokes
     it; sample assets are public paths (not blob:) and are skipped by
     the revoker. */
  const [creativeAssets, setCreativeAssetsState] = useState<
    Record<string, CreativeAssetRef>
  >({});
  const creativeAssetsRef = useRef(creativeAssets);
  useEffect(() => {
    creativeAssetsRef.current = creativeAssets;
  }, [creativeAssets]);
  const revokeAsset = (asset: CreativeAssetRef | undefined) => {
    if (asset && asset.url.startsWith("blob:")) URL.revokeObjectURL(asset.url);
  };
  const clearCreativeAssets = useCallback(() => {
    for (const asset of Object.values(creativeAssetsRef.current)) revokeAsset(asset);
    setCreativeAssetsState({});
  }, []);
  // Unmount-only cleanup — reads the ref, so it revokes whatever is
  // current at teardown without re-running mid-life.
  useEffect(() => {
    return () => {
      for (const asset of Object.values(creativeAssetsRef.current)) revokeAsset(asset);
    };
  }, []);

  const setCreativeAsset = useCallback(
    (key: string, nextFile: File | null): { ok: boolean; error?: string } => {
      if (nextFile === null) {
        setCreativeAssetsState((prev) => {
          revokeAsset(prev[key]);
          const next = { ...prev };
          delete next[key];
          return next;
        });
        return { ok: true };
      }
      const result = validateLogoFile(nextFile);
      if (!result.ok) return result;
      const url = URL.createObjectURL(nextFile);
      setCreativeAssetsState((prev) => {
        revokeAsset(prev[key]);
        return { ...prev, [key]: { url, name: nextFile.name } };
      });
      return { ok: true };
    },
    []
  );

  const setSampleCreativeAssets = useCallback(
    (assets: Record<string, CreativeAssetRef>) => {
      setCreativeAssetsState((prev) => {
        for (const asset of Object.values(prev)) revokeAsset(asset);
        return { ...assets };
      });
    },
    []
  );

  /* Format confirmations and attached creatives describe the loaded
     CSV's ads by name — a different file makes them stale (or wrongly
     matching), so any file change clears both. */
  const setFile = useCallback(
    (next: File | null) => {
      setFileState(next);
      setFormatOverrides({});
      clearCreativeAssets();
    },
    [clearCreativeAssets]
  );
  const [previousFile, setPreviousFile] = useState<File | null>(null);
  const [memo, setMemo] = useState<Memo | null>(null);
  const [error, setError] = useState<DebriefApiError | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);

  const updateFields = useCallback((patch: Partial<GeneratorFields>) => {
    setFields((prev) => ({ ...prev, ...patch }));
  }, []);

  const generate = useCallback(async () => {
    if (!file) return;
    setError(null);
    setStatus("processing");
    const started = Date.now();

    const body = new FormData();
    body.append("csv", file);
    body.append("kpi", fields.kpi);
    body.append("product", fields.product);
    body.append("offer", fields.offer);
    if (fields.targetCpa.trim() !== "") body.append("targetCpa", fields.targetCpa);
    if (fields.targetRoas.trim() !== "") body.append("targetRoas", fields.targetRoas);
    body.append("creativeNotes", fields.creativeNotes);
    body.append("marketContext", fields.marketContext);
    // Evidence Inputs V1: send test-quality answers only when the user
    // actually picked one. An unanswered field is never sent, so the
    // server treats it as undefined = no-op (memo byte-identical).
    if (fields.controlledTest !== "") body.append("controlledTest", fields.controlledTest);
    if (fields.trackingChanged !== "") body.append("trackingChanged", fields.trackingChanged);
    if (fields.setupChanged !== "") body.append("setupChanged", fields.setupChanged);
    // Input Honesty V1: same "send only when set" no-op contract.
    if (fields.objective !== "") body.append("objective", fields.objective);
    // Decision Criteria V2: same contract — sent only when set.
    if (fields.spendGateOverride.trim() !== "") {
      body.append("spendGateOverride", fields.spendGateOverride);
    }
    if (fields.minOutcomeCount.trim() !== "") {
      body.append("minOutcomeCount", fields.minOutcomeCount);
    }
    // Evidence Sufficiency V1: same "send only when set" contract.
    if (fields.minBriefOutcomeCount.trim() !== "") {
      body.append("minBriefOutcomeCount", fields.minBriefOutcomeCount);
    }
    if (fields.minLossSpendMultiple.trim() !== "") {
      body.append("minLossSpendMultiple", fields.minLossSpendMultiple);
    }
    // Period Comparison V2: the optional previous-period file.
    if (previousFile) body.append("previousCsv", previousFile);
    if (Object.keys(formatOverrides).length > 0) {
      body.append("creativeFormatOverrides", JSON.stringify(formatOverrides));
    }

    try {
      const res = await fetch("/api/debrief", { method: "POST", body });
      const data = await res.json();

      const elapsed = Date.now() - started;
      if (elapsed < MIN_PROCESSING_MS) {
        await new Promise((r) => setTimeout(r, MIN_PROCESSING_MS - elapsed));
      }

      if (!data.ok) {
        setError(normalizeError(data.error));
        setStatus("idle");
        return;
      }
      setMemo(data.memo);
      setGeneratedAt(Date.now());
      setStatus("ready");
    } catch {
      setError({
        title: "Network error",
        message: "The request didn't reach Debrief.",
        fix: "Check your connection and try again.",
      });
      setStatus("idle");
    }
  }, [file, previousFile, fields, formatOverrides]);

  const clearError = useCallback(() => setError(null), []);

  const reset = useCallback(() => {
    setStatus("idle");
    setFileState(null);
    setPreviousFile(null);
    setFields(DEFAULT_FIELDS);
    setCompetitorSources([]);
    setFormatOverrides({});
    clearCreativeAssets();
    setMemo(null);
    setError(null);
    setGeneratedAt(null);
  }, [clearCreativeAssets]);

  const value = useMemo(
    () => ({
      status,
      file,
      previousFile,
      fields,
      competitorSources,
      formatOverrides,
      creativeAssets,
      memo,
      error,
      generatedAt,
      setFile,
      setPreviousFile,
      updateFields,
      setCompetitorSources,
      setFormatOverrides,
      setCreativeAsset,
      setSampleCreativeAssets,
      generate,
      clearError,
      reset,
    }),
    [status, file, previousFile, fields, competitorSources, formatOverrides, creativeAssets, memo, error, generatedAt, setFile, updateFields, setCreativeAsset, setSampleCreativeAssets, generate, clearError, reset]
  );

  return (
    <DebriefContext.Provider value={value}>{children}</DebriefContext.Provider>
  );
}

export function useDebrief(): DebriefContextValue {
  const ctx = useContext(DebriefContext);
  if (!ctx) throw new Error("useDebrief must be used inside DebriefProvider");
  return ctx;
}
