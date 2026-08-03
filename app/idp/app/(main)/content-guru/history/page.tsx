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
import { ContentStatusBadge } from "@/features/content-guru/utils"
import { useMyArchive } from "@/features/content-guru/hooks"
import type { ContentArchiveEntryDto, ContentGuruGenerationStatus } from "@/features/content-guru/types"

const STATUS_FILTER_OPTIONS: Array<{ value: ContentGuruGenerationStatus | "all"; label: string }> = [
  { value: "all", label: "Wszystkie statusy" },
  { value: "done", label: "Gotowe" },
  { value: "done-with-warnings", label: "Zakazane frazy" },
]
const ALL_CONTENT_TYPES = "__all__"

// Referencja stabilna między renderami — inaczej `archiveQuery.data ?? []`
// tworzyłby nową tablicę za każdym razem, unieważniając poniższe useMemo.
const EMPTY_ARCHIVE: ContentArchiveEntryDto[] = []

export default function ContentGuruHistoryPage() {
  const router = useRouter()
  const archiveQuery = useMyArchive()
  const [statusFilter, setStatusFilter] = useState<ContentGuruGenerationStatus | "all">("all")
  const [contentTypeFilter, setContentTypeFilter] = useState(ALL_CONTENT_TYPES)

  const rows = archiveQuery.data ?? EMPTY_ARCHIVE

  const contentTypes = useMemo(() => Array.from(new Set(rows.map((row) => row.contentType))).sort(), [rows])

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        if (statusFilter !== "all" && row.status !== statusFilter) return false
        if (contentTypeFilter !== ALL_CONTENT_TYPES && row.contentType !== contentTypeFilter) return false
        return true
      }),
    [rows, statusFilter, contentTypeFilter],
  )

  const columns: ColumnDef<ContentArchiveEntryDto, unknown>[] = useMemo(
    () => [
      {
        accessorKey: "createdAt",
        header: "Data",
        enableSorting: true,
        cell: ({ row }) => formatAbsolute(row.original.createdAt),
      },
      { accessorKey: "contentType", header: "Typ treści", enableSorting: true },
      {
        accessorKey: "topic",
        header: "Temat",
        cell: ({ row }) => <span className="line-clamp-1 max-w-md">{row.original.topic ?? "—"}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: true,
        cell: ({ row }) => <ContentStatusBadge status={row.original.status} />,
      },
      { accessorKey: "modelUsed", header: "Model" },
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Zobacz szczegóły treści z ${formatAbsolute(row.original.createdAt)}`}
              onClick={() => router.push(`/content-guru/history/${row.original.id}`)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [router],
  )

  return (
    <>
      <PageHeader
        title="Historia"
        description="Wygenerowane treści — status, temat i pełny wynik dla każdej z nich."
      />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="content-guru-history-status" className="text-xs text-muted-foreground">
              Status
            </Label>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as ContentGuruGenerationStatus | "all")}
            >
              <SelectTrigger id="content-guru-history-status" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="content-guru-history-type" className="text-xs text-muted-foreground">
              Typ treści
            </Label>
            <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
              <SelectTrigger id="content-guru-history-type" className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CONTENT_TYPES}>Wszystkie typy</SelectItem>
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
          <LoadingState label="Wczytywanie archiwum…" />
        ) : (
          <CortexDataGrid
            columns={columns}
            data={filtered}
            bordered
            searchable
            searchPlaceholder="Szukaj po temacie, typie lub modelu…"
            getRowId={(row) => row.id}
            emptyState={
              <EmptyState
                icon={History}
                title="Brak wpisów w archiwum"
                description="Wygeneruj pierwszą treść na ekranie Generowanie — pojawi się tutaj automatycznie."
              />
            }
          />
        )}
      </div>
    </>
  )
}
