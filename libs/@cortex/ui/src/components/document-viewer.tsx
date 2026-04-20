"use client"

import type { NormalizedHighlightBox } from "@cortex/types"
import { cn } from "@cortex/utils"
import { renderAsync } from "docx-preview"
import { FileWarning, Loader2 } from "lucide-react"
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist"
import { useEffect, useMemo, useRef, useState } from "react"
import * as XLSX from "xlsx"

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
  activePage?: number | null | undefined
  highlightBoxes?: NormalizedHighlightBox[] | undefined
}

export function DocumentViewer({
  source,
  fileName,
  mediaType,
  className,
  activePage,
  highlightBoxes,
}: DocumentViewerProps) {
  const kind = useMemo(() => detectDocumentKind(fileName, mediaType), [fileName, mediaType])

  if (!source) {
    return (
      <ViewerFrame className={className}>
        <ViewerMessage label="No document selected." />
      </ViewerFrame>
    )
  }

  if (kind === "pdf")
    return (
      <PdfViewer
        source={source}
        className={className}
        activePage={activePage ?? null}
        highlightBoxes={highlightBoxes ?? []}
      />
    )
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

const PDF_WORKER_SRC = "/pdfjs/pdf.worker.min.js"
const PDF_CMAP_URL = "/pdfjs/cmaps/"
const PDF_STANDARD_FONT_URL = "/pdfjs/standard_fonts/"
const PDF_RENDER_SCALE = 1.25

function PdfViewer({
  source,
  className,
  activePage,
  highlightBoxes,
}: {
  source: Blob | ArrayBuffer | string
  className?: string | undefined
  activePage: number | null
  highlightBoxes: NormalizedHighlightBox[]
}) {
  const pageRefs = useRef(new Map<number, HTMLDivElement>())
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let loadingTask: PDFDocumentLoadingTask | null = null
    let loadedDoc: PDFDocumentProxy | null = null

    async function load() {
      try {
        const pdfjs = await import("pdfjs-dist")
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC
        }
        let data: ArrayBuffer | Uint8Array
        if (source instanceof ArrayBuffer) data = source
        else if (source instanceof Blob) data = await source.arrayBuffer()
        else {
          setError("Remote URL source not supported for PDF; pass a Blob.")
          return
        }
        loadingTask = pdfjs.getDocument({
          data,
          cMapUrl: PDF_CMAP_URL,
          cMapPacked: true,
          standardFontDataUrl: PDF_STANDARD_FONT_URL,
        })
        loadedDoc = await loadingTask.promise
        if (cancelled) {
          loadedDoc.destroy()
          return
        }
        setDoc(loadedDoc)
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load PDF")
      }
    }
    void load()

    return () => {
      cancelled = true
      loadedDoc?.destroy()
      loadingTask?.destroy()
    }
  }, [source])

  useEffect(() => {
    if (!activePage) return
    const target = pageRefs.current.get(activePage)
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [activePage, doc])

  if (error) {
    return (
      <ViewerFrame className={className}>
        <ViewerMessage icon={<FileWarning className="h-5 w-5" />} label={error} />
      </ViewerFrame>
    )
  }
  if (!doc) {
    return (
      <ViewerFrame className={className}>
        <ViewerMessage
          icon={<Loader2 className="h-4 w-4 animate-spin" />}
          label="Loading PDF…"
        />
      </ViewerFrame>
    )
  }

  const pages = Array.from({ length: doc.numPages }, (_, i) => i + 1)

  return (
    <ViewerFrame className={className}>
      <div className="flex-1 space-y-3 overflow-auto bg-muted/20 p-3">
        {pages.map((n) => (
          <div
            key={n}
            ref={(el) => {
              if (el) pageRefs.current.set(n, el)
              else pageRefs.current.delete(n)
            }}
          >
            <PdfPage
              doc={doc}
              pageNumber={n}
              boxes={activePage === n ? highlightBoxes : []}
            />
          </div>
        ))}
      </div>
    </ViewerFrame>
  )
}

function PdfPage({
  doc,
  pageNumber,
  boxes,
}: {
  doc: PDFDocumentProxy
  pageNumber: number
  boxes: NormalizedHighlightBox[]
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    let renderTask: RenderTask | null = null

    async function render() {
      const page = await doc.getPage(pageNumber)
      if (cancelled) return
      const viewport = page.getViewport({ scale: PDF_RENDER_SCALE })
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      canvas.width = viewport.width
      canvas.height = viewport.height
      renderTask = page.render({ canvasContext: ctx, viewport })
      try {
        await renderTask.promise
      } catch {
        // render cancelled — ignore
      }
      if (!cancelled) setDims({ w: viewport.width, h: viewport.height })
    }
    void render()

    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [doc, pageNumber])

  return (
    <div className="relative mx-auto w-fit shadow-sm ring-1 ring-border">
      <canvas ref={canvasRef} className="block bg-background" />
      {dims && boxes.length > 0 ? (
        <svg
          className="pointer-events-none absolute inset-0"
          width={dims.w}
          height={dims.h}
          viewBox={`0 0 ${dims.w} ${dims.h}`}
        >
          {boxes.map((b, i) => (
            <rect
              key={i}
              x={b.x * dims.w}
              y={b.y * dims.h}
              width={b.width * dims.w}
              height={b.height * dims.h}
              className="fill-primary/20 stroke-primary"
              strokeWidth={2}
            />
          ))}
        </svg>
      ) : null}
    </div>
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
