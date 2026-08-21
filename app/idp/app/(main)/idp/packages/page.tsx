"use client"

import { DateRangeFilter } from "@/components/date-range-filter"
import { packageColumns } from "@/lib/columns/packages"
import { toastApiError, useDeletePackages, useMe, usePackages } from "@cortex/api"
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
import {
  ArrowDown,
  ArrowUp,
  FileQuestion,
  Loader2,
  Search,
  Trash2,
  Upload,
  UserCheck,
} from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import { toast } from "sonner"

const SORT_FIELDS: ReadonlyArray<{ value: PackageSortField; labelKey: string }> = [
  { value: "created_date", labelKey: "packages.list.sortCreated" },
  { value: "package_name", labelKey: "packages.list.sortPackageName" },
  { value: "file_name", labelKey: "packages.list.sortFileName" },
  { value: "processing_state", labelKey: "packages.list.sortProcessingState" },
]

const PAGE_SIZE = 10

export default function PackagesPage() {
  const { t } = useTranslation(["idp", "common"])
  const me = useMe()
  const currentEmail = me.data?.email ?? null

  const [page, setPage] = useState(0)
  const [processingState, setProcessingState] = useState<ProcessingState | "all">("all")
  const [verificationState, setVerificationState] = useState<VerificationState | "all">("all")
  const [search, setSearch] = useState("")
  const [customStatus, setCustomStatus] = useState("")
  const [assignedToMe, setAssignedToMe] = useState(false)
  const [uploadedByMe, setUploadedByMe] = useState(false)
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
      assignee: assignedToMe && currentEmail ? currentEmail : null,
      uploaded_by: uploadedByMe && currentEmail ? currentEmail : null,
      sort_by: sortBy,
      sort_order: sortOrder,
      date_from: dateFrom || null,
      date_to: dateTo || null,
    }),
    [
      page,
      processingState,
      verificationState,
      search,
      customStatus,
      assignedToMe,
      uploadedByMe,
      currentEmail,
      sortBy,
      sortOrder,
      dateFrom,
      dateTo,
    ],
  )

  const { data, isLoading, isFetching } = usePackages(query)
  const deleteMutation = useDeletePackages()
  const items = useMemo(() => data?.items ?? [], [data?.items])
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const resetPage = () => setPage(0)

  const visibleIds = useMemo(() => items.map((p) => p.id), [items])
  const allSelectedOnPage = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelectedOnPage) {
        for (const id of visibleIds) next.delete(id)
      } else {
        for (const id of visibleIds) next.add(id)
      }
      return next
    })
  }, [allSelectedOnPage, visibleIds])

  const clearSelection = () => setSelectedIds(new Set())

  const columns = useMemo(
    () =>
      packageColumns({
        t,
        selection: {
          selected: selectedIds,
          allSelectedOnPage,
          toggleRow,
          toggleAll,
        },
      }),
    [t, selectedIds, allSelectedOnPage, toggleRow, toggleAll],
  )

  const handleDelete = async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    try {
      await deleteMutation.mutateAsync({ package_ids: ids })
      toast.success(t("packages.list.deleted", { count: ids.length }))
      clearSelection()
      setConfirmOpen(false)
    } catch (err) {
      toastApiError(err)
    }
  }

  const selectionCount = selectedIds.size

  return (
    <>
      <PageHeader title={t("packages.list.title")} description={t("packages.list.description")} />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("packages.list.searchPlaceholder")}
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
              <SelectValue placeholder={t("packages.list.processingPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("packages.list.allProcessing")}</SelectItem>
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
              <SelectValue placeholder={t("packages.list.verificationPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("packages.list.allVerification")}</SelectItem>
              {VERIFICATION_STATE.map((s) => (
                <SelectItem key={s} value={s}>
                  {getVerificationStateLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder={t("packages.list.customStatusPlaceholder")}
            value={customStatus}
            onChange={(e) => {
              resetPage()
              setCustomStatus(e.target.value)
            }}
            className="h-9 w-[160px]"
          />
          <Button
            variant={assignedToMe ? "default" : "outline"}
            size="sm"
            className="h-9"
            disabled={!currentEmail}
            onClick={() => {
              resetPage()
              setAssignedToMe((v) => !v)
            }}
            aria-pressed={assignedToMe}
          >
            <UserCheck className="mr-1.5 h-3.5 w-3.5" />
            {t("packages.list.assignedToMe")}
          </Button>
          <Button
            variant={uploadedByMe ? "default" : "outline"}
            size="sm"
            className="h-9"
            disabled={!currentEmail}
            onClick={() => {
              resetPage()
              setUploadedByMe((v) => !v)
            }}
            aria-pressed={uploadedByMe}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {t("packages.list.uploadedByMe")}
          </Button>
          <div className="ml-auto text-xs text-muted-foreground">
            {isFetching ? t("packages.list.refreshing") : t("packages.list.total", { n: total })}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t("packages.list.sortBy")}
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
                      {t(f.labelKey)}
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
                aria-label={
                  sortOrder === "asc"
                    ? t("packages.list.sortAscending")
                    : t("packages.list.sortDescending")
                }
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
          {dateFrom ||
          dateTo ||
          customStatus ||
          assignedToMe ||
          uploadedByMe ||
          sortBy !== "created_date" ||
          sortOrder !== "desc" ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => {
                resetPage()
                setDateFrom("")
                setDateTo("")
                setCustomStatus("")
                setAssignedToMe(false)
                setUploadedByMe(false)
                setSortBy("created_date")
                setSortOrder("desc")
              }}
            >
              {t("packages.list.resetFilters")}
            </Button>
          ) : null}
        </div>

        {selectionCount > 0 ? (
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
            <span>
              {/* Trans, bo polska forma zależy od liczebnika, a liczba ma zostać
                  pogrubiona — rozbicie na „liczba + sufiks” dawało „2 zaznaczonych". */}
              <Trans
                t={t}
                i18nKey="packages.list.selectedCount"
                count={selectionCount}
                components={{ n: <strong /> }}
              />
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                {t("packages.list.clearSelection")}
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
                {t("packages.list.deleteSelected")}
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
              title={t("packages.list.emptyTitle")}
              description={t("packages.list.emptyDescription")}
            />
          }
          getRowId={(row) => row.id}
        />

        <Pagination page={page} pageCount={pageCount} onChange={setPage} />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("packages.list.confirmDeleteTitle", { count: selectionCount })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("packages.list.confirmDeleteBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t("common:actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending}>
              {t("common:actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
