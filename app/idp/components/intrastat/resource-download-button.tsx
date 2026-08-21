"use client"

import { downloadBlob } from "@/lib/download"
import { formatIntrastatError } from "@/lib/intrastat/api"
import { useIntrastatDownloadCnResource } from "@/lib/intrastat/hooks"
import { Button } from "@cortex/ui"
import { Download, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

interface Props {
  disabled?: boolean
}

export function IntrastatResourceDownloadButton({ disabled }: Props) {
  const { t } = useTranslation("intrastat")
  const download = useIntrastatDownloadCnResource()

  const handleDownload = async () => {
    try {
      const result = await download.mutateAsync()
      downloadBlob(result.blob, result.filename)
    } catch (error) {
      toast.error(formatIntrastatError(error, t("cnResource.downloadFailed")))
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleDownload}
      disabled={disabled || download.isPending}
    >
      {download.isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {t("cnResource.downloadButton")}
    </Button>
  )
}
