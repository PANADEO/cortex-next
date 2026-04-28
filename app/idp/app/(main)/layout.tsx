"use client"

import { AppShell, TileMenu } from "@cortex/ui"
import { Boxes } from "lucide-react"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { FeatureErrorBoundary } from "@/components/error-boundaries"
import { Topbar } from "@/components/topbar"
import { IDP_NAV } from "@/lib/nav"
import { useSidebarStore } from "@/lib/stores/sidebar-store"

function pathToItemId(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean)
  const first = segments[0]
  if (first === "idp") return segments[1] ?? "dashboard"
  return first ?? "dashboard"
}

export default function MainLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const activeItemId = pathToItemId(pathname)
  const collapsed = useSidebarStore((s) => s.collapsed)

  const brandIcon = (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
      <Boxes className="h-4 w-4" />
    </span>
  )

  return (
    <AppShell
      sidebarCollapsed={collapsed}
      sidebar={
        <TileMenu
          sections={IDP_NAV}
          activeItemId={activeItemId}
          collapsed={collapsed}
          brand={
            <div className="flex items-center gap-2 font-semibold tracking-tight">
              {brandIcon}
              <span className="text-sm">Cortex360 IDP</span>
            </div>
          }
          brandIcon={brandIcon}
          footerSlot={
            <p className="px-2 text-[10px] text-muted-foreground">IDP v0.1 · prototype</p>
          }
        />
      }
      topbar={<Topbar />}
    >
      <FeatureErrorBoundary>{children}</FeatureErrorBoundary>
    </AppShell>
  )
}
