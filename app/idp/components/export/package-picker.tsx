"use client"

import { usePackages } from "@cortex/api"
import type { PackageReadModel } from "@cortex/types"
import {
  Button,
  Checkbox,
  Input,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cortex/ui"
import { cn, formatRelative } from "@cortex/utils"
import { CheckCircle2, Loader2, PlayCircle, Search } from "lucide-react"
import { useMemo, useState } from "react"
import type { ExportBuilderState } from "@/lib/export/use-export-builder"

type Readiness = "verified" | "ready" | "all"

const READINESS_FILTERS: ReadonlyArray<{ value: Readiness; label: string }> = [
  { value: "verified", label: "Verified only" },
  { value: "ready", label: "Ready + verified" },
  { value: "all", label: "All" },
]

function isReady(pkg: PackageReadModel): boolean {
  return pkg.processing_state === "ready"
}

function isVerified(pkg: PackageReadModel): boolean {
  return isReady(pkg) && pkg.verification_state === "completed"
}

function matchReadiness(pkg: PackageReadModel, readiness: Readiness): boolean {
  if (readiness === "all") return true
  if (readiness === "verified") return isVerified(pkg)
  return isReady(pkg)
}

interface PackagePickerProps {
  state: ExportBuilderState
}

export function PackagePicker({ state }: PackagePickerProps) {
  const [search, setSearch] = useState("")
  const [readiness, setReadiness] = useState<Readiness>("verified")

  const { data, isLoading } = usePackages({
    limit: 200,
    sort_by: "created_date",
    sort_order: "desc",
  })

  const filtered = useMemo(() => {
    const items = data?.items ?? []
    const needle = search.trim().toLowerCase()
    return items.filter((pkg) => {
      if (!matchReadiness(pkg, readiness)) return false
      if (!needle) return true
      return (
        pkg.file_name.toLowerCase().includes(needle) ||
        pkg.id.toLowerCase().includes(needle) ||
        (pkg.assignee?.toLowerCase().includes(needle) ?? false)
      )
    })
  }, [data?.items, readiness, search])

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((p) => state.selectedPackageIds.has(p.id))

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      const next = new Set(state.selectedPackageIds)
      for (const p of filtered) next.delete(p.id)
      state.setSelectedPackageIds(next)
    } else {
      const next = new Set(state.selectedPackageIds)
      for (const p of filtered) next.add(p.id)
      state.setSelectedPackageIds(next)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Select packages</h3>
            <p className="text-[11px] text-muted-foreground">
              Pick which packages get exported in this batch.
            </p>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {state.selectedPackageIds.size} selected
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search packages…"
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Select
            value={readiness}
            onValueChange={(v) => setReadiness(v as Readiness)}
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {READINESS_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allVisibleSelected}
            onCheckedChange={toggleAllVisible}
            aria-label="Select all visible"
            disabled={filtered.length === 0}
          />
          <span className="text-[11px] text-muted-foreground">
            {filtered.length} packages match
          </span>
        </div>
        {state.selectedPackageIds.size > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-[11px]"
            onClick={state.clearPackages}
          >
            Clear
          </Button>
        ) : null}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ul className="divide-y divide-border">
          {isLoading ? (
            <li className="flex items-center justify-center px-4 py-6 text-xs text-muted-foreground">
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              Loading…
            </li>
          ) : filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-xs text-muted-foreground">
              Nothing matches current filters.
            </li>
          ) : (
            filtered.map((pkg) => (
              <PackageRow
                key={pkg.id}
                pkg={pkg}
                checked={state.selectedPackageIds.has(pkg.id)}
                onToggle={() => state.togglePackage(pkg.id)}
              />
            ))
          )}
        </ul>
      </ScrollArea>
    </div>
  )
}

function PackageRow({
  pkg,
  checked,
  onToggle,
}: {
  pkg: PackageReadModel
  checked: boolean
  onToggle: () => void
}) {
  const verified = isVerified(pkg)
  return (
    <li
      className={cn(
        "flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40",
        checked && "bg-primary/5",
      )}
      onClick={onToggle}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Select ${pkg.file_name}`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{pkg.file_name}</p>
        <p className="truncate font-mono text-[10px] text-muted-foreground">
          {pkg.id} · {formatRelative(pkg.created_date)} ·{" "}
          {pkg.assignee ?? "unassigned"}
        </p>
      </div>
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-sm px-2 py-0.5 text-[10px] font-medium",
          verified
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
            : "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
        )}
      >
        {verified ? <CheckCircle2 className="h-3 w-3" /> : <PlayCircle className="h-3 w-3" />}
        {verified ? "Verified" : "Ready"}
      </span>
    </li>
  )
}
