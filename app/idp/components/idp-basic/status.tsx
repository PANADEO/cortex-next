"use client"

import type {
  IdpBasicCompletenessStatus,
  IdpBasicDocumentType,
  IdpBasicPackageStatus,
} from "@/lib/idp-basic/types"
import { Badge } from "@cortex/ui"

const STATUS_LABELS: Record<IdpBasicPackageStatus, string> = {
  queued: "Przetwarzanie",
  processing: "Przetwarzanie",
  ready: "Przetworzone",
  needs_review: "Do weryfikacji",
  failed: "Błąd przetwarzania",
}

const STATUS_CLASS: Record<IdpBasicPackageStatus, string> = {
  queued: "border-info/40 bg-info/10 text-info",
  processing: "border-warning/40 bg-warning/10 text-warning",
  ready: "border-success/40 bg-success/10 text-success",
  needs_review: "border-warning/40 bg-warning/10 text-warning",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
}

const COMPLETENESS_LABELS: Record<IdpBasicCompletenessStatus, string> = {
  complete: "Kompletne",
  incomplete: "Niekompletne",
  unknown: "Nieznane",
}

const COMPLETENESS_CLASS: Record<IdpBasicCompletenessStatus, string> = {
  complete: "border-success/40 bg-success/10 text-success",
  incomplete: "border-warning/40 bg-warning/10 text-warning",
  unknown: "border-muted-foreground/30 bg-muted text-muted-foreground",
}

const DOCUMENT_TYPE_LABELS: Record<IdpBasicDocumentType, string> = {
  cost_invoice: "Faktura kosztowa",
  cmr: "CMR",
  pod: "POD / potwierdzenie dostawy",
  transport_order: "Zlecenie transportowe",
  other: "Inny dokument",
}

export function IdpBasicStatusBadge({ status }: { status: IdpBasicPackageStatus }) {
  return (
    <Badge variant="outline" className={STATUS_CLASS[status]}>
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
    <Badge variant="outline" className={COMPLETENESS_CLASS[resolved]}>
      {COMPLETENESS_LABELS[resolved]}
    </Badge>
  )
}

export function getIdpBasicDocumentTypeLabel(type: IdpBasicDocumentType | null): string {
  return type ? DOCUMENT_TYPE_LABELS[type] : "Nierozpoznany"
}

export function getIdpBasicStatusLabel(status: IdpBasicPackageStatus): string {
  return STATUS_LABELS[status]
}
