"use client"

import { FeatureErrorBoundary } from "@/components/error-boundaries"
import type { ReactNode } from "react"

export default function ShellLayout({ children }: { children: ReactNode }) {
  return <FeatureErrorBoundary>{children}</FeatureErrorBoundary>
}
