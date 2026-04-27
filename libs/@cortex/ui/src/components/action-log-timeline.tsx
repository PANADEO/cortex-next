"use client"

import type { PackageActionReadModel, PackageActionType } from "@cortex/types"
import { cn, formatAbsolute, formatRelative } from "@cortex/utils"
import {
  AlertCircle,
  ArchiveRestore,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Edit3,
  Loader2,
  MessageSquare,
  Play,
  RotateCcw,
  RotateCw,
  Sparkles,
  StickyNote,
  Tag,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useState } from "react"
import { JsonViewer } from "./json-viewer"
import { Badge } from "./ui/badge"

const ACTION_META: Partial<
  Record<PackageActionType, { icon: LucideIcon; tone: string; label: string }>
> = {
  imported: { icon: CircleDashed, tone: "text-info", label: "Imported" },
  imported_with_error: { icon: AlertCircle, tone: "text-warning-foreground", label: "Imported with error" },
  analysing: { icon: Loader2, tone: "text-info", label: "Analysis started" },
  analysis_failed: { icon: XCircle, tone: "text-destructive", label: "Analysis failed" },
  ready_for_verification: { icon: Play, tone: "text-success-foreground", label: "Ready for verification" },
  verification: { icon: Play, tone: "text-warning-foreground", label: "Verification started" },
  cancel_verification: { icon: RotateCcw, tone: "text-muted-foreground", label: "Verification cancelled" },
  verified: { icon: CheckCircle2, tone: "text-success-foreground", label: "Verified" },
  reset_verification: { icon: RotateCcw, tone: "text-muted-foreground", label: "Verification reset" },
  seller_updated: { icon: Edit3, tone: "text-muted-foreground", label: "Seller updated" },
  buyer_updated: { icon: Edit3, tone: "text-muted-foreground", label: "Buyer updated" },
  consignor_updated: { icon: Edit3, tone: "text-muted-foreground", label: "Consignor updated" },
  consignee_updated: { icon: Edit3, tone: "text-muted-foreground", label: "Consignee updated" },
  invoice_updated: { icon: Edit3, tone: "text-muted-foreground", label: "Invoice updated" },
  invoice_line_updated: { icon: Edit3, tone: "text-muted-foreground", label: "Invoice line updated" },
  invoice_totals_updated: { icon: Edit3, tone: "text-muted-foreground", label: "Invoice totals updated" },
  delivery_terms_updated: { icon: Edit3, tone: "text-muted-foreground", label: "Delivery terms updated" },
  transport_info_updated: { icon: Edit3, tone: "text-muted-foreground", label: "Transport info updated" },
  sad_context_updated: { icon: MessageSquare, tone: "text-muted-foreground", label: "SAD context updated" },
  custom_status_updated: { icon: Tag, tone: "text-muted-foreground", label: "Custom status updated" },
  user_notes_updated: { icon: StickyNote, tone: "text-muted-foreground", label: "User notes updated" },
  deleted: { icon: Trash2, tone: "text-destructive", label: "Deleted" },
  restored: { icon: ArchiveRestore, tone: "text-success-foreground", label: "Restored" },
}

// Backend logs reprocess as action_type "analysing" with payload.reprocess === true,
// not as a distinct action_type. Detected at render time from the payload.
const REPROCESS_META = {
  icon: RotateCw,
  tone: "text-info",
  label: "Reprocessed",
} as const

interface ActionLogTimelineProps {
  events: PackageActionReadModel[]
  showPayloads?: boolean
  className?: string
}

export function ActionLogTimeline({
  events,
  showPayloads = true,
  className,
}: ActionLogTimelineProps) {
  if (events.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>No actions yet.</p>
    )
  }

  return (
    <ol className={cn("space-y-3", className)}>
      {events.map((event) => (
        <TimelineRow key={event.id} event={event} showPayloads={showPayloads} />
      ))}
    </ol>
  )
}

function TimelineRow({
  event,
  showPayloads,
}: {
  event: PackageActionReadModel
  showPayloads: boolean
}) {
  const [open, setOpen] = useState(false)
  const hasPayload = showPayloads && event.payload && event.payload !== "null"

  let parsedPayload: unknown = null
  if (hasPayload && event.payload) {
    try {
      parsedPayload = JSON.parse(event.payload)
    } catch {
      parsedPayload = event.payload
    }
  }

  const isReprocess =
    event.action_type === "analysing" &&
    !!parsedPayload &&
    typeof parsedPayload === "object" &&
    (parsedPayload as { reprocess?: boolean }).reprocess === true

  const meta = isReprocess
    ? REPROCESS_META
    : ACTION_META[event.action_type] ?? {
        icon: ArrowRight,
        tone: "text-muted-foreground",
        label: event.action_type.replace(/_/g, " "),
      }
  const Icon = meta.icon

  return (
    <li className="flex gap-3">
      <div
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted",
          meta.tone,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium">{meta.label}</p>
          <time
            className="shrink-0 font-mono text-[10px] text-muted-foreground"
            title={formatAbsolute(event.timestamp)}
          >
            {formatRelative(event.timestamp)}
          </time>
        </div>
        <p className="text-xs text-muted-foreground">by {event.performed_by}</p>
        {showPayloads && isReprocess ? (
          <ReprocessPayload payload={parsedPayload} />
        ) : hasPayload ? (
          isDiffPayload(parsedPayload) ? (
            <DiffPayload diff={parsedPayload} />
          ) : (
            <>
              <button
                type="button"
                onClick={() => setOpen(!open)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {open ? "Hide payload" : "Show payload"}
              </button>
              {open ? <JsonViewer data={parsedPayload} initialDepth={1} /> : null}
            </>
          )
        ) : null}
      </div>
    </li>
  )
}

interface ReprocessPayloadShape {
  reprocess?: boolean
  use_fast_model?: boolean
  additional_ai_context_enabled?: boolean
  additional_ai_context?: string | null
}

function isReprocessPayload(v: unknown): v is ReprocessPayloadShape {
  return !!v && typeof v === "object" && !Array.isArray(v)
}

function ReprocessPayload({ payload }: { payload: unknown }) {
  const [expanded, setExpanded] = useState(false)

  if (!isReprocessPayload(payload)) {
    return (
      <p className="text-xs italic text-muted-foreground">
        Reprocess details unavailable
      </p>
    )
  }

  const aiEnabled = payload.additional_ai_context_enabled === true
  const fastProcessing = payload.use_fast_model === true
  const aiContext = typeof payload.additional_ai_context === "string"
    ? payload.additional_ai_context.trim()
    : ""
  const hasAiContext = aiEnabled && aiContext.length > 0
  // Long context gets a "Show more" toggle; short fits inline.
  const isLongContext = aiContext.length > 240

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        <Badge
          variant={aiEnabled ? "secondary" : "outline"}
          className="gap-1 text-[10px]"
        >
          <Sparkles className="h-3 w-3" />
          {aiEnabled ? "AI context used" : "No additional context"}
        </Badge>
        {fastProcessing ? (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Zap className="h-3 w-3" />
            Fast processing
          </Badge>
        ) : null}
      </div>
      {hasAiContext ? (
        <div className="rounded-md border border-border bg-muted/40 p-2 text-xs">
          {isLongContext && !expanded ? (
            <>
              <p className="whitespace-pre-wrap text-foreground">
                {aiContext.slice(0, 240)}…
              </p>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="mt-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Show more
              </button>
            </>
          ) : (
            <>
              <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-foreground">
                {aiContext}
              </p>
              {isLongContext ? (
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="mt-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  Show less
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}

function isDiffPayload(v: unknown): v is Record<string, { from: unknown; to: unknown }> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false
  const entries = Object.entries(v as Record<string, unknown>)
  if (entries.length === 0) return false
  return entries.every(([, val]) => {
    if (!val || typeof val !== "object" || Array.isArray(val)) return false
    const keys = Object.keys(val as object)
    return keys.includes("from") && keys.includes("to")
  })
}

function formatDiffValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string") return value.length > 0 ? value : "∅"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function DiffPayload({ diff }: { diff: Record<string, { from: unknown; to: unknown }> }) {
  return (
    <dl className="space-y-0.5 text-xs">
      {Object.entries(diff).map(([field, { from, to }]) => (
        <div key={field} className="flex flex-wrap items-baseline gap-1.5">
          <dt className="font-mono text-muted-foreground">{field}:</dt>
          <dd className="flex items-center gap-1 font-mono">
            <span className="text-destructive/80 line-through">{formatDiffValue(from)}</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="text-success-foreground">{formatDiffValue(to)}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}
