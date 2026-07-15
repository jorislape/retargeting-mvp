"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyModeDefaults,
  createDefaultCustomization,
  type AccentId,
  type ReportCustomization,
  type ReportMode,
} from "./reportCustomization";
import { validateLogoFile } from "./logoValidation";

/**
 * The stateful half of White-label Report Customization V1A — plain
 * React state, session-only (dies with the component, exactly like
 * every other piece of report state in this app: `Memo`, `queued`,
 * `briefIdxs`). No localStorage/sessionStorage, no server round-trip.
 *
 * Logo lifecycle: one agency logo (V1A scope — no client logo). A new
 * File is validated (logoValidation.ts, pure) before ever calling
 * URL.createObjectURL; the previous object URL is revoked on replace,
 * on explicit removal, and on unmount — never left dangling.
 */
export interface UseReportCustomizationResult<Id extends string> {
  customization: ReportCustomization<Id>;
  setAgencyName: (value: string) => void;
  setClientName: (value: string) => void;
  setReportTitle: (value: string) => void;
  setAccentId: (value: AccentId) => void;
  setDateOverride: (value: string | null) => void;
  /** Switching mode applies that mode's recommended section defaults
   *  (reportSections.ts's *_CLIENT_MODE_HIDDEN lists) — a one-time
   *  starting point, not a standing rule; toggleSection after this
   *  freely overrides it. */
  setMode: (value: ReportMode) => void;
  toggleSection: (id: Id) => void;
  /** Returns the validation result so the caller can surface an
   *  inline error without this hook needing to own any UI state.
   *  Passing `null` removes the current logo. */
  setAgencyLogoFile: (file: File | null) => { ok: boolean; error?: string };
  reset: () => void;
}

export function useReportCustomization<Id extends string>(
  sectionIds: readonly Id[],
  clientModeHidden: readonly Id[]
): UseReportCustomizationResult<Id> {
  const [customization, setCustomization] = useState<ReportCustomization<Id>>(() =>
    createDefaultCustomization(sectionIds)
  );
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

  const setMode = useCallback(
    (mode: ReportMode) => {
      setCustomization((c) => ({
        ...c,
        mode,
        sections: applyModeDefaults(sectionIds, mode, clientModeHidden),
      }));
    },
    [sectionIds, clientModeHidden]
  );

  const toggleSection = useCallback((id: Id) => {
    setCustomization((c) => ({ ...c, sections: { ...c.sections, [id]: !c.sections[id] } }));
  }, []);

  const reset = useCallback(() => {
    revokeCurrentLogo();
    setCustomization(createDefaultCustomization(sectionIds));
  }, [sectionIds, revokeCurrentLogo]);

  return {
    customization,
    setAgencyName: (value) => setCustomization((c) => ({ ...c, agencyName: value })),
    setClientName: (value) => setCustomization((c) => ({ ...c, clientName: value })),
    setReportTitle: (value) => setCustomization((c) => ({ ...c, reportTitle: value })),
    setAccentId: (value) => setCustomization((c) => ({ ...c, accentId: value })),
    setDateOverride: (value) => setCustomization((c) => ({ ...c, dateOverride: value })),
    setMode,
    toggleSection,
    setAgencyLogoFile,
    reset,
  };
}
