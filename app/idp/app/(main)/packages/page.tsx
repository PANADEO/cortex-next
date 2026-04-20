"use client"

import { usePackages } from "@cortex/api"
import { PACKAGE_STATUS, type PackageReadModel, type PackageStatus } from "@cortex/types"
import {
  Button,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
} from "@cortex/ui"
import { formatRelative } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import { ChevronLeft, ChevronRight, FileQuestion, Search } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

const STATUS_LABELS: Record<PackageStatus, string> = {
  imported: "Imported",
  imported_with_error: "Import error",
  analysing: "Analysing",
  analysis_failed: "Analysis failed",
  ready_for_verification: "Ready",
  verification: "In verification",
  verified: "Verified",
}

const columns: ColumnDef<PackageReadModel, unknown>[] = [
  {
    accessorKey: "file_name",
    header: "File",
    cell: ({ row }) => (
      <Link
        href={`/packages/${row.original.id}`}
        className="font-mono text-xs hover:underline"
      >
        {row.original.file_name}
      </Link>
    ),
  },
  {
    accessorKey: "id",
    header: "ID",
    size: 140,
    cell: ({ row }) => (
      <span className="font-mono text-[10px] text-muted-foreground">{row.original.id}</span>
    ),
  },
  {
    accessorKey: "created_date",
    header: "Created",
    size: 160,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {formatRelative(row.original.created_date)}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    size: 180,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "assignee",
    header: "Assignee",
    size: 180,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {row.original.assignee ?? "—"}
      </span>
    ),
  },
]

const PAGE_SIZE = 10

export default function PackagesPage() {
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState<PackageStatus | "all">("all")
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

  const { data, isLoading, isFetching } = usePackages(query)
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

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
              setStatus(v as PackageStatus | "all")
            }}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {PACKAGE_STATUS.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-muted-foreground">
            {isFetching ? "Refreshing…" : `${total} total`}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={data?.items ?? []}
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

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <p>
            Page {page + 1} of {pageCount}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page + 1 >= pageCount}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
