"use client"

import { formatIntrastatError } from "@/lib/intrastat/api"
import { useIntrastatBatchFilterOptions, useIntrastatUploadBatch } from "@/lib/intrastat/hooks"
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
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

const NEW_OPTION_VALUE = "__intrastat_new_option__"

export function IntrastatUploadBatchButton() {
  const { t } = useTranslation("intrastat")
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useIntrastatUploadBatch()
  const filterOptions = useIntrastatBatchFilterOptions()
  const [open, setOpen] = useState(false)
  const [transactionKind, setTransactionKind] = useState<IntrastatTransactionKind | "">("")
  const [uploadToFilesystem, setUploadToFilesystem] = useState(false)
  const [clientSelection, setClientSelection] = useState("")
  const [monthSelection, setMonthSelection] = useState("")
  const [clientName, setClientName] = useState("")
  const [periodMonth, setPeriodMonth] = useState("")
  const isNewClient = filterOptions.isError || clientSelection === NEW_OPTION_VALUE
  const isNewMonth = filterOptions.isError || monthSelection === NEW_OPTION_VALUE
  const filesystemMetadataMissing =
    uploadToFilesystem && (!clientName.trim() || !periodMonth.trim())

  const handleClientChange = (value: string) => {
    setClientSelection(value)
    setClientName(value === NEW_OPTION_VALUE ? "" : value)
  }

  const handleMonthChange = (value: string) => {
    setMonthSelection(value)
    setPeriodMonth(value === NEW_OPTION_VALUE ? "" : value)
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    if (!transactionKind) {
      toast.error(t("upload.kindRequired"))
      return
    }
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast.error(t("errors.onlyZipFilesSupported"))
      return
    }
    if (filesystemMetadataMissing) {
      toast.error(t("errors.filesystemUploadMetadataRequired"))
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
      toast.success(t("upload.success", { count: result.document_count }))
      setOpen(false)
    } catch (error) {
      toast.error(formatIntrastatError(error, t("upload.failed")))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Upload className="mr-2 h-4 w-4" />
          {t("upload.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("upload.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("upload.dialogDescription")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="intrastat-transaction-kind">{t("upload.kindLabel")}</Label>
          <Select
            value={transactionKind}
            onValueChange={(value) => setTransactionKind(value as IntrastatTransactionKind)}
          >
            <SelectTrigger id="intrastat-transaction-kind">
              <SelectValue placeholder={t("upload.kindPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WNT">{t("upload.kindWnt")}</SelectItem>
              <SelectItem value="WDT">{t("upload.kindWdt")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="intrastat-upload-to-filesystem"
            checked={uploadToFilesystem}
            onCheckedChange={(checked) => setUploadToFilesystem(checked === true)}
          />
          <Label htmlFor="intrastat-upload-to-filesystem">{t("upload.toFilesystem")}</Label>
        </div>
        {uploadToFilesystem ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {filterOptions.isError ? (
              <p className="text-sm text-destructive sm:col-span-2">
                {t("upload.filterOptionsError")}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label
                htmlFor={
                  filterOptions.isError ? "intrastat-new-client-name" : "intrastat-client-name"
                }
              >
                {t("upload.clientLabel")}
              </Label>
              {!filterOptions.isError ? (
                <Select value={clientSelection} onValueChange={handleClientChange}>
                  <SelectTrigger id="intrastat-client-name" disabled={filterOptions.isLoading}>
                    <SelectValue
                      placeholder={
                        filterOptions.isLoading
                          ? t("upload.clientLoading")
                          : t("upload.clientPlaceholder")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {filterOptions.data?.clients.map((client) => (
                      <SelectItem key={client} value={client}>
                        {client}
                      </SelectItem>
                    ))}
                    <SelectItem value={NEW_OPTION_VALUE}>{t("upload.newClientOption")}</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}
              {isNewClient ? (
                <div className="space-y-2">
                  {!filterOptions.isError ? (
                    <Label htmlFor="intrastat-new-client-name">{t("upload.newClientLabel")}</Label>
                  ) : null}
                  <Input
                    id="intrastat-new-client-name"
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                    placeholder={t("upload.clientExample")}
                  />
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label
                htmlFor={
                  filterOptions.isError ? "intrastat-new-period-month" : "intrastat-period-month"
                }
              >
                {t("upload.monthLabel")}
              </Label>
              {!filterOptions.isError ? (
                <Select value={monthSelection} onValueChange={handleMonthChange}>
                  <SelectTrigger id="intrastat-period-month" disabled={filterOptions.isLoading}>
                    <SelectValue
                      placeholder={
                        filterOptions.isLoading
                          ? t("upload.monthLoading")
                          : t("upload.monthPlaceholder")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {filterOptions.data?.months.map((month) => (
                      <SelectItem key={month} value={month}>
                        {month}
                      </SelectItem>
                    ))}
                    <SelectItem value={NEW_OPTION_VALUE}>{t("upload.newMonthOption")}</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}
              {isNewMonth ? (
                <div className="space-y-2">
                  {!filterOptions.isError ? (
                    <Label htmlFor="intrastat-new-period-month">{t("upload.newMonthLabel")}</Label>
                  ) : null}
                  <Input
                    id="intrastat-new-period-month"
                    value={periodMonth}
                    onChange={(event) => setPeriodMonth(event.target.value)}
                    placeholder={t("upload.monthExample")}
                  />
                </div>
              ) : null}
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
            {t("upload.chooseZip")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
