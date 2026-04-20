"use client"

import { usePackages } from "@cortex/api"
import {
  PROCESSING_STATE,
  VERIFICATION_STATE,
  type PackageReadModel,
  type ProcessingState,
  type VerificationState,
} from "@cortex/types"
import {
  DataTable,
  EmptyState,
  Input,
  PackageStatusBadges,
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
import { formatRelative } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import { FileQuestion, Search } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

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
    accessorKey: "processing_state",
    header: "Status",
    size: 260,
    cell: ({ row }) => (
      <PackageStatusBadges
        processingState={row.original.processing_state}
        verificationState={row.original.verification_state}
      />
    ),
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
  const [processingState, setProcessingState] = useState<ProcessingState | "all">("all")
  const [verificationState, setVerificationState] = useState<VerificationState | "all">("all")
  const [search, setSearch] = useState("")

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
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const resetPage = () => setPage(0)

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

        <Pagination page={page} pageCount={pageCount} onChange={setPage} />
      </div>
    </>
  )
}
