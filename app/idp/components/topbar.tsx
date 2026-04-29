"use client"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  SkinToggle,
  type SkinOption,
  ThemeToggle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  UserMenu,
} from "@cortex/ui"
import { useSetUserPreferences } from "@cortex/api"
import { Bell, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Fragment, useEffect, useState } from "react"
import { breadcrumbsFromPath } from "../lib/breadcrumbs"
import { buildLogoutChainUrl } from "../lib/logout"
import { SKINS, useSkinStore, type SkinId } from "../lib/stores/skin-store"
import { useSidebarStore } from "../lib/stores/sidebar-store"
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

export function Topbar() {
  const pathname = usePathname()
  const collapsed = useSidebarStore((s) => s.collapsed)
  const toggle = useSidebarStore((s) => s.toggle)
  const themeMode = useThemeStore((s) => s.mode)
  const setThemeMode = useThemeStore((s) => s.setMode)
  const skin = useSkinStore((s) => s.skin)
  const setSkin = useSkinStore((s) => s.setSkin)
  const persistPreferences = useSetUserPreferences()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const logoutHref =
    typeof window !== "undefined"
      ? buildLogoutChainUrl(`${window.location.origin}/login`)
      : null

  const trail = breadcrumbsFromPath(pathname)

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
        <div className="flex flex-1 items-center gap-3">
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
          className="flex h-8 w-64 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-left text-xs text-muted-foreground transition-colors hover:bg-muted"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1">Search packages…</span>
          <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">
            ⌘K
          </kbd>
        </button>

        <div className="flex items-center gap-1">
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
          <UserMenu logoutHref={logoutHref} />
        </div>
      </TooltipProvider>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  )
}
