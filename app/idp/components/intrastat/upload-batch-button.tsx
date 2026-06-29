"use client"

import { formatIntrastatError } from "@/lib/intrastat/api"
import { useIntrastatUploadBatch } from "@/lib/intrastat/hooks"
import type { IntrastatTransactionKind } from "@/lib/intrastat/types"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cortex/ui"
import { Loader2, Upload } from "lucide-react"
import { useRef, useState, type ChangeEvent } from "react"
import { toast } from "sonner"

export function IntrastatUploadBatchButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useIntrastatUploadBatch()
  const [open, setOpen] = useState(false)
  const [transactionKind, setTransactionKind] = useState<IntrastatTransactionKind | "">("")

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    if (!transactionKind) {
      toast.error("Choose WNT or WDT before uploading")
      return
    }
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast.error("Choose a ZIP file")
      return
    }

    try {
      const result = await upload.mutateAsync({ file, transactionKind })
      toast.success(`Uploaded ${result.document_count} PDF invoice(s)`)
      setOpen(false)
    } catch (error) {
      toast.error(formatIntrastatError(error, "Intrastat upload failed"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Upload className="mr-2 h-4 w-4" />
          Upload ZIP
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Intrastat batch</DialogTitle>
          <DialogDescription>
            Choose whether the invoices should generate a WNT or WDT import workbook.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="intrastat-transaction-kind">Transaction kind</Label>
          <Select
            value={transactionKind}
            onValueChange={(value) => setTransactionKind(value as IntrastatTransactionKind)}
          >
            <SelectTrigger id="intrastat-transaction-kind">
              <SelectValue placeholder="Choose WNT or WDT" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WNT">WNT - purchase invoices</SelectItem>
              <SelectItem value="WDT">WDT - sales invoices</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          className="hidden"
          onChange={handleFileChange}
        />
        <DialogFooter>
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={!transactionKind || upload.isPending}
          >
            {upload.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Choose ZIP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
