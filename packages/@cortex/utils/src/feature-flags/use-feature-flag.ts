"use client"

import { useFeatureFlags } from "@cortex/api"
import { BACKEND_FIELD, DEFAULTS, type FeatureFlag } from "./flags"

/**
 * Reactive flag check. Safe-by-default: returns `DEFAULTS[flag]` (false) on
 * loading, error, or when the backend response is missing the mapped field.
 */
export function useFeatureFlag(flag: FeatureFlag): boolean {
  const { data, isSuccess } = useFeatureFlags()
  if (!isSuccess) return DEFAULTS[flag]
  const value = data[BACKEND_FIELD[flag]]
  return typeof value === "boolean" ? value : DEFAULTS[flag]
}
