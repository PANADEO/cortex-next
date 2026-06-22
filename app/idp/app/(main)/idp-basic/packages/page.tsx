"use client"

import { IdpBasicCsvDownloadButton } from "@/components/idp-basic/csv-download-dialog"
import { IdpBasicStatusBadge } from "@/components/idp-basic/status"
import { IdpBasicUploadPackageButton } from "@/components/idp-basic/upload-package-button"
import { useIdpBasicPackages } from "@/lib/idp-basic/hooks"
import type { IdpBasicPackageStatus, IdpBasicPackageSummary } from "@/lib/idp-basic/types"
import {
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
import { formatAbsolute } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import { PackageSearch, Search } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

const PAGE_SIZE = 20

const columns: ColumnDef<IdpBasicPackageSummary>[] = [
  {
    accessorKey: "subject",
    header: "Package",
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link
          href={`/idp-basic/packages/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.original.subject}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{row.original.sender}</p>
      </div>
    ),
  },
  {
    accessorKey: "reference_number",
    header: "Reference",
    cell: ({ row }) => row.original.reference_number ?? "—",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <IdpBasicStatusBadge status={row.original.status} />,
  },
  { accessorKey: "document_count", header: "Documents" },
  {
    accessorKey: "received_at",
    header: "Received",
    cell: ({ row }) => (row.original.received_at ? formatAbsolute(row.original.received_at) : "—"),
  },
]

export default function IdpBasicPackagesPage() {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<IdpBasicPackageStatus | "all">("all")
  const packages = useIdpBasicPackages({
    limit: PAGE_SIZE,
    offset: 0,
    status,
    search,
  })
  const items = useMemo(() => packages.data?.items ?? [], [packages.data?.items])
  const hasFilters = Boolean(search || status !== "all")

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Packages"
        description="Mailbox and manually uploaded packages imported for IDP Basic."
        actions={
          <div className="flex items-center gap-2">
            <IdpBasicCsvDownloadButton
              source="packages"
              filters={{ status, search }}
              contextLabel={hasFilters ? "Filtrowane paczki" : "Wszystkie paczki"}
              disabled={packages.isPending && items.length === 0}
            />
            <IdpBasicUploadPackageButton />
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search subject, sender, reference…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 w-72 pl-9"
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as IdpBasicPackageStatus | "all")}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Status" />
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
        </div>

        <DataTable
          columns={columns}
          data={items}
          isLoading={packages.isPending && items.length === 0}
          bordered
          emptyState={
            <EmptyState
              icon={PackageSearch}
              title="No packages found"
              description="Adjust filters or wait for the mailbox poller to import new mail."
            />
          }
        />
      </div>
    </div>
  )
}
