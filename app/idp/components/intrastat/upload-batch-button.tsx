"use client"

import { formatIntrastatError } from "@/lib/intrastat/api"
import { useIntrastatUploadBatch } from "@/lib/intrastat/hooks"
import type { IntrastatTransactionKind } from "@/lib/intrastat/types"
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
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
  const [uploadToFilesystem, setUploadToFilesystem] = useState(false)
  const [clientName, setClientName] = useState("")
  const [periodMonth, setPeriodMonth] = useState("")
  const filesystemMetadataMissing =
    uploadToFilesystem && (!clientName.trim() || !periodMonth.trim())

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
    if (filesystemMetadataMissing) {
      toast.error("Enter client and month")
      return
    }

    try {
      const result = await upload.mutateAsync({
        file,
        transactionKind,
        uploadToFilesystem,
        clientName: clientName.trim(),
        periodMonth: periodMonth.trim(),
      })
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
        <div className="flex items-center gap-2">
          <Checkbox
            id="intrastat-upload-to-filesystem"
            checked={uploadToFilesystem}
            onCheckedChange={(checked) => setUploadToFilesystem(checked === true)}
          />
          <Label htmlFor="intrastat-upload-to-filesystem">Upload to filesystem</Label>
        </div>
        {uploadToFilesystem ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="intrastat-client-name">Client</Label>
              <Input
                id="intrastat-client-name"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                placeholder="Jabil"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="intrastat-period-month">Month</Label>
              <Input
                id="intrastat-period-month"
                value={periodMonth}
                onChange={(event) => setPeriodMonth(event.target.value)}
                placeholder="Lipiec 2026"
              />
            </div>
          </div>
        ) : null}
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
            disabled={!transactionKind || filesystemMetadataMissing || upload.isPending}
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
