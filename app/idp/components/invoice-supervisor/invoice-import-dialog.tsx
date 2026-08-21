"use client"

import { useInvoiceSupervisorImportInvoices } from "@/lib/invoice-supervisor/hooks"
import type { InvoiceSupervisorImportResult } from "@/lib/invoice-supervisor/types"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@cortex/ui"
import { Loader2, Upload } from "lucide-react"
import { useRef, useState, type ChangeEvent } from "react"
import { useTranslation } from "react-i18next"

export function InvoiceSupervisorImportDialog() {
  const { t } = useTranslation("invoice-supervisor")
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<InvoiceSupervisorImportResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const importInvoices = useInvoiceSupervisorImportInvoices()

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    importInvoices.mutate({ file }, { onSuccess: setResult })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setResult(null)
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="h-4 w-4" />
          {t("import.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("import.title")}</DialogTitle>
          <DialogDescription>{t("import.description")}</DialogDescription>
        </DialogHeader>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={importInvoices.isPending}
        >
          {importInvoices.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {t("import.pickFile")}
        </Button>
        {result ? (
          <div className="space-y-2 text-sm">
            <p>
              {t("import.imported")} <strong>{result.summary.imported}</strong> ·{" "}
              {t("import.errors")} {result.summary.errors} · {t("import.conflicts")}{" "}
              {result.summary.conflicts}
            </p>
            {result.errors.length > 0 ? (
              <ul className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-border p-2 text-destructive">
                {result.errors.map((error, index) => (
                  <li key={`${error.row_number}-${index}`}>
                    {t("import.errorRow", { row: error.row_number, message: error.message })}
                  </li>
                ))}
              </ul>
            ) : null}
            {result.conflicts.length > 0 ? (
              <p className="text-warning-foreground">
                {t("import.conflictsNote", { n: result.conflicts.length })}
              </p>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
