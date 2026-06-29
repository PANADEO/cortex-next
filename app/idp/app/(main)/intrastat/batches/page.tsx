"use client"

import { IntrastatExportButtons } from "@/components/intrastat/export-buttons"
import {
  IntrastatKindBadge,
  IntrastatStatusBadge,
  getIntrastatStatusLabel,
} from "@/components/intrastat/status"
import { IntrastatUploadBatchButton } from "@/components/intrastat/upload-batch-button"
import { useIntrastatBatches } from "@/lib/intrastat/hooks"
import type {
  IntrastatBatchStatus,
  IntrastatBatchSummary,
  IntrastatTransactionKind,
} from "@/lib/intrastat/types"
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
} from "@cortex/ui"
import { formatAbsolute } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import { FileSpreadsheet, Search } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

const PAGE_SIZE = 20
const STATUS_OPTIONS: Array<{ value: IntrastatBatchStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "queued", label: "Queued" },
  { value: "processing", label: "Processing" },
  { value: "ready", label: "Ready" },
  { value: "needs_review", label: "Needs review" },
  { value: "failed", label: "Failed" },
]
const KIND_OPTIONS: Array<{ value: IntrastatTransactionKind | "all"; label: string }> = [
  { value: "all", label: "WNT and WDT" },
  { value: "WNT", label: "WNT" },
  { value: "WDT", label: "WDT" },
]

const columns: ColumnDef<IntrastatBatchSummary>[] = [
  {
    accessorKey: "name",
    header: "Batch",
    size: 320,
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link
          href={`/intrastat/review?batch=${row.original.id}`}
          className="block truncate font-medium hover:underline"
        >
          {row.original.name}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{row.original.source_type}</p>
      </div>
    ),
  },
  {
    accessorKey: "transaction_kind",
    header: "Type",
    size: 90,
    cell: ({ row }) => <IntrastatKindBadge kind={row.original.transaction_kind} />,
  },
  {
    accessorKey: "line_count",
    header: "Lines",
    size: 90,
    cell: ({ row }) => <span className="whitespace-nowrap">{row.original.line_count}</span>,
  },
  {
    accessorKey: "alert_count",
    header: "Alerts",
    size: 90,
    cell: ({ row }) => <span className="whitespace-nowrap">{row.original.alert_count}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    size: 150,
    cell: ({ row }) => <IntrastatStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "updated_at",
    header: "Updated",
    size: 170,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {formatAbsolute(row.original.updated_at)}
      </span>
    ),
  },
  {
    id: "actions",
    header: "",
    size: 250,
    cell: ({ row }) => (
      <div
        className="flex items-center justify-end gap-2"
        onClick={(event) => event.stopPropagation()}
      >
        <Button asChild size="sm" variant="outline">
          <Link href={`/intrastat/review?batch=${row.original.id}`}>Review</Link>
        </Button>
        <IntrastatExportButtons batchId={row.original.id} />
      </div>
    ),
  },
]

export default function IntrastatBatchesPage() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<IntrastatBatchStatus | "all">("all")
  const [kind, setKind] = useState<IntrastatTransactionKind | "all">("all")
  const batches = useIntrastatBatches({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    status,
    transaction_kind: kind,
    search,
  })
  const items = useMemo(() => batches.data?.items ?? [], [batches.data?.items])
  const total = batches.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const resetPage = () => setPage(0)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Intrastat Batches"
        description="WNT/WDT imports from manual ZIP upload and watched folders."
        actions={<IntrastatUploadBatchButton />}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-8 py-6">
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search batch..."
              value={search}
              onChange={(event) => {
                resetPage()
                setSearch(event.target.value)
              }}
              className="h-9 w-80 pl-9"
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) => {
              resetPage()
              setStatus(value as IntrastatBatchStatus | "all")
            }}
          >
            <SelectTrigger className="h-9 w-[190px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.value === "all" ? option.label : getIntrastatStatusLabel(option.value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={kind}
            onValueChange={(value) => {
              resetPage()
              setKind(value as IntrastatTransactionKind | "all")
            }}
          >
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-muted-foreground">
            {batches.isFetching ? "Refreshing..." : `${total} total`}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={items}
          isLoading={batches.isPending && items.length === 0}
          getRowId={(row) => row.id}
          stickyHeader
          bordered
          emptyState={
            <EmptyState
              icon={FileSpreadsheet}
              title="No Intrastat batches"
              description="Upload a WNT/WDT ZIP or import batches from the watched folder."
            />
          }
        />

        <Pagination page={page} pageCount={pageCount} onChange={setPage} />
      </div>
    </div>
  )
}
