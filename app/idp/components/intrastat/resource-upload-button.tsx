"use client"

import { formatIntrastatError } from "@/lib/intrastat/api"
import { useIntrastatUploadCnResource } from "@/lib/intrastat/hooks"
import { Button } from "@cortex/ui"
import { Database, Loader2 } from "lucide-react"
import { useRef, type ChangeEvent } from "react"
import { toast } from "sonner"

export function IntrastatResourceUploadButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const upload = useIntrastatUploadCnResource()

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Choose an XLSX resource file")
      return
    }

    try {
      const result = await upload.mutateAsync(file)
      const embeddingText = result.embedding_count
        ? ` and ${result.embedding_count} embedding(s)`
        : ""
      toast.success(`Loaded ${result.row_count} CN resource row(s)${embeddingText}`)
    } catch (error) {
      toast.error(formatIntrastatError(error, "CN resource upload failed"))
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
        Upload CN XLSX
      </Button>
    </>
  )
}
