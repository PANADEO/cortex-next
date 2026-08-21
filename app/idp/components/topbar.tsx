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
  LocaleToggle,
  SkinToggle,
  ThemeToggle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  UserMenu,
} from "@cortex/ui"
import { cva } from "class-variance-authority"
import { Bell, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Fragment, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useResolvedBreadcrumbs } from "../lib/breadcrumbs"
import { localeChoices } from "../lib/i18n/config"
import { useLocaleStore } from "../lib/i18n/locale-store"
import { usePreset, usePresetStore } from "../lib/presets/preset-store"
import { presetChoices, presetChoiceToStored, storedToPresetChoice } from "../lib/presets/registry"
import { useSidebarStore } from "../lib/stores/sidebar-store"
import { useThemeStore } from "../lib/stores/theme-store"
import { CommandPalette } from "./command-palette"

/**
 * Pole szukania i klawisz `⌘K`. Kolory zostają tokenami; wariant zmienia
 * grubość ramki, krój klawisza i sposób reakcji na hover.
 *
 * `shadow-[2px_2px_0_hsl(var(--chart-1))]` to jedyne miejsce w tej zmianie,
 * gdzie sięgam po wartość arbitralną: twardy cień bez rozmycia nie ma
 * odpowiednika w skali Tailwinda. Kolor nadal idzie tokenem, a reguła siedzi w
 * tabeli wariantu — nie wraca do `globals.css` jako ręczna klasa `ch-*`, przez
 * którą poprzednie podejście trafiło do rewertu.
 */
const topbarSlots = {
  search: cva(
    "hidden h-8 w-64 items-center gap-2 rounded-md px-3 text-left text-xs transition-colors motion-reduce:transition-none lg:flex",
    {
      variants: {
        variant: {
          plain: "border border-border bg-muted/40 text-muted-foreground hover:bg-muted",
          ruled:
            "border-2 border-border bg-sidebar-accent text-sidebar-foreground hover:shadow-[2px_2px_0_hsl(var(--chart-1))]",
        },
      },
      defaultVariants: { variant: "plain" },
    },
  ),
  kbd: cva("rounded font-mono", {
    variants: {
      variant: {
        plain: "border border-border bg-background px-1 py-0.5 text-[10px]",
        ruled: "border-[1.5px] border-border bg-sidebar px-[5px] py-px text-[11px]",
      },
    },
    defaultVariants: { variant: "plain" },
  }),
}

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
  // Tu odwrotnie: kształt ma iść za tym, co użytkownik REALNIE widzi, więc
  // rozwiązany preset (user → instancja → domyślny), nie sam wybór ze store'u.
  const shellVariant = usePreset().variants.shell
  const persistPreferences = useSetUserPreferences()
  const shellUser = useShellUser()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)
  const { t: tCommon } = useTranslation("common")

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
                  aria-label={
                    collapsed
                      ? tCommon("actions.expandSidebar")
                      : tCommon("actions.collapseSidebar")
                  }
                >
                  {collapsed ? (
                    <PanelLeftOpen className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {collapsed ? tCommon("actions.expandSidebar") : tCommon("actions.collapseSidebar")}
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
          className={topbarSlots.search({ variant: shellVariant })}
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1">{tCommon("palette.searchOrJump")}</span>
          <kbd className={topbarSlots.kbd({ variant: shellVariant })}>⌘K</kbd>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <Bell className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{tCommon("nav.notifications")}</TooltipContent>
          </Tooltip>
          {/* Drugie miejsce renderu jednego store'u — ten sam wzorzec, którym
              chodzi już `ThemeToggle`. Uzasadnienie propsów w `shell-header.tsx`. */}
          <LocaleToggle
            locale={locale}
            options={localeChoices(tCommon)}
            onLocaleChange={setLocale}
          />
          <SkinToggle
            skin={storedToPresetChoice(storedPreset)}
            options={presetChoices(tCommon)}
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
