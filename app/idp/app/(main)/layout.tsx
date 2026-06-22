"use client"

import { FeatureErrorBoundary } from "@/components/error-boundaries"
import { AppGate } from "@/components/shell/app-gate"
import { VersionLabel } from "@/components/shell/version-label"
import { Topbar } from "@/components/topbar"
import { useIdpBasicNavSections, useIdpNavSections } from "@/lib/nav"
import { useSidebarStore } from "@/lib/stores/sidebar-store"
import { TILES } from "@/lib/tiles"
import { AppShell, TileMenu } from "@cortex/ui"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

function pathToItemId(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean)
  const first = segments[0]
  if (first === "idp" || first === "idp-basic") return segments[1] ?? "dashboard"
  return first ?? "dashboard"
}

function pathToTileId(pathname: string): string {
  const first = pathname.split("/").filter(Boolean)[0]
  return first === "idp-basic" ? "idp-basic" : "idp"
}

export default function MainLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const tileId = pathToTileId(pathname)
  const tile = TILES.find((t) => t.id === tileId)
  const activeItemId = pathToItemId(pathname)
  const collapsed = useSidebarStore((s) => s.collapsed)
  const isBoardRoute =
    pathname === "/idp/dashboard" || pathname === "/idp/board" || pathname === "/idp-basic/dashboard"
  const idpNavSections = useIdpNavSections()
  const idpBasicNavSections = useIdpBasicNavSections()
  const navSections = tileId === "idp-basic" ? idpBasicNavSections : idpNavSections

  const brandIcon = (
    <Link
      href="/"
      aria-label="Powrót do Cortex360 hub"
      className="inline-block transition-opacity hover:opacity-80"
    >
      <Image
        src="/cortex-logo.png"
        alt="Cortex360"
        width={28}
        height={28}
        className="dark:hue-rotate-180 dark:invert"
        priority
      />
    </Link>
  )

  const brand = (
    <Link
      href="/"
      aria-label="Powrót do Cortex360 hub"
      className="flex items-center gap-2 font-semibold tracking-tight transition-opacity hover:opacity-80"
    >
      <Image
        src="/cortex-logo.png"
        alt="Cortex360"
        width={28}
        height={28}
        className="dark:hue-rotate-180 dark:invert"
      />
      <span className="text-sm">Cortex360 {tile?.label ?? "IDP"}</span>
    </Link>
  )

  return (
    <AppGate>
      <AppShell
        sidebarCollapsed={collapsed}
        {...(isBoardRoute ? { mainClassName: "overflow-hidden" } : {})}
        sidebar={
          <TileMenu
            sections={navSections}
            activeItemId={activeItemId}
            collapsed={collapsed}
            brand={brand}
            brandIcon={brandIcon}
            footerSlot={<VersionLabel tileId={tileId} />}
          />
        }
        topbar={<Topbar />}
      >
        <FeatureErrorBoundary>{children}</FeatureErrorBoundary>
      </AppShell>
    </AppGate>
  )
}
