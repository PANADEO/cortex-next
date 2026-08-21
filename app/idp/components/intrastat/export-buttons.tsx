"use client"

import { downloadBlob } from "@/lib/download"
import { formatIntrastatError } from "@/lib/intrastat/api"
import { useIntrastatExportAudit, useIntrastatExportIntrastat } from "@/lib/intrastat/hooks"
import { Button } from "@cortex/ui"
import { FileSpreadsheet, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

interface Props {
  batchId?: string | null
  batchIds?: string[]
  disabled?: boolean | undefined
  exportLabel?: string | undefined
  auditLabel?: string | undefined
}

export function IntrastatExportButtons({
  batchId,
  batchIds,
  disabled: disabledProp,
  exportLabel,
  auditLabel,
}: Props) {
  const { t } = useTranslation("intrastat")
  const intrastatExport = useIntrastatExportIntrastat()
  const auditExport = useIntrastatExportAudit()
  const resolvedBatchIds = batchIds ?? (batchId ? [batchId] : [])
  const disabled =
    disabledProp ||
    resolvedBatchIds.length === 0 ||
    intrastatExport.isPending ||
    auditExport.isPending

  const handleIntrastatExport = async () => {
    try {
      const result = await intrastatExport.mutateAsync(resolvedBatchIds)
      downloadBlob(result.blob, result.filename)
    } catch (error) {
      toast.error(formatIntrastatError(error, t("exports.exportFailed")))
    }
  }

  const handleAuditExport = async () => {
    try {
      const result = await auditExport.mutateAsync(resolvedBatchIds)
      downloadBlob(result.blob, result.filename)
    } catch (error) {
      toast.error(formatIntrastatError(error, t("exports.auditFailed")))
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={handleIntrastatExport} disabled={disabled}>
        {intrastatExport.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="mr-2 h-4 w-4" />
        )}
        {exportLabel ?? t("exports.exportXlsx")}
      </Button>
      <Button size="sm" variant="outline" onClick={handleAuditExport} disabled={disabled}>
        {auditExport.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="mr-2 h-4 w-4" />
        )}
        {auditLabel ?? t("exports.auditXlsx")}
      </Button>
    </div>
  )
}
