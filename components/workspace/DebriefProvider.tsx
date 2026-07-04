"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { KpiKey, Memo } from "@/modules/debrief";

/* ------------------------------------------------------------------ */
/* Session state for the generator, lifted to the workspace layout so  */
/* a generated report survives client-side navigation between          */
/* sections. Deliberately React state only: no localStorage, no        */
/* cookies, no storage APIs — a refresh wipes everything, which is the */
/* product's privacy guarantee, not a limitation.                      */
/* ------------------------------------------------------------------ */

export interface GeneratorFields {
  kpi: KpiKey;
  product: string;
  offer: string;
  goal: string;
  targetCpa: string;
  creativeNotes: string;
  /** Optional pasted market/competitor notes — never required. */
  marketContext: string;
}

export type GeneratorStatus = "idle" | "processing" | "ready";

const DEFAULT_FIELDS: GeneratorFields = {
  kpi: "roas",
  product: "",
  offer: "",
  goal: "",
  targetCpa: "",
  creativeNotes: "",
  marketContext: "",
};

/* The engine is deterministic and fast (~50ms); a sub-100ms flash of
   "processing" reads as a glitch. A short floor keeps the staged
   status readable without faking work beyond that. */
const MIN_PROCESSING_MS = 1200;

interface DebriefContextValue {
  status: GeneratorStatus;
  file: File | null;
  fields: GeneratorFields;
  memo: Memo | null;
  error: string | null;
  generatedAt: number | null;
  setFile: (file: File | null) => void;
  updateFields: (patch: Partial<GeneratorFields>) => void;
  generate: () => Promise<void>;
  reset: () => void;
}

const DebriefContext = createContext<DebriefContextValue | null>(null);

export function DebriefProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GeneratorStatus>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<GeneratorFields>(DEFAULT_FIELDS);
  const [memo, setMemo] = useState<Memo | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    body.append("goal", fields.goal);
    if (fields.targetCpa.trim() !== "") body.append("targetCpa", fields.targetCpa);
    body.append("creativeNotes", fields.creativeNotes);
    body.append("marketContext", fields.marketContext);

    try {
      const res = await fetch("/api/debrief", { method: "POST", body });
      const data = await res.json();

      const elapsed = Date.now() - started;
      if (elapsed < MIN_PROCESSING_MS) {
        await new Promise((r) => setTimeout(r, MIN_PROCESSING_MS - elapsed));
      }

      if (!data.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setStatus("idle");
        return;
      }
      setMemo(data.memo);
      setGeneratedAt(Date.now());
      setStatus("ready");
    } catch {
      setError("Network error — check your connection and try again.");
      setStatus("idle");
    }
  }, [file, fields]);

  const reset = useCallback(() => {
    setStatus("idle");
    setFile(null);
    setFields(DEFAULT_FIELDS);
    setMemo(null);
    setError(null);
    setGeneratedAt(null);
  }, []);

  const value = useMemo(
    () => ({
      status,
      file,
      fields,
      memo,
      error,
      generatedAt,
      setFile,
      updateFields,
      generate,
      reset,
    }),
    [status, file, fields, memo, error, generatedAt, updateFields, generate, reset]
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
