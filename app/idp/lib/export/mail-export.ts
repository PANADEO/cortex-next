import { downloadBlob } from "@/lib/download"

const MIME_BY_EXTENSION: Record<string, string> = {
  csv: "text/csv",
  json: "application/json",
  xml: "application/xml",
  zip: "application/zip",
}

export type MailExportResult = "shared" | "downloaded-mailto"

export function buildMailtoHref(fileName: string): string {
  const params = new URLSearchParams({
    subject: fileName,
  })

  return `mailto:?${params.toString()}`
}

function getExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? ""
}

export function getMailExportMimeType(blob: Blob, fileName: string): string {
  const blobType = blob.type.trim()
  if (blobType && blobType !== "application/octet-stream") return blobType

  return MIME_BY_EXTENSION[getExtension(fileName)] ?? (blobType || "application/octet-stream")
}

export function createMailExportFile(blob: Blob, fileName: string): File {
  return new File([blob], fileName, {
    type: getMailExportMimeType(blob, fileName),
  })
}

export async function openMailExport(blob: Blob, fileName: string): Promise<MailExportResult> {
  if (typeof navigator !== "undefined" && typeof File !== "undefined") {
    const file = createMailExportFile(blob, fileName)
    const shareData: ShareData = { files: [file] }

    if (typeof navigator.share === "function" && navigator.canShare?.(shareData)) {
      // Keep this payload file-only. Some Windows share targets treat mixed title/text+files as a text share.
      await navigator.share(shareData)
      return "shared"
    }
  }

  downloadBlob(blob, fileName)
  if (typeof window !== "undefined") {
    window.location.href = buildMailtoHref(fileName)
  }
  return "downloaded-mailto"
}
