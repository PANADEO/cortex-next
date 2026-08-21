"use client"

import { IntrastatCnResourceRowDialog } from "@/components/intrastat/cn-resource-row-dialog"
import { IntrastatResourceDownloadButton } from "@/components/intrastat/resource-download-button"
import { IntrastatResourceUploadButton } from "@/components/intrastat/resource-upload-button"
import { useIntrastatCnResource, useIntrastatCnResourceRows } from "@/lib/intrastat/hooks"
import type { IntrastatCnResourceRow } from "@/lib/intrastat/types"
import { useAuthorizedApps } from "@cortex/api"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  DataCard,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  Pagination,
} from "@cortex/ui"
import { formatAbsolute } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import { AlertTriangle, Database, GitBranch, Pencil, Plus, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

const PAGE_SIZE = 50
const CN_EDITOR_APP_CODE = "intrastat-cn-editor"

export default function IntrastatResourcesPage() {
  const { t } = useTranslation(["intrastat", "common"])
  const access = useAuthorizedApps()
  const canEdit = access.apps.includes(CN_EDITOR_APP_CODE)
  const resource = useIntrastatCnResource()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<IntrastatCnResourceRow | null>(null)
  const rows = useIntrastatCnResourceRows({
    search,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  })
  const total = rows.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const columns = useMemo<ColumnDef<IntrastatCnResourceRow>[]>(
    () => [
      {
        accessorKey: "index_value",
        header: t("resources.columnIndex"),
        size: 220,
        cell: ({ row }) => (
          <span className="font-mono font-medium">{row.original.index_value}</span>
        ),
      },
      {
        accessorKey: "cn8",
        header: t("resources.columnCn8"),
        size: 140,
        cell: ({ row }) => <span className="font-mono">{row.original.cn8 ?? "—"}</span>,
      },
      {
        accessorKey: "cn",
        header: t("resources.columnCn"),
        size: 160,
        cell: ({ row }) => (
          <span className="font-mono text-muted-foreground">{row.original.cn ?? "—"}</span>
        ),
      },
      {
        accessorKey: "description",
        header: t("resources.columnDescription"),
        cell: ({ row }) => row.original.description ?? "—",
      },
      ...(canEdit
        ? [
            {
              id: "actions",
              header: "",
              size: 80,
              cell: ({ row }: { row: { original: IntrastatCnResourceRow } }) => (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingRow(row.original)
                      setDialogOpen(true)
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    {t("common:actions.edit")}
                  </Button>
                </div>
              ),
            },
          ]
        : []),
    ],
    [canEdit, t],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title={t("resources.title")}
        description={t("resources.description")}
        actions={
          <>
            <IntrastatResourceDownloadButton disabled={!resource.data?.id} />
            {canEdit ? (
              <>
                <IntrastatResourceUploadButton />
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingRow(null)
                    setDialogOpen(true)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t("resources.addCnCode")}
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-8 py-6">
        <Alert className="shrink-0 border-amber-500/60 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>{t("resources.warningTitle")}</AlertTitle>
          <AlertDescription>{t("resources.warningBody")}</AlertDescription>
        </Alert>

        <div className="grid shrink-0 gap-4 md:grid-cols-2">
          <DataCard
            label={t("resources.activeRows")}
            value={String(resource.data?.row_count ?? 0)}
            description={resource.data?.file_name ?? t("resources.noResourceUploaded")}
            icon={Database}
            tone={resource.data?.row_count ? "success" : "warning"}
          />
          <DataCard
            label={t("resources.activeVersion")}
            value={resource.data?.id ? resource.data.id.slice(0, 8) : "—"}
            description={
              resource.data?.created_at
                ? formatAbsolute(resource.data.created_at)
                : t("resources.noActiveVersion")
            }
            icon={GitBranch}
          />
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 w-80 pl-9"
              placeholder={t("resources.searchPlaceholder")}
              value={search}
              onChange={(event) => {
                setPage(0)
                setSearch(event.target.value)
              }}
            />
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            {rows.isFetching ? t("resources.refreshing") : t("resources.total", { count: total })}
          </span>
        </div>

        <DataTable
          columns={columns}
          data={rows.data?.items ?? []}
          isLoading={rows.isPending && !rows.data}
          getRowId={(row) => row.id}
          stickyHeader
          bordered
          className="min-h-0 flex-1 overflow-auto"
          emptyState={
            <EmptyState
              icon={Database}
              title={t("resources.emptyTitle")}
              description={search ? t("resources.emptySearch") : t("resources.emptyUpload")}
            />
          }
        />
        <Pagination page={page} pageCount={pageCount} onChange={setPage} />
      </div>

      {canEdit ? (
        <IntrastatCnResourceRowDialog
          row={editingRow}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      ) : null}
    </div>
  )
}
