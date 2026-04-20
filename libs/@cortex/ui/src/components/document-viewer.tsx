"use client"

import { cn } from "@cortex/utils"
import { renderAsync } from "docx-preview"
import { ChevronLeft, ChevronRight, FileWarning, Loader2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import * as XLSX from "xlsx"
import { Button } from "./ui/button"

pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs"

const PDF_OPTIONS = {
  cMapUrl: "/pdfjs/cmaps/",
  standardFontDataUrl: "/pdfjs/standard_fonts/",
}

export type DocumentKind = "pdf" | "docx" | "xlsx" | "image" | "unsupported"

export function detectDocumentKind(fileName: string, mediaType?: string): DocumentKind {
  const lower = fileName.toLowerCase()
  if (mediaType?.includes("pdf") || lower.endsWith(".pdf")) return "pdf"
  if (mediaType?.includes("wordprocessingml") || lower.endsWith(".docx")) return "docx"
  if (mediaType?.includes("spreadsheetml") || lower.endsWith(".xlsx") || lower.endsWith(".xls"))
    return "xlsx"
  if (mediaType?.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/.test(lower)) return "image"
  return "unsupported"
}

interface DocumentViewerProps {
  source: Blob | ArrayBuffer | string | null
  fileName: string
  mediaType?: string
  className?: string | undefined
}

export function DocumentViewer({
  source,
  fileName,
  mediaType,
  className,
}: DocumentViewerProps) {
  const kind = useMemo(() => detectDocumentKind(fileName, mediaType), [fileName, mediaType])

  if (!source) {
    return <ViewerFrame className={className}><ViewerMessage label="No document selected." /></ViewerFrame>
  }

  if (kind === "pdf") return <PdfViewer source={source} className={className} />
  if (kind === "docx") return <DocxViewer source={source} className={className} />
  if (kind === "xlsx") return <XlsxViewer source={source} className={className} />
  if (kind === "image") return <ImageViewer source={source} fileName={fileName} className={className} />

  return (
    <ViewerFrame className={className}>
      <ViewerMessage icon={<FileWarning className="h-5 w-5" />} label={`No inline preview for ${fileName}.`} />
    </ViewerFrame>
  )
}

function ViewerFrame({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string | undefined
}) {
  return (
    <div
      className={cn(
        "flex min-h-[480px] w-full flex-col overflow-hidden rounded-md border border-border bg-muted/30",
        className,
      )}
    >
      {children}
    </div>
  )
}

function ViewerMessage({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-1 items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
      {icon}
      {label}
    </div>
  )
}

function PdfViewer({ source, className }: { source: Blob | ArrayBuffer | string; className?: string | undefined }) {
  const [numPages, setNumPages] = useState(0)
  const [page, setPage] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | undefined>(undefined)

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const update = () => setWidth(Math.max(320, el.clientWidth - 24))
    update()
    const obs = new ResizeObserver(update)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const file = useMemo(() => {
    if (typeof source === "string") return source
    if (source instanceof Blob) return source
    return { data: source }
  }, [source])

  return (
    <ViewerFrame className={className}>
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs">
        <span className="font-mono text-muted-foreground">
          Page {page} / {numPages || "…"}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(numPages, p + 1))}
            disabled={page >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 overflow-auto p-3">
        <Document
          file={file}
          onLoadSuccess={({ numPages: n }) => {
            setNumPages(n)
            setPage((p) => Math.min(p, n))
          }}
          loading={<ViewerMessage icon={<Loader2 className="h-4 w-4 animate-spin" />} label="Loading PDF…" />}
          error={<ViewerMessage icon={<FileWarning className="h-5 w-5" />} label="Failed to load PDF." />}
          options={PDF_OPTIONS}
        >
          <Page
            pageNumber={page}
            {...(width !== undefined ? { width } : {})}
            renderAnnotationLayer={false}
            renderTextLayer={false}
          />
        </Document>
      </div>
    </ViewerFrame>
  )
}

function DocxViewer({ source, className }: { source: Blob | ArrayBuffer | string; className?: string | undefined }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ref.current) return
    if (typeof source === "string") {
      setError("Remote URL source not supported for DOCX; pass a Blob.")
      return
    }
    const blob = source instanceof Blob ? source : new Blob([source])
    ref.current.innerHTML = ""
    renderAsync(blob, ref.current).catch((e) => {
      setError(e instanceof Error ? e.message : "Unknown error")
    })
  }, [source])

  return (
    <ViewerFrame className={className}>
      <div className="flex-1 overflow-auto bg-background p-4 [&>div]:!bg-background [&>div]:!shadow-none">
        {error ? (
          <ViewerMessage icon={<FileWarning className="h-5 w-5" />} label={error} />
        ) : (
          <div ref={ref} />
        )}
      </div>
    </ViewerFrame>
  )
}

interface SheetTable {
  name: string
  html: string
}

function XlsxViewer({ source, className }: { source: Blob | ArrayBuffer | string; className?: string | undefined }) {
  const [sheets, setSheets] = useState<SheetTable[]>([])
  const [active, setActive] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        let buffer: ArrayBuffer
        if (source instanceof ArrayBuffer) buffer = source
        else if (source instanceof Blob) buffer = await source.arrayBuffer()
        else {
          setError("Remote URL source not supported for XLSX; pass a Blob.")
          return
        }
        const wb = XLSX.read(buffer, { type: "array" })
        const parsed: SheetTable[] = wb.SheetNames.map((name) => {
          const ws = wb.Sheets[name]
          const html = ws ? XLSX.utils.sheet_to_html(ws) : ""
          return { name, html }
        })
        if (!cancelled) {
          setSheets(parsed)
          setActive(0)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to parse spreadsheet")
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [source])

  if (error) {
    return (
      <ViewerFrame className={className}>
        <ViewerMessage icon={<FileWarning className="h-5 w-5" />} label={error} />
      </ViewerFrame>
    )
  }
  if (sheets.length === 0) {
    return (
      <ViewerFrame className={className}>
        <ViewerMessage icon={<Loader2 className="h-4 w-4 animate-spin" />} label="Loading spreadsheet…" />
      </ViewerFrame>
    )
  }

  const activeSheet = sheets[active]

  return (
    <ViewerFrame className={className}>
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-3 py-2">
        {sheets.map((s, i) => (
          <button
            key={s.name}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "whitespace-nowrap rounded-sm px-2 py-1 text-xs",
              i === active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {s.name}
          </button>
        ))}
      </div>
      <div
        className="flex-1 overflow-auto bg-background p-3 text-xs [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: activeSheet?.html ?? "" }}
      />
    </ViewerFrame>
  )
}

function ImageViewer({
  source,
  fileName,
  className,
}: {
  source: Blob | ArrayBuffer | string
  fileName: string
  className?: string | undefined
}) {
  const url = useMemo(() => {
    if (typeof source === "string") return source
    if (source instanceof Blob) return URL.createObjectURL(source)
    return URL.createObjectURL(new Blob([source]))
  }, [source])

  useEffect(() => {
    return () => {
      if (typeof source !== "string") URL.revokeObjectURL(url)
    }
  }, [url, source])

  return (
    <ViewerFrame className={className}>
      <div className="flex flex-1 items-center justify-center overflow-auto p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={fileName} className="max-h-full max-w-full" />
      </div>
    </ViewerFrame>
  )
}
