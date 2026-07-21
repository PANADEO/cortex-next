---
name: csv-export
description: Export tabular data as a plain CSV file when the user explicitly asks for CSV, or wants a lightweight export that opens in any spreadsheet tool without formatting. Use instead of excel-report when the user says "csv" or "plain export".
---

# CSV export skill

Write the requested table as RFC 4180 CSV to `artifacts/<slug>.csv` in the sandbox.

## Steps

1. Shape the data into rows exactly like `excel-report` would.
2. Quote fields that contain a comma, quote, or newline; escape embedded quotes by doubling them.
3. Use UTF-8 with a BOM so the file opens correctly in Excel on Windows.
4. Confirm the artifact with the user once written.
