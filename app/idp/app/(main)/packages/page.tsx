"use client"

import { toastApiError, useDeletePackages, usePackages } from "@cortex/api"
import {
  PROCESSING_STATE,
  VERIFICATION_STATE,
  type ProcessingState,
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
import { FileQuestion, Loader2, Search, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { packageColumns } from "@/lib/columns/packages"

const PAGE_SIZE = 10

export default function PackagesPage() {
  const [page, setPage] = useState(0)
  const [processingState, setProcessingState] = useState<ProcessingState | "all">("all")
  const [verificationState, setVerificationState] = useState<VerificationState | "all">("all")
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)

  const query = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      processing_state: processingState === "all" ? null : processingState,
      verification_state: verificationState === "all" ? null : verificationState,
      search: search || null,
    }),
    [page, processingState, verificationState, search],
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
        includeId: true,
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
        title="Packages"
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
          <div className="ml-auto text-xs text-muted-foreground">
            {isFetching ? "Refreshing…" : `${total} total`}
          </div>
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
