"use client";

import { createContext, useContext } from "react";
import { middleTruncate } from "./longNames";

/**
 * Bulletproof pass B1/B3 — the report's display-name resolver. Report.tsx
 * provides it per view: the buyer gets collision-safe shortened names
 * (longNames.ts buildNameShortener); the client gets readable labels for
 * tokened names (buildClientLabels) and the collision-safe raw name for
 * the rest. `labelAll` tells sentence renderers to resolve EVERY quoted
 * ad name (labels replace short names too), not just long ones.
 */
export interface NameDisplay {
  short: (name: string, max?: number) => string;
  labelAll: boolean;
}

export const NameDisplayContext = createContext<NameDisplay>({ short: middleTruncate, labelAll: false });

export function useShortName(): (name: string, max?: number) => string {
  return useContext(NameDisplayContext).short;
}

export function useLabelAll(): boolean {
  return useContext(NameDisplayContext).labelAll;
}
