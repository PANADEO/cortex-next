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
} from "@cortex/ui"
import { Bell, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Fragment, useEffect, useState } from "react"
import { useResolvedBreadcrumbs } from "../lib/breadcrumbs"
import { usePresetStore } from "../lib/presets/preset-store"
import { PRESET_CHOICES, presetChoiceToStored, storedToPresetChoice } from "../lib/presets/registry"
import { useSidebarStore } from "../lib/stores/sidebar-store"
import { useThemeStore } from "../lib/stores/theme-store"
import { CommandPalette } from "./command-palette"

interface TopbarProps {
  showSidebarToggle?: boolean
}

export function Topbar({ showSidebarToggle = true }: TopbarProps) {
  const pathname = usePathname()
  const collapsed = useSidebarStore((s) => s.collapsed)
  const toggle = useSidebarStore((s) => s.toggle)
  const themeMode = useThemeStore((s) => s.mode)
  const setThemeMode = useThemeStore((s) => s.setMode)
  // Wybór ze store'a, nie rozwiązany preset — uzasadnienie w `shell-header.tsx`.
  const storedPreset = usePresetStore((s) => s.preset)
  const setPreset = usePresetStore((s) => s.setPreset)
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
          className="hidden h-8 w-64 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-left text-xs text-muted-foreground transition-colors hover:bg-muted lg:flex"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1">Search or jump...</span>
          <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">
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
          {/* Drugie miejsce renderu jednego store'u — ten sam wzorzec, którym
              chodzi już `ThemeToggle`. Uzasadnienie propsów w `shell-header.tsx`. */}
          <SkinToggle
            skin={storedToPresetChoice(storedPreset)}
            options={PRESET_CHOICES}
            onSkinChange={(choice) => setPreset(presetChoiceToStored(choice))}
          />
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
