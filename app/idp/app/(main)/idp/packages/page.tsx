"use client"

import { toastApiError, useDeletePackages, usePackages } from "@cortex/api"
import {
  PROCESSING_STATE,
  VERIFICATION_STATE,
  type PackageSortField,
  type ProcessingState,
  type SortOrder,
  type VerificationState,
} from "@cortex/types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  DataTable,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  getProcessingStateLabel,
  getVerificationStateLabel,
} from "@cortex/ui"
import { ArrowDown, ArrowUp, FileQuestion, Loader2, Search, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { DateRangeFilter } from "@/components/date-range-filter"
import { packageColumns } from "@/lib/columns/packages"

const SORT_FIELDS: ReadonlyArray<{ value: PackageSortField; label: string }> = [
  { value: "created_date", label: "Created date" },
  { value: "file_name", label: "File name" },
  { value: "processing_state", label: "Processing state" },
]

const PAGE_SIZE = 10

export default function PackagesPage() {
  const [page, setPage] = useState(0)
  const [processingState, setProcessingState] = useState<ProcessingState | "all">("all")
  const [verificationState, setVerificationState] = useState<VerificationState | "all">("all")
  const [search, setSearch] = useState("")
  const [customStatus, setCustomStatus] = useState("")
  const [sortBy, setSortBy] = useState<PackageSortField>("created_date")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)

  const query = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      processing_state: processingState === "all" ? null : processingState,
      verification_state: verificationState === "all" ? null : verificationState,
      search: search || null,
      custom_status: customStatus.trim() || null,
      sort_by: sortBy,
      sort_order: sortOrder,
      date_from: dateFrom || null,
      date_to: dateTo || null,
    }),
    [page, processingState, verificationState, search, customStatus, sortBy, sortOrder, dateFrom, dateTo],
  )

  const { data, isLoading, isFetching } = usePackages(query)
  const deleteMutation = useDeletePackages()
  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const resetPage = () => setPage(0)

  const visibleIds = useMemo(() => items.map((p) => p.id), [items])
  const allSelectedOnPage =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelectedOnPage) {
        for (const id of visibleIds) next.delete(id)
      } else {
        for (const id of visibleIds) next.add(id)
      }
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const columns = useMemo(
    () =>
      packageColumns({
        selection: {
          selected: selectedIds,
          allSelectedOnPage,
          toggleRow,
          toggleAll,
        },
      }),
    [selectedIds, allSelectedOnPage, visibleIds],
  )

  const handleDelete = async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    try {
      await deleteMutation.mutateAsync({ package_ids: ids })
      toast.success(`Deleted ${ids.length} package(s)`)
      clearSelection()
      setConfirmOpen(false)
    } catch (err) {
      toastApiError(err)
    }
  }

  const selectionCount = selectedIds.size

  return (
    <>
      <PageHeader
        title="Extraction"
        description="Browse, filter, and manage all document packages."
      />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by file name…"
              value={search}
              onChange={(e) => {
                resetPage()
                setSearch(e.target.value)
              }}
              className="h-9 w-64 pl-9"
            />
          </div>
          <Select
            value={processingState}
            onValueChange={(v) => {
              resetPage()
              setProcessingState(v as ProcessingState | "all")
            }}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Processing" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All processing</SelectItem>
              {PROCESSING_STATE.map((s) => (
                <SelectItem key={s} value={s}>
                  {getProcessingStateLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={verificationState}
            onValueChange={(v) => {
              resetPage()
              setVerificationState(v as VerificationState | "all")
            }}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Verification" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All verification</SelectItem>
              {VERIFICATION_STATE.map((s) => (
                <SelectItem key={s} value={s}>
                  {getVerificationStateLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Custom status"
            value={customStatus}
            onChange={(e) => {
              resetPage()
              setCustomStatus(e.target.value)
            }}
            className="h-9 w-[160px]"
          />
          <div className="ml-auto text-xs text-muted-foreground">
            {isFetching ? "Refreshing…" : `${total} total`}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Sort by
            </Label>
            <div className="flex items-center gap-2">
              <Select
                value={sortBy}
                onValueChange={(v) => {
                  resetPage()
                  setSortBy(v as PackageSortField)
                }}
              >
                <SelectTrigger className="h-9 w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_FIELDS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => {
                  resetPage()
                  setSortOrder((o) => (o === "asc" ? "desc" : "asc"))
                }}
                aria-label={sortOrder === "asc" ? "Sort ascending" : "Sort descending"}
              >
                {sortOrder === "asc" ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <DateRangeFilter
            idPrefix="packages-date"
            from={dateFrom}
            to={dateTo}
            onChange={({ from, to }) => {
              resetPage()
              setDateFrom(from)
              setDateTo(to)
            }}
          />
          {(dateFrom || dateTo || customStatus || sortBy !== "created_date" || sortOrder !== "desc") ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => {
                resetPage()
                setDateFrom("")
                setDateTo("")
                setCustomStatus("")
                setSortBy("created_date")
                setSortOrder("desc")
              }}
            >
              Reset filters
            </Button>
          ) : null}
        </div>

        {selectionCount > 0 ? (
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
            <span>
              <strong>{selectionCount}</strong> selected
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Clear
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-1.5 h-4 w-4" />
                )}
                Delete selected
              </Button>
            </div>
          </div>
        ) : null}

        <DataTable
          columns={columns}
          data={items}
          isLoading={isLoading}
          emptyState={
            <EmptyState
              icon={FileQuestion}
              title="No packages match"
              description="Try clearing filters or importing a new package."
            />
          }
          getRowId={(row) => row.id}
        />

        <Pagination page={page} pageCount={pageCount} onChange={setPage} />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectionCount} package(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Packages are soft-deleted — they can be restored later via the API.
              Proceed with delete?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
