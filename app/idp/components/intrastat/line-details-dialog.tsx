"use client"

import type { IntrastatDeclarationLine } from "@/lib/intrastat/types"
import {
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@cortex/ui"
import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"

interface IntrastatLineDetailsDialogProps {
  line: IntrastatDeclarationLine | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function IntrastatLineDetailsDialog({
  line,
  open,
  onOpenChange,
}: IntrastatLineDetailsDialogProps) {
  const { t } = useTranslation(["intrastat", "common"])
  const declarationDetails = line
    ? [
        [t("fields.itemIndex"), line.item_index],
        [t("fields.cnCode"), line.cn_code],
        [t("fields.description"), line.description],
        [t("fields.quantity"), line.quantity],
        [t("fields.value"), line.value],
        [t("fields.currency"), line.currency],
        [t("fields.netWeight"), line.net_weight],
        [t("fields.originCountry"), line.origin_country],
        [t("fields.deliveryTerms"), line.delivery_terms],
        [t("fields.vatNumber"), line.vat_number],
        [t("fields.transactionCode"), line.transaction_code],
        [t("fields.transportType"), line.transport_type],
      ]
    : []
  const matchingDetails = line
    ? [
        [t("fields.matchStatus"), line.cn_match_status],
        [t("fields.matchedIndex"), line.matched_index],
        [t("fields.matchedFragment"), line.matched_fragment],
        [t("fields.extractionConfidence"), line.confidence],
        [t("fields.matchConfidence"), line.match_confidence],
      ]
    : []
  const correctionDetails = line
    ? [
        [t("fields.documentType"), line.document_type],
        [t("fields.correctedInvoice"), line.corrected_invoice_number],
        [t("fields.correctedInvoiceDate"), line.corrected_invoice_date],
        [t("fields.correctionSide"), line.correction_side],
        [t("fields.correctionReason"), line.correction_reason],
        [t("fields.excluded"), line.is_excluded],
        [t("fields.exclusionReason"), line.exclusion_reason],
      ]
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("lineDetails.title")}</DialogTitle>
          <DialogDescription>
            {line
              ? t("lineDetails.subtitle", { invoice: line.invoice_number, lp: line.lp })
              : t("lineDetails.emptySubtitle")}
          </DialogDescription>
        </DialogHeader>

        {line ? (
          <div className="space-y-6">
            <section>
              <h3 className="mb-3 text-sm font-semibold">{t("lineDetails.invoiceSection")}</h3>
              <dl className="grid gap-3 rounded-md border border-border p-4 sm:grid-cols-3">
                {[
                  [t("fields.invoiceNumber"), line.invoice_number],
                  [t("fields.invoiceDate"), line.invoice_date],
                  [t("fields.transactionKind"), line.transaction_kind],
                  [t("fields.sourceFile"), line.source_file],
                  [t("fields.batchId"), line.batch_id],
                  [t("fields.lineId"), line.id],
                ].map(([label, value]) => (
                  <div key={String(label)} className="min-w-0">
                    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                    <dd className="mt-1 break-words text-sm">{displayValue(t, value)}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold">{t("lineDetails.declarationSection")}</h3>
              <dl className="grid gap-3 rounded-md border border-border p-4 sm:grid-cols-3">
                {declarationDetails.map(([label, value]) => (
                  <div key={String(label)} className="min-w-0">
                    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                    <dd className="mt-1 break-words text-sm">{displayValue(t, value)}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold">{t("lineDetails.matchingSection")}</h3>
              <dl className="grid gap-3 rounded-md border border-border p-4 sm:grid-cols-3">
                {[...matchingDetails, ...correctionDetails].map(([label, value]) => (
                  <div key={String(label)} className="min-w-0">
                    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                    <dd className="mt-1 break-words text-sm">{displayValue(t, value)}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-semibold">{t("lineDetails.alertsSection")}</h3>
                <Badge variant={line.alerts.length > 0 ? "destructive" : "secondary"}>
                  {line.alerts.length}
                </Badge>
              </div>
              {line.alerts.length > 0 ? (
                <ul className="space-y-2 rounded-md border border-border p-4 text-sm">
                  {line.alerts.map((alert) => (
                    <li key={alert}>{alert}</li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-md border border-border p-4 text-sm text-muted-foreground">
                  {t("lineDetails.noAlerts")}
                </p>
              )}
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function displayValue(t: TFunction<["intrastat", "common"]>, value: unknown): string {
  if (value == null || value === "") return "—"
  if (typeof value === "boolean") return value ? t("common:footer.yes") : t("common:footer.no")
  return String(value)
}
