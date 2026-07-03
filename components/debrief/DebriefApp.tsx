"use client";

import { useCallback, useState } from "react";
import { Memo } from "@/modules/debrief";
import { Hero } from "./Hero";
import { MemoResult } from "./MemoResult";
import { ProcessingState } from "./ProcessingState";
import { DebriefFields, UploadForm } from "./UploadForm";

type Step = "form" | "processing" | "result";

const DEFAULT_FIELDS: DebriefFields = {
  kpi: "roas",
  product: "",
  offer: "",
  goal: "",
  targetCpa: "",
  creativeNotes: "",
};

/**
 * The entire app lives in this one component's state — no routes, no
 * history, nothing written anywhere. Closing the tab or hitting "Start
 * over" is a full, real reset: the CSV and memo simply cease to exist.
 */
export function DebriefApp() {
  const [step, setStep] = useState<Step>("form");
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<DebriefFields>(DEFAULT_FIELDS);
  const [memo, setMemo] = useState<Memo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateFields = useCallback((patch: Partial<DebriefFields>) => {
    setFields((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!file) return;
    setError(null);
    setStep("processing");

    const body = new FormData();
    body.append("csv", file);
    body.append("kpi", fields.kpi);
    body.append("product", fields.product);
    body.append("offer", fields.offer);
    body.append("goal", fields.goal);
    if (fields.targetCpa.trim() !== "") body.append("targetCpa", fields.targetCpa);
    body.append("creativeNotes", fields.creativeNotes);

    try {
      const res = await fetch("/api/debrief", { method: "POST", body });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setStep("form");
        return;
      }
      setMemo(data.memo);
      setStep("result");
    } catch {
      setError("Network error — check your connection and try again.");
      setStep("form");
    }
  }, [file, fields]);

  const handleReset = useCallback(() => {
    setStep("form");
    setFile(null);
    setFields(DEFAULT_FIELDS);
    setMemo(null);
    setError(null);
  }, []);

  if (step === "result" && memo) {
    return <MemoResult memo={memo} onReset={handleReset} />;
  }

  if (step === "processing") {
    return <ProcessingState />;
  }

  return (
    <>
      <Hero />
      <UploadForm
        file={file}
        onFileChange={setFile}
        fields={fields}
        onFieldsChange={updateFields}
        onSubmit={handleSubmit}
        error={error}
      />
    </>
  );
}
