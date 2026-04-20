"use client"

import { endpoints, toastApiError, useExportTemplates } from "@cortex/api"
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@cortex/ui"
import { Download, FileDown, Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { downloadBlob } from "@/lib/download"

interface ExportMenuProps {
  packageId: string
  fileName: string
}

const FORMAT_EXTENSION: Record<string, string> = {
  csv: "csv",
  zip: "zip",
  xml: "xml",
  json: "json",
}

function deriveFileName(baseName: string, templateName: string, format: string): string {
  const stripped = baseName.replace(/\.(zip|pdf|docx|xlsx)$/i, "")
  const ext = FORMAT_EXTENSION[format] ?? format
  return `${stripped}_${templateName}.${ext}`
}

export function ExportMenu({ packageId, fileName }: ExportMenuProps) {
  const templates = useExportTemplates()
  const [downloading, setDownloading] = useState<string | null>(null)

  const handleExport = async (templateName: string, format: string) => {
    setDownloading(templateName)
    try {
      const blob = await endpoints.packages.exportResult(packageId, templateName)
      downloadBlob(blob, deriveFileName(fileName, templateName, format))
      toast.success(`Exported as ${templateName}`)
    } catch (err) {
      toastApiError(err)
    } finally {
      setDownloading(null)
    }
  }

  if (templates.isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Export
      </Button>
    )
  }

  const items = templates.data ?? []
  if (items.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled>
        <FileDown className="mr-1.5 h-4 w-4" /> No templates
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={downloading !== null}>
          {downloading ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {items.map((t) => (
          <DropdownMenuItem
            key={t.name}
            onClick={() => handleExport(t.name, t.format)}
            disabled={downloading !== null}
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="truncate text-sm">{t.display_name}</p>
              <p className="truncate text-[10px] uppercase text-muted-foreground">
                {t.format}
              </p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
