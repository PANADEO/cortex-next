"use client"

import type { IdpBasicPackageStatus } from "@/lib/idp-basic/types"
import { Badge } from "@cortex/ui"

const STATUS_LABELS: Record<IdpBasicPackageStatus, string> = {
  queued: "Queued",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
}

const STATUS_CLASS: Record<IdpBasicPackageStatus, string> = {
  queued: "border-info/40 bg-info/10 text-info",
  processing: "border-warning/40 bg-warning/10 text-warning",
  ready: "border-success/40 bg-success/10 text-success",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
}

export function IdpBasicStatusBadge({ status }: { status: IdpBasicPackageStatus }) {
  return (
    <Badge variant="outline" className={STATUS_CLASS[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
