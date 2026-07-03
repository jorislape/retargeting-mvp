"use client";

import { useRef, useState } from "react";
import { KpiKey } from "@/modules/debrief";
import {
  AlertTriangleIcon,
  ArrowIcon,
  FileTextIcon,
  UploadIcon,
  XIcon,
} from "@/components/ui/icons";
import { btnPrimary, card } from "@/components/ui/theme";

export interface DebriefFields {
  kpi: KpiKey;
  product: string;
  offer: string;
  goal: string;
  targetCpa: string;
  creativeNotes: string;
}

const KPI_OPTIONS: { value: KpiKey; label: string; hint: string }[] = [
  { value: "roas", label: "ROAS", hint: "Return on ad spend" },
  { value: "cpa", label: "CPA", hint: "Cost per acquisition" },
  { value: "ctr", label: "CTR", hint: "Click-through rate" },
  { value: "cpc", label: "CPC", hint: "Cost per click" },
  { value: "leads", label: "Leads", hint: "Lead volume" },
  { value: "purchases", label: "Purchases", hint: "Purchase volume" },
];

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function UploadForm({
  file,
  onFileChange,
  fields,
  onFieldsChange,
  onSubmit,
  error,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  fields: DebriefFields;
  onFieldsChange: (patch: Partial<DebriefFields>) => void;
  onSubmit: () => void;
  error: string | null;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const canSubmit =
    !!file &&
    fields.product.trim() !== "" &&
    fields.offer.trim() !== "" &&
    fields.goal.trim() !== "";

  const handleFiles = (files: FileList | null) => {
    const picked = files?.[0];
    if (picked) onFileChange(picked);
  };

  return (
    <section className="relative mx-auto max-w-2xl px-5 pb-20 pt-10 sm:px-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) onSubmit();
        }}
        className={`${card} p-5 sm:p-7`}
      >
        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3.5 text-[13px] leading-relaxed text-red-200"
          >
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            {error}
          </div>
        )}

        {/* CSV dropzone */}
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
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
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
              <FileTextIcon className="h-6 w-6 text-blue-300" />
              <p className="text-sm font-semibold text-zinc-100">{file.name}</p>
              <p className="text-xs text-zinc-500">{fmtBytes(file.size)}</p>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onFileChange(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="mt-1 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-zinc-400 transition hover:text-white"
              >
                <XIcon className="h-3 w-3" />
                Remove
              </button>
            </>
          ) : (
            <>
              <UploadIcon className="h-6 w-6 text-zinc-500" />
              <p className="text-sm font-semibold text-zinc-200">
                Drop your CSV here or click to browse
              </p>
              <p className="text-xs text-zinc-500">
                Exported from Meta Ads Manager · up to 5MB
              </p>
            </>
          )}
        </label>

        {/* KPI selector */}
        <fieldset className="mt-6">
          <legend className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            What matters most this period?
          </legend>
          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {KPI_OPTIONS.map((opt) => {
              const active = fields.kpi === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onFieldsChange({ kpi: opt.value })}
                  className={`cursor-pointer rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${
                    active
                      ? "border-blue-400/40 bg-blue-500/10"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <span
                    className={`block text-sm font-semibold ${active ? "text-white" : "text-zinc-200"}`}
                  >
                    {opt.label}
                  </span>
                  <span className="block text-[11px] text-zinc-500">{opt.hint}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Context */}
        <div className="mt-6 space-y-4">
          <Field
            id="product"
            label="Product / industry"
            required
            value={fields.product}
            onChange={(v) => onFieldsChange({ product: v })}
            placeholder="e.g. Skincare — moisturizer line"
          />
          <Field
            id="offer"
            label="Offer"
            required
            value={fields.offer}
            onChange={(v) => onFieldsChange({ offer: v })}
            placeholder="e.g. 20% off first order"
          />
          <Field
            id="goal"
            label="Campaign goal"
            required
            value={fields.goal}
            onChange={(v) => onFieldsChange({ goal: v })}
            placeholder="e.g. Scale profitably past $500/day"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="targetCpa"
              label="Target CPA"
              optional
              type="number"
              value={fields.targetCpa}
              onChange={(v) => onFieldsChange({ targetCpa: v })}
              placeholder="e.g. 25"
            />
          </div>
          <div>
            <label
              htmlFor="creativeNotes"
              className="flex items-baseline justify-between text-xs font-semibold uppercase tracking-wider text-zinc-500"
            >
              Creative notes
              <span className="text-[10px] font-medium normal-case tracking-normal text-zinc-600">
                Optional
              </span>
            </label>
            <textarea
              id="creativeNotes"
              rows={3}
              value={fields.creativeNotes}
              onChange={(e) => onFieldsChange({ creativeNotes: e.target.value })}
              placeholder="e.g. Ad 3 and 5 are UGC testimonials; the rest are static product shots"
              className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-blue-400/40 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className={`mt-7 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${btnPrimary}`}
        >
          Generate debrief
          <ArrowIcon className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  required,
  optional,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  optional?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="flex items-baseline justify-between text-xs font-semibold uppercase tracking-wider text-zinc-500"
      >
        <span>
          {label}
          {required && <span className="ml-0.5 text-blue-400">*</span>}
        </span>
        {optional && (
          <span className="text-[10px] font-medium normal-case tracking-normal text-zinc-600">
            Optional
          </span>
        )}
      </label>
      <input
        id={id}
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        min={type === "number" ? 0 : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-900/60 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-blue-400/40 focus:outline-none focus:ring-2 focus:ring-blue-400/30"
      />
    </div>
  );
}
