"use client"

import { DateRangeFilter } from "@/components/date-range-filter"
import { useActionLogs } from "@cortex/api"
import { PACKAGE_ACTION_TYPE, type ActionLogReadModel, type PackageActionType } from "@cortex/types"
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
import { cn, formatAbsolute } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import type { TFunction } from "i18next"
import { History, RotateCw } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

/** Napis zdarzenia bierze się z klucza, nie z `humanizeEnum` — maszynowe
 *  rozbicie nazwy enuma działa tylko po angielsku. */
const ACTION_LABEL_KEY = (type: PackageActionType) => `auditLog.actions.${type}`

const KNOWN_ACTION_TYPES: ReadonlySet<string> = new Set(PACKAGE_ACTION_TYPE)

/** Backend potrafi dołożyć rodzaj zdarzenia, którego ten build jeszcze nie zna.
 *  Bez tego zapasu i18next zwróciłby surowy klucz `auditLog.actions.<nowy>`
 *  wprost do komórki tabeli. */
function actionLabel(t: TFunction, type: string): string {
  return KNOWN_ACTION_TYPES.has(type)
    ? t(ACTION_LABEL_KEY(type as PackageActionType))
    : t("auditLog.unknownAction")
}

const PAGE_SIZE = 20

export default function AuditLogPage() {
  const { t } = useTranslation("idp")
  const [page, setPage] = useState(0)
  const [actionType, setActionType] = useState<PackageActionType | "all">("all")
  const [performedBy, setPerformedBy] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const query = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      action_type: actionType === "all" ? null : actionType,
      performed_by: performedBy || null,
      date_from: dateFrom || null,
      date_to: dateTo || null,
    }),
    [page, actionType, performedBy, dateFrom, dateTo],
  )

  const { data, isLoading, isFetching, refetch } = useActionLogs(query)
  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const columns = useMemo<ColumnDef<ActionLogReadModel, unknown>[]>(
    () => [
      {
        accessorKey: "timestamp",
        header: t("auditLog.columnWhen"),
        size: 200,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {formatAbsolute(row.original.timestamp)}
          </span>
        ),
      },
      {
        accessorKey: "action_type",
        header: t("auditLog.columnEvent"),
        size: 200,
        cell: ({ row }) => (
          <span className="text-xs">{actionLabel(t, row.original.action_type)}</span>
        ),
      },
      {
        accessorKey: "package_file_name",
        header: t("auditLog.columnPackage"),
        cell: ({ row }) => (
          <Link
            href={`/idp/packages/${row.original.package_id}`}
            className="font-mono text-xs hover:underline"
          >
            {row.original.package_file_name}
          </Link>
        ),
      },
      {
        accessorKey: "performed_by",
        header: t("auditLog.columnActor"),
        size: 200,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.performed_by}
          </span>
        ),
      },
    ],
    [t],
  )

  return (
    <>
      <PageHeader
        title={t("auditLog.title")}
        description={t("auditLog.description")}
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCw className={cn("mr-1 h-4 w-4", isFetching && "animate-spin")} />
            {t("auditLog.refresh")}
          </Button>
        }
      />
      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={actionType}
            onValueChange={(v) => {
              setPage(0)
              setActionType(v as PackageActionType | "all")
            }}
          >
            <SelectTrigger className="h-9 w-[220px]">
              <SelectValue placeholder={t("auditLog.eventTypePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("auditLog.allEvents")}</SelectItem>
              {PACKAGE_ACTION_TYPE.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(ACTION_LABEL_KEY(type))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder={t("auditLog.performedByPlaceholder")}
            value={performedBy}
            onChange={(e) => {
              setPage(0)
              setPerformedBy(e.target.value)
            }}
            className="h-9 w-56"
          />
          <DateRangeFilter
            idPrefix="audit-date"
            from={dateFrom}
            to={dateTo}
            onChange={({ from, to }) => {
              setPage(0)
              setDateFrom(from)
              setDateTo(to)
            }}
          />
          <div className="ml-auto text-xs text-muted-foreground">
            {isFetching ? t("auditLog.refreshing") : t("auditLog.total", { count: total })}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={data?.items ?? []}
          isLoading={isLoading}
          emptyState={
            <EmptyState
              icon={History}
              title={t("auditLog.emptyTitle")}
              description={t("auditLog.emptyDescription")}
            />
          }
          getRowId={(row) => row.id}
        />

        <Pagination page={page} pageCount={pageCount} onChange={setPage} />
      </div>
    </>
  )
}
