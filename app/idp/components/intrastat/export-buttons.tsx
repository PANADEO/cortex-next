"use client"

import { downloadBlob } from "@/lib/download"
import { formatIntrastatError } from "@/lib/intrastat/api"
import { useIntrastatExportAudit, useIntrastatExportIntrastat } from "@/lib/intrastat/hooks"
import { Button } from "@cortex/ui"
import { FileSpreadsheet, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function IntrastatExportButtons({ batchId }: { batchId?: string | null }) {
  const intrastatExport = useIntrastatExportIntrastat()
  const auditExport = useIntrastatExportAudit()
  const batchIds = batchId ? [batchId] : []
  const disabled = !batchId || intrastatExport.isPending || auditExport.isPending

  const handleIntrastatExport = async () => {
    try {
      const result = await intrastatExport.mutateAsync(batchIds)
      downloadBlob(result.blob, result.filename)
    } catch (error) {
      toast.error(formatIntrastatError(error, "Intrastat export failed"))
    }
  }

  const handleAuditExport = async () => {
    try {
      const result = await auditExport.mutateAsync(batchIds)
      downloadBlob(result.blob, result.filename)
    } catch (error) {
      toast.error(formatIntrastatError(error, "Audit export failed"))
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
        Export XLSX
      </Button>
      <Button size="sm" variant="outline" onClick={handleAuditExport} disabled={disabled}>
        {auditExport.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="mr-2 h-4 w-4" />
        )}
        Audit XLSX
      </Button>
    </div>
  )
}
