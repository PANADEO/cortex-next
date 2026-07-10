"use client"

import { IntrastatCorrectionInfo } from "@/components/intrastat/correction-info"
import { IntrastatDeleteBatchButton } from "@/components/intrastat/delete-batch-button"
import { IntrastatDocumentPreviewPanel } from "@/components/intrastat/document-preview-panel"
import { IntrastatExportButtons } from "@/components/intrastat/export-buttons"
import { IntrastatLineEditDialog } from "@/components/intrastat/line-edit-dialog"
import { IntrastatMatchDetailsPopover } from "@/components/intrastat/match-details-popover"
import {
  IntrastatKindBadge,
  IntrastatStatusBadge,
  getIntrastatMatchLabel,
} from "@/components/intrastat/status"
import {
  useIntrastatBatch,
  useIntrastatBatches,
  useIntrastatLines,
  useIntrastatReprocessBatch,
} from "@/lib/intrastat/hooks"
import type { IntrastatCnMatchStatus, IntrastatDeclarationLine } from "@/lib/intrastat/types"
import {
  Button,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@cortex/ui"
import type { ColumnDef } from "@tanstack/react-table"
import {
  AlertTriangle,
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  PlayCircle,
  Search,
  TableProperties,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"
import { toast } from "sonner"

const PAGE_SIZE = 100
const PREVIEW_VISIBLE_STORAGE_KEY = "intrastat.review.documentPreviewVisible"
const PREVIEW_SPLIT_STORAGE_KEY = "intrastat-review-document-preview-split"
const MATCH_OPTIONS: Array<{ value: IntrastatCnMatchStatus | "all"; label: string }> = [
  { value: "all", label: "All match statuses" },
  { value: "exact", label: "Exact" },
  { value: "prefix_unique", label: "Prefix" },
  { value: "description_match", label: "Description" },
  { value: "semantic_match", label: "Semantic" },
  { value: "invoice_cn", label: "Invoice CN" },
  { value: "manual", label: "Manual" },
  { value: "ambiguous", label: "Ambiguous" },
  { value: "unmatched", label: "Unmatched" },
]

function getBatchParam(): string | null {
  if (typeof window === "undefined") return null
  return new URLSearchParams(window.location.search).get("batch")
}

export default function IntrastatReviewPage() {
  const router = useRouter()
  const [batchId, setBatchId] = useState("")
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [matchStatus, setMatchStatus] = useState<IntrastatCnMatchStatus | "all">("all")
  const [editing, setEditing] = useState<IntrastatDeclarationLine | null>(null)
  const [selectedSourceFile, setSelectedSourceFile] = useState<string | null>(null)
  const [documentPreviewVisible, setDocumentPreviewVisible] = useState(true)
  const batches = useIntrastatBatches({ limit: 100, offset: 0 })
  const selectedBatch = useIntrastatBatch(batchId)
  const lines = useIntrastatLines(batchId, {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    match_status: matchStatus,
    search,
  })
  const reprocess = useIntrastatReprocessBatch()

  useEffect(() => {
    const initialBatch = getBatchParam()
    if (initialBatch) setBatchId(initialBatch)
  }, [])

  useEffect(() => {
    try {
      setDocumentPreviewVisible(localStorage.getItem(PREVIEW_VISIBLE_STORAGE_KEY) !== "false")
    } catch {
      setDocumentPreviewVisible(true)
    }
  }, [])

  useEffect(() => {
    if (getBatchParam()) return
    if (!batchId && batches.data?.items[0]) {
      setBatchId(batches.data.items[0].id)
    }
  }, [batchId, batches.data?.items])

  const items = useMemo(() => lines.data?.items ?? [], [lines.data?.items])
  const total = lines.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const columns = useMemo<ColumnDef<IntrastatDeclarationLine>[]>(
    () => [
      {
        accessorKey: "lp",
        header: "LP",
        size: 60,
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.lp}</span>,
      },
      {
        accessorKey: "invoice_number",
        header: "Invoice",
        size: 260,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p
              className={
                row.original.is_excluded
                  ? "truncate font-medium line-through"
                  : "truncate font-medium"
              }
            >
              {row.original.invoice_number}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.invoice_date ?? "No date"}
            </p>
            <IntrastatCorrectionInfo line={row.original} />
          </div>
        ),
      },
      {
        accessorKey: "item_index",
        header: "Index",
        size: 170,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.item_index || "—"}</span>
        ),
      },
      {
        accessorKey: "cn_code",
        header: "CN",
        size: 110,
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.cn_code ?? "—"}</span>,
      },
      {
        accessorKey: "description",
        header: "Description",
        size: 270,
        cell: ({ row }) => (
          <span className="block max-w-[260px] truncate">{row.original.description ?? "—"}</span>
        ),
      },
      {
        accessorKey: "value",
        header: "Value",
        size: 130,
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {row.original.value ?? "—"} {row.original.currency ?? ""}
          </span>
        ),
      },
      {
        accessorKey: "net_weight",
        header: "Weight",
        size: 100,
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{row.original.net_weight ?? "—"}</span>
        ),
      },
      {
        accessorKey: "cn_match_status",
        header: "Match",
        size: 140,
        cell: ({ row }) => <IntrastatMatchDetailsPopover line={row.original} />,
      },
      {
        accessorKey: "alerts",
        header: "Alerts",
        size: 80,
        cell: ({ row }) =>
          row.original.alerts.length > 0 ? (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help" tabIndex={0}>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-80 border bg-popover p-3 text-popover-foreground shadow-lg">
                  <ul className="space-y-1 text-sm">
                    {row.original.alerts.map((alert) => (
                      <li key={alert}>{alert}</li>
                    ))}
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: "actions",
        header: "",
        size: 80,
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelectedSourceFile(row.original.source_file)
              setEditing(row.original)
            }}
          >
            <Edit3 className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [],
  )

  const handleBatchChange = (nextBatchId: string) => {
    setBatchId(nextBatchId)
    setPage(0)
    setSelectedSourceFile(null)
    router.replace(`/intrastat/review?batch=${nextBatchId}`)
  }

  const handleLineSelect = (line: IntrastatDeclarationLine) => {
    setSelectedSourceFile(line.source_file)
  }

  const handleDocumentPreviewToggle = () => {
    setDocumentPreviewVisible((current) => {
      const next = !current
      try {
        localStorage.setItem(PREVIEW_VISIBLE_STORAGE_KEY, String(next))
      } catch {
        // localStorage can be unavailable in restricted browser contexts.
      }
      return next
    })
  }

  const handleReprocess = async () => {
    if (!batchId) return
    try {
      await reprocess.mutateAsync(batchId)
      toast.success("Batch queued for reprocessing")
    } catch {
      toast.error("Batch reprocess failed")
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Intrastat Review"
        description="Correct CN, weight, VAT, and delivery fields before exporting the importer workbook."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleDocumentPreviewToggle}>
              {documentPreviewVisible ? (
                <EyeOff className="mr-2 h-4 w-4" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              {documentPreviewVisible ? "Hide preview" : "Show preview"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReprocess}
              disabled={!batchId || reprocess.isPending}
            >
              {reprocess.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="mr-2 h-4 w-4" />
              )}
              Reprocess
            </Button>
            <IntrastatExportButtons batchId={batchId} />
            <IntrastatDeleteBatchButton
              batchId={batchId}
              batchName={selectedBatch.data?.name ?? "this batch"}
              disabled={!selectedBatch.data || selectedBatch.data.status === "processing"}
              onDeleted={() => router.push("/intrastat/batches")}
            />
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-hidden px-8 py-6">
        <PanelGroup
          key={documentPreviewVisible ? "with-document-preview" : "without-document-preview"}
          autoSaveId={documentPreviewVisible ? PREVIEW_SPLIT_STORAGE_KEY : undefined}
          direction="horizontal"
          className="h-full"
        >
          <Panel
            defaultSize={documentPreviewVisible ? 68 : 100}
            minSize={45}
            className="flex min-h-0 flex-col gap-4 overflow-hidden pr-4"
          >
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <Select value={batchId} onValueChange={handleBatchChange}>
                <SelectTrigger className="h-9 w-[340px]">
                  <SelectValue placeholder="Choose a batch" />
                </SelectTrigger>
                <SelectContent>
                  {(batches.data?.items ?? []).map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBatch.data ? (
                <>
                  <IntrastatKindBadge kind={selectedBatch.data.transaction_kind} />
                  <IntrastatStatusBadge status={selectedBatch.data.status} />
                </>
              ) : null}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search invoice, index, CN..."
                  value={search}
                  onChange={(event) => {
                    setPage(0)
                    setSearch(event.target.value)
                  }}
                  className="h-9 w-72 pl-9"
                />
              </div>
              <Select
                value={matchStatus}
                onValueChange={(value) => {
                  setPage(0)
                  setMatchStatus(value as IntrastatCnMatchStatus | "all")
                }}
              >
                <SelectTrigger className="h-9 w-[210px]">
                  <SelectValue placeholder="Match status" />
                </SelectTrigger>
                <SelectContent>
                  {MATCH_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.value === "all" ? option.label : getIntrastatMatchLabel(option.value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="ml-auto text-xs text-muted-foreground">
                {lines.isFetching ? "Refreshing..." : `${total} total`}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <DataTable
                columns={columns}
                data={items}
                isLoading={lines.isPending && items.length === 0}
                getRowId={(row) => row.id}
                getRowClassName={(row) =>
                  row.is_excluded ? "bg-muted/30 text-muted-foreground" : undefined
                }
                onRowClick={handleLineSelect}
                stickyHeader
                bordered
                emptyState={
                  <EmptyState
                    icon={TableProperties}
                    title={batchId ? "No lines in this batch" : "Choose a batch"}
                    description={
                      batchId
                        ? "Lines appear after worker processing finishes."
                        : "Select an Intrastat batch to review declaration lines."
                    }
                  />
                }
              />
            </div>

            <Pagination page={page} pageCount={pageCount} onChange={setPage} />
          </Panel>

          {documentPreviewVisible ? (
            <>
              <PanelResizeHandle className="w-1 shrink-0 bg-border transition-colors hover:bg-primary/40 data-[resize-handle-active]:bg-primary/50" />
              <Panel
                defaultSize={32}
                minSize={22}
                maxSize={55}
                className="min-h-0 overflow-hidden pl-4"
              >
                <IntrastatDocumentPreviewPanel
                  batchId={batchId}
                  documents={selectedBatch.data?.documents ?? []}
                  selectedSourceFile={selectedSourceFile}
                  className="h-full"
                />
              </Panel>
            </>
          ) : null}
        </PanelGroup>
      </div>

      <IntrastatLineEditDialog
        batchId={batchId}
        line={editing}
        open={Boolean(editing)}
        onOpenChange={(next) => {
          if (!next) setEditing(null)
        }}
      />
    </div>
  )
}
