---
name: excel-report
description: Generate a formatted Excel (.xlsx) workbook summarizing tabular data the user asks about, with a header row, sized columns, and a totals row when the data is numeric. Use when the user asks for a report, spreadsheet, export, or "an Excel" of some data.
---

# Excel report skill

Build a single-sheet `.xlsx` workbook from the data available in the conversation or sandbox.

## Steps

1. Collect the rows to export - from the user's message, from files already in the sandbox, or from a prior tool result.
2. Shape the rows into a flat table: one header row, one row per record.
3. Write the workbook to `artifacts/<slug>.xlsx` using a spreadsheet library (e.g. SheetJS `xlsx`). Auto-size columns from the longest cell in each column.
4. If a numeric column is present, append a totals row.
5. Tell the user the artifact is ready and where to find it (Artifacts panel).

## Notes

- Keep sheet names short (Excel's 31-character limit).
- Never overwrite an existing artifact - suffix the filename with an incrementing counter instead.
