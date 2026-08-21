"use client"

import { Badge, Button } from "@cortex/ui"
import type { LucideIcon } from "lucide-react"
import { Check, Copy, Download, FileSpreadsheet, FileText, Loader2, Share2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { CoworkArtifact } from "../types"

const ICON_BY_MIME: Record<string, LucideIcon> = {
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": FileSpreadsheet,
  "text/csv": FileText,
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

interface ArtifactRowProps {
  artifact: CoworkArtifact
  downloadHref: string
  /** Present when the project has an export share configured. */
  onExport?: () => Promise<{ displayPath: string }>
}

export function ArtifactRow({ artifact, downloadHref, onExport }: ArtifactRowProps) {
  const { t } = useTranslation("cortex-cowork")
  const Icon = ICON_BY_MIME[artifact.mimeType] ?? FileText
  const [exporting, setExporting] = useState(false)
  const [exportedPath, setExportedPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleExport = async () => {
    if (!onExport) return
    setExporting(true)
    setError(null)
    try {
      const result = await onExport()
      setExportedPath(result.displayPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("artifacts.exportFailed"))
    } finally {
      setExporting(false)
    }
  }

  const handleCopy = async () => {
    if (!exportedPath) return
    try {
      await navigator.clipboard.writeText(exportedPath)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard denied (e.g. insecure context) - the path stays visible to copy manually.
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-sm font-medium">{artifact.filename}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">
              {artifact.skill}
            </Badge>
            <span>{formatBytes(artifact.sizeBytes)}</span>
          </div>
        </div>
        {onExport ? (
          <Button
            variant="outline"
            size="icon"
            onClick={handleExport}
            disabled={exporting}
            aria-label={t("artifacts.exportAria", { filename: artifact.filename })}
            title={t("artifacts.exportTitle")}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="icon"
          asChild
          aria-label={t("artifacts.downloadAria", { filename: artifact.filename })}
        >
          <a href={downloadHref} download={artifact.filename}>
            <Download className="h-4 w-4" />
          </a>
        </Button>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {exportedPath ? (
        <div className="flex items-center gap-2 rounded-md bg-muted px-2 py-1.5">
          <code className="min-w-0 flex-1 truncate text-xs" title={exportedPath}>
            {exportedPath}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={t("artifacts.copyPathAria")}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      ) : null}
    </div>
  )
}
