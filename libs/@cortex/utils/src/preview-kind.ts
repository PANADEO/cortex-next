import { File, FileImage, FileSpreadsheet, FileText, type LucideIcon } from "lucide-react"

// Mirror of `detectDocumentKind` in libs/@cortex/ui/src/components/document-viewer.tsx.
// Kept here as a pure helper so consumers can decide preview routing without
// dragging the SSR-unsafe pdfjs dynamic import. Update both when adding formats.
export type PreviewableKind = "pdf" | "docx" | "xlsx" | "image" | "unsupported"

export function detectPreviewableKind(
  fileName: string,
  mediaType?: string | null,
): PreviewableKind {
  const lower = fileName.toLowerCase()
  if (mediaType?.includes("pdf") || lower.endsWith(".pdf")) return "pdf"
  if (mediaType?.includes("wordprocessingml") || lower.endsWith(".docx")) return "docx"
  if (
    mediaType?.includes("spreadsheetml") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls")
  ) {
    return "xlsx"
  }
  if (mediaType?.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/.test(lower)) {
    return "image"
  }
  return "unsupported"
}

export function canPreviewInline(
  fileName: string,
  mediaType: string | null | undefined,
  backendHint: "pdf" | "image" | "download_only",
): boolean {
  if (backendHint === "pdf" || backendHint === "image") return true
  return detectPreviewableKind(fileName, mediaType) !== "unsupported"
}

export interface FileTypeIcon {
  Icon: LucideIcon
  toneClass: string
}

export function getFileTypeIcon(
  fileName: string,
  mediaType?: string | null,
): FileTypeIcon {
  const kind = detectPreviewableKind(fileName, mediaType)
  switch (kind) {
    case "pdf":
      return { Icon: FileText, toneClass: "text-rose-600 dark:text-rose-400" }
    case "docx":
      return { Icon: FileText, toneClass: "text-sky-600 dark:text-sky-400" }
    case "xlsx":
      return { Icon: FileSpreadsheet, toneClass: "text-emerald-600 dark:text-emerald-400" }
    case "image":
      return { Icon: FileImage, toneClass: "text-amber-600 dark:text-amber-400" }
    case "unsupported":
    default:
      return { Icon: File, toneClass: "text-muted-foreground" }
  }
}
