"use client"

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
import { DIRTY_STATUS_LABEL } from "@/components/classification/labels"

type DirtySortField = "created_date" | "name" | "status"

const SORT_FIELDS: ReadonlyArray<{ value: DirtySortField; label: string }> = [
  { value: "created_date", label: "Created date" },
  { value: "name", label: "Name" },
  { value: "status", label: "Status" },
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
  const { className, icon: Icon, animate } = STATUS_BADGE_VARIANT[status]
  return (
    <Badge variant="outline" className={className}>
      <Icon className={`mr-1 h-3 w-3 ${animate ? "animate-spin" : ""}`} />
      {DIRTY_STATUS_LABEL[status]}
    </Badge>
  )
}

const PAGE_SIZE = 10

export default function ClassificationPage() {
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
        header: "Name",
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
        header: "ID",
        size: 140,
        cell: ({ row }) => (
          <span className="font-mono text-[10px] text-muted-foreground">
            {row.original.id}
          </span>
        ),
      },
      {
        id: "customer",
        header: "Customer",
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
        header: "Status",
        size: 220,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "documents",
        header: "Documents",
        size: 180,
        cell: ({ row }) => (
          <div className="flex items-center gap-2 text-sm">
            <span>{row.original.document_count}</span>
            {row.original.needs_review_count > 0 ? (
              <Badge variant="outline" className="border-amber-500/30 text-amber-700">
                {row.original.needs_review_count} need review
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        id: "created",
        header: "Created",
        size: 160,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatRelative(row.original.created_date)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <Button asChild size="sm" variant="ghost">
            <Link href={`/idp/classification/${row.original.id}`}>
              Open
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        ),
      },
    ],
    [],
  )

  if (flagState.isPending) {
    return <LoadingState label="Loading classification…" />
  }
  if (!flagState.enabled) {
    notFound()
  }

  const filtersDirty =
    status !== "all" ||
    search !== "" ||
    sortBy !== "created_date" ||
    sortOrder !== "desc"

  return (
    <>
      <PageHeader
        title="Classification"
        description="Triage uploaded documents into clean packages with AI assistance."
      />
      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name…"
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
              <SelectItem value="all">All statuses</SelectItem>
              {DIRTY_PACKAGE_STATUS.map((s) => (
                <SelectItem key={s} value={s}>
                  {DIRTY_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                  setSortBy(v as DirtySortField)
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
              Reset filters
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
              title="No dirty packages"
              description="Upload a mixed bundle of documents to start triage."
            />
          }
          getRowId={(row) => row.id}
        />

        <Pagination page={page} pageCount={pageCount} onChange={setPage} />
      </div>
    </>
  )
}
