"use client"

import type {
  IntrastatBatchStatus,
  IntrastatCnMatchStatus,
  IntrastatTransactionKind,
} from "@/lib/intrastat/types"
import { Badge } from "@cortex/ui"

const STATUS_LABELS: Record<IntrastatBatchStatus, string> = {
  queued: "Queued",
  processing: "Processing",
  ready: "Ready",
  needs_review: "Needs review",
  failed: "Failed",
}

const MATCH_LABELS: Record<IntrastatCnMatchStatus, string> = {
  exact: "Exact",
  prefix_unique: "Closest index",
  description_match: "Description",
  semantic_match: "Semantic",
  invoice_cn: "Invoice CN",
  manual: "Manual",
  ambiguous: "Ambiguous",
  unmatched: "Unmatched",
}

export function getIntrastatStatusLabel(status: IntrastatBatchStatus): string {
  return STATUS_LABELS[status]
}

export function getIntrastatMatchLabel(status: IntrastatCnMatchStatus): string {
  return MATCH_LABELS[status]
}

export function IntrastatStatusBadge({ status }: { status: IntrastatBatchStatus }) {
  const variant = status === "failed" ? "destructive" : status === "ready" ? "secondary" : "outline"
  return <Badge variant={variant}>{STATUS_LABELS[status]}</Badge>
}

export function IntrastatMatchBadge({
  status,
  confidence,
}: {
  status: IntrastatCnMatchStatus
  confidence?: number | null
}) {
  const variant =
    status === "ambiguous" || status === "unmatched"
      ? "destructive"
      : status === "manual" || status === "exact"
        ? "secondary"
        : "outline"
  const percentage =
    confidence === null || confidence === undefined ? null : Math.round(confidence * 100)
  return (
    <Badge variant={variant} className="whitespace-nowrap">
      {MATCH_LABELS[status]}
      {percentage === null ? null : ` ${percentage}%`}
    </Badge>
  )
}

export function IntrastatKindBadge({ kind }: { kind: IntrastatTransactionKind }) {
  return <Badge variant={kind === "WNT" ? "secondary" : "outline"}>{kind}</Badge>
}
