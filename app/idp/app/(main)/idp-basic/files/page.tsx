"use client"

import { DateRangeFilter } from "@/components/date-range-filter"
import { IdpBasicCsvDownloadButton } from "@/components/idp-basic/csv-download-dialog"
import { IdpBasicDeleteDocumentButton } from "@/components/idp-basic/delete-actions"
import { IdpBasicStatusBadge } from "@/components/idp-basic/status"
import { useIdpBasicFiles } from "@/lib/idp-basic/hooks"
import type { IdpBasicFileItem, IdpBasicPackageStatus } from "@/lib/idp-basic/types"
import {
  Badge,
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
} from "@cortex/ui"
import { cn, formatAbsolute, formatFileSizeBytes, getFileTypeIcon } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import { FileText, Search } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

const PAGE_SIZE = 100

const columns: ColumnDef<IdpBasicFileItem>[] = [
  {
    accessorKey: "file_name",
    header: "File",
    size: 340,
    cell: ({ row }) => {
      const { Icon, toneClass } = getFileTypeIcon(row.original.file_name, row.original.media_type)
      return (
        <div className="flex min-w-0 items-start gap-2">
          <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", toneClass)} />
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.file_name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSizeBytes(row.original.size_bytes)}
            </p>
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: "label",
    header: "Label",
    size: 230,
    cell: ({ row }) => (
      <div className="flex flex-nowrap items-center gap-2 overflow-hidden">
        <Badge variant="secondary" className="whitespace-nowrap">
          {row.original.label ?? "Unclassified"}
        </Badge>
        {row.original.confidence != null ? (
          <span className="shrink-0 text-xs text-muted-foreground">
            {Math.round(row.original.confidence * 100)}%
          </span>
        ) : null}
      </div>
    ),
  },
  {
    accessorKey: "package_reference_number",
    header: "Reference",
    size: 170,
    cell: ({ row }) => (
      <span className="block max-w-[150px] truncate whitespace-nowrap">
        {row.original.package_reference_number ?? "—"}
      </span>
    ),
  },
  {
    accessorKey: "package_subject",
    header: "Package",
    size: 360,
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link
          href={`/idp-basic/packages/${row.original.package_id}`}
          className="block truncate font-medium hover:underline"
        >
          {row.original.package_subject}
        </Link>
      </div>
    ),
  },
  {
    accessorKey: "package_status",
    header: "Package status",
    size: 160,
    cell: ({ row }) => <IdpBasicStatusBadge status={row.original.package_status} />,
  },
  {
    accessorKey: "created_at",
    header: "Imported",
    size: 170,
    cell: ({ row }) => (
      <span className="whitespace-nowrap">{formatAbsolute(row.original.created_at)}</span>
    ),
  },
  {
    id: "actions",
    header: "",
    size: 80,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <IdpBasicDeleteDocumentButton
          packageId={row.original.package_id}
          documentId={row.original.id}
          fileName={row.original.file_name}
          compact
          disabled={
            row.original.package_status === "queued" || row.original.package_status === "processing"
          }
        />
      </div>
    ),
  },
]

export default function IdpBasicFilesPage() {
  const [search, setSearch] = useState("")
  const [reference, setReference] = useState("")
  const [label, setLabel] = useState("")
  const [status, setStatus] = useState<IdpBasicPackageStatus | "all">("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const files = useIdpBasicFiles({
    limit: PAGE_SIZE,
    offset: 0,
    status,
    search,
    reference,
    label,
    date_from: dateFrom,
    date_to: dateTo,
  })
  const items = useMemo(() => files.data?.items ?? [], [files.data?.items])
  const total = files.data?.total ?? 0
  const hasFilters = Boolean(search || reference || label || status !== "all" || dateFrom || dateTo)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Files"
        description="All files from imported IDP Basic packages."
        actions={
          <IdpBasicCsvDownloadButton
            source="files"
            filters={{
              status,
              search,
              reference,
              label,
              date_from: dateFrom,
              date_to: dateTo,
            }}
            contextLabel={hasFilters ? "Filtered files" : "All files"}
            disabled={files.isPending && items.length === 0}
          />
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-8 py-6">
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search file or package..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 w-72 pl-9"
            />
          </div>
          <Input
            placeholder="Reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            className="h-9 w-40"
          />
          <Input
            placeholder="Label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className="h-9 w-48"
          />
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as IdpBasicPackageStatus | "all")}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Package status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="needs_review">Needs review</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-muted-foreground">
            {files.isFetching ? "Refreshing…" : `${total} total`}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-end gap-3">
          <DateRangeFilter
            idPrefix="idp-basic-files-date"
            from={dateFrom}
            to={dateTo}
            onChange={({ from, to }) => {
              setDateFrom(from)
              setDateTo(to)
            }}
          />
          {hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => {
                setSearch("")
                setReference("")
                setLabel("")
                setStatus("all")
                setDateFrom("")
                setDateTo("")
              }}
            >
              Reset filters
            </Button>
          ) : null}
        </div>

        <DataTable
          columns={columns}
          data={items}
          isLoading={files.isPending && items.length === 0}
          bordered
          className="min-h-0 flex-1 overflow-auto"
          stickyHeader
          tableClassName="min-w-[1510px] table-fixed"
          emptyState={
            <EmptyState
              icon={FileText}
              title="No files found"
              description="Files will appear here after packages are imported."
            />
          }
        />
      </div>
    </div>
  )
}
