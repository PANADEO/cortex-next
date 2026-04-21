"use client"

import { useDirtyPackages } from "@cortex/api"
import {
  DIRTY_PACKAGE_STATUS,
  type DirtyPackageReadModel,
  type DirtyPackageStatus,
} from "@cortex/types"
import {
  Badge,
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
} from "@cortex/ui"
import type { ColumnDef } from "@tanstack/react-table"
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

const STATUS_LABEL: Record<DirtyPackageStatus, string> = {
  needs_classification: "Needs classification",
  classifying: "Classifying",
  classified: "Classified",
  promoted: "Promoted",
  archived: "Archived",
}

function StatusBadge({ status }: { status: DirtyPackageStatus }) {
  const variant: Record<DirtyPackageStatus, { className: string; icon: typeof Sparkles }> = {
    needs_classification: { className: "bg-amber-500/15 text-amber-700 border-amber-500/30", icon: AlertCircle },
    classifying: { className: "bg-sky-500/15 text-sky-700 border-sky-500/30", icon: Loader2 },
    classified: { className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", icon: Sparkles },
    promoted: { className: "bg-violet-500/15 text-violet-700 border-violet-500/30", icon: CheckCircle2 },
    archived: { className: "bg-muted text-muted-foreground border-border", icon: CheckCircle2 },
  }
  const { className, icon: Icon } = variant[status]
  return (
    <Badge variant="outline" className={className}>
      <Icon
        className={`mr-1 h-3 w-3 ${status === "classifying" ? "animate-spin" : ""}`}
      />
      {STATUS_LABEL[status]}
    </Badge>
  )
}

const PAGE_SIZE = 25

export default function ClassificationPage() {
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState<DirtyPackageStatus | "all">("all")
  const [search, setSearch] = useState("")

  const query = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      status: status === "all" ? null : status,
      search: search || null,
    }),
    [page, status, search],
  )

  const { data, isLoading, isFetching } = useDirtyPackages(query)
  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const columns = useMemo<ColumnDef<DirtyPackageReadModel>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        accessorKey: "name",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-xs text-muted-foreground">{row.original.id}</span>
          </div>
        ),
      },
      {
        id: "customer",
        header: "Customer",
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
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "documents",
        header: "Documents",
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
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.original.created_date).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <Button asChild size="sm" variant="ghost">
            <Link href={`/classification/${row.original.id}`}>
              Open
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        ),
      },
    ],
    [],
  )

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
              placeholder="Search dirty packages…"
              value={search}
              onChange={(e) => {
                setPage(0)
                setSearch(e.target.value)
              }}
              className="h-9 w-64 pl-9"
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setPage(0)
              setStatus(v as DirtyPackageStatus | "all")
            }}
          >
            <SelectTrigger className="h-9 w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {DIRTY_PACKAGE_STATUS.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-muted-foreground">
            {isFetching ? "Refreshing…" : `${total} dirty packages`}
          </div>
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
