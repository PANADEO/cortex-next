"use client"

import { useSourceMaterialSelectionStore } from "@/lib/stores/source-material-selection"
import { endpoints, usePackageSourceFiles } from "@cortex/api"
import type { NormalizedHighlightBox, SourceFileReadModel } from "@cortex/types"
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  LoadingState,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@cortex/ui"
import type { SpreadsheetSearchTerm } from "@cortex/ui/components/spreadsheet-search"
import { canPreviewInline, cn, detectPreviewableKind, getFileTypeIcon } from "@cortex/utils"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import dynamic from "next/dynamic"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

/** Osobny komponent, bo `loading` w `dynamic()` stoi poza drzewem Reacta
 *  i nie wolno tam wołać hooka. */
function ViewerLoading() {
  const { t } = useTranslation("idp")
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-md border border-border bg-muted/30 text-xs text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("sourceMaterials.loadingViewer")}
    </div>
  )
}

const DocumentViewer = dynamic(
  () => import("@cortex/ui/components/document-viewer").then((m) => m.DocumentViewer),
  { ssr: false, loading: () => <ViewerLoading /> },
)

interface SourceMaterialsPanelProps {
  packageId: string
}

export function SourceMaterialsPanel({ packageId }: SourceMaterialsPanelProps) {
  const { t } = useTranslation("idp")
  const files = usePackageSourceFiles(packageId)
  const activePath = useSourceMaterialSelectionStore((s) => s.activePath)
  const activePage = useSourceMaterialSelectionStore((s) => s.activePage)
  const highlightBoxes = useSourceMaterialSelectionStore((s) => s.highlightBoxes)
  const selectionLabel = useSourceMaterialSelectionStore((s) => s.selectionLabel)
  const spreadsheetSearchTerms = useSourceMaterialSelectionStore((s) => s.spreadsheetSearchTerms)
  const setActivePath = useSourceMaterialSelectionStore((s) => s.setActivePath)

  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    if (!activePath && files.data && files.data.length > 0) {
      setActivePath(files.data[0]?.path ?? null)
    }
  }, [files.data, activePath, setActivePath])

  const items = files.data ?? []

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    updateScrollState()
    el.addEventListener("scroll", updateScrollState, { passive: true })
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => updateScrollState())
    observer?.observe(el)
    return () => {
      el.removeEventListener("scroll", updateScrollState)
      observer?.disconnect()
    }
  }, [updateScrollState, items.length])

  useEffect(() => {
    if (!activePath) return
    const el = scrollerRef.current
    if (!el) return
    const trigger = el.querySelector<HTMLElement>(`[data-tab-path="${CSS.escape(activePath)}"]`)
    trigger?.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "nearest" })
  }, [activePath])

  if (files.isLoading) return <LoadingState label={t("sourceMaterials.loadingFiles")} />
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("sourceMaterials.empty")}</p>
  }

  const active = items.find((f) => f.path === activePath) ?? items[0]!
  const activeKind = detectPreviewableKind(active.file_name, active.media_type)
  const showDropdown = items.length > 1
  const isSelectedSource = active.path === activePath
  const isPdfSelection = isSelectedSource && activeKind === "pdf"
  const hasSourceSelection =
    isSelectedSource &&
    (selectionLabel !== null ||
      (isPdfSelection && activePage !== null) ||
      (isPdfSelection && highlightBoxes.length > 0) ||
      spreadsheetSearchTerms.length > 0)

  const handleScrollBy = (delta: number) => {
    scrollerRef.current?.scrollBy({ left: delta, behavior: "smooth" })
  }

  const handleSelectFromDropdown = (path: string) => {
    setActivePath(path)
    requestAnimationFrame(() => {
      const el = scrollerRef.current
      if (!el) return
      el.querySelector<HTMLElement>(`[data-tab-path="${CSS.escape(path)}"]`)?.scrollIntoView?.({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      })
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <Tabs value={active.path} onValueChange={setActivePath}>
        <div className="relative flex items-center gap-1 border-b border-border">
          {canScrollLeft ? (
            <button
              type="button"
              onClick={() => handleScrollBy(-200)}
              aria-label={t("sourceMaterials.scrollLeft")}
              className="flex h-8 w-6 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : null}
          <TabsList
            ref={scrollerRef}
            className="flex h-auto flex-1 justify-start overflow-x-auto rounded-none bg-transparent p-0 text-muted-foreground [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {items.map((f) => {
              const { Icon, toneClass } = getFileTypeIcon(f.file_name, f.media_type)
              return (
                <TabsTrigger
                  key={f.path}
                  value={f.path}
                  data-tab-path={f.path}
                  title={f.file_name}
                  className={cn(
                    "inline-flex max-w-[220px] shrink-0 items-center gap-1.5 rounded-none rounded-t-md border-x border-t border-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-none",
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", toneClass)} />
                  <span className="truncate">{f.file_name}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>
          {canScrollRight ? (
            <button
              type="button"
              onClick={() => handleScrollBy(200)}
              aria-label={t("sourceMaterials.scrollRight")}
              className="flex h-8 w-6 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : null}
          {showDropdown ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label={t("sourceMaterials.showAllFiles")}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                {items.map((f) => {
                  const { Icon, toneClass } = getFileTypeIcon(f.file_name, f.media_type)
                  const isActive = f.path === active.path
                  return (
                    <DropdownMenuItem
                      key={f.path}
                      onSelect={() => handleSelectFromDropdown(f.path)}
                      className={cn("gap-2", isActive && "bg-accent")}
                    >
                      <Icon className={cn("h-3.5 w-3.5 shrink-0", toneClass)} />
                      <span className="max-w-[280px] truncate" title={f.file_name}>
                        {f.file_name}
                      </span>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </Tabs>

      {hasSourceSelection ? (
        <div className="shrink-0 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          {t("sourceMaterials.selected")}
          {selectionLabel ? ` — ${selectionLabel}` : ""}
          {isPdfSelection && activePage ? ` · ${t("sourceMaterials.page", { n: activePage })}` : ""}
          {isPdfSelection && highlightBoxes.length > 0
            ? ` · ${t("sourceMaterials.highlights", { count: highlightBoxes.length })}`
            : ""}
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        <SourceFileBody
          packageId={packageId}
          file={active}
          activePage={isPdfSelection ? activePage : null}
          highlightBoxes={isPdfSelection ? highlightBoxes : []}
          spreadsheetSearchTerms={isSelectedSource ? spreadsheetSearchTerms : []}
        />
      </div>
    </div>
  )
}

function SourceFileBody({
  packageId,
  file,
  activePage,
  highlightBoxes,
  spreadsheetSearchTerms,
}: {
  packageId: string
  file: SourceFileReadModel
  activePage: number | null
  highlightBoxes: NormalizedHighlightBox[]
  spreadsheetSearchTerms: SpreadsheetSearchTerm[]
}) {
  const { t } = useTranslation("idp")
  const previewable = canPreviewInline(file.file_name, file.media_type, file.preview_kind)
  const content = useQuery({
    queryKey: ["idp", "packages", "source-file", packageId, file.path],
    queryFn: () => endpoints.packages.sourceFileContent(packageId, file.path),
    staleTime: Infinity,
    enabled: previewable,
  })

  if (!previewable) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
        {t("sourceMaterials.noInlinePreview")}
      </div>
    )
  }

  if (content.isLoading)
    return <LoadingState label={t("sourceMaterials.loadingFile", { name: file.file_name })} />
  if (content.error || !content.data) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {t("sourceMaterials.loadFailed")}
      </div>
    )
  }

  return (
    <DocumentViewer
      source={content.data}
      fileName={file.file_name}
      mediaType={file.media_type}
      activePage={activePage}
      highlightBoxes={highlightBoxes}
      spreadsheetSearchTerms={spreadsheetSearchTerms}
    />
  )
}
