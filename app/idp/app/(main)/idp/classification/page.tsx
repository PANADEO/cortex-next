"use client"

import { DIRTY_STATUS_LABEL_KEY } from "@/components/classification/labels"
import { useDirtyPackages } from "@cortex/api"
import {
  DIRTY_PACKAGE_STATUS,
  type DirtyPackageReadModel,
  type DirtyPackageStatus,
  type SortOrder,
} from "@cortex/types"
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Input,
  Label,
  LoadingState,
  PageHeader,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cortex/ui"
import { formatRelative, useFeatureFlagState } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

type DirtySortField = "created_date" | "name" | "status"

const SORT_FIELDS: ReadonlyArray<{ value: DirtySortField; labelKey: string }> = [
  { value: "created_date", labelKey: "classification.list.sortCreated" },
  { value: "name", labelKey: "classification.list.sortName" },
  { value: "status", labelKey: "classification.list.sortStatus" },
]

const STATUS_BADGE_VARIANT: Record<
  DirtyPackageStatus,
  { className: string; icon: typeof Sparkles; animate?: boolean }
> = {
  needs_classification: {
    className: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    icon: AlertCircle,
  },
  classifying: {
    className: "bg-sky-500/15 text-sky-700 border-sky-500/30",
    icon: Loader2,
    animate: true,
  },
  classified: {
    className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    icon: Sparkles,
  },
  promoted: {
    className: "bg-violet-500/15 text-violet-700 border-violet-500/30",
    icon: CheckCircle2,
  },
  archived: {
    className: "bg-muted text-muted-foreground border-border",
    icon: CheckCircle2,
  },
}

function StatusBadge({ status }: { status: DirtyPackageStatus }) {
  const { t } = useTranslation("idp")
  const { className, icon: Icon, animate } = STATUS_BADGE_VARIANT[status]
  return (
    <Badge variant="outline" className={className}>
      <Icon className={`mr-1 h-3 w-3 ${animate ? "animate-spin" : ""}`} />
      {t(DIRTY_STATUS_LABEL_KEY[status])}
    </Badge>
  )
}

const PAGE_SIZE = 10

export default function ClassificationPage() {
  const { t } = useTranslation("idp")
  const flagState = useFeatureFlagState("idp.classification")
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState<DirtyPackageStatus | "all">("all")
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<DirtySortField>("created_date")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")

  const query = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      status: status === "all" ? null : status,
      search: search || null,
      sort_by: sortBy,
      sort_order: sortOrder,
    }),
    [page, status, search, sortBy, sortOrder],
  )

  const resetPage = () => setPage(0)

  const { data, isLoading, isFetching } = useDirtyPackages(query, {
    enabled: flagState.enabled,
  })
  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const columns = useMemo<ColumnDef<DirtyPackageReadModel>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: t("classification.list.columnName"),
        cell: ({ row }) => (
          <Link
            href={`/idp/classification/${row.original.id}`}
            className="font-mono text-xs hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        id: "id",
        accessorKey: "id",
        header: t("classification.list.columnId"),
        size: 140,
        cell: ({ row }) => (
          <span className="font-mono text-[10px] text-muted-foreground">{row.original.id}</span>
        ),
      },
      {
        id: "customer",
        header: t("classification.list.columnCustomer"),
        size: 180,
        cell: ({ row }) =>
          row.original.customer_tag ? (
            <Badge variant="secondary">{row.original.customer_tag}</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: "status",
        header: t("classification.list.columnStatus"),
        size: 220,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "documents",
        header: t("classification.list.columnDocuments"),
        size: 180,
        cell: ({ row }) => (
          <div className="flex items-center gap-2 text-sm">
            <span>{row.original.document_count}</span>
            {row.original.needs_review_count > 0 ? (
              <Badge variant="outline" className="border-amber-500/30 text-amber-700">
                {t("classification.list.needReview", { count: row.original.needs_review_count })}
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        id: "created",
        header: t("classification.list.columnCreated"),
        size: 160,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatRelative(row.original.created_date)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{t("classification.list.columnActions")}</span>,
        cell: ({ row }) => (
          <Button asChild size="sm" variant="ghost">
            <Link href={`/idp/classification/${row.original.id}`}>
              {t("classification.list.open")}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        ),
      },
    ],
    [t],
  )

  if (flagState.isPending) {
    return <LoadingState label={t("classification.loading")} />
  }
  if (!flagState.enabled) {
    notFound()
  }

  const filtersDirty =
    status !== "all" || search !== "" || sortBy !== "created_date" || sortOrder !== "desc"

  return (
    <>
      <PageHeader
        title={t("classification.list.title")}
        description={t("classification.list.description")}
      />
      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("classification.list.searchPlaceholder")}
              value={search}
              onChange={(e) => {
                resetPage()
                setSearch(e.target.value)
              }}
              className="h-9 w-64 pl-9"
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              resetPage()
              setStatus(v as DirtyPackageStatus | "all")
            }}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("classification.list.allStatuses")}</SelectItem>
              {DIRTY_PACKAGE_STATUS.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(DIRTY_STATUS_LABEL_KEY[s])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-muted-foreground">
            {isFetching
              ? t("classification.list.refreshing")
              : t("classification.list.total", { n: total })}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t("classification.list.sortBy")}
            </Label>
            <div className="flex items-center gap-2">
              <Select
                value={sortBy}
                onValueChange={(v) => {
                  resetPage()
                  setSortBy(v as DirtySortField)
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
                    ? t("classification.list.sortAscending")
                    : t("classification.list.sortDescending")
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
          {filtersDirty ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => {
                resetPage()
                setStatus("all")
                setSearch("")
                setSortBy("created_date")
                setSortOrder("desc")
              }}
            >
              {t("classification.list.resetFilters")}
            </Button>
          ) : null}
        </div>

        <DataTable
          columns={columns}
          data={items}
          isLoading={isLoading}
          emptyState={
            <EmptyState
              icon={FileSpreadsheet}
              title={t("classification.list.emptyTitle")}
              description={t("classification.list.emptyDescription")}
            />
          }
          getRowId={(row) => row.id}
        />

        <Pagination page={page} pageCount={pageCount} onChange={setPage} />
      </div>
    </>
  )
}
