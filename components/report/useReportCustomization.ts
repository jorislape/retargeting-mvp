"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createDefaultCustomization,
  derivePreset,
  type AccentId,
  type Density,
  type PresetDefinition,
  type PresetId,
  type ReportCustomization,
  type ReportMode,
  type TopAdsShown,
} from "./reportCustomization";
import { validateLogoFile } from "./logoValidation";

/**
 * The stateful half of Report Customization — plain React state,
 * session-only (dies with the component, exactly like every other
 * piece of report state in this app: `Memo`, `queued`, `briefIdxs`). No
 * localStorage/sessionStorage, no server round-trip.
 *
 * Logo lifecycle: one agency logo (V1A scope — no client logo). A new
 * File is validated (logoValidation.ts, pure) before ever calling
 * URL.createObjectURL; the previous object URL is revoked on replace,
 * on explicit removal, and on unmount — never left dangling.
 *
 * Report Foundation V1: `presets` is optional and report-type-specific
 * (e.g. components/debrief/reportPresets.ts for Performance) — this
 * file stays generic and knows nothing about any concrete section id.
 * When omitted (Competitor Debrief, this milestone), `preset` simply
 * always reads "custom"; nothing else about the hook changes.
 */
export interface UseReportCustomizationResult<Id extends string> {
  customization: ReportCustomization<Id>;
  setAgencyName: (value: string) => void;
  setClientName: (value: string) => void;
  setReportTitle: (value: string) => void;
  setAccentId: (value: AccentId) => void;
  setDateOverride: (value: string | null) => void;
  /** Changes ONLY the report register (Buyer/Client). Per approved
   *  decision #9: does not touch sections, does not reapply mode
   *  defaults, and — because `mode` is excluded from matchesPreset —
   *  never changes the current preset name. Switching Buyer/Client is
   *  previewing the other register, not customizing the report. */
  setMode: (value: ReportMode) => void;
  toggleSection: (id: Id) => void;
  setTopAdsShown: (value: TopAdsShown) => void;
  setDensity: (value: Density) => void;
  /** No `setColorMode` — colorMode is an internal, preset-scoped field
   *  only (see reportCustomization.ts). It's never user-toggleable
   *  directly; the only way it changes is via setPreset applying a
   *  preset that specifies it (Print-friendly sets "grayscale"). */
  /** Applies a named preset's full snapshot (mode + sections +
   *  topAdsShown + density + colorMode) in one update. Identity/
   *  branding fields (agency/client name, title, logo, accent, date
   *  override) are never touched by a preset. */
  setPreset: (id: Exclude<PresetId, "custom">) => void;
  /** Returns the validation result so the caller can surface an
   *  inline error without this hook needing to own any UI state.
   *  Passing `null` removes the current logo. */
  setAgencyLogoFile: (file: File | null) => { ok: boolean; error?: string };
  reset: () => void;
}

export function useReportCustomization<Id extends string>(
  sectionIds: readonly Id[],
  presets?: Partial<Record<Exclude<PresetId, "custom">, PresetDefinition<Id>>>
): UseReportCustomizationResult<Id> {
  const [customization, setCustomization] = useState<ReportCustomization<Id>>(() => {
    const base = createDefaultCustomization(sectionIds);
    return { ...base, preset: derivePreset(base, presets, sectionIds) };
  });
  const logoUrlRef = useRef<string | null>(null);

  const revokeCurrentLogo = useCallback(() => {
    if (logoUrlRef.current) {
      URL.revokeObjectURL(logoUrlRef.current);
      logoUrlRef.current = null;
    }
  }, []);

  // Unmount-only cleanup — revokeCurrentLogo is referentially stable
  // (empty dep array), so this effect never re-runs mid-life; it only
  // fires the revoke on the way out, reading whatever logoUrlRef holds
  // at that moment (refs are always current).
  useEffect(() => () => revokeCurrentLogo(), [revokeCurrentLogo]);

  const setAgencyLogoFile = useCallback(
    (file: File | null): { ok: boolean; error?: string } => {
      if (file === null) {
        revokeCurrentLogo();
        setCustomization((c) => ({ ...c, agencyLogo: null }));
        return { ok: true };
      }
      const result = validateLogoFile(file);
      if (!result.ok) return result;
      revokeCurrentLogo();
      const url = URL.createObjectURL(file);
      logoUrlRef.current = url;
      setCustomization((c) => ({ ...c, agencyLogo: { url, name: file.name } }));
      return { ok: true };
    },
    [revokeCurrentLogo]
  );

  // Report Foundation V1: mode changes ONLY the register — no section
  // reset, no preset invalidation (mode is excluded from
  // matchesPreset), matching approved decision #9 exactly.
  const setMode = useCallback((mode: ReportMode) => {
    setCustomization((c) => ({ ...c, mode }));
  }, []);

  const toggleSection = useCallback(
    (id: Id) => {
      setCustomization((c) => {
        const next = { ...c, sections: { ...c.sections, [id]: !c.sections[id] } };
        return { ...next, preset: derivePreset(next, presets, sectionIds) };
      });
    },
    [presets, sectionIds]
  );

  const setTopAdsShown = useCallback(
    (value: TopAdsShown) => {
      setCustomization((c) => {
        const next = { ...c, topAdsShown: value };
        return { ...next, preset: derivePreset(next, presets, sectionIds) };
      });
    },
    [presets, sectionIds]
  );

  const setDensity = useCallback(
    (value: Density) => {
      setCustomization((c) => {
        const next = { ...c, density: value };
        return { ...next, preset: derivePreset(next, presets, sectionIds) };
      });
    },
    [presets, sectionIds]
  );

  const setPreset = useCallback(
    (id: Exclude<PresetId, "custom">) => {
      const snapshot = presets?.[id];
      if (!snapshot) return; // no snapshot defined for this report type — no-op, never throws
      setCustomization((c) => ({
        ...c,
        mode: snapshot.mode,
        sections: { ...snapshot.sections },
        topAdsShown: snapshot.topAdsShown,
        density: snapshot.density,
        colorMode: snapshot.colorMode,
        preset: id,
      }));
    },
    [presets]
  );

  const reset = useCallback(() => {
    revokeCurrentLogo();
    const base = createDefaultCustomization(sectionIds);
    setCustomization({ ...base, preset: derivePreset(base, presets, sectionIds) });
  }, [sectionIds, presets, revokeCurrentLogo]);

  return {
    customization,
    setAgencyName: (value) => setCustomization((c) => ({ ...c, agencyName: value })),
    setClientName: (value) => setCustomization((c) => ({ ...c, clientName: value })),
    setReportTitle: (value) => setCustomization((c) => ({ ...c, reportTitle: value })),
    setAccentId: (value) => setCustomization((c) => ({ ...c, accentId: value })),
    setDateOverride: (value) => setCustomization((c) => ({ ...c, dateOverride: value })),
    setMode,
    toggleSection,
    setTopAdsShown,
    setDensity,
    setPreset,
    setAgencyLogoFile,
    reset,
  };
}
