"use client"

import type { PackageActionReadModel, PackageActionType } from "@cortex/types"
import { cn, formatAbsolute, formatRelative } from "@cortex/utils"
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Edit3,
  Loader2,
  Play,
  RotateCcw,
  XCircle,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useState } from "react"
import { JsonViewer } from "./json-viewer"

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
}

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
  const meta = ACTION_META[event.action_type] ?? {
    icon: ArrowRight,
    tone: "text-muted-foreground",
    label: event.action_type.replace(/_/g, " "),
  }
  const Icon = meta.icon
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
        {hasPayload ? (
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
        ) : null}
      </div>
    </li>
  )
}
