"use client"

import type {
  IntrastatBatchStatus,
  IntrastatCnMatchStatus,
  IntrastatTransactionKind,
} from "@/lib/intrastat/types"
import { Badge } from "@cortex/ui"
import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"

// `t` przychodzi argumentem, bo te dwie funkcje wołają też definicje kolumn
// tabeli — zwykłe funkcje, nie komponenty, więc hook nie ma się gdzie zaczepić.
export function getIntrastatStatusLabel(
  t: TFunction<"intrastat">,
  status: IntrastatBatchStatus,
): string {
  return t(`status.${status}`)
}

export function getIntrastatMatchLabel(
  t: TFunction<"intrastat">,
  status: IntrastatCnMatchStatus,
): string {
  return t(`match.${status}`)
}

export function IntrastatStatusBadge({ status }: { status: IntrastatBatchStatus }) {
  const { t } = useTranslation("intrastat")
  const variant = status === "failed" ? "destructive" : status === "ready" ? "secondary" : "outline"
  return <Badge variant={variant}>{getIntrastatStatusLabel(t, status)}</Badge>
}

export function IntrastatMatchBadge({
  status,
  confidence,
}: {
  status: IntrastatCnMatchStatus
  confidence?: number | null
}) {
  const { t } = useTranslation("intrastat")
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
      {getIntrastatMatchLabel(t, status)}
      {percentage === null ? null : ` ${percentage}%`}
    </Badge>
  )
}

export function IntrastatKindBadge({ kind }: { kind: IntrastatTransactionKind }) {
  return <Badge variant={kind === "WNT" ? "secondary" : "outline"}>{kind}</Badge>
}
