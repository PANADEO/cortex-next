"use client"

import type { ReactNode } from "react"
import { FeatureErrorBoundary } from "@/components/error-boundaries"
import { ShellFooter } from "@/components/shell/shell-footer"
import { ShellHeader } from "@/components/shell/shell-header"

export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground [background-image:radial-gradient(hsl(var(--foreground)/0.06)_1px,transparent_1px)] [background-size:18px_18px]">
      <ShellHeader />
      <main className="flex-1">
        <FeatureErrorBoundary>{children}</FeatureErrorBoundary>
      </main>
      <ShellFooter />
    </div>
  )
}
