"use client"

import { usePackages } from "@cortex/api"
import { Dialog, DialogContent, DialogTitle, Input } from "@cortex/ui"
import { cn } from "@cortex/utils"
import {
  BarChart3,
  FileSpreadsheet,
  History,
  Package,
  ScrollText,
  Search,
  Upload,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"

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

const NAV_ENTRIES: Entry[] = [
  { id: "nav-dashboard", group: "Navigation", label: "Dashboard", icon: BarChart3, href: "/dashboard" },
  { id: "nav-packages", group: "Navigation", label: "Packages", icon: Package, href: "/packages" },
  { id: "nav-import", group: "Navigation", label: "Import", icon: Upload, href: "/import" },
  { id: "nav-audit", group: "Navigation", label: "Audit log", icon: History, href: "/audit-log" },
  { id: "nav-classification", group: "Navigation", label: "Classification", icon: FileSpreadsheet, href: "/classification" },
  { id: "nav-rules", group: "Navigation", label: "Rule editor", icon: ScrollText, href: "/rules" },
]

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const packages = usePackages({ limit: 20, search: query || null })

  const entries: Entry[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    const nav = q
      ? NAV_ENTRIES.filter((e) => e.label.toLowerCase().includes(q))
      : NAV_ENTRIES
    const pkgEntries: Entry[] = (packages.data?.items ?? []).map((p) => ({
      id: `pkg-${p.id}`,
      group: "Packages",
      label: p.file_name,
      hint: p.id,
      icon: Package,
      href: `/packages/${p.id}`,
    }))
    return [...nav, ...pkgEntries]
  }, [query, packages.data])

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
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search packages or jump to…"
            className="h-12 border-0 bg-transparent text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <kbd className="pointer-events-none hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground md:inline-block">
            Esc
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {entries.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No results.
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
                      activeIdx === i
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/60",
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
            navigate
          </span>
          <span>
            <kbd className="rounded border border-border bg-background px-1 font-mono">↵</kbd>{" "}
            open
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
