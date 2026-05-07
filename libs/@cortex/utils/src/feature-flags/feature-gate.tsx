"use client"

import type { ReactNode } from "react"
import { type FeatureFlag } from "./flags"
import { useFeatureFlag } from "./use-feature-flag"

interface FeatureGateProps {
  flag: FeatureFlag
  children: ReactNode
  fallback?: ReactNode
}

export function FeatureGate({
  flag,
  children,
  fallback = null,
}: FeatureGateProps) {
  return useFeatureFlag(flag) ? <>{children}</> : <>{fallback}</>
}
