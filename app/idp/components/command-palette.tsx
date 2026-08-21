"use client"

import { useIdpBasicNavSections, useIdpNavSections, useIntrastatNavSections } from "@/lib/nav"
import { TILES } from "@/lib/tiles"
import { usePackages } from "@cortex/api"
import { Dialog, DialogContent, DialogTitle, Input } from "@cortex/ui"
import { cn } from "@cortex/utils"
import type { LucideIcon } from "lucide-react"
import { Package, Search } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface Entry {
  id: string
  group: string
  label: string
  hint?: string
  icon: LucideIcon
  href: string
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useTranslation("common")
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const tileId = pathToTileId(pathname)
  const idpNavSections = useIdpNavSections()
  const idpBasicNavSections = useIdpBasicNavSections()
  const intrastatNavSections = useIntrastatNavSections()
  const navSections =
    tileId === "idp-basic"
      ? idpBasicNavSections
      : tileId === "intrastat"
        ? intrastatNavSections
        : idpNavSections
  const navEntries = useMemo<Entry[]>(
    () =>
      navSections.flatMap((section) =>
        section.items.map((item) => ({
          id: `nav-${item.id}`,
          group: t("palette.navigation"),
          label: item.label,
          icon: item.icon,
          href: item.href,
        })),
      ),
    [navSections, t],
  )

  const packages = usePackages(
    { limit: 20, search: deferredQuery || null },
    { enabled: open && tileId === "idp" },
  )

  const entries: Entry[] = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    const nav = q ? navEntries.filter((e) => e.label.toLowerCase().includes(q)) : navEntries
    const pkgEntries: Entry[] =
      tileId === "idp"
        ? (packages.data?.items ?? []).map((p) => ({
            id: `pkg-${p.id}`,
            group: t("palette.extraction"),
            label: p.package_name ?? p.file_name,
            ...(p.package_name ? { hint: p.file_name } : {}),
            icon: Package,
            href: `/idp/packages/${p.id}`,
          }))
        : []
    return [...nav, ...pkgEntries]
  }, [deferredQuery, navEntries, packages.data, tileId, t])

  useEffect(() => {
    setActiveIdx(0)
  }, [query, entries.length])

  useEffect(() => {
    if (!open) {
      setQuery("")
      setActiveIdx(0)
    }
  }, [open])

  const go = (e: Entry) => {
    onOpenChange(false)
    router.push(e.href)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIdx((i) => Math.min(entries.length - 1, i + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIdx((i) => Math.max(0, i - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const entry = entries[activeIdx]
      if (entry) go(entry)
    }
  }

  let currentGroup = ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl gap-0 overflow-hidden p-0"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <DialogTitle className="sr-only">{t("palette.title")}</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder={tileId === "idp" ? t("palette.searchPackages") : t("palette.jumpTo")}
            className="h-12 border-0 bg-transparent text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <kbd className="pointer-events-none hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline-block">
            Esc
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {entries.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("palette.noResults")}
            </p>
          ) : (
            entries.map((entry, i) => {
              const showGroup = entry.group !== currentGroup
              currentGroup = entry.group
              const Icon = entry.icon
              return (
                <div key={entry.id}>
                  {showGroup ? (
                    <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {entry.group}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => go(entry)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                      activeIdx === i ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{entry.label}</span>
                    {entry.hint ? (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {entry.hint}
                      </span>
                    ) : null}
                  </button>
                </div>
              )
            })
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-3 py-1.5 text-[10px] text-muted-foreground">
          <span>
            <kbd className="rounded border border-border bg-background px-1 font-mono">↑↓</kbd>{" "}
            {t("palette.navigate")}
          </span>
          <span>
            <kbd className="rounded border border-border bg-background px-1 font-mono">↵</kbd>{" "}
            {t("palette.open")}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function pathToTileId(pathname: string): string {
  const first = pathname.split("/").filter(Boolean)[0]
  return TILES.some((tile) => tile.id === first) ? (first ?? "idp") : "idp"
}
