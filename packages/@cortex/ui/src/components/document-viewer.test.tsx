// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import * as XLSX from "xlsx"
import { DocumentViewer } from "./document-viewer"
import type { SpreadsheetSearchTerm } from "./spreadsheet-search"

function makeWorkbookBuffer(rows: (string | number)[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer
}

describe("DocumentViewer", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })

  it("searches, scrolls, and marks the best spreadsheet row", async () => {
    const spreadsheetSearchTerms: SpreadsheetSearchTerm[] = [
      {
        key: "product_code",
        value: "b-2",
        numericValue: null,
        allowSubstring: true,
        weight: 6,
      },
      {
        key: "quantity",
        value: "20",
        numericValue: "20",
        allowSubstring: false,
        weight: 2,
      },
    ]

    render(
      <DocumentViewer
        source={makeWorkbookBuffer([
          ["Product", "Qty"],
          ["A-1", 10],
          ["B-2", 20],
        ])}
        fileName="packing-list.xlsx"
        mediaType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        spreadsheetSearchTerms={spreadsheetSearchTerms}
      />,
    )

    expect(await screen.findByText("B-2")).toBeInTheDocument()
    expect(await screen.findByText("Matched 2 fields in row 3.")).toBeInTheDocument()

    await waitFor(() => {
      const rows = document.querySelectorAll("table tr")
      expect(rows).toHaveLength(3)
      expect(rows[2]).toHaveAttribute("data-source-active-row", "true")
      expect(rows[2]?.querySelectorAll("[data-source-active-cell='true']")).toHaveLength(2)
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
        block: "center",
        inline: "nearest",
        behavior: "auto",
      })
    })
  })
})
