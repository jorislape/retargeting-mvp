"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applySnapshot,
  createDefaultCustomization,
  derivePreset,
  matchesPreset,
  type AccentId,
  type Density,
  type ModeDefaults,
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

/**
 * Report Default Curation V1 ("D′"): `modeDefaults` is optional and
 * report-type-specific (e.g. components/debrief/reportPresets.ts's
 * PERFORMANCE_MODE_DEFAULTS) — one canonical PresetSnapshot per
 * register. Used here to seed the true initial mount (always
 * "internal"/Buyer — see createDefaultCustomization), and by setMode
 * below to re-derive a register's own canonical defaults ONLY while
 * the state being left is still pristine (see setMode's own doc
 * comment). Never touched by any per-field setter — manual
 * customization always wins.
 */
function buildInitialCustomization<Id extends string>(
  sectionIds: readonly Id[],
  presets: Partial<Record<Exclude<PresetId, "custom">, PresetDefinition<Id>>> | undefined,
  modeDefaults: ModeDefaults<Id> | undefined
): ReportCustomization<Id> {
  const base = createDefaultCustomization(sectionIds);
  const snapshot = modeDefaults?.[base.mode];
  const merged = snapshot ? applySnapshot(base, snapshot) : base;
  return { ...merged, preset: derivePreset(merged, presets, sectionIds) };
}
export interface UseReportCustomizationResult<Id extends string> {
  customization: ReportCustomization<Id>;
  setAgencyName: (value: string) => void;
  setClientName: (value: string) => void;
  setReportTitle: (value: string) => void;
  setAccentId: (value: AccentId) => void;
  setDateOverride: (value: string | null) => void;
  /** Expert Commentary V2 — identity-like field: never affects preset
   *  matching, rendered as an attributed commentary block only. */
  setExpertTake: (value: string) => void;
  /** Changes the report register (Buyer/Client) — pristine-aware
   *  (Report Default Curation V1 "D′"): if the state being left still
   *  exactly matches that register's OWN canonical default (nothing
   *  manually touched), the destination register's own canonical
   *  default is applied too; otherwise ONLY `mode` changes, per
   *  approved decision #9, and every manual customization is
   *  preserved exactly. Either way `mode` itself is excluded from
   *  matchesPreset, so switching alone never invents a preset match
   *  it shouldn't. */
  setMode: (value: ReportMode) => void;
  toggleSection: (id: Id) => void;
  setTopAdsShown: (value: TopAdsShown) => void;
  setDensity: (value: Density) => void;
  setShowRankingChart: (value: boolean) => void;
  setShowSpendAllocationChart: (value: boolean) => void;
  setShowMovementChart: (value: boolean) => void;
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
  presets?: Partial<Record<Exclude<PresetId, "custom">, PresetDefinition<Id>>>,
  modeDefaults?: ModeDefaults<Id>
): UseReportCustomizationResult<Id> {
  const [customization, setCustomization] = useState<ReportCustomization<Id>>(() =>
    buildInitialCustomization(sectionIds, presets, modeDefaults)
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

  // Report Default Curation V1 ("D′"): pristine-aware mode switch.
  // Compare the state being LEFT against ITS OWN canonical default
  // (modeDefaults[c.mode]) via the existing matchesPreset — if nothing
  // has been manually touched, it's safe to also apply the
  // destination register's own canonical default. The instant any
  // field diverges, this falls back to approved decision #9's
  // original, unconditional behavior: mode changes, nothing else
  // does. No stored "dirty" flag — pristine-ness is recomputed from
  // live values every call, so it can never drift out of sync with
  // reality, and it costs nothing for report types with no
  // modeDefaults (Competitor Debrief): the lookup is undefined, so
  // isPristine is always false and this degrades to the pre-existing
  // mode-only behavior exactly.
  const setMode = useCallback(
    (mode: ReportMode) => {
      setCustomization((c) => {
        const leavingDefault = modeDefaults?.[c.mode];
        const isPristine = leavingDefault ? matchesPreset(c, leavingDefault, sectionIds) : false;
        const destinationDefault = isPristine ? modeDefaults?.[mode] : undefined;
        if (!destinationDefault) return { ...c, mode };
        const next = applySnapshot(c, destinationDefault);
        return { ...next, mode, preset: derivePreset(next, presets, sectionIds) };
      });
    },
    [modeDefaults, presets, sectionIds]
  );

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

  const setShowRankingChart = useCallback(
    (value: boolean) => {
      setCustomization((c) => {
        const next = { ...c, showRankingChart: value };
        return { ...next, preset: derivePreset(next, presets, sectionIds) };
      });
    },
    [presets, sectionIds]
  );

  const setShowSpendAllocationChart = useCallback(
    (value: boolean) => {
      setCustomization((c) => {
        const next = { ...c, showSpendAllocationChart: value };
        return { ...next, preset: derivePreset(next, presets, sectionIds) };
      });
    },
    [presets, sectionIds]
  );

  const setShowMovementChart = useCallback(
    (value: boolean) => {
      setCustomization((c) => {
        const next = { ...c, showMovementChart: value };
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
        ...applySnapshot(c, snapshot),
        mode: snapshot.mode,
        preset: id,
      }));
    },
    [presets]
  );

  // Report Default Curation V1: reset semantics are unchanged by "D′" —
  // always back to the true initial mount (Buyer/internal + its own
  // canonical default), regardless of which register was active.
  const reset = useCallback(() => {
    revokeCurrentLogo();
    setCustomization(buildInitialCustomization(sectionIds, presets, modeDefaults));
  }, [sectionIds, presets, modeDefaults, revokeCurrentLogo]);

  return {
    customization,
    setAgencyName: (value) => setCustomization((c) => ({ ...c, agencyName: value })),
    setClientName: (value) => setCustomization((c) => ({ ...c, clientName: value })),
    setReportTitle: (value) => setCustomization((c) => ({ ...c, reportTitle: value })),
    setAccentId: (value) => setCustomization((c) => ({ ...c, accentId: value })),
    setDateOverride: (value) => setCustomization((c) => ({ ...c, dateOverride: value })),
    setExpertTake: (value) => setCustomization((c) => ({ ...c, expertTake: value })),
    setMode,
    toggleSection,
    setTopAdsShown,
    setDensity,
    setShowRankingChart,
    setShowSpendAllocationChart,
    setShowMovementChart,
    setPreset,
    setAgencyLogoFile,
    reset,
  };
}
