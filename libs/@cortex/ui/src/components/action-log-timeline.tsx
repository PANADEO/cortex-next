"use client"

import type { PackageActionReadModel, PackageActionType } from "@cortex/types"
import { cn, formatAbsolute, formatRelative, humanizeEnum } from "@cortex/utils"
import { formatDistanceToNowStrict, parseISO } from "date-fns"
import { Cpu, Sparkles, Zap } from "lucide-react"
import type { SyntheticEvent } from "react"
import { useMemo, useRef, useState } from "react"
import { JsonViewer } from "./json-viewer"
import { Badge } from "./ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"

type EventCategory = "edit" | "system" | "verification"
type SortOrder = "desc" | "asc"
type FilterValue = "all" | EventCategory

interface EditSummary {
  field: string
  from: unknown
  to: unknown
}

const CATEGORY_BY_ACTION = {
  imported: "system",
  imported_with_error: "system",
  analysing: "system",
  analysis_failed: "system",
  ready_for_verification: "system",
  verification: "verification",
  cancel_verification: "verification",
  unlock_verification: "verification",
  verified: "verification",
  reset_verification: "verification",
  seller_updated: "edit",
  buyer_updated: "edit",
  consignor_updated: "edit",
  consignee_updated: "edit",
  invoice_updated: "edit",
  invoice_line_updated: "edit",
  invoice_totals_updated: "edit",
  delivery_terms_updated: "edit",
  transport_info_updated: "edit",
  sad_context_updated: "edit",
  custom_status_updated: "edit",
  user_notes_updated: "edit",
  deleted: "system",
  restored: "system",
} as const satisfies Record<PackageActionType, EventCategory>

const ACTION_LABELS: Record<PackageActionType, string> = {
  imported: "Package imported",
  imported_with_error: "Imported with error",
  analysing: "Started analysis pipeline",
  analysis_failed: "Analysis failed",
  ready_for_verification: "Package ready for verification",
  verification: "Started package verification",
  cancel_verification: "Verification cancelled",
  unlock_verification: "Package unlocked",
  verified: "Marked package as verified",
  reset_verification: "Verification reset",
  seller_updated: "Updated seller",
  buyer_updated: "Updated buyer",
  consignor_updated: "Updated consignor",
  consignee_updated: "Updated consignee",
  invoice_updated: "Updated invoice",
  invoice_line_updated: "Updated invoice line",
  invoice_totals_updated: "Updated invoice totals",
  delivery_terms_updated: "Updated delivery terms",
  transport_info_updated: "Updated transport info",
  sad_context_updated: "Updated SAD context",
  custom_status_updated: "Updated custom status",
  user_notes_updated: "Updated user notes",
  deleted: "Package deleted",
  restored: "Package restored",
}

const TAG_LABEL_BY_CATEGORY: Record<EventCategory, string> = {
  edit: "Edit",
  system: "System",
  verification: "Verify",
}

const FILTER_DEFINITIONS: ReadonlyArray<{ value: FilterValue; label: string }> = [
  { value: "all", label: "All" },
  { value: "edit", label: "User edits" },
  { value: "system", label: "System" },
  { value: "verification", label: "Verification" },
]

export function categorise(actionType: PackageActionType): EventCategory {
  return CATEGORY_BY_ACTION[actionType]
}

// Same one-liner as user-menu / kanban-card / owner-filter — extract if a 5th appears.
function initialFor(source: string | null | undefined): string {
  const s = source?.trim() ?? ""
  return s.length > 0 ? s[0]!.toUpperCase() : "?"
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v)
}

export function normaliseEditPayload(payload: unknown): EditSummary[] {
  if (!isPlainObject(payload)) return []

  // Shape (a): flat — { field: string; previous: unknown; next: unknown }
  if (typeof payload.field === "string" && "previous" in payload && "next" in payload) {
    return [{ field: payload.field, from: payload.previous, to: payload.next }]
  }

  // Shape (b): nested — { line_no?, changes: { [field]: { prev/previous, next } } }
  if (isPlainObject(payload.changes)) {
    const lineNo = typeof payload.line_no === "number" ? payload.line_no : null
    const rows: EditSummary[] = []
    for (const [field, raw] of Object.entries(payload.changes)) {
      if (!isPlainObject(raw)) continue
      const hasPrev = "prev" in raw || "previous" in raw
      if (!hasPrev || !("next" in raw)) continue
      const fromValue = "prev" in raw ? raw.prev : raw.previous
      const fieldName = lineNo !== null ? `line ${lineNo} ${field}` : field
      rows.push({ field: fieldName, from: fromValue, to: raw.next })
    }
    return rows
  }

  // Shape (c): diff — { [field]: { from, to } }
  const entries = Object.entries(payload)
  if (entries.length === 0) return []
  const isDiff = entries.every(([, val]) => {
    if (!isPlainObject(val)) return false
    return "from" in val && "to" in val
  })
  if (isDiff) {
    return entries.map(([field, raw]) => {
      const obj = raw as Record<string, unknown>
      return { field, from: obj.from, to: obj.to }
    })
  }

  return []
}

interface ReprocessPayloadShape {
  reprocess?: boolean
  use_fast_model?: boolean
  additional_ai_context_enabled?: boolean
  additional_ai_context?: string | null
  packaging_selection_mode?: string | null
}

interface ActionLogTimelineProps {
  events: PackageActionReadModel[]
  showPayloads?: boolean
  className?: string
}

interface RowMeta {
  category: EventCategory
  isReprocess: boolean
  editSummary: EditSummary[]
  parsedPayload: unknown
  hasPayload: boolean
}

function parsePayload(raw: string | null): unknown {
  if (!raw || raw === "null") return null
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function buildRowMeta(event: PackageActionReadModel, showPayloads: boolean): RowMeta {
  const parsedPayload = showPayloads ? parsePayload(event.payload) : null
  const hasPayload = showPayloads && parsedPayload !== null
  const isReprocess =
    event.action_type === "analysing" &&
    isPlainObject(parsedPayload) &&
    parsedPayload.reprocess === true
  const category = categorise(event.action_type)
  const editSummary = category === "edit" && hasPayload ? normaliseEditPayload(parsedPayload) : []
  return { category, isReprocess, editSummary, parsedPayload, hasPayload }
}

export function ActionLogTimeline({
  events,
  showPayloads = true,
  className,
}: ActionLogTimelineProps) {
  const [filter, setFilter] = useState<FilterValue>("all")
  const [sort, setSort] = useState<SortOrder>("desc")
  // Map of event.id -> open boolean. Empty until first user toggle / collapse-expand-all.
  const [openMap, setOpenMap] = useState<ReadonlyMap<string, boolean>>(new Map())
  const hasUserToggledRef = useRef(false)
  // Tracks the open value we last rendered for each row so we can distinguish
  // user-driven onToggle events from React-controlled echoes (jsdom fires
  // toggle on every attribute change, browsers don't — be defensive).
  const lastRenderedOpenRef = useRef<Map<string, boolean>>(new Map())

  const rowMetas = useMemo(() => {
    const map = new Map<string, RowMeta>()
    for (const event of events) {
      map.set(event.id, buildRowMeta(event, showPayloads))
    }
    return map
  }, [events, showPayloads])

  const counts = useMemo(() => {
    const out = { all: events.length, edit: 0, system: 0, verification: 0 }
    for (const event of events) {
      out[categorise(event.action_type)] += 1
    }
    return out
  }, [events])

  const visible = useMemo(() => {
    const sorted = sort === "desc" ? events : events.slice().reverse()
    if (filter === "all") return sorted
    return sorted.filter((e) => categorise(e.action_type) === filter)
  }, [events, filter, sort])

  const span = useMemo(() => {
    if (events.length < 2) return null
    const sortedAsc = events.slice().sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    const oldest = sortedAsc[0]!.timestamp
    return formatDistanceToNowStrict(parseISO(oldest))
  }, [events])

  if (events.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>No actions yet.</p>
  }

  const handleToggle = (eventId: string) => (e: SyntheticEvent<HTMLDetailsElement>) => {
    const domOpen = e.currentTarget.open
    const lastRendered = lastRenderedOpenRef.current.get(eventId)
    // Programmatic echo from a React-driven open prop change — no user intent.
    if (lastRendered === domOpen) return
    hasUserToggledRef.current = true
    lastRenderedOpenRef.current.set(eventId, domOpen)
    const next = new Map(openMap)
    next.set(eventId, domOpen)
    setOpenMap(next)
  }

  const handleCollapseAll = () => {
    hasUserToggledRef.current = true
    const next = new Map<string, boolean>()
    for (const event of events) next.set(event.id, false)
    setOpenMap(next)
  }

  const handleExpandAll = () => {
    hasUserToggledRef.current = true
    const next = new Map<string, boolean>()
    for (const event of events) next.set(event.id, true)
    setOpenMap(next)
  }

  const firstVisibleId = visible[0]?.id ?? null

  return (
    <div className={cn("space-y-4", className)}>
      <Toolbar
        counts={counts}
        filter={filter}
        sort={sort}
        onFilterChange={setFilter}
        onSortChange={setSort}
      />
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-5 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Action log</h2>
            <span className="text-xs text-muted-foreground">
              {events.length} {events.length === 1 ? "event" : "events"}
              {span ? ` · ${span}` : null}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <button type="button" onClick={handleCollapseAll} className="hover:text-foreground">
              Collapse all
            </button>
            <span aria-hidden className="text-muted-foreground/50">
              |
            </span>
            <button type="button" onClick={handleExpandAll} className="hover:text-foreground">
              Expand all
            </button>
          </div>
        </header>
        {visible.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No events match this filter.
          </p>
        ) : (
          <ol>
            {visible.map((event) => {
              const meta = rowMetas.get(event.id)!
              const isFirstVisible = event.id === firstVisibleId
              const naturalDefault = !hasUserToggledRef.current && isFirstVisible
              const open = openMap.get(event.id) ?? naturalDefault
              // Record what we're about to render so onToggle can detect echoes.
              lastRenderedOpenRef.current.set(event.id, open)
              return (
                <li key={event.id}>
                  <ConversationRow
                    event={event}
                    meta={meta}
                    open={open}
                    onToggle={handleToggle(event.id)}
                  />
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}

interface ToolbarProps {
  counts: Record<FilterValue, number>
  filter: FilterValue
  sort: SortOrder
  onFilterChange: (value: FilterValue) => void
  onSortChange: (value: SortOrder) => void
}

function Toolbar({ counts, filter, sort, onFilterChange, onSortChange }: ToolbarProps) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs text-muted-foreground">Show:</span>
        {FILTER_DEFINITIONS.map((def) => {
          const active = filter === def.value
          return (
            <button
              key={def.value}
              type="button"
              onClick={() => onFilterChange(def.value)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                active
                  ? "border-cortex/40 bg-cortex/10 text-cortex-dark"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/40",
              )}
            >
              {def.label}
              <span
                className={cn(
                  "text-[10px] font-medium",
                  active ? "text-cortex-dark/70" : "text-muted-foreground/70",
                )}
              >
                {counts[def.value]}
              </span>
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Sort:</span>
        <Select value={sort} onValueChange={(v) => onSortChange(v as SortOrder)}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Newest first</SelectItem>
            <SelectItem value="asc">Oldest first</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </section>
  )
}

// Edit rail uses the literal cortex brand hex (also defined in tailwind.config
// as cortex.DEFAULT) so it stays the same blue across light/dark/customs and
// matches the mockup byte-for-byte. Verification + system use theme tokens.
const RAIL_BY_CATEGORY: Record<EventCategory, string> = {
  edit: "shadow-[inset_3px_0_0_0_#4A90E2]",
  verification: "shadow-[inset_3px_0_0_0_hsl(var(--success))]",
  system: "shadow-[inset_3px_0_0_0_hsl(var(--muted-foreground)/0.35)]",
}

const TAG_CLASS_BY_CATEGORY: Record<EventCategory, string> = {
  edit: "bg-cortex/10 text-cortex-dark",
  verification: "bg-success/15 text-success-foreground",
  system: "bg-muted text-muted-foreground",
}

interface ConversationRowProps {
  event: PackageActionReadModel
  meta: RowMeta
  open: boolean
  onToggle: (e: SyntheticEvent<HTMLDetailsElement>) => void
}

function ConversationRow({ event, meta, open, onToggle }: ConversationRowProps) {
  const { category, isReprocess, editSummary, parsedPayload, hasPayload } = meta
  const isSystemRow = category === "system"
  const senderLabel = isSystemRow ? "system" : event.performed_by
  const senderSub = isSystemRow ? "cortex.idp" : event.performed_by
  const subjectLabel = ACTION_LABELS[event.action_type] ?? humanizeEnum(event.action_type)
  const tagLabel = TAG_LABEL_BY_CATEGORY[category]

  return (
    <details
      className={cn(
        "group block border-b border-border/60 bg-card transition-colors last:border-b-0",
        "open:bg-muted/30 hover:bg-muted/20",
        RAIL_BY_CATEGORY[category],
      )}
      open={open}
      onToggle={onToggle}
    >
      <summary
        className={cn(
          "grid cursor-pointer list-none items-start gap-3.5 px-5 py-3.5",
          "grid-cols-[2rem_minmax(0,11rem)_minmax(0,1fr)_auto]",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <Avatar isSystem={isSystemRow} initial={initialFor(event.performed_by)} />
        <div className="min-w-0">
          <span
            className={cn(
              "block truncate text-sm font-semibold leading-tight text-foreground",
              isSystemRow && "font-medium text-muted-foreground",
            )}
          >
            {senderLabel}
          </span>
          <span className="block truncate text-[0.7rem] leading-tight text-muted-foreground/80">
            {senderSub}
          </span>
        </div>
        <div className="min-w-0">
          <span
            className={cn(
              "block text-sm leading-tight text-foreground",
              isSystemRow && "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "mr-1.5 inline-flex shrink-0 items-center rounded-sm px-1.5 py-0.5 font-mono text-[0.64rem] font-semibold uppercase tracking-wide",
                TAG_CLASS_BY_CATEGORY[category],
              )}
            >
              {tagLabel}
            </span>
            {subjectLabel}
          </span>
          <PreviewLine editSummary={editSummary} category={category} />
        </div>
        <Timestamp timestamp={event.timestamp} />
      </summary>
      <Body
        event={event}
        meta={{ category, isReprocess, editSummary, parsedPayload, hasPayload }}
      />
    </details>
  )
}

function Avatar({ isSystem, initial }: { isSystem: boolean; initial: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-semibold",
        isSystem ? "bg-muted text-muted-foreground" : "bg-cortex/15 text-cortex-dark",
      )}
      aria-hidden
    >
      {isSystem ? <Cpu className="h-3.5 w-3.5" /> : initial}
    </span>
  )
}

function Timestamp({ timestamp }: { timestamp: string }) {
  return (
    <time
      className="shrink-0 whitespace-nowrap text-right text-[0.72rem] leading-tight text-muted-foreground"
      title={formatAbsolute(timestamp, "yyyy-MM-dd HH:mm:ss")}
    >
      {formatRelative(timestamp)}
      <br />
      <span className="text-[0.65rem]">{formatAbsolute(timestamp, "HH:mm")}</span>
    </time>
  )
}

function PreviewLine({
  editSummary,
  category,
}: {
  editSummary: EditSummary[]
  category: EventCategory
}) {
  if (editSummary.length === 0) return null
  const first = editSummary[0]!
  const extraCount = editSummary.length - 1
  return (
    <span className="mt-0.5 block font-mono text-[0.74rem] leading-tight text-muted-foreground">
      <span className="font-sans text-muted-foreground">{first.field}: </span>
      <span className="text-destructive line-through decoration-destructive/50">
        {formatDiffValue(first.from)}
      </span>
      <span className="mx-1.5 text-muted-foreground/70">→</span>
      <span className="font-medium text-success">{formatDiffValue(first.to)}</span>
      {extraCount > 0 ? (
        <span className="ml-2 font-sans text-[0.7rem] text-muted-foreground/70">
          +{extraCount} more {category === "edit" ? "field" : "change"}
          {extraCount === 1 ? "" : "s"}
        </span>
      ) : null}
    </span>
  )
}

function Body({ event, meta }: { event: PackageActionReadModel; meta: RowMeta }) {
  const { category, isReprocess, editSummary, parsedPayload, hasPayload } = meta
  return (
    <div
      className={cn(
        "space-y-3 bg-muted/15 px-5 py-4 text-[0.82rem] text-foreground/80",
        "pl-[calc(2rem+0.875rem+1.25rem)]",
      )}
    >
      <MetaLine event={event} />
      <p className="text-foreground/80">{describe(event, category, isReprocess)}</p>
      {isReprocess ? (
        <ReprocessPayload payload={parsedPayload} />
      ) : editSummary.length > 0 ? (
        <DiffTable rows={editSummary} />
      ) : hasPayload ? (
        <JsonViewer data={parsedPayload} initialDepth={1} />
      ) : null}
    </div>
  )
}

function describe(
  event: PackageActionReadModel,
  category: EventCategory,
  isReprocess: boolean,
): string {
  if (isReprocess) {
    return "Reprocess triggered. Pipeline rerun with the parameters listed below."
  }
  if (category === "edit") {
    return `${ACTION_LABELS[event.action_type]}. See diff below for changed fields.`
  }
  return ACTION_LABELS[event.action_type] ?? humanizeEnum(event.action_type)
}

function MetaLine({ event }: { event: PackageActionReadModel }) {
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 border-b border-dashed border-border/60 pb-2 text-[0.72rem] text-muted-foreground">
      <span className="inline-flex items-baseline gap-1">
        <dt className="text-muted-foreground/80">Event</dt>
        <dd className="font-mono text-foreground/80">{event.action_type}</dd>
      </span>
      <span className="inline-flex items-baseline gap-1">
        <dt className="text-muted-foreground/80">By</dt>
        <dd className="text-foreground/80">{event.performed_by}</dd>
      </span>
      <span className="inline-flex items-baseline gap-1">
        <dt className="text-muted-foreground/80">At</dt>
        <dd className="text-foreground/80" title={event.timestamp}>
          {formatAbsolute(event.timestamp, "yyyy-MM-dd HH:mm:ss")}
        </dd>
      </span>
    </dl>
  )
}

function DiffTable({ rows }: { rows: EditSummary[] }) {
  return (
    <table className="w-full border-collapse text-[0.78rem]">
      <thead>
        <tr>
          <th className="border-b border-border bg-muted/60 px-2.5 py-1.5 text-left text-[0.66rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Field
          </th>
          <th className="border-b border-border bg-muted/60 px-2.5 py-1.5 text-left text-[0.66rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Before
          </th>
          <th className="border-b border-border bg-muted/60 px-2.5 py-1.5 text-left text-[0.66rem] font-semibold uppercase tracking-wide text-muted-foreground">
            After
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.field} className="border-b border-border/40 last:border-b-0">
            <td className="px-2.5 py-2 align-top text-[0.78rem] font-medium text-foreground/80">
              {row.field}
            </td>
            <td className="px-2.5 py-2 align-top font-mono text-[0.76rem]">
              <span className="text-destructive line-through decoration-destructive/50">
                {formatDiffValue(row.from)}
              </span>
            </td>
            <td className="px-2.5 py-2 align-top font-mono text-[0.76rem]">
              <span className="font-medium text-success">{formatDiffValue(row.to)}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ReprocessPayload({ payload }: { payload: unknown }) {
  if (!isPlainObject(payload)) {
    return <p className="text-xs italic text-muted-foreground">Reprocess details unavailable</p>
  }
  const shape = payload as ReprocessPayloadShape
  const aiEnabled = shape.additional_ai_context_enabled === true
  const fastProcessing = shape.use_fast_model === true
  const aiContext =
    typeof shape.additional_ai_context === "string" ? shape.additional_ai_context.trim() : ""
  const hasAiContext = aiEnabled && aiContext.length > 0
  const packagingMode = formatPackagingSelectionMode(shape.packaging_selection_mode)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <Badge variant={aiEnabled ? "secondary" : "outline"} className="gap-1 text-[10px]">
          <Sparkles className="h-3 w-3" />
          {aiEnabled ? "AI context used" : "No additional context"}
        </Badge>
        {fastProcessing ? (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Zap className="h-3 w-3" />
            Fast processing
          </Badge>
        ) : null}
        {packagingMode ? (
          <Badge variant="outline" className="text-[10px]">
            {packagingMode}
          </Badge>
        ) : null}
      </div>
      {hasAiContext ? (
        <div className="rounded-md border border-border bg-muted/40 p-2 text-xs">
          <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-foreground">
            {aiContext}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function formatPackagingSelectionMode(value: unknown): string | null {
  if (typeof value !== "string") return null
  if (value === "auto_by_bill_of_lading") return "Packaging: auto by B/L"
  if (value === "force_packages") return "Packaging: packages"
  if (value === "force_pallets") return "Packaging: pallets"
  return null
}

function formatDiffValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string") return value.length > 0 ? value : "∅"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}
