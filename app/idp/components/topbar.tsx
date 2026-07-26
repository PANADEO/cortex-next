"use client"

import { useSetUserPreferences, useShellUser } from "@cortex/api"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  SkinToggle,
  ThemeToggle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  UserMenu,
  type SkinOption,
} from "@cortex/ui"
import { Bell, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Fragment, useEffect, useState } from "react"
import { useResolvedBreadcrumbs } from "../lib/breadcrumbs"
import { useSidebarStore } from "../lib/stores/sidebar-store"
import { SKINS, useSkinStore, type SkinId } from "../lib/stores/skin-store"
import { useThemeStore } from "../lib/stores/theme-store"
import { CommandPalette } from "./command-palette"

const SKIN_SWATCHES: Record<SkinId, readonly [string, string, string]> = {
  default: ["#0a0a0a", "#f5f5f5", "#a3a3a3"],
  customs: ["#f97316", "#15803d", "#fbbf24"],
}

const SKIN_OPTIONS: readonly SkinOption<SkinId>[] = SKINS.map((s) => ({
  id: s.id,
  label: s.label,
  description: s.description,
  swatch: SKIN_SWATCHES[s.id],
}))

interface TopbarProps {
  showSidebarToggle?: boolean
}

export function Topbar({ showSidebarToggle = true }: TopbarProps) {
  const pathname = usePathname()
  const collapsed = useSidebarStore((s) => s.collapsed)
  const toggle = useSidebarStore((s) => s.toggle)
  const themeMode = useThemeStore((s) => s.mode)
  const setThemeMode = useThemeStore((s) => s.setMode)
  const skin = useSkinStore((s) => s.skin)
  const setSkin = useSkinStore((s) => s.setSkin)
  const persistPreferences = useSetUserPreferences()
  const shellUser = useShellUser()
  const [paletteOpen, setPaletteOpen] = useState(false)

  const trail = useResolvedBreadcrumbs(pathname)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {showSidebarToggle ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={toggle}
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  {collapsed ? (
                    <PanelLeftOpen className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {collapsed ? "Expand sidebar" : "Collapse sidebar"}
              </TooltipContent>
            </Tooltip>
          ) : null}

          <Breadcrumb>
            <BreadcrumbList>
              {trail.map((entry, idx) => {
                const isLast = idx === trail.length - 1
                return (
                  <Fragment key={`${entry.label}-${idx}`}>
                    <BreadcrumbItem>
                      {isLast || !entry.href ? (
                        <BreadcrumbPage>{entry.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link href={entry.href}>{entry.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {isLast ? null : <BreadcrumbSeparator />}
                  </Fragment>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="ch-top-search hidden h-8 w-64 items-center gap-2 px-3 text-left text-xs lg:flex"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1">Search or jump...</span>
          <kbd className="ch-top-kbd">
            ⌘K
          </kbd>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <Bell className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Notifications</TooltipContent>
          </Tooltip>
          <SkinToggle skin={skin} options={SKIN_OPTIONS} onSkinChange={setSkin} />
          <ThemeToggle
            mode={themeMode}
            onModeChange={(next) => {
              setThemeMode(next)
              persistPreferences.mutate({ theme_mode: next })
            }}
          />
          <UserMenu user={shellUser} />
        </div>
      </TooltipProvider>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  )
}
