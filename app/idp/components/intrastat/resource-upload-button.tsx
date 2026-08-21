"use client"

import { formatIntrastatError } from "@/lib/intrastat/api"
import { useIntrastatUploadCnResource } from "@/lib/intrastat/hooks"
import { Button } from "@cortex/ui"
import { Database, Loader2 } from "lucide-react"
import { useRef, type ChangeEvent } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

export function IntrastatResourceUploadButton() {
  const { t } = useTranslation("intrastat")
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useIntrastatUploadCnResource()

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error(t("cnResource.invalidXlsx"))
      return
    }

    try {
      const result = await upload.mutateAsync(file)
      toast.success(
        result.embedding_count
          ? t("cnResource.uploadSuccessWithEmbeddings", {
              rows: result.row_count,
              embeddings: result.embedding_count,
            })
          : t("cnResource.uploadSuccess", { rows: result.row_count }),
      )
    } catch (error) {
      toast.error(formatIntrastatError(error, t("cnResource.uploadFailed")))
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        size="sm"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={upload.isPending}
      >
        {upload.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Database className="mr-2 h-4 w-4" />
        )}
        {t("cnResource.uploadButton")}
      </Button>
    </>
  )
}
