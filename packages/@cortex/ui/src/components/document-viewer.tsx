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
import { useTranslation } from "react-i18next"
import * as XLSX from "xlsx"
import type { SpreadsheetSearchTerm } from "./spreadsheet-search"
import {
  findBestSpreadsheetRowMatch,
  findBestSpreadsheetSheetMatch,
  type SpreadsheetSheetData,
} from "./spreadsheet-search"
import { Button } from "./ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"

export type DocumentKind = "pdf" | "docx" | "xlsx" | "image" | "unsupported"

// Mirrored as `detectPreviewableKind` in packages/@cortex/utils/src/preview-kind.ts
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
  spreadsheetSearchTerms?: SpreadsheetSearchTerm[] | undefined
}

export function DocumentViewer({
  source,
  fileName,
  mediaType,
  className,
  activePage,
  highlightBoxes,
  spreadsheetSearchTerms,
}: DocumentViewerProps) {
  const { t } = useTranslation("ui")
  const kind = useMemo(() => detectDocumentKind(fileName, mediaType), [fileName, mediaType])

  if (!source) {
    return (
      <ViewerFrame className={className}>
        <ViewerMessage label={t("documentViewer.noSelection")} />
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
  if (kind === "xlsx")
    return (
      <XlsxViewer
        source={source}
        className={className}
        spreadsheetSearchTerms={spreadsheetSearchTerms ?? []}
      />
    )
  if (kind === "image")
    return <ImageViewer source={source} fileName={fileName} className={className} />

  return (
    <ViewerFrame className={className}>
      <ViewerMessage
        icon={<FileWarning className="h-5 w-5" />}
        label={t("documentViewer.noPreview", { fileName })}
      />
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
  const { t } = useTranslation("ui")
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef(new Map<number, HTMLDivElement>())
  const hasAutoFitRef = useRef(false)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(PDF_RENDER_SCALE)
  const [currentPage, setCurrentPage] = useState(1)
  const [unscaledFirstPageWidth, setUnscaledFirstPageWidth] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    let loadingTask: PDFDocumentLoadingTask | null = null
    let loadedDoc: PDFDocumentProxy | null = null
    hasAutoFitRef.current = false

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
          setError(t("documentViewer.remoteUnsupportedPdf"))
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
        if (!cancelled) setError(e instanceof Error ? e.message : t("documentViewer.loadPdfFailed"))
      }
    }
    void load()

    return () => {
      cancelled = true
      loadedDoc?.destroy()
      loadingTask?.destroy()
    }
  }, [source, t])

  useEffect(() => {
    if (!doc || !unscaledFirstPageWidth || hasAutoFitRef.current) return
    const container = containerRef.current
    if (!container || container.clientWidth <= 0) return
    const fitScale = (container.clientWidth - PDF_FIT_PADDING_PX) / unscaledFirstPageWidth
    hasAutoFitRef.current = true
    setScale(Math.min(PDF_RENDER_SCALE, Math.max(PDF_MIN_SCALE, fitScale)))
  }, [doc, unscaledFirstPageWidth])

  useEffect(() => {
    if (!activePage) return
    const frame = requestAnimationFrame(() => {
      const container = containerRef.current
      const target = pageRefs.current.get(activePage)
      if (!container || !target) return
      container.scrollTo({
        top: Math.max(0, target.offsetTop - container.offsetTop),
        behavior: "auto",
      })
      setCurrentPage(activePage)
    })
    return () => cancelAnimationFrame(frame)
  }, [activePage, doc, scale])

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
          label={t("documentViewer.loadingPdf")}
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
  const { t } = useTranslation("ui")
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
              aria-label={t("documentViewer.previousPage")}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("documentViewer.previousPage")}</TooltipContent>
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
              aria-label={t("documentViewer.nextPage")}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("documentViewer.nextPage")}</TooltipContent>
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
              aria-label={t("documentViewer.zoomOut")}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("documentViewer.zoomOut")}</TooltipContent>
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
              aria-label={t("documentViewer.zoomIn")}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("documentViewer.zoomIn")}</TooltipContent>
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
              aria-label={t("documentViewer.fitToWidth")}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("documentViewer.fitToWidth")}</TooltipContent>
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

function DocxViewer({
  source,
  className,
}: {
  source: Blob | ArrayBuffer | string
  className?: string | undefined
}) {
  const { t } = useTranslation("ui")
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ref.current) return
    if (typeof source === "string") {
      setError(t("documentViewer.remoteUnsupportedDocx"))
      return
    }
    const blob = source instanceof Blob ? source : new Blob([source])
    ref.current.innerHTML = ""
    renderAsync(blob, ref.current).catch((e) => {
      setError(e instanceof Error ? e.message : t("documentViewer.unknownError"))
    })
  }, [source, t])

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

function XlsxViewer({
  source,
  className,
  spreadsheetSearchTerms,
}: {
  source: Blob | ArrayBuffer | string
  className?: string | undefined
  spreadsheetSearchTerms: SpreadsheetSearchTerm[]
}) {
  const { t } = useTranslation("ui")
  const tableRef = useRef<HTMLDivElement>(null)
  const [sheets, setSheets] = useState<SpreadsheetSheetData[]>([])
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
          setError(t("documentViewer.remoteUnsupportedXlsx"))
          return
        }
        const wb = XLSX.read(buffer, { type: "array" })
        const parsed: SpreadsheetSheetData[] = wb.SheetNames.map((name) => {
          const ws = wb.Sheets[name]
          const rawRows = ws
            ? (XLSX.utils.sheet_to_json(ws, {
                header: 1,
                blankrows: true,
                defval: "",
                raw: false,
              }) as unknown[][])
            : []
          return { name, rows: normalizeSpreadsheetRows(rawRows) }
        })
        if (!cancelled) {
          setSheets(parsed)
          setActive(0)
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : t("documentViewer.parseSpreadsheetFailed"))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [source, t])

  useEffect(() => {
    if (spreadsheetSearchTerms.length === 0 || sheets.length === 0) return

    const sheetMatch = findBestSpreadsheetSheetMatch(sheets, spreadsheetSearchTerms)
    if (!sheetMatch) return

    const sheetIndex = sheets.findIndex((sheet) => sheet.name === sheetMatch.sheetName)
    if (sheetIndex >= 0 && sheetIndex !== active) setActive(sheetIndex)
  }, [active, sheets, spreadsheetSearchTerms])

  const activeSheet = sheets[active]
  const spreadsheetMatch = useMemo(
    () =>
      activeSheet ? findBestSpreadsheetRowMatch(activeSheet.rows, spreadsheetSearchTerms) : null,
    [activeSheet, spreadsheetSearchTerms],
  )
  const matchedCellIndexes = useMemo(
    () => new Set(spreadsheetMatch?.matchedCellIndexes ?? []),
    [spreadsheetMatch],
  )

  useEffect(() => {
    if (!spreadsheetMatch) return
    const container = tableRef.current
    if (!container) return

    const target = container.querySelector<HTMLElement>(
      `[data-spreadsheet-row="${spreadsheetMatch.rowIndex}"]`,
    )
    target?.scrollIntoView?.({ block: "center", inline: "nearest", behavior: "auto" })
  }, [active, spreadsheetMatch])

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
        <ViewerMessage
          icon={<Loader2 className="h-4 w-4 animate-spin" />}
          label={t("documentViewer.loadingSpreadsheet")}
        />
      </ViewerFrame>
    )
  }

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
      {spreadsheetMatch ? (
        <div className="shrink-0 border-b border-border bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          {t("documentViewer.matched", {
            count: spreadsheetMatch.matchedTermCount,
            row: spreadsheetMatch.rowIndex + 1,
          })}
        </div>
      ) : null}
      <div ref={tableRef} className="flex-1 overflow-auto bg-background p-3 text-xs">
        <table className="w-full border-collapse">
          <tbody>
            {(activeSheet?.rows ?? []).map((row, rowIndex) => {
              const isMatchedRow = spreadsheetMatch?.rowIndex === rowIndex
              return (
                <tr
                  key={rowIndex}
                  data-spreadsheet-row={rowIndex}
                  data-source-active-row={isMatchedRow ? "true" : undefined}
                  className={cn(
                    isMatchedRow &&
                      "bg-primary/10 outline outline-2 outline-offset-[-2px] outline-primary/50",
                  )}
                >
                  {row.map((cell, cellIndex) => {
                    const isMatchedCell = isMatchedRow && matchedCellIndexes.has(cellIndex)
                    return (
                      <td
                        key={cellIndex}
                        data-source-active-cell={isMatchedCell ? "true" : undefined}
                        className={cn(
                          "border border-border px-2 py-1 align-top",
                          isMatchedCell &&
                            "bg-primary/20 font-semibold ring-1 ring-inset ring-primary/40",
                        )}
                      >
                        {cell}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </ViewerFrame>
  )
}

function normalizeSpreadsheetRows(rows: unknown[][]): string[][] {
  return rows.map((row) =>
    row.map((cell) => {
      if (cell === null || cell === undefined) return ""
      return String(cell)
    }),
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
