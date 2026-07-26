"use client"

import { cn } from "@cortex/utils"
import type { ReactNode } from "react"

interface AppShellProps {
  sidebar?: ReactNode
  topbar?: ReactNode
  children: ReactNode
  className?: string
  mainClassName?: string
  sidebarCollapsed?: boolean
}

export function AppShell({
  sidebar,
  topbar,
  children,
  className,
  mainClassName,
  sidebarCollapsed = false,
}: AppShellProps) {
  return (
    <div className={cn("flex h-screen overflow-hidden bg-background", className)}>
      {sidebar ? (
        // No width transition on purpose: animating a layout property thrashes
        // layout on every frame. Collapse is a binary, infrequent state change
        // — it swaps instantly instead.
        <aside
          className={cn(
            "ch-aside hidden shrink-0 md:flex md:flex-col",
            sidebarCollapsed ? "w-sidebar-icon" : "w-sidebar",
          )}
          data-collapsed={sidebarCollapsed || undefined}
        >
          {sidebar}
        </aside>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        {topbar ? (
          <header className="ch-topbar flex h-header shrink-0 items-center gap-3 px-4">
            {topbar}
          </header>
        ) : null}
        <main className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto", mainClassName)}>
          {children}
        </main>
      </div>
    </div>
  )
}
