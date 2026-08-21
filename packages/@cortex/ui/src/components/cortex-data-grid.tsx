"use client"

import {
  flexRender,
  functionalUpdate,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type HeaderContext,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "./data-table"
import { Button } from "./ui/button"
import { Input } from "./ui/input"

export interface CortexDataGridProps<TData> {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  isLoading?: boolean
  emptyState?: ReactNode
  getRowClassName?: (row: TData) => string | undefined
  className?: string
  tableClassName?: string
  /**
   * Uwaga przy sortowaniu/wyszukiwaniu włączonym: `index` odnosi się do
   * pozycji wiersza w aktualnie wyrenderowanym (przefiltrowanym/posortowanym/
   * spaginowanym) zestawie, nie w oryginalnej tablicy `data`. Buduj id z pola
   * na samym wierszu, nie z indeksu.
   */
  getRowId?: (row: TData, index: number) => string
  skeletonRows?: number
  stickyHeader?: boolean
  /** Wrap the table in a bordered card. Default false — table bleeds into surrounding page. */
  bordered?: boolean

  /**
   * Pokazuje pole wyszukiwania nad tabelą i filtruje po wszystkich kolumnach
   * (dopasowanie tekstowe, bez uwzględniania wielkości liter). Domyślnie
   * wyłączone — nie każda lista tego potrzebuje (np. bardzo krótkie).
   */
  searchable?: boolean
  searchPlaceholder?: string
  /** Kontrolowana wartość wyszukiwania — pomiń, żeby grid trzymał stan sam. */
  globalFilter?: string
  onGlobalFilterChange?: (value: string) => void

  /**
   * Kontrolowany stan sortowania — furtka pod przyszły sort po stronie
   * serwera. Pomiń, żeby grid trzymał stan sam (dzisiejszy przypadek: dane
   * ładowane w całości na kliencie, jak token-usage/system-config).
   */
  sorting?: SortingState
  onSortingChange?: OnChangeFn<SortingState>

  /**
   * Ustaw, żeby włączyć paginację po stronie klienta z podaną liczbą wierszy
   * na stronę. Domyślnie POMINIĘTE — grid renderuje wszystkie wiersze naraz
   * ("pokaż wszystko"), co jest wymagane np. przy ręcznym zmienianiu
   * kolejności wierszy (trzeba widzieć cały zbiór). Włączaj tylko tam, gdzie
   * lista realnie bywa długa i paginacja pomaga, nie z automatu.
   */
  pageSize?: number
}

function SortIndicator({ direction }: { direction: false | "asc" | "desc" }) {
  if (direction === "asc") return <ArrowUp className="h-3.5 w-3.5" />
  if (direction === "desc") return <ArrowDown className="h-3.5 w-3.5" />
  return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
}

interface SortableHeaderMeta {
  label: ReactNode
  direction: false | "asc" | "desc"
  onToggle: ((event: unknown) => void) | undefined
}

/**
 * Stabilny, modułowy renderer nagłówka sortowalnej kolumny — referencja tej
 * funkcji jest zawsze ta sama między renderami `CortexDataGrid`, niezależnie
 * od tego, co wywołało re-render (np. pisanie w polu wyszukiwania). Wcześniej
 * `withSortableHeaders` budowało nowe domknięcie (`header: () => (...)`) przy
 * każdym wywołaniu — TanStack/React widziały to jako nowy typ elementu i
 * odmontowywały `<button>` nagłówka (utrata focusu klawiatury), mimo że nic w
 * samej kolumnie się nie zmieniło. Dane potrzebne do renderu (label/kierunek
 * sortowania/handler kliknięcia) płyną przez `columnDef.meta`, czyli zwykłe,
 * swobodnie zmienne z rendera na render propsy — to nie wpływa na tożsamość
 * komponentu, więc focus i stan DOM przeżywają.
 *
 * Uwaga: `direction`/`onToggle` NIE są liczone z `getIsSorted()` /
 * `getToggleSortingHandler()` tej instancji tabeli, która faktycznie
 * renderuje ten nagłówek (`DataTable` wewnątrz `CortexDataGrid` ma własną,
 * "martwą" instancję `useReactTable` bez stanu sortowania — służy wyłącznie
 * do renderu już posortowanych wierszy). Są policzone raz, w `withSortableHeaders`,
 * z instancji tabeli w `CortexDataGrid`, która faktycznie trzyma stan
 * sortowania — i przekazane w dół przez `meta`.
 */
function SortableColumnHeader<TData>({ column }: HeaderContext<TData, unknown>) {
  const meta = column.columnDef.meta as SortableHeaderMeta | undefined
  if (!meta) return null
  return (
    <button
      type="button"
      onClick={(event) => meta.onToggle?.(event)}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      <span>{meta.label}</span>
      <SortIndicator direction={meta.direction} />
    </button>
  )
}

/**
 * Kolumna jest sortowalna tylko, gdy jej `ColumnDef` jawnie ustawia
 * `enableSorting: true` — to opt-in, nie opt-out (odwrotnie niż domyślne
 * zachowanie samego TanStack Table), żeby kolumny bez sensownej wartości do
 * porównania (np. kolumna akcji) nie dostawały klikalnego, nic-nie-robiącego
 * nagłówka za darmo. Dodatkowo sprawdzamy realną `getCanSort()` z TanStack
 * (wymaga m.in. `accessorKey`/`accessorFn`) — sam flag `enableSorting: true`
 * na kolumnie bez akcesora (np. kolumna akcji ustawiona przez pomyłkę) nadal
 * dałby klikalny, nic-nie-robiący przycisk sortowania, bo nie ma pola do
 * porównania.
 */
function withSortableHeaders<TData>(
  columns: ColumnDef<TData, unknown>[],
  table: ReturnType<typeof useReactTable<TData>>,
): ColumnDef<TData, unknown>[] {
  const headers = table.getHeaderGroups()[0]?.headers ?? []
  return columns.map((column, index) => {
    const header = headers[index]
    if (column.enableSorting !== true || !header || !header.column.getCanSort()) return column

    const label = header.isPlaceholder
      ? null
      : flexRender(header.column.columnDef.header, header.getContext())
    const meta: SortableHeaderMeta = {
      label,
      direction: header.column.getIsSorted(),
      onToggle: header.column.getToggleSortingHandler(),
    }

    return {
      ...column,
      header: SortableColumnHeader,
      meta: { ...column.meta, ...meta },
    } as ColumnDef<TData, unknown>
  })
}

/**
 * Prymityw z sortowaniem, wyszukiwaniem i opcjonalną paginacją (domyślnie
 * wyłączoną — patrz `pageSize`) na TanStack Table. Wzorcowy przykład
 * konwencji `Cortex*` z `.claude/skills/code-ui/SKILL.md`: to jedyny
 * sankcjonowany sposób renderowania listy z akcjami w wierszu idący
 * naprzód — nowe ekrany z tabelami mają używać tego komponentu, nie
 * surowego `<table>` ani gołego `DataTable`.
 *
 * Celowo NIE eksponuje `onRowClick` — cały klikalny `<tr>` łamie regułę
 * "Listy: row-actions, nie klik-w-wiersz" (patrz skill). Akcje w wierszu
 * idą przez dedykowaną kolumnę (ostatnia, `text-right`,
 * `Button size="icon" variant="ghost"`).
 */
export function CortexDataGrid<TData>({
  columns,
  data,
  isLoading,
  emptyState,
  getRowClassName,
  className,
  tableClassName,
  getRowId,
  skeletonRows = 5,
  stickyHeader = false,
  bordered = false,
  searchable = false,
  searchPlaceholder,
  globalFilter: globalFilterProp,
  onGlobalFilterChange,
  sorting: sortingProp,
  onSortingChange,
  pageSize,
}: CortexDataGridProps<TData>) {
  const { t } = useTranslation("ui")
  const searchLabel = searchPlaceholder ?? t("dataGrid.searchPlaceholder")
  const [internalGlobalFilter, setInternalGlobalFilter] = useState("")
  const [internalSorting, setInternalSorting] = useState<SortingState>([])
  const [internalPageIndex, setInternalPageIndex] = useState(0)

  const globalFilter = globalFilterProp ?? internalGlobalFilter
  const sorting = sortingProp ?? internalSorting
  const paginated = typeof pageSize === "number" && pageSize > 0

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = functionalUpdate(updater, sorting)
    onSortingChange?.(updater)
    if (sortingProp === undefined) setInternalSorting(next)
  }

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter: searchable ? globalFilter : "",
      ...(paginated ? { pagination: { pageIndex: internalPageIndex, pageSize } } : {}),
    },
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(paginated
      ? {
          getPaginationRowModel: getPaginationRowModel(),
          onPaginationChange: ((updater) => {
            const current: PaginationState = { pageIndex: internalPageIndex, pageSize }
            const next = functionalUpdate(updater, current)
            setInternalPageIndex(next.pageIndex)
          }) satisfies OnChangeFn<PaginationState>,
        }
      : {}),
    ...(getRowId ? { getRowId } : {}),
  })

  const rows = table.getRowModel().rows.map((row) => row.original)
  const displayColumns = withSortableHeaders(columns, table)

  function handleSearchChange(value: string) {
    onGlobalFilterChange?.(value)
    if (globalFilterProp === undefined) setInternalGlobalFilter(value)
  }

  return (
    <div className="space-y-3">
      {searchable ? (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder={searchLabel}
            aria-label={searchLabel}
            className="pl-8"
          />
        </div>
      ) : null}

      <DataTable
        columns={displayColumns}
        data={rows}
        skeletonRows={skeletonRows}
        stickyHeader={stickyHeader}
        bordered={bordered}
        {...(isLoading !== undefined ? { isLoading } : {})}
        {...(emptyState !== undefined ? { emptyState } : {})}
        {...(getRowClassName !== undefined ? { getRowClassName } : {})}
        {...(className !== undefined ? { className } : {})}
        {...(tableClassName !== undefined ? { tableClassName } : {})}
        {...(getRowId !== undefined ? { getRowId } : {})}
      />

      {paginated ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <p>
            {t("pagination.page", {
              current: table.getState().pagination.pageIndex + 1,
              total: Math.max(table.getPageCount(), 1),
            })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {t("pagination.previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              {t("pagination.next")}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
