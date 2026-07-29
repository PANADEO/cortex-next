"use client"

import { useFeatureFlags } from "@cortex/api"
import { BACKEND_FIELD, DEFAULTS, type FeatureFlag } from "./flags"

/**
 * Reactive flag check exposing query lifecycle. For page-level guards that
 * need to differentiate "still loading" from "settled-but-disabled" — a 404
 * `notFound()` should fire only after the flag has settled to `false`, not
 * while `/config` is still in flight.
 *
 * Use `useFeatureFlag` instead when you only need a boolean (UI elements
 * with safe-by-default null fallback).
 */
export interface FeatureFlagState {
  enabled: boolean
  isPending: boolean
  isError: boolean
}

export function useFeatureFlagState(flag: FeatureFlag): FeatureFlagState {
  const { data, isPending, isError, isSuccess } = useFeatureFlags()
  if (!isSuccess) {
    return { enabled: DEFAULTS[flag], isPending, isError }
  }
  const value = data[BACKEND_FIELD[flag]]
  const enabled = typeof value === "boolean" ? value : DEFAULTS[flag]
  return { enabled, isPending: false, isError: false }
}
