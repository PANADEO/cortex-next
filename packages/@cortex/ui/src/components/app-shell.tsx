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

/**
 * Tło, ramki i kolory idą TOKENAMI (`bg-sidebar`, `border-sidebar-border`,
 * `border-border`) i tak zostaje — E2 tego nie tknie.
 *
 * Wariant z gałęzi Domino (`ef85991`) wymieniał je na klasy `ch-*` czytające
 * `--ch-*` z `:root`, działające wyłącznie pod scope'em `.cortex-chrome`.
 * Odrzucone i wycofane z dwóch powodów. Po pierwsze, `@cortex/ui` jest pakietem
 * współdzielonym: komponent wyrenderowany poza tym jednym scope'em traci tło i
 * ramki, więc koszt płaci każdy przyszły konsument, nie tylko autor skinu. Po
 * drugie — i to jest właściwy argument — powłoka zostaje na warstwie 1 (D5,
 * PROJECT/cortex-frontend/ARTIFACTS/cortex-frontend-presety-wygladu-projekt.md):
 * dowodem jest to, że `ef85991` nie zmienił DOM-u ani o jeden element, więc
 * cały chrome wyraża się samymi wartościami tokenów. Skin przemalowuje go,
 * nadpisując `--sidebar`/`--border` w bloku `.skin-*`, i nie potrzebuje ani
 * jednej własnej reguły układu ani drugiego zestawu klas.
 */
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
