"use client"

// Archiwum Visual Guru — design doc §6.2. CortexDataGrid (nie surowy
// <table>): data / miniatura pierwszego wariantu / skrócony prompt / model /
// liczba wariantów / czy użyto obrazu referencyjnego (badge). Wyszukiwanie
// po treści promptu. Jedna dominująca akcja wiersza — "zobacz szczegóły"
// (code-ui "Listy: row-actions").

import { Badge, Button, CortexDataGrid, EmptyState, LoadingState, PageHeader } from "@cortex/ui"
import { formatAbsolute } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import { ChevronRight, ImageOff, Images } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo } from "react"
import { useHistory } from "@/features/visual-guru/hooks"
import type { GenerationListItemDto } from "@/features/visual-guru/types"

// Referencja stabilna między renderami — wzorem document-parser/history/page.tsx.
const EMPTY_ITEMS: GenerationListItemDto[] = []

export default function VisualGuruHistoryPage() {
  const router = useRouter()
  const historyQuery = useHistory()
  const items = historyQuery.data ?? EMPTY_ITEMS

  const columns: ColumnDef<GenerationListItemDto, unknown>[] = useMemo(
    () => [
      {
        id: "thumbnail",
        header: () => null,
        enableSorting: false,
        cell: ({ row }) =>
          row.original.firstVariantDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.original.firstVariantDataUrl}
              alt=""
              className="h-10 w-10 rounded-md object-cover ring-1 ring-border"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted ring-1 ring-border">
              <ImageOff className="h-4 w-4 text-muted-foreground" />
            </div>
          ),
      },
      {
        accessorKey: "prompt",
        header: "Prompt",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="block max-w-md truncate" title={row.original.prompt}>
            {row.original.prompt}
          </span>
        ),
      },
      { accessorKey: "model", header: "Model", enableSorting: true },
      { accessorKey: "variantCount", header: "Warianty", enableSorting: true },
      {
        id: "hadReferenceImage",
        header: "Obraz referencyjny",
        enableSorting: true,
        accessorFn: (row) => row.hadReferenceImage,
        cell: ({ row }) =>
          row.original.hadReferenceImage ? (
            <Badge variant="secondary">Użyto</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "createdAt",
        header: "Data",
        enableSorting: true,
        cell: ({ row }) => formatAbsolute(row.original.createdAt),
      },
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Zobacz szczegóły generacji z ${formatAbsolute(row.original.createdAt)}`}
              onClick={() => router.push(`/visual-guru/history/${row.original.id}`)}
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
      <PageHeader title="Archiwum" description="Wszystkie generacje, które wykonałeś — prompt, warianty i metadane." />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        {historyQuery.isLoading ? (
          <LoadingState label="Wczytywanie archiwum…" />
        ) : (
          <CortexDataGrid
            columns={columns}
            data={items}
            bordered
            searchable
            searchPlaceholder="Szukaj po treści promptu…"
            getRowId={(row) => row.id}
            emptyState={
              <EmptyState
                icon={Images}
                title="Brak generacji"
                description="Wygeneruj pierwszy obraz na ekranie Generatora — pojawi się tutaj automatycznie."
              />
            }
          />
        )}
      </div>
    </>
  )
}
