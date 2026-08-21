import type { Story } from "@ladle/react"
import type { ColumnDef } from "@tanstack/react-table"
import { Inbox } from "lucide-react"
import { CortexDataGrid } from "./cortex-data-grid"
import { EmptyState } from "./empty-state"

interface Row {
  id: string
  name: string
  code: string
  owner: string
  status: "active" | "inactive"
  requests: number
}

const ROWS: Row[] = [
  {
    id: "1",
    name: "Fakturownia",
    code: "invoice-supervisor",
    owner: "Zespół A",
    status: "active",
    requests: 1284,
  },
  {
    id: "2",
    name: "Intrastat",
    code: "intrastat",
    owner: "Zespół B",
    status: "active",
    requests: 842,
  },
  {
    id: "3",
    name: "Store PIT",
    code: "store-pit",
    owner: "Zespół A",
    status: "inactive",
    requests: 12,
  },
  {
    id: "4",
    name: "IDP Basic",
    code: "idp-basic",
    owner: "Zespół C",
    status: "active",
    requests: 3021,
  },
  {
    id: "5",
    name: "Okna Czasowe",
    code: "okna-czasowe",
    owner: "Zespół B",
    status: "active",
    requests: 156,
  },
  {
    id: "6",
    name: "Raportowanie Tokenów",
    code: "token-usage",
    owner: "Zespół C",
    status: "active",
    requests: 97,
  },
]

const COLUMNS: ColumnDef<Row, unknown>[] = [
  { accessorKey: "name", header: "Nazwa", enableSorting: true },
  { accessorKey: "code", header: "Kod", enableSorting: true },
  { accessorKey: "owner", header: "Zespół", enableSorting: true },
  {
    accessorKey: "requests",
    header: "Żądania",
    enableSorting: true,
    cell: ({ row }) => <span className="tabular-nums">{row.original.requests}</span>,
  },
  {
    id: "status",
    header: "Status",
    // Brak enableSorting: kolumna renderowana jako zwykły, nieklikalny nagłówek.
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {row.original.status === "active" ? "aktywna" : "nieaktywna"}
      </span>
    ),
  },
]

export default {
  title: "Domain / CortexDataGrid",
}

export const Basic: Story = () => (
  <div className="p-6">
    <CortexDataGrid columns={COLUMNS} data={ROWS} bordered />
  </div>
)

export const Sortable: Story = () => (
  <div className="space-y-2 p-6">
    <p className="text-xs text-muted-foreground">
      Kliknij nagłówek „Nazwa”, „Kod”, „Zespół” lub „Żądania” — „Status” nie ma `enableSorting`,
      więc nie reaguje na klik.
    </p>
    <CortexDataGrid columns={COLUMNS} data={ROWS} bordered />
  </div>
)

export const Searchable: Story = () => (
  <div className="p-6">
    <CortexDataGrid
      columns={COLUMNS}
      data={ROWS}
      bordered
      searchable
      searchPlaceholder="Szukaj aplikacji..."
    />
  </div>
)

export const SearchableAndSortable: Story = () => (
  <div className="p-6">
    <CortexDataGrid columns={COLUMNS} data={ROWS} bordered searchable />
  </div>
)

export const ShowAllNoPagination: Story = () => (
  <div className="space-y-2 p-6">
    <p className="text-xs text-muted-foreground">
      Domyślny tryb — bez `pageSize` grid renderuje wszystkie wiersze naraz. To przypadek listy
      Aplikacje w trybie zmiany kolejności: trzeba widzieć cały zbiór jednocześnie.
    </p>
    <CortexDataGrid columns={COLUMNS} data={[...ROWS, ...ROWS, ...ROWS]} bordered />
  </div>
)

export const Paginated: Story = () => (
  <div className="p-6">
    <CortexDataGrid columns={COLUMNS} data={[...ROWS, ...ROWS, ...ROWS]} bordered pageSize={5} />
  </div>
)

export const Loading: Story = () => (
  <div className="p-6">
    <CortexDataGrid columns={COLUMNS} data={[]} isLoading bordered />
  </div>
)

export const EmptyDefault: Story = () => (
  <div className="p-6">
    <CortexDataGrid columns={COLUMNS} data={[]} bordered searchable />
  </div>
)

export const EmptyCustom: Story = () => (
  <div className="p-6">
    <CortexDataGrid
      columns={COLUMNS}
      data={[]}
      bordered
      emptyState={
        <EmptyState
          icon={Inbox}
          title="Brak aplikacji"
          description="Żadna aplikacja nie pasuje do bieżących filtrów."
        />
      }
    />
  </div>
)
