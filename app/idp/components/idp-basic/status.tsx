"use client"

import type {
  IdpBasicCompletenessStatus,
  IdpBasicDocumentType,
  IdpBasicPackageStatus,
} from "@/lib/idp-basic/types"
import { Badge } from "@cortex/ui"
import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"

const STATUS_LABEL_KEYS: Record<IdpBasicPackageStatus, string> = {
  queued: "status.queued",
  processing: "status.processing",
  ready: "status.ready",
  needs_review: "status.needsReview",
  failed: "status.failed",
}

const STATUS_CLASS: Record<IdpBasicPackageStatus, string> = {
  queued: "border-info/40 bg-info/10 text-info",
  processing: "border-warning/40 bg-warning/10 text-warning",
  ready: "border-success/40 bg-success/10 text-success",
  needs_review: "border-warning/40 bg-warning/10 text-warning",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
}

const COMPLETENESS_LABEL_KEYS: Record<IdpBasicCompletenessStatus, string> = {
  complete: "completeness.complete",
  incomplete: "completeness.incomplete",
  unknown: "completeness.unknown",
}

const COMPLETENESS_CLASS: Record<IdpBasicCompletenessStatus, string> = {
  complete: "border-success/40 bg-success/10 text-success",
  incomplete: "border-warning/40 bg-warning/10 text-warning",
  unknown: "border-muted-foreground/30 bg-muted text-muted-foreground",
}

const DOCUMENT_TYPE_LABEL_KEYS: Record<IdpBasicDocumentType, string> = {
  cost_invoice: "documentType.costInvoice",
  cmr: "documentType.cmr",
  pod: "documentType.pod",
  transport_order: "documentType.transportOrder",
  other: "documentType.other",
}

export function IdpBasicStatusBadge({ status }: { status: IdpBasicPackageStatus }) {
  const { t } = useTranslation("idp-basic")
  return (
    <Badge variant="outline" className={`${STATUS_CLASS[status]} whitespace-nowrap`}>
      {getIdpBasicStatusLabel(t, status)}
    </Badge>
  )
}

export function IdpBasicCompletenessBadge({
  status,
}: {
  status: IdpBasicCompletenessStatus | null
}) {
  const { t } = useTranslation("idp-basic")
  const resolved = status ?? "unknown"
  return (
    <Badge variant="outline" className={`${COMPLETENESS_CLASS[resolved]} whitespace-nowrap`}>
      {t(COMPLETENESS_LABEL_KEYS[resolved])}
    </Badge>
  )
}

export function getIdpBasicDocumentTypeLabel(
  t: TFunction<"idp-basic">,
  type: IdpBasicDocumentType | null,
): string {
  return t(type ? DOCUMENT_TYPE_LABEL_KEYS[type] : "documentType.unknown")
}

export function getIdpBasicStatusLabel(
  t: TFunction<"idp-basic">,
  status: IdpBasicPackageStatus,
): string {
  return t(STATUS_LABEL_KEYS[status])
}

/**
 * Napisy, które backend `idp-basic` przysyła gotową POLSKĄ prozą — ostrzeżenia
 * AI oraz pozycje `missing_required` / `missing_optional`.
 *
 * Polski napis jest tu KLUCZEM DOPASOWANIA, czyli DANĄ z drutu, a nie
 * etykietą do pokazania. Wynikiem jest `t()`, więc trzeci język dokłada się w
 * pliku JSON i ten plik zostaje nietknięty. Poprzednia wersja trzymała po
 * prawej stronie zaszyty angielski — czyli drugi, równoległy mechanizm
 * tłumaczenia, który przy trzecim języku nie miał dokąd urosnąć.
 *
 * Gdy backend zacznie zwracać KODY zamiast prozy, znika tylko lewa kolumna;
 * klucze i tłumaczenia zostają bez zmian.
 */
const BACKEND_TEXT_KEYS: Record<string, string> = {
  "Brak CMR": "backendText.missingCmr",
  "Brak POD": "backendText.missingPod",
  "Brak faktury kosztowej": "backendText.missingCostInvoice",
  "Brak zlecenia transportowego": "backendText.missingTransportOrder",
  "Nie znaleziono numeru referencyjnego": "backendText.referenceNotFound",
}

/** Przedrostek z backendu -> klucz. Ogon (nazwa pliku, treść uwagi, wynik
 *  pewności) jest daną i wchodzi do napisu jako interpolacja `{{detail}}`. */
const BACKEND_TEXT_PREFIX_KEYS: ReadonlyArray<readonly [string, string]> = [
  ["Dokument nierozpoznany:", "backendText.unrecognizedDocument"],
  ["Niska pewność klasyfikacji:", "backendText.lowConfidence"],
  ["CMR zawiera uwagę lub zastrzeżenie:", "backendText.cmrRemark"],
  ["Niepełna analiza po maksymalnym zakresie:", "backendText.incompleteAnalysis"],
  ["Pominięto nieobsługiwany plik:", "backendText.skippedUnsupportedFile"],
]

export function formatIdpBasicDisplayText(t: TFunction<"idp-basic">, value: string): string {
  const exactKey = BACKEND_TEXT_KEYS[value]
  if (exactKey) return t(exactKey)

  for (const [prefix, key] of BACKEND_TEXT_PREFIX_KEYS) {
    if (!value.startsWith(prefix)) continue
    return t(key, { detail: value.slice(prefix.length).trim() })
  }
  return value
}
