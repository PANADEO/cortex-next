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
        <aside
          className={cn(
            "hidden shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex md:flex-col",
            sidebarCollapsed ? "w-sidebar-icon" : "w-sidebar",
          )}
          data-collapsed={sidebarCollapsed || undefined}
        >
          {sidebar}
        </aside>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        {topbar ? (
          <header className="flex h-header shrink-0 items-center gap-3 border-b border-border bg-background px-4">
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
