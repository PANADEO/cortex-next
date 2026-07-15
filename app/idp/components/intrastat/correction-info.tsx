"use client"

import type { IntrastatDeclarationLine } from "@/lib/intrastat/types"
import { Badge } from "@cortex/ui"

export function IntrastatCorrectionInfo({ line }: { line: IntrastatDeclarationLine }) {
  if (line.document_type === "invoice") return null

  const documentLabel = line.document_type === "physical_return" ? "Physical return" : "Correction"
  const sideLabel =
    line.correction_side === "before"
      ? "Before correction"
      : line.correction_side === "after"
        ? "After correction"
        : null

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex flex-wrap gap-1">
        <Badge
          variant="outline"
          className="border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        >
          {documentLabel}
        </Badge>
        {sideLabel ? (
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
            {sideLabel}
          </Badge>
        ) : null}
        {line.is_excluded ? (
          <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-muted-foreground">
            Historical / excluded
          </Badge>
        ) : null}
      </div>
      {line.corrected_invoice_number ? (
        <p className="truncate text-[11px] text-muted-foreground">
          Corrects: <span className="font-mono">{line.corrected_invoice_number}</span>
          {line.corrected_invoice_date ? ` · ${line.corrected_invoice_date}` : ""}
        </p>
      ) : null}
      {line.correction_reason ? (
        <p className="truncate text-[11px] text-muted-foreground" title={line.correction_reason}>
          Reason: {line.correction_reason}
        </p>
      ) : null}
    </div>
  )
}
