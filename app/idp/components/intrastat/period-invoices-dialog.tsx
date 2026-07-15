"use client"

import type { IntrastatDocument } from "@/lib/intrastat/types"
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
} from "@cortex/ui"
import { Eye, FileText, Search } from "lucide-react"
import { useMemo, useState } from "react"

interface IntrastatPeriodInvoicesDialogProps {
  periodLabel: string
  invoiceCount: number
  documents: IntrastatDocument[]
  onInvoiceSelect: (fileName: string) => void
}

export function IntrastatPeriodInvoicesDialog({
  periodLabel,
  invoiceCount,
  documents,
  onInvoiceSelect,
}: IntrastatPeriodInvoicesDialogProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const filteredDocuments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) return documents
    return documents.filter((document) =>
      document.file_name.toLowerCase().includes(normalizedSearch),
    )
  }, [documents, search])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) setSearch("")
  }

  const handleInvoiceSelect = (fileName: string) => {
    onInvoiceSelect(fileName)
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={documents.length === 0}
          aria-label={`Open invoices for ${periodLabel}`}
        >
          <FileText className="mr-2 h-4 w-4" />
          Invoices
          <Badge variant="secondary" className="ml-2 px-1.5 font-mono text-[10px]">
            {invoiceCount}
          </Badge>
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[min(680px,85vh)] max-w-xl flex-col gap-4 overflow-hidden">
        <DialogHeader>
          <DialogTitle>{periodLabel}</DialogTitle>
          <DialogDescription>
            {invoiceCount} {invoiceCount === 1 ? "invoice" : "invoices"} in this period. Choose a
            file to open its preview.
          </DialogDescription>
        </DialogHeader>

        <div className="relative shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search invoice file..."
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="min-h-0 overflow-y-auto rounded-md border border-border">
          {filteredDocuments.length > 0 ? (
            <ul className="divide-y divide-border">
              {filteredDocuments.map((document) => (
                <li key={document.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    onClick={() => handleInvoiceSelect(document.file_name)}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-cortex" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {document.file_name}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No invoices match this search.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
