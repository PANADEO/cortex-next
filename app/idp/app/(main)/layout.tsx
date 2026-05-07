"use client"

import { AppShell, TileMenu } from "@cortex/ui"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { FeatureErrorBoundary } from "@/components/error-boundaries"
import { VersionLabel } from "@/components/shell/version-label"
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
  const isBoardRoute = pathname === "/idp/dashboard" || pathname === "/idp/board"

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
        className="dark:invert dark:hue-rotate-180"
        priority
      />
    </Link>
  )

  return (
    <AppShell
      sidebarCollapsed={collapsed}
      {...(isBoardRoute ? { mainClassName: "overflow-hidden" } : {})}
      sidebar={
        <TileMenu
          sections={IDP_NAV}
          activeItemId={activeItemId}
          collapsed={collapsed}
          brand={
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
                className="dark:invert dark:hue-rotate-180"
              />
              <span className="text-sm">Cortex360 IDP</span>
            </Link>
          }
          brandIcon={brandIcon}
          footerSlot={<VersionLabel tileId="idp" />}
        />
      }
      topbar={<Topbar />}
    >
      <FeatureErrorBoundary>{children}</FeatureErrorBoundary>
    </AppShell>
  )
}
