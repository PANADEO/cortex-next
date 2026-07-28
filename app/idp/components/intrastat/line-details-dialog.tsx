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
  const declarationDetails = line
    ? [
        ["Item index", line.item_index],
        ["CN code", line.cn_code],
        ["Description", line.description],
        ["Quantity", line.quantity],
        ["Value", line.value],
        ["Currency", line.currency],
        ["Net weight", line.net_weight],
        ["Origin country", line.origin_country],
        ["Delivery terms", line.delivery_terms],
        ["NIP/VAT", line.vat_number],
        ["Transaction code", line.transaction_code],
        ["Transport type", line.transport_type],
      ]
    : []
  const matchingDetails = line
    ? [
        ["Match status", line.cn_match_status],
        ["Matched index", line.matched_index],
        ["Matched fragment", line.matched_fragment],
        ["Extraction confidence", line.confidence],
        ["Match confidence", line.match_confidence],
      ]
    : []
  const correctionDetails = line
    ? [
        ["Document type", line.document_type],
        ["Corrected invoice", line.corrected_invoice_number],
        ["Corrected invoice date", line.corrected_invoice_date],
        ["Correction side", line.correction_side],
        ["Correction reason", line.correction_reason],
        ["Excluded", line.is_excluded],
        ["Exclusion reason", line.exclusion_reason],
      ]
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Declaration line details</DialogTitle>
          <DialogDescription>
            {line ? `${line.invoice_number} · line ${line.lp}` : "Declaration line preview"}
          </DialogDescription>
        </DialogHeader>

        {line ? (
          <div className="space-y-6">
            <section>
              <h3 className="mb-3 text-sm font-semibold">Invoice</h3>
              <dl className="grid gap-3 rounded-md border border-border p-4 sm:grid-cols-3">
                {[
                  ["Invoice number", line.invoice_number],
                  ["Invoice date", line.invoice_date],
                  ["Transaction kind", line.transaction_kind],
                  ["Source file", line.source_file],
                  ["Batch ID", line.batch_id],
                  ["Line ID", line.id],
                ].map(([label, value]) => (
                  <div key={String(label)} className="min-w-0">
                    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                    <dd className="mt-1 break-words text-sm">{displayValue(value)}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold">Declaration data</h3>
              <dl className="grid gap-3 rounded-md border border-border p-4 sm:grid-cols-3">
                {declarationDetails.map(([label, value]) => (
                  <div key={String(label)} className="min-w-0">
                    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                    <dd className="mt-1 break-words text-sm">{displayValue(value)}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold">Matching and correction</h3>
              <dl className="grid gap-3 rounded-md border border-border p-4 sm:grid-cols-3">
                {[...matchingDetails, ...correctionDetails].map(([label, value]) => (
                  <div key={String(label)} className="min-w-0">
                    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                    <dd className="mt-1 break-words text-sm">{displayValue(value)}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-semibold">Alerts</h3>
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
                  No alerts for this line.
                </p>
              )}
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function displayValue(value: unknown): string {
  if (value == null || value === "") return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return String(value)
}
