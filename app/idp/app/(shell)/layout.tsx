"use client"

import type { ReactNode } from "react"
import { FeatureErrorBoundary } from "@/components/error-boundaries"

export default function ShellLayout({ children }: { children: ReactNode }) {
  return <FeatureErrorBoundary>{children}</FeatureErrorBoundary>
}
