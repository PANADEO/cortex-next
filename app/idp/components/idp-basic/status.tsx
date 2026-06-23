"use client"

import type {
  IdpBasicCompletenessStatus,
  IdpBasicDocumentType,
  IdpBasicPackageStatus,
} from "@/lib/idp-basic/types"
import { Badge } from "@cortex/ui"

const STATUS_LABELS: Record<IdpBasicPackageStatus, string> = {
  queued: "Queued",
  processing: "Processing",
  ready: "Ready",
  needs_review: "Needs review",
  failed: "Failed",
}

const STATUS_CLASS: Record<IdpBasicPackageStatus, string> = {
  queued: "border-info/40 bg-info/10 text-info",
  processing: "border-warning/40 bg-warning/10 text-warning",
  ready: "border-success/40 bg-success/10 text-success",
  needs_review: "border-warning/40 bg-warning/10 text-warning",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
}

const COMPLETENESS_LABELS: Record<IdpBasicCompletenessStatus, string> = {
  complete: "Complete",
  incomplete: "Incomplete",
  unknown: "Unknown",
}

const COMPLETENESS_CLASS: Record<IdpBasicCompletenessStatus, string> = {
  complete: "border-success/40 bg-success/10 text-success",
  incomplete: "border-warning/40 bg-warning/10 text-warning",
  unknown: "border-muted-foreground/30 bg-muted text-muted-foreground",
}

const DOCUMENT_TYPE_LABELS: Record<IdpBasicDocumentType, string> = {
  cost_invoice: "Cost invoice",
  cmr: "CMR",
  pod: "POD / proof of delivery",
  transport_order: "Transport order",
  other: "Other document",
}

export function IdpBasicStatusBadge({ status }: { status: IdpBasicPackageStatus }) {
  return (
    <Badge variant="outline" className={`${STATUS_CLASS[status]} whitespace-nowrap`}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}

export function IdpBasicCompletenessBadge({
  status,
}: {
  status: IdpBasicCompletenessStatus | null
}) {
  const resolved = status ?? "unknown"
  return (
    <Badge variant="outline" className={`${COMPLETENESS_CLASS[resolved]} whitespace-nowrap`}>
      {COMPLETENESS_LABELS[resolved]}
    </Badge>
  )
}

export function getIdpBasicDocumentTypeLabel(type: IdpBasicDocumentType | null): string {
  return type ? DOCUMENT_TYPE_LABELS[type] : "Unknown"
}

export function getIdpBasicStatusLabel(status: IdpBasicPackageStatus): string {
  return STATUS_LABELS[status]
}

export function formatIdpBasicDisplayText(value: string): string {
  const exactLabels: Record<string, string> = {
    "Brak CMR": "Missing CMR",
    "Brak POD": "Missing POD",
    "Brak faktury kosztowej": "Missing cost invoice",
    "Brak zlecenia transportowego": "Missing transport order",
    "Nie znaleziono numeru referencyjnego": "Reference number not found",
  }
  if (exactLabels[value]) return exactLabels[value]

  const prefixes: Array<[string, string]> = [
    ["Dokument nierozpoznany:", "Unrecognized document:"],
    ["Niska pewność klasyfikacji:", "Low classification confidence:"],
    ["CMR zawiera uwagę lub zastrzeżenie:", "CMR contains a remark or reservation:"],
    ["Niepełna analiza po maksymalnym zakresie:", "Incomplete analysis after full coverage:"],
    ["Pominięto nieobsługiwany plik:", "Skipped unsupported file:"],
  ]
  for (const [source, replacement] of prefixes) {
    if (value.startsWith(source)) return value.replace(source, replacement)
  }
  return value
}
