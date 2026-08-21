// @vitest-environment jsdom
import type { ColumnDef } from "@tanstack/react-table"
import "@testing-library/jest-dom/vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { CortexDataGrid } from "../cortex-data-grid"

interface Row {
  id: string
  name: string
  amount: number
}

const ROWS: Row[] = [
  { id: "1", name: "Beta", amount: 20 },
  { id: "2", name: "Alpha", amount: 30 },
  { id: "3", name: "Gamma", amount: 10 },
  { id: "4", name: "Delta", amount: 40 },
  { id: "5", name: "Epsilon", amount: 5 },
]

const PLAIN_COLUMNS: ColumnDef<Row, unknown>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "amount", header: "Amount" },
]

const SORTABLE_COLUMNS: ColumnDef<Row, unknown>[] = [
  { accessorKey: "name", header: "Name", enableSorting: true },
  { accessorKey: "amount", header: "Amount" },
]

function bodyRows(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLTableRowElement>("tbody tr"))
}

function firstCellText(row: HTMLTableRowElement) {
  return row.querySelector("td")?.textContent
}

describe("<CortexDataGrid>", () => {
  describe("pagination", () => {
    it("defaults to show-all: no pageSize renders every row and no pager controls", () => {
      const { container } = render(<CortexDataGrid columns={PLAIN_COLUMNS} data={ROWS} />)
      expect(bodyRows(container)).toHaveLength(ROWS.length)
      expect(screen.queryByText(/Poprzednia/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Następna/)).not.toBeInTheDocument()
    })

    it("pageSize enables pagination: fewer rows render, with pager controls present", () => {
      const { container } = render(
        <CortexDataGrid columns={PLAIN_COLUMNS} data={ROWS} pageSize={2} />,
      )
      const rows = bodyRows(container)
      expect(rows).toHaveLength(2)
      expect(rows.length).toBeLessThan(ROWS.length)
      expect(screen.getByText("Strona 1 z 3")).toBeInTheDocument()
      expect(screen.getByText(/Poprzednia/)).toBeInTheDocument()
      expect(screen.getByText(/Następna/)).toBeInTheDocument()
    })
  })

  describe("sorting opt-in", () => {
    it("a column without enableSorting never gets a sort control", () => {
      render(<CortexDataGrid columns={SORTABLE_COLUMNS} data={ROWS} />)
      const amountHeader = screen.getByRole("columnheader", { name: "Amount" })
      expect(within(amountHeader).queryByRole("button")).not.toBeInTheDocument()
    })

    it("a column with enableSorting gets a sort control that toggles row order on click", async () => {
      const user = userEvent.setup()
      const { container } = render(<CortexDataGrid columns={SORTABLE_COLUMNS} data={ROWS} />)
      const nameHeaderButton = screen.getByRole("button", { name: /Name/ })

      expect(bodyRows(container).map(firstCellText)).toEqual([
        "Beta",
        "Alpha",
        "Gamma",
        "Delta",
        "Epsilon",
      ])

      await user.click(nameHeaderButton)
      const ascending = bodyRows(container).map(firstCellText)
      expect(ascending).toEqual(["Alpha", "Beta", "Delta", "Epsilon", "Gamma"])

      await user.click(nameHeaderButton)
      const descending = bodyRows(container).map(firstCellText)
      expect(descending).toEqual([...ascending].reverse())
    })

    it("enableSorting on an id-only column without an accessor never gets a sort control (getCanSort gate)", () => {
      // Regression for finding: gating on the raw `enableSorting` flag alone
      // would render a clickable-but-dead sort button here, since there is no
      // accessorKey/accessorFn for TanStack to compare rows by.
      const columnsWithMistakenFlag: ColumnDef<Row, unknown>[] = [
        { accessorKey: "name", header: "Name", enableSorting: true },
        {
          id: "actions",
          header: "Actions",
          enableSorting: true,
          cell: () => <button type="button">Edit</button>,
        },
      ]
      render(<CortexDataGrid columns={columnsWithMistakenFlag} data={ROWS} />)
      const actionsHeader = screen.getByRole("columnheader", { name: "Actions" })
      expect(within(actionsHeader).queryByRole("button")).not.toBeInTheDocument()
    })
  })

  describe("search", () => {
    it("typing a query narrows rendered rows to matches", async () => {
      const user = userEvent.setup()
      const { container } = render(
        <CortexDataGrid columns={PLAIN_COLUMNS} data={ROWS} searchable />,
      )
      expect(bodyRows(container)).toHaveLength(ROWS.length)

      await user.type(screen.getByPlaceholderText("Szukaj..."), "alpha")

      const rows = bodyRows(container)
      expect(rows).toHaveLength(1)
      expect(firstCellText(rows[0]!)).toBe("Alpha")
    })
  })

  describe("row-never-clickable invariant", () => {
    it("never renders a clickable <tr> — no onClick affordance, tabIndex or role=link", () => {
      const { container } = render(<CortexDataGrid columns={PLAIN_COLUMNS} data={ROWS} />)
      const rows = bodyRows(container)
      expect(rows.length).toBeGreaterThan(0)
      for (const row of rows) {
        expect(row.getAttribute("role")).toBeNull()
        expect(row.getAttribute("tabindex")).toBeNull()
        expect(row.className).not.toMatch(/cursor-pointer/)
      }
    })
  })

  describe("sortable header focus stability (finding: unrelated re-renders must not remount it)", () => {
    it("keeps the sortable header button mounted while typing in the search box", async () => {
      const user = userEvent.setup()
      render(<CortexDataGrid columns={SORTABLE_COLUMNS} data={ROWS} searchable />)
      const headerButton = screen.getByRole("button", { name: /Name/ })
      expect(document.contains(headerButton)).toBe(true)

      await user.type(screen.getByPlaceholderText("Szukaj..."), "al")

      // Same DOM node still attached — proves the header wasn't unmounted and
      // remounted by the unrelated search-input re-render (which would have
      // dropped keyboard focus on the button in a real browser).
      expect(document.contains(headerButton)).toBe(true)
      expect(screen.getByRole("button", { name: /Name/ })).toBe(headerButton)
    })
  })

  describe("sort + meta-passing mechanism (adversarial, added in review)", () => {
    it("sort applies to the filtered subset, not the full unfiltered set", async () => {
      const user = userEvent.setup()
      const rowsWithAlphPrefix: Row[] = [...ROWS, { id: "6", name: "Alphonse", amount: 15 }]
      const { container } = render(
        <CortexDataGrid columns={SORTABLE_COLUMNS} data={rowsWithAlphPrefix} searchable />,
      )
      await user.type(screen.getByPlaceholderText("Szukaj..."), "alph")
      expect(bodyRows(container)).toHaveLength(2) // Alpha, Alphonse

      await user.click(screen.getByRole("button", { name: /Name/ }))
      const rows = bodyRows(container).map(firstCellText)
      expect(rows).toEqual(["Alpha", "Alphonse"])
    })

    it("sort order stays internally consistent across an unrelated re-render (search typing)", async () => {
      const user = userEvent.setup()
      const { container } = render(
        <CortexDataGrid columns={SORTABLE_COLUMNS} data={ROWS} searchable />,
      )
      await user.click(screen.getByRole("button", { name: /Name/ })) // asc
      await user.type(screen.getByPlaceholderText("Szukaj..."), "a")
      const rows = bodyRows(container).map(firstCellText)
      const sorted = [...rows].sort((a, b) => (a ?? "").localeCompare(b ?? ""))
      expect(rows).toEqual(sorted)
    })

    it("rapid asc -> desc -> asc clicks toggle correctly without a skipped/stale transition", async () => {
      const user = userEvent.setup()
      const { container } = render(<CortexDataGrid columns={SORTABLE_COLUMNS} data={ROWS} />)
      const nameHeaderButton = screen.getByRole("button", { name: /Name/ })

      await user.click(nameHeaderButton)
      const asc = bodyRows(container).map(firstCellText)
      expect(asc[0]).toBe("Alpha")

      await user.click(nameHeaderButton)
      const desc = bodyRows(container).map(firstCellText)
      expect(desc).toEqual([...asc].reverse())

      await user.click(nameHeaderButton)
      const third = bodyRows(container).map(firstCellText)
      expect(third).not.toEqual(desc)
    })

    it("initial render (before any interaction) shows a neutral indicator matching unsorted row order", () => {
      const { container } = render(<CortexDataGrid columns={SORTABLE_COLUMNS} data={ROWS} />)
      const nameHeader = screen.getByRole("columnheader", { name: /Name/ })
      const button = within(nameHeader).getByRole("button")
      expect(button.querySelector("svg")).toHaveClass("text-muted-foreground/50")
      expect(bodyRows(container).map(firstCellText)).toEqual([
        "Beta",
        "Alpha",
        "Gamma",
        "Delta",
        "Epsilon",
      ])
    })
  })
})
