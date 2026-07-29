import { describe, expect, it } from "vitest"
import {
  findBestSpreadsheetRowMatch,
  findBestSpreadsheetSheetMatch,
  normalizeSpreadsheetNumericValue,
  type SpreadsheetSearchTerm,
} from "./spreadsheet-search"

const terms: SpreadsheetSearchTerm[] = [
  {
    key: "product_code",
    value: "bx2486029",
    numericValue: null,
    allowSubstring: true,
    weight: 6,
  },
  {
    key: "quantity",
    value: "2.5",
    numericValue: "2.5",
    allowSubstring: false,
    weight: 2,
  },
  {
    key: "invoice_value",
    value: "20.25",
    numericValue: "20.25",
    allowSubstring: false,
    weight: 1.5,
  },
]

describe("spreadsheet search", () => {
  it("normalizes comma numeric values", () => {
    expect(normalizeSpreadsheetNumericValue("2,50")).toBe("2.5")
  })

  it("finds the best weighted spreadsheet row", () => {
    const match = findBestSpreadsheetRowMatch(
      [
        ["Product", "Qty", "Value"],
        ["AX2486029", "1", "10"],
        ["BX2486029", "2,50", "20.25"],
      ],
      terms,
    )

    expect(match).toMatchObject({
      rowIndex: 2,
      matchedTermCount: 3,
      matchedCellIndexes: [0, 1, 2],
    })
  })

  it("selects the sheet with the strongest row match", () => {
    const match = findBestSpreadsheetSheetMatch(
      [
        { name: "Invoice", rows: [["Other"], ["AX2486029"]] },
        {
          name: "Packing List",
          rows: [
            ["Product", "Qty"],
            ["BX2486029", "2.5"],
          ],
        },
      ],
      terms,
    )

    expect(match).toMatchObject({
      sheetName: "Packing List",
      rowIndex: 1,
    })
  })
})
