"use client"

import { IntrastatCorrectionInfo } from "@/components/intrastat/correction-info"
import { IntrastatDeleteBatchButton } from "@/components/intrastat/delete-batch-button"
import { IntrastatDocumentPreviewPanel } from "@/components/intrastat/document-preview-panel"
import { IntrastatExportButtons } from "@/components/intrastat/export-buttons"
import { IntrastatLineDetailsDialog } from "@/components/intrastat/line-details-dialog"
import { IntrastatMatchDetailsPopover } from "@/components/intrastat/match-details-popover"
import { IntrastatPeriodInvoicesDialog } from "@/components/intrastat/period-invoices-dialog"
import {
  IntrastatKindBadge,
  IntrastatStatusBadge,
  getIntrastatMatchLabel,
} from "@/components/intrastat/status"
import { formatIntrastatError, isIntrastatErrorDetail } from "@/lib/intrastat/api"
import {
  useIntrastatBatch,
  useIntrastatBatches,
  useIntrastatCnSuggestions,
  useIntrastatCreateLine,
  useIntrastatLines,
  useIntrastatPatchLine,
  useIntrastatReprocessBatch,
  useIntrastatUpsertCnResourceRow,
} from "@/lib/intrastat/hooks"
import type {
  IntrastatCnMatchStatus,
  IntrastatCnSuggestion,
  IntrastatDeclarationLine,
  IntrastatLinePatchRequest,
} from "@/lib/intrastat/types"
import { useAuthorizedApps } from "@cortex/api"
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
  Check,
  Database,
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  PlayCircle,
  Plus,
  Search,
  TableProperties,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"
import { toast } from "sonner"

const PAGE_SIZE = 100
const CN_EDITOR_APP_CODE = "intrastat-cn-editor"
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

type LineFormState = {
  item_index: string
  cn_code: string
  description: string
  net_weight: string
  origin_country: string
  delivery_terms: string
  vat_number: string
  quantity: string
  value: string
  currency: string
}

type ActiveLineEditor = {
  mode: "edit" | "create"
  line: IntrastatDeclarationLine
  referenceLineId: string
  form: LineFormState
}

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
  const [editor, setEditor] = useState<ActiveLineEditor | null>(null)
  const [viewing, setViewing] = useState<IntrastatDeclarationLine | null>(null)
  const [cnSuggestionsOpen, setCnSuggestionsOpen] = useState(false)
  const [selectedSourceFile, setSelectedSourceFile] = useState<string | null>(null)
  const [documentPreviewVisible, setDocumentPreviewVisible] = useState(true)
  const access = useAuthorizedApps()
  const batches = useIntrastatBatches({ limit: 100, offset: 0 })
  const selectedBatch = useIntrastatBatch(batchId)
  const lines = useIntrastatLines(batchId, {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    match_status: matchStatus,
    search,
  })
  const reprocess = useIntrastatReprocessBatch()
  const patchLine = useIntrastatPatchLine(batchId)
  const createLine = useIntrastatCreateLine(batchId)
  const upsertCnResourceRow = useIntrastatUpsertCnResourceRow()
  const suggestionSearch = useMemo(
    () =>
      editor
        ? (
            editor.form.cn_code.trim() ||
            editor.form.item_index.trim() ||
            editor.form.description.trim()
          ).trim()
        : "",
    [editor],
  )
  const suggestions = useIntrastatCnSuggestions(
    suggestionSearch,
    Boolean(editor) && cnSuggestionsOpen && suggestionSearch.length >= 2,
  )

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
  const tableItems = useMemo(() => {
    if (editor?.mode !== "create") return items
    const referenceIndex = items.findIndex((line) => line.id === editor.referenceLineId)
    if (referenceIndex < 0) return items
    return [...items.slice(0, referenceIndex + 1), editor.line, ...items.slice(referenceIndex + 1)]
  }, [editor, items])
  const total = lines.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const isSaving = patchLine.isPending || createLine.isPending || upsertCnResourceRow.isPending
  const canEditCnResource = access.apps.includes(CN_EDITOR_APP_CODE)
  const cn8 = normalizedCn8(editor?.form.cn_code ?? "")
  const canSaveToCnResource = Boolean(
    editor?.form.item_index.trim() && cn8 && editor.form.description.trim(),
  )
  const mutationsDisabled =
    Boolean(editor) ||
    selectedBatch.data?.status === "queued" ||
    selectedBatch.data?.status === "processing"

  const updateEditor = (key: keyof LineFormState, value: string) => {
    setEditor((current) =>
      current ? { ...current, form: { ...current.form, [key]: value } } : current,
    )
  }

  const handleStartEdit = (line: IntrastatDeclarationLine) => {
    setSelectedSourceFile(line.source_file)
    setCnSuggestionsOpen(false)
    setEditor({
      mode: "edit",
      line,
      referenceLineId: line.id,
      form: lineFormFromLine(line),
    })
  }

  const handleStartCreate = (reference: IntrastatDeclarationLine) => {
    setSelectedSourceFile(reference.source_file)
    setCnSuggestionsOpen(false)
    setEditor({
      mode: "create",
      line: draftLineFromReference(reference),
      referenceLineId: reference.id,
      form: newLineFormFromReference(reference),
    })
  }

  const handleCancelEdit = () => {
    setCnSuggestionsOpen(false)
    setEditor(null)
  }

  const handleSuggestionSelect = (suggestion: IntrastatCnSuggestion) => {
    setEditor((current) =>
      current
        ? {
            ...current,
            form: {
              ...current.form,
              cn_code: suggestion.cn8 ?? suggestion.cn ?? current.form.cn_code,
              description: suggestion.description ?? current.form.description,
            },
          }
        : current,
    )
    setCnSuggestionsOpen(false)
  }

  const handleSaveLine = async (saveToCnResource: boolean) => {
    if (!editor) return
    const currentEditor = editor
    let savedLine: IntrastatDeclarationLine
    try {
      const payload = linePatchFromForm(currentEditor.form)
      savedLine =
        currentEditor.mode === "create"
          ? await createLine.mutateAsync({
              ...payload,
              reference_line_id: currentEditor.referenceLineId,
              item_index: currentEditor.form.item_index.trim(),
            })
          : await patchLine.mutateAsync({
              lineId: currentEditor.line.id,
              payload,
            })
    } catch (error) {
      toast.error(
        formatIntrastatError(
          error,
          currentEditor.mode === "create" ? "Line creation failed" : "Line update failed",
        ),
      )
      return
    }

    if (
      saveToCnResource &&
      canEditCnResource &&
      canSaveToCnResource &&
      cn8 &&
      currentEditor.form.item_index.trim()
    ) {
      const resourcePayload = {
        index_value: currentEditor.form.item_index.trim(),
        cn8,
        cn: cn8,
        description: currentEditor.form.description.trim(),
      }
      try {
        await upsertCnResourceRow.mutateAsync({ payload: resourcePayload })
      } catch (error) {
        if (!isIntrastatErrorDetail(error, "cn-resource-index-conflict")) {
          toast.error(formatIntrastatError(error, "Line saved, but CN database update failed"))
          handleCancelEdit()
          return
        }

        const shouldReplace = window.confirm(
          `Index ${resourcePayload.index_value} already has a different CN code. Replace it with ${cn8}?`,
        )
        if (!shouldReplace) {
          toast.success("Intrastat line saved; CN database unchanged")
          handleCancelEdit()
          return
        }
        try {
          await upsertCnResourceRow.mutateAsync({
            payload: resourcePayload,
            replaceConflict: true,
          })
        } catch (replaceError) {
          toast.error(
            formatIntrastatError(replaceError, "Line saved, but CN database update failed"),
          )
          handleCancelEdit()
          return
        }
      }
      toast.success("Intrastat line and CN database updated")
    } else {
      toast.success(
        currentEditor.mode === "create" ? "Intrastat line created" : "Intrastat line updated",
      )
    }
    setSelectedSourceFile(savedLine.source_file)
    handleCancelEdit()
  }

  const renderEditorInput = (
    line: IntrastatDeclarationLine,
    key: keyof LineFormState,
    label: string,
    options?: { type?: "text" | "number"; uppercase?: boolean; className?: string },
  ) => {
    if (editor?.line.id !== line.id) return null
    return (
      <Input
        aria-label={`${label} ${line.id}`}
        type={options?.type ?? "text"}
        value={editor.form[key]}
        onChange={(event) =>
          updateEditor(
            key,
            options?.uppercase ? event.target.value.toUpperCase() : event.target.value,
          )
        }
        className={options?.className ?? "h-8 min-w-24"}
        onClick={(event) => event.stopPropagation()}
      />
    )
  }

  const columns: ColumnDef<IntrastatDeclarationLine>[] = [
    {
      accessorKey: "lp",
      header: "LP",
      size: 60,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.lp}</span>,
    },
    {
      accessorKey: "invoice_number",
      header: "Invoice",
      size: 220,
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
      cell: ({ row }) =>
        editor?.mode === "create" && editor.line.id === row.original.id ? (
          renderEditorInput(row.original, "item_index", "Item index", {
            className: "h-8 min-w-36 font-mono",
          })
        ) : (
          <span className="font-mono text-xs">{row.original.item_index || "—"}</span>
        ),
    },
    {
      accessorKey: "cn_code",
      header: "CN",
      size: 150,
      cell: ({ row }) => {
        if (editor?.line.id !== row.original.id) {
          return <span className="font-mono text-xs">{row.original.cn_code ?? "—"}</span>
        }
        return (
          <div className="relative">
            <Input
              aria-label={`CN code ${row.original.id}`}
              value={editor.form.cn_code}
              onFocus={() => setCnSuggestionsOpen(true)}
              onChange={(event) => {
                updateEditor("cn_code", event.target.value)
                setCnSuggestionsOpen(true)
              }}
              onClick={(event) => event.stopPropagation()}
              className="h-8 min-w-32 font-mono"
            />
            {cnSuggestionsOpen &&
            (suggestions.isFetching || (suggestions.data?.items.length ?? 0) > 0) ? (
              <div
                className="absolute left-0 top-full z-30 mt-1 w-[420px] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg"
                onClick={(event) => event.stopPropagation()}
              >
                {(suggestions.data?.items ?? []).map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    className="grid w-full grid-cols-[88px_110px_minmax(0,1fr)] gap-3 border-b border-border px-3 py-2 text-left text-xs last:border-b-0 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    onClick={() => handleSuggestionSelect(suggestion)}
                  >
                    <span className="font-mono font-medium">
                      {suggestion.cn8 ?? suggestion.cn ?? "—"}
                    </span>
                    <span className="truncate font-mono text-muted-foreground">
                      {suggestion.index_value}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {suggestion.description ?? "—"}
                    </span>
                  </button>
                ))}
                {suggestions.isFetching && (suggestions.data?.items.length ?? 0) === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Loading suggestions...
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      size: 280,
      cell: ({ row }) =>
        renderEditorInput(row.original, "description", "Description", {
          className: "h-8 min-w-64",
        }) ?? (
          <span className="block max-w-[260px] truncate">{row.original.description ?? "—"}</span>
        ),
    },
    {
      accessorKey: "quantity",
      header: "Quantity",
      size: 110,
      cell: ({ row }) =>
        renderEditorInput(row.original, "quantity", "Quantity", {
          type: "number",
        }) ?? <span className="whitespace-nowrap">{row.original.quantity ?? "—"}</span>,
    },
    {
      accessorKey: "value",
      header: "Value",
      size: 120,
      cell: ({ row }) =>
        renderEditorInput(row.original, "value", "Value", { type: "number" }) ?? (
          <span className="whitespace-nowrap">{row.original.value ?? "—"}</span>
        ),
    },
    {
      accessorKey: "currency",
      header: "Currency",
      size: 100,
      cell: ({ row }) =>
        renderEditorInput(row.original, "currency", "Currency", {
          uppercase: true,
        }) ?? <span className="font-mono text-xs">{row.original.currency ?? "—"}</span>,
    },
    {
      accessorKey: "net_weight",
      header: "Weight",
      size: 110,
      cell: ({ row }) =>
        renderEditorInput(row.original, "net_weight", "Net weight", {
          type: "number",
        }) ?? <span className="whitespace-nowrap">{row.original.net_weight ?? "—"}</span>,
    },
    {
      accessorKey: "origin_country",
      header: "Origin",
      size: 100,
      cell: ({ row }) =>
        renderEditorInput(row.original, "origin_country", "Origin", {
          uppercase: true,
        }) ?? <span className="font-mono text-xs">{row.original.origin_country ?? "—"}</span>,
    },
    {
      accessorKey: "delivery_terms",
      header: "Delivery",
      size: 110,
      cell: ({ row }) =>
        renderEditorInput(row.original, "delivery_terms", "Delivery terms", {
          uppercase: true,
        }) ?? <span className="font-mono text-xs">{row.original.delivery_terms ?? "—"}</span>,
    },
    {
      accessorKey: "vat_number",
      header: "NIP/VAT",
      size: 150,
      cell: ({ row }) =>
        renderEditorInput(row.original, "vat_number", "NIP/VAT") ?? (
          <span className="font-mono text-xs">{row.original.vat_number ?? "—"}</span>
        ),
    },
    {
      accessorKey: "cn_match_status",
      header: "Match",
      size: 140,
      cell: ({ row }) =>
        isDraftLine(row.original) ? (
          <span className="text-xs text-muted-foreground">New line</span>
        ) : (
          <IntrastatMatchDetailsPopover line={row.original} />
        ),
    },
    {
      accessorKey: "alerts",
      header: "Alerts",
      size: 110,
      cell: ({ row }) =>
        row.original.alerts.length > 0 ? (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex cursor-help items-center gap-1.5 whitespace-nowrap"
                  tabIndex={0}
                  aria-label={formatReviewCount(row.original.alerts.length)}
                >
                  <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
                  <span className="text-xs text-muted-foreground">
                    {row.original.alerts.length} field
                    {row.original.alerts.length === 1 ? "" : "s"}
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-80 border bg-popover p-3 text-popover-foreground shadow-lg">
                <p className="mb-2 text-sm font-medium">
                  {formatReviewCount(row.original.alerts.length)}
                </p>
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
      size: 180,
      cell: ({ row }) => {
        const isActive = editor?.line.id === row.original.id
        if (isActive) {
          return (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Cancel line ${row.original.id}`}
                title="Cancel"
                disabled={isSaving}
                onClick={(event) => {
                  event.stopPropagation()
                  handleCancelEdit()
                }}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Save line ${row.original.id}`}
                title="Save line"
                disabled={isSaving}
                onClick={(event) => {
                  event.stopPropagation()
                  void handleSaveLine(false)
                }}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </Button>
              {canEditCnResource ? (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Save line ${row.original.id} and add to CN database`}
                  title="Save and add to CN database"
                  disabled={isSaving || !canSaveToCnResource}
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleSaveLine(true)
                  }}
                >
                  <Database className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          )
        }
        return (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              aria-label={`View line ${row.original.id}`}
              title="View details"
              disabled={Boolean(editor)}
              onClick={(event) => {
                event.stopPropagation()
                setViewing(row.original)
              }}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Edit line ${row.original.id}`}
              title="Edit line"
              disabled={mutationsDisabled}
              onClick={(event) => {
                event.stopPropagation()
                handleStartEdit(row.original)
              }}
            >
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Add line after ${row.original.id}`}
              title="Add line to this invoice"
              disabled={mutationsDisabled}
              onClick={(event) => {
                event.stopPropagation()
                handleStartCreate(row.original)
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )
      },
    },
  ]

  const handleBatchChange = (nextBatchId: string) => {
    handleCancelEdit()
    setBatchId(nextBatchId)
    setPage(0)
    setSelectedSourceFile(null)
    router.replace(`/intrastat/review?batch=${nextBatchId}`)
  }

  const handleLineSelect = (line: IntrastatDeclarationLine) => {
    setSelectedSourceFile(line.source_file)
  }

  const handleInvoiceSelect = (fileName: string) => {
    setSelectedSourceFile(fileName)
    setDocumentPreviewVisible(true)
    try {
      localStorage.setItem(PREVIEW_VISIBLE_STORAGE_KEY, "true")
    } catch {
      // localStorage can be unavailable in restricted browser contexts.
    }
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
              disabled={!batchId || reprocess.isPending || Boolean(editor)}
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
              <Select value={batchId} onValueChange={handleBatchChange} disabled={Boolean(editor)}>
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
                  <IntrastatPeriodInvoicesDialog
                    periodLabel={
                      selectedBatch.data.client_name && selectedBatch.data.period_month
                        ? `${selectedBatch.data.client_name} / ${selectedBatch.data.period_month}`
                        : selectedBatch.data.name
                    }
                    invoiceCount={selectedBatch.data.invoice_count}
                    documents={selectedBatch.data.documents}
                    onInvoiceSelect={handleInvoiceSelect}
                  />
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
                  disabled={Boolean(editor)}
                  className="h-9 w-72 pl-9"
                />
              </div>
              <Select
                value={matchStatus}
                disabled={Boolean(editor)}
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
                data={tableItems}
                className="w-max min-w-full overflow-visible [contain:none]"
                isLoading={lines.isPending && items.length === 0}
                getRowId={(row) => row.id}
                getRowClassName={(row) => {
                  if (editor?.line.id === row.id)
                    return "bg-primary/5 ring-1 ring-inset ring-primary/20"
                  return row.is_excluded ? "bg-muted/30 text-muted-foreground" : undefined
                }}
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

            {editor ? (
              <p className="text-xs text-muted-foreground">
                Save or cancel the active line before changing pages.
              </p>
            ) : (
              <Pagination page={page} pageCount={pageCount} onChange={setPage} />
            )}
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

      <IntrastatLineDetailsDialog
        line={viewing}
        open={Boolean(viewing)}
        onOpenChange={(next) => {
          if (!next) setViewing(null)
        }}
      />
    </div>
  )
}

function formatReviewCount(count: number): string {
  return count === 1 ? "1 field requires review" : `${count} fields require review`
}

function lineFormFromLine(line: IntrastatDeclarationLine): LineFormState {
  return {
    item_index: line.item_index,
    cn_code: line.cn_code ?? "",
    description: line.description ?? "",
    net_weight: valueToString(line.net_weight),
    origin_country: line.origin_country ?? "",
    delivery_terms: line.delivery_terms ?? "",
    vat_number: line.vat_number ?? "",
    quantity: valueToString(line.quantity),
    value: valueToString(line.value),
    currency: line.currency ?? "",
  }
}

function newLineFormFromReference(reference: IntrastatDeclarationLine): LineFormState {
  return {
    item_index: "",
    cn_code: "",
    description: "",
    net_weight: "",
    origin_country: "",
    delivery_terms: reference.delivery_terms ?? "",
    vat_number: reference.vat_number ?? "",
    quantity: "",
    value: "",
    currency: reference.currency ?? "",
  }
}

function draftLineFromReference(reference: IntrastatDeclarationLine): IntrastatDeclarationLine {
  const timestamp = new Date().toISOString()
  return {
    ...reference,
    id: `draft:${reference.id}`,
    item_index: "",
    matched_index: null,
    matched_fragment: null,
    cn_code: null,
    description: null,
    quantity: null,
    value: null,
    net_weight: null,
    origin_country: null,
    cn_match_status: "unmatched",
    confidence: 0,
    match_confidence: 0,
    alerts: [],
    created_at: timestamp,
    updated_at: timestamp,
  }
}

function linePatchFromForm(form: LineFormState): IntrastatLinePatchRequest {
  return {
    cn_code: nullableText(form.cn_code),
    description: nullableText(form.description),
    net_weight: nullableNumber(form.net_weight),
    origin_country: nullableText(form.origin_country),
    delivery_terms: nullableText(form.delivery_terms),
    vat_number: nullableText(form.vat_number),
    quantity: nullableNumber(form.quantity),
    value: nullableNumber(form.value),
    currency: nullableText(form.currency),
  }
}

function isDraftLine(line: IntrastatDeclarationLine): boolean {
  return line.id.startsWith("draft:")
}

function normalizedCn8(value: string): string | null {
  const digits = value.replace(/\D/g, "")
  return digits.length >= 8 ? digits.slice(0, 8) : null
}

function valueToString(value: number | null): string {
  return value == null ? "" : String(value)
}

function nullableText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function nullableNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}
