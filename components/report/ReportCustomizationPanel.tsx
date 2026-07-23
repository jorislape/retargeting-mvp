"use client";

import { useEffect, useState } from "react";
import { RefreshIcon, XIcon } from "@/components/ui/icons";
import { btnPrimarySm, btnSecondary, cardNested, fieldLabel, inputBase } from "@/components/ui/theme";
import { ACCENT_PALETTE } from "./reportCustomization";
import { LogoPicker } from "./LogoPicker";
import type { UseReportCustomizationResult } from "./useReportCustomization";
import type { SectionDescriptor } from "./reportSections";

/**
 * The shared customization drawer — one component, reused by both
 * report types via the `sections`/`actions` props. Desktop: fixed
 * right-side panel. Mobile (below `sm`): full-screen sheet, same
 * markup, just full-width — a single responsive class, not a second
 * component. `.print-hidden` on the outermost element: this control
 * surface must never appear in print/PDF output.
 *
 * Only rendered by the caller once a report exists — see Report.tsx /
 * CompetitorDebriefResult.tsx, which mount this behind their own
 * "Customize report" trigger. The generator forms never reference
 * this component at all.
 */
export function ReportCustomizationPanel<Id extends string>({
  open,
  onClose,
  actions,
  sections,
  defaultTitlePlaceholder,
  modeReadout,
}: {
  open: boolean;
  onClose: () => void;
  actions: UseReportCustomizationResult<Id>;
  sections: readonly SectionDescriptor<Id>[];
  defaultTitlePlaceholder: string;
  /** Read-only "current mode" context line, labeled with the calling
   *  report's own vocabulary. The report's own toolbar (Report.tsx's
   *  Buyer/Client tabs) is the ONE place mode is ever changed — this
   *  panel only displays the current state, never a second control.
   *  Omit entirely for reports with no content register to display
   *  (the competitor report has no toolbar mode control at all, so it
   *  passes nothing here and this section doesn't render). */
  modeReadout?: { internal: string; client: string };
}) {
  const { customization } = actions;
  const [sectionsExpanded, setSectionsExpanded] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const visibleCount = sections.filter((s) => customization.sections[s.id]).length;
  const usingCustomDate = customization.dateOverride !== null;

  return (
    <div className="print-hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Customize report">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

      <div className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-white/10 bg-carbon shadow-2xl sm:max-w-md">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Customize report</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close customize report panel"
            className="cursor-pointer text-zinc-400 hover:text-white"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* Report mode — read-only context only. The toolbar above
              (Buyer/Client) is the one place this ever changes; this
              panel never duplicates that control. */}
          {modeReadout && (
            <div>
              <span className={`${fieldLabel} mb-1.5 block`}>Report mode</span>
              <p className="text-xs text-zinc-300">
                {customization.mode === "client" ? modeReadout.client : modeReadout.internal}
              </p>
              <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-500">
                Change the report mode using the Buyer / Client tabs above.
              </p>
            </div>
          )}

          {/* Identity fields */}
          <div className="space-y-3">
            <div>
              <label className={`${fieldLabel} mb-1.5 block`} htmlFor="rc-agency-name">
                Agency name
              </label>
              <input
                id="rc-agency-name"
                type="text"
                autoComplete="off"
                className={inputBase}
                placeholder="Your agency"
                value={customization.agencyName}
                onChange={(e) => actions.setAgencyName(e.target.value)}
              />
            </div>
            <div>
              <label className={`${fieldLabel} mb-1.5 block`} htmlFor="rc-client-name">
                Client name
              </label>
              <input
                id="rc-client-name"
                type="text"
                autoComplete="off"
                className={inputBase}
                placeholder="Client name"
                value={customization.clientName}
                onChange={(e) => actions.setClientName(e.target.value)}
              />
            </div>
            <div>
              <label className={`${fieldLabel} mb-1.5 block`} htmlFor="rc-report-title">
                Report title
              </label>
              <input
                id="rc-report-title"
                type="text"
                autoComplete="off"
                className={inputBase}
                placeholder={defaultTitlePlaceholder}
                value={customization.reportTitle}
                onChange={(e) => actions.setReportTitle(e.target.value)}
              />
            </div>
            <div>
              <span className={`${fieldLabel} mb-1.5 block`}>Report date</span>
              <div
                role="group"
                aria-label="Report date"
                className="inline-flex flex-wrap gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5"
              >
                <button
                  type="button"
                  aria-pressed={!usingCustomDate}
                  onClick={() => actions.setDateOverride(null)}
                  className={`cursor-pointer rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                    !usingCustomDate ? "bg-white/[0.09] text-white" : "text-zinc-400 hover:text-zinc-300"
                  }`}
                >
                  Use generated date
                </button>
                <button
                  type="button"
                  aria-pressed={usingCustomDate}
                  onClick={() => {
                    if (!usingCustomDate) actions.setDateOverride(new Date().toISOString().slice(0, 10));
                  }}
                  className={`cursor-pointer rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                    usingCustomDate ? "bg-white/[0.09] text-white" : "text-zinc-400 hover:text-zinc-300"
                  }`}
                >
                  Custom date
                </button>
              </div>
              {usingCustomDate && (
                <input
                  type="date"
                  className={`${inputBase} mt-2`}
                  value={customization.dateOverride ?? ""}
                  onChange={(e) => actions.setDateOverride(e.target.value)}
                />
              )}
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                Changes the displayed report date only. It does not change
                the analyzed data period.
              </p>
            </div>
          </div>

          <LogoPicker label="Agency logo" logo={customization.agencyLogo} onSelect={actions.setAgencyLogoFile} />

          {/* Accent */}
          <div>
            <span className={`${fieldLabel} mb-1.5 block`}>Accent color</span>
            <div role="group" aria-label="Accent color" className="flex flex-wrap gap-2">
              {ACCENT_PALETTE.map((accent) => (
                <button
                  key={accent.id}
                  type="button"
                  aria-pressed={customization.accentId === accent.id}
                  title={accent.label}
                  onClick={() => actions.setAccentId(accent.id)}
                  className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition ${
                    customization.accentId === accent.id ? "border-white" : "border-transparent hover:border-white/30"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-6 w-6 rounded-full"
                    style={{ backgroundColor: accent.screen }}
                  />
                  <span className="sr-only">{accent.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sections — collapsed by default so identity/branding stays
              the first thing anyone sees; section-hiding is the more
              power-user action of the two. */}
          <div className={`${cardNested} p-3`}>
            <button
              type="button"
              onClick={() => setSectionsExpanded((v) => !v)}
              aria-expanded={sectionsExpanded}
              className="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
            >
              <span className={fieldLabel}>Sections</span>
              <span className="shrink-0 text-[11px] text-zinc-400">
                {visibleCount}/{sections.length} visible
              </span>
            </button>
            {sectionsExpanded && (
              <div className="mt-3 space-y-1.5">
                {sections.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={customization.sections[s.id]}
                      onChange={() => actions.toggleSection(s.id)}
                      className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-accent"
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 px-5 py-4">
          <button
            type="button"
            onClick={actions.reset}
            className={`flex cursor-pointer items-center gap-1.5 ${btnSecondary}`}
          >
            <RefreshIcon className="h-3.5 w-3.5" />
            Reset to default
          </button>
          <button type="button" onClick={onClose} className={btnPrimarySm}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
