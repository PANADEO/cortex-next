"use client"

import type { DirtyDocument } from "@cortex/types"
import { Badge, Button, ScrollArea } from "@cortex/ui"
import {
  AlertTriangle,
  CheckCircle2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileX,
} from "lucide-react"
import { DOC_MODE_COLOR, DOC_MODE_LABEL, DOC_TYPE_LABEL } from "./labels"

interface DocumentTreeProps {
  documents: DirtyDocument[]
  selectedId: string | null
  onSelect: (id: string) => void
  draftLookup: Map<string, string>
}

function fileIcon(media: string) {
  if (media.startsWith("image/")) return FileImage
  if (media.includes("spreadsheet")) return FileSpreadsheet
  return FileText
}

function confidenceTone(confidence: number | null): string {
  if (confidence === null) return "text-muted-foreground"
  if (confidence < 0.6) return "text-rose-600"
  if (confidence < 0.8) return "text-amber-600"
  return "text-emerald-600"
}

export function DocumentTree({
  documents,
  selectedId,
  onSelect,
  draftLookup,
}: DocumentTreeProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
        <span>Documents · {documents.length}</span>
        <span>{documents.filter((d) => d.human_reviewed).length} reviewed</span>
      </div>
      <ScrollArea className="flex-1">
        <ul className="divide-y divide-border">
          {documents.map((doc) => {
            const Icon = doc.mode === "skip" ? FileX : fileIcon(doc.media_type)
            const isSelected = doc.id === selectedId
            const draftName = doc.target_clean_package_id
              ? draftLookup.get(doc.target_clean_package_id) ?? "—"
              : null
            const needsReview = !doc.human_reviewed && (doc.confidence ?? 1) < 0.8
            return (
              <li key={doc.id}>
                <Button
                  type="button"
                  variant="ghost"
                  className={`h-auto w-full justify-start rounded-none px-3 py-2 text-left ${
                    isSelected ? "bg-primary/10" : ""
                  }`}
                  onClick={() => onSelect(doc.id)}
                >
                  <div className="flex w-full flex-col gap-1.5">
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate text-sm font-medium">
                        {doc.file_name}
                      </span>
                      {doc.human_reviewed ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      ) : needsReview ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {DOC_TYPE_LABEL[doc.doc_type]}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-normal ${DOC_MODE_COLOR[doc.mode]}`}
                      >
                        {DOC_MODE_LABEL[doc.mode]}
                      </Badge>
                      {doc.confidence !== null ? (
                        <span className={`text-[10px] ${confidenceTone(doc.confidence)}`}>
                          {Math.round(doc.confidence * 100)}%
                        </span>
                      ) : null}
                    </div>
                    {draftName ? (
                      <span className="truncate text-[10px] text-muted-foreground">
                        → {draftName}
                      </span>
                    ) : null}
                  </div>
                </Button>
              </li>
            )
          })}
        </ul>
      </ScrollArea>
    </div>
  )
}
