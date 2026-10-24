"use client";

import { createContext, useContext } from "react";
import { middleTruncate } from "./longNames";

/**
 * Bulletproof pass B1 — the report's display-name resolver. Report.tsx
 * provides a collision-safe shortener built over every analyzed ad
 * (longNames.ts buildNameShortener); every surface that shortens an ad
 * name reads it from here, so no two ads ever share a displayed name.
 */
export const NameDisplayContext = createContext<(name: string, max?: number) => string>(middleTruncate);

export function useShortName(): (name: string, max?: number) => string {
  return useContext(NameDisplayContext);
}
