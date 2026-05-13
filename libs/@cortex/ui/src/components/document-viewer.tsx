"use client"

import type { NormalizedHighlightBox } from "@cortex/types"
import { cn } from "@cortex/utils"
import { renderAsync } from "docx-preview"
import {
  ChevronDown,
  ChevronUp,
  FileWarning,
  Loader2,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as XLSX from "xlsx"
import { Button } from "./ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"

export type DocumentKind = "pdf" | "docx" | "xlsx" | "image" | "unsupported"

// Mirrored as `detectPreviewableKind` in libs/@cortex/utils/src/preview-kind.ts
// for consumers that need to decide preview routing without loading pdfjs.
// Update both when adding formats.
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
        "flex h-full min-h-[480px] w-full flex-col overflow-hidden rounded-md border border-border bg-muted/30",
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

const PUBLIC_BASE_PATH = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH)
const PDF_WORKER_SRC = publicAssetPath("/pdfjs/pdf.worker.min.js")
const PDF_CMAP_URL = publicAssetPath("/pdfjs/cmaps/")
const PDF_STANDARD_FONT_URL = publicAssetPath("/pdfjs/standard_fonts/")
const PDF_RENDER_SCALE = 1.25
const PDF_MIN_SCALE = 0.5
const PDF_MAX_SCALE = 3.0
const PDF_SCALE_STEP = 1.25
const PDF_FIT_PADDING_PX = 24
const PDF_TOOLBAR_TOOLTIP_DELAY = 300

function normalizeBasePath(value: string | undefined): string {
  if (!value) return ""
  const trimmed = value.trim()
  if (!trimmed || trimmed === "/") return ""
  return trimmed.startsWith("/") ? trimmed.replace(/\/+$/, "") : `/${trimmed.replace(/\/+$/, "")}`
}

function publicAssetPath(pathname: string): string {
  return `${PUBLIC_BASE_PATH}${pathname}`
}

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
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef(new Map<number, HTMLDivElement>())
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(PDF_RENDER_SCALE)
  const [currentPage, setCurrentPage] = useState(1)
  const [unscaledFirstPageWidth, setUnscaledFirstPageWidth] = useState<number | null>(null)

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
        const firstPage = await loadedDoc.getPage(1)
        if (cancelled) {
          loadedDoc.destroy()
          return
        }
        const firstViewport = firstPage.getViewport({ scale: 1 })
        setDoc(loadedDoc)
        setUnscaledFirstPageWidth(firstViewport.width)
        setCurrentPage(1)
        setScale(PDF_RENDER_SCALE)
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

  useEffect(() => {
    if (!doc) return
    const root = containerRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        let bestPage: number | null = null
        let bestRatio = 0
        for (const entry of entries) {
          if (entry.intersectionRatio <= bestRatio) continue
          const pageAttr = entry.target.getAttribute("data-page")
          const n = pageAttr ? Number(pageAttr) : NaN
          if (Number.isFinite(n)) {
            bestRatio = entry.intersectionRatio
            bestPage = n
          }
        }
        if (bestPage !== null && bestRatio > 0) setCurrentPage(bestPage)
      },
      { root, threshold: [0.1, 0.5, 0.9] },
    )
    for (const el of pageRefs.current.values()) observer.observe(el)
    return () => observer.disconnect()
  }, [doc])

  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(PDF_MAX_SCALE, s * PDF_SCALE_STEP))
  }, [])

  const handleZoomOut = useCallback(() => {
    setScale((s) => Math.max(PDF_MIN_SCALE, s / PDF_SCALE_STEP))
  }, [])

  const handleFitToWidth = useCallback(() => {
    const container = containerRef.current
    if (!container || !unscaledFirstPageWidth) return
    const target = (container.clientWidth - PDF_FIT_PADDING_PX) / unscaledFirstPageWidth
    setScale(Math.min(PDF_MAX_SCALE, Math.max(PDF_MIN_SCALE, target)))
  }, [unscaledFirstPageWidth])

  const handlePrevPage = useCallback(() => {
    const n = Math.max(1, currentPage - 1)
    pageRefs.current.get(n)?.scrollIntoView({ block: "start", behavior: "smooth" })
  }, [currentPage])

  const handleNextPage = useCallback(() => {
    if (!doc) return
    const n = Math.min(doc.numPages, currentPage + 1)
    pageRefs.current.get(n)?.scrollIntoView({ block: "start", behavior: "smooth" })
  }, [doc, currentPage])

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
      <PdfToolbar
        currentPage={currentPage}
        numPages={doc.numPages}
        scale={scale}
        canFitToWidth={unscaledFirstPageWidth !== null}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitToWidth={handleFitToWidth}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
      />
      <div ref={containerRef} className="flex-1 space-y-3 overflow-auto bg-muted/20 p-3">
        {pages.map((n) => (
          <div
            key={n}
            data-page={n}
            ref={(el) => {
              if (el) pageRefs.current.set(n, el)
              else pageRefs.current.delete(n)
            }}
          >
            <PdfPage
              doc={doc}
              pageNumber={n}
              scale={scale}
              boxes={activePage === n ? highlightBoxes : []}
            />
          </div>
        ))}
      </div>
    </ViewerFrame>
  )
}

function PdfToolbar({
  currentPage,
  numPages,
  scale,
  canFitToWidth,
  onZoomIn,
  onZoomOut,
  onFitToWidth,
  onPrevPage,
  onNextPage,
}: {
  currentPage: number
  numPages: number
  scale: number
  canFitToWidth: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onFitToWidth: () => void
  onPrevPage: () => void
  onNextPage: () => void
}) {
  const atFirstPage = currentPage <= 1
  const atLastPage = currentPage >= numPages
  const atMinScale = scale <= PDF_MIN_SCALE + 1e-6
  const atMaxScale = scale >= PDF_MAX_SCALE - 1e-6

  return (
    <TooltipProvider delayDuration={PDF_TOOLBAR_TOOLTIP_DELAY}>
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-background/60 px-2 py-1.5 text-xs">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onPrevPage}
              disabled={atFirstPage}
              aria-label="Previous page"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Previous page</TooltipContent>
        </Tooltip>
        <span className="px-1 tabular-nums text-muted-foreground">
          {currentPage} / {numPages}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onNextPage}
              disabled={atLastPage}
              aria-label="Next page"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Next page</TooltipContent>
        </Tooltip>
        <span className="mx-1 h-4 w-px bg-border" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onZoomOut}
              disabled={atMinScale}
              aria-label="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom out</TooltipContent>
        </Tooltip>
        <span className="min-w-[3rem] px-1 text-center tabular-nums text-muted-foreground">
          {Math.round(scale * 100)}%
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onZoomIn}
              disabled={atMaxScale}
              aria-label="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom in</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onFitToWidth}
              disabled={!canFitToWidth}
              aria-label="Fit to width"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Fit to width</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}

function PdfPage({
  doc,
  pageNumber,
  scale,
  boxes,
}: {
  doc: PDFDocumentProxy
  pageNumber: number
  scale: number
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
      const viewport = page.getViewport({ scale })
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
  }, [doc, pageNumber, scale])

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
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-3 py-2">
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
