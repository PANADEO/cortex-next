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
import type { TFunction } from "i18next"
import { PackageSearch, Search } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

const PAGE_SIZE = 20

function buildPackageColumns(t: TFunction<"idp-basic">): ColumnDef<IdpBasicPackageSummary>[] {
  return [
    {
      accessorKey: "subject",
      header: t("packages.columnPackage"),
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
      header: t("packages.columnReference"),
      cell: ({ row }) => row.original.reference_number ?? "—",
    },
    {
      accessorKey: "status",
      header: t("packages.columnStatus"),
      cell: ({ row }) => <IdpBasicStatusBadge status={row.original.status} />,
    },
    { accessorKey: "document_count", header: t("packages.columnDocuments") },
    {
      accessorKey: "received_at",
      header: t("packages.columnReceived"),
      cell: ({ row }) =>
        row.original.received_at ? formatAbsolute(row.original.received_at) : "—",
    },
  ]
}

export default function IdpBasicPackagesPage() {
  const { t } = useTranslation("idp-basic")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<IdpBasicPackageStatus | "all">("all")
  const packages = useIdpBasicPackages({
    limit: PAGE_SIZE,
    offset: 0,
    status,
    search,
  })
  const columns = useMemo(() => buildPackageColumns(t), [t])
  const items = useMemo(() => packages.data?.items ?? [], [packages.data?.items])
  const hasFilters = Boolean(search || status !== "all")

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={t("packages.title")}
        description={t("packages.description")}
        actions={
          <div className="flex items-center gap-2">
            <IdpBasicCsvDownloadButton
              source="packages"
              filters={{ status, search }}
              contextLabel={hasFilters ? t("packages.scopeFiltered") : t("packages.scopeAll")}
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
              placeholder={t("packages.searchPlaceholder")}
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
              <SelectValue placeholder={t("filters.status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("status.all")}</SelectItem>
              <SelectItem value="queued">{t("status.queued")}</SelectItem>
              <SelectItem value="processing">{t("status.processing")}</SelectItem>
              <SelectItem value="ready">{t("status.ready")}</SelectItem>
              <SelectItem value="needs_review">{t("status.needsReview")}</SelectItem>
              <SelectItem value="failed">{t("status.failed")}</SelectItem>
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
              title={t("packages.emptyTitle")}
              description={t("packages.emptyDescription")}
            />
          }
        />
      </div>
    </div>
  )
}
