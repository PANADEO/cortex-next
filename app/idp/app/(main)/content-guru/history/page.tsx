"use client"

// Historia (design doc §4.5, Round D) — `CortexDataGrid` archiwum treści
// bieżącego usera (`listMyArchive`, Round A — auto-log KAŻDEJ generacji,
// nieużywane przez żaden ekran do teraz). Filtr statusu + typu treści nad
// tabelą (wzorem geo-score-calculator/history filtr oceny,
// content-guru/templates filtr kategorii); wbudowane wyszukiwanie
// CortexDataGrid pokrywa kolumny widoczne w gridzie (typ/temat/model) — pełny
// tekst wygenerowanej treści NIE jest przeszukiwany z tego widoku (świadoma
// redukcja zakresu względem legacy `content_search_query`, patrz notatka dla
// reviewera). Jedna dominująca akcja wiersza (ChevronRight, code-ui
// "row-actions") -> /content-guru/history/[id].

import { useMyArchive } from "@/features/content-guru/hooks"
import type {
  ContentArchiveEntryDto,
  ContentGuruGenerationStatus,
} from "@/features/content-guru/types"
import { ContentStatusBadge } from "@/features/content-guru/utils"
import {
  Button,
  CortexDataGrid,
  EmptyState,
  Label,
  LoadingState,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cortex/ui"
import { formatAbsolute } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import { ChevronRight, History } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

// Wartości filtra są stałe, etykiety NIE — muszą przejść przez `t()`, więc
// lista powstaje w komponencie, nie w module.
const STATUS_FILTER_VALUES = ["all", "done", "done-with-warnings"] as const
const STATUS_FILTER_LABEL_KEYS: Record<(typeof STATUS_FILTER_VALUES)[number], string> = {
  all: "history.filters.allStatuses",
  done: "history.filters.statusDone",
  "done-with-warnings": "history.filters.statusWithWarnings",
}
const ALL_CONTENT_TYPES = "__all__"

// Referencja stabilna między renderami — inaczej `archiveQuery.data ?? []`
// tworzyłby nową tablicę za każdym razem, unieważniając poniższe useMemo.
const EMPTY_ARCHIVE: ContentArchiveEntryDto[] = []

export default function ContentGuruHistoryPage() {
  const { t } = useTranslation("content-guru")
  const router = useRouter()
  const archiveQuery = useMyArchive()
  const [statusFilter, setStatusFilter] = useState<ContentGuruGenerationStatus | "all">("all")
  const [contentTypeFilter, setContentTypeFilter] = useState(ALL_CONTENT_TYPES)

  const rows = archiveQuery.data ?? EMPTY_ARCHIVE

  const statusFilterOptions: Array<{ value: ContentGuruGenerationStatus | "all"; label: string }> =
    useMemo(
      () =>
        STATUS_FILTER_VALUES.map((value) => ({
          value,
          label: t(STATUS_FILTER_LABEL_KEYS[value]),
        })),
      [t],
    )

  const contentTypes = useMemo(
    () => Array.from(new Set(rows.map((row) => row.contentType))).sort(),
    [rows],
  )

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        if (statusFilter !== "all" && row.status !== statusFilter) return false
        if (contentTypeFilter !== ALL_CONTENT_TYPES && row.contentType !== contentTypeFilter)
          return false
        return true
      }),
    [rows, statusFilter, contentTypeFilter],
  )

  const columns: ColumnDef<ContentArchiveEntryDto, unknown>[] = useMemo(
    () => [
      {
        accessorKey: "createdAt",
        header: t("history.columns.createdAt"),
        enableSorting: true,
        cell: ({ row }) => formatAbsolute(row.original.createdAt),
      },
      { accessorKey: "contentType", header: t("history.columns.contentType"), enableSorting: true },
      {
        accessorKey: "topic",
        header: t("history.columns.topic"),
        cell: ({ row }) => (
          <span className="line-clamp-1 max-w-md">{row.original.topic ?? "—"}</span>
        ),
      },
      {
        accessorKey: "status",
        header: t("history.columns.status"),
        enableSorting: true,
        cell: ({ row }) => <ContentStatusBadge status={row.original.status} />,
      },
      { accessorKey: "modelUsed", header: t("history.columns.model") },
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              size="icon"
              variant="ghost"
              aria-label={t("history.a11y.viewDetails", {
                date: formatAbsolute(row.original.createdAt),
              })}
              onClick={() => router.push(`/content-guru/history/${row.original.id}`)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [router, t],
  )

  return (
    <>
      <PageHeader title={t("history.title")} description={t("history.description")} />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="content-guru-history-status" className="text-xs text-muted-foreground">
              {t("history.filters.statusLabel")}
            </Label>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as ContentGuruGenerationStatus | "all")
              }
            >
              <SelectTrigger id="content-guru-history-status" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="content-guru-history-type" className="text-xs text-muted-foreground">
              {t("history.filters.contentTypeLabel")}
            </Label>
            <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
              <SelectTrigger id="content-guru-history-type" className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CONTENT_TYPES}>
                  {t("history.filters.allContentTypes")}
                </SelectItem>
                {contentTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {archiveQuery.isLoading ? (
          <LoadingState label={t("history.loading")} />
        ) : (
          <CortexDataGrid
            columns={columns}
            data={filtered}
            bordered
            searchable
            searchPlaceholder={t("history.searchPlaceholder")}
            getRowId={(row) => row.id}
            emptyState={
              <EmptyState
                icon={History}
                title={t("history.empty.title")}
                description={t("history.empty.description")}
              />
            }
          />
        )}
      </div>
    </>
  )
}
