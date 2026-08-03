// Eksport CAŁEJ historii do CSV/JSON — design doc §4.2 ("port ExportService
// 1:1 na TS — trywialne"). Wołane WYŁĄCZNIE z przeglądarki, z danych, które
// klient już ma (CortexDataGrid ładuje całą tablicę naraz) — zero
// dodatkowego round-tripu do API tylko po to, żeby złożyć plik.

import { downloadBlob } from "@/lib/download"
import type { GeoScoreCalculationSummaryDto } from "./types"

/** Excel czyta UTF-8 z pliku .csv tylko wtedy, gdy zobaczy BOM — bez niego
 *  polskie znaki w podglądzie tekstu otwierają się jako krzaki. Wzorem
 *  app/idp/lib/token-usage/csv.ts. */
const BOM = "﻿"

/**
 * Escapowanie wg RFC 4180 (cudzysłów gdy pole zawiera separator/cudzysłów/
 * CR/LF, wewnętrzny cudzysłów podwojony) + neutralizacja wiodących
 * "=","+","-","@" apostrofem, żeby arkusz nie potraktował podglądu
 * WKLEJONEGO PRZEZ UŻYTKOWNIKA tekstu jako formuły (CSV injection) —
 * `textPreview` to fragment dowolnego tekstu prasowego, nie zaufane wejście.
 */
export function escapeCsvField(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  const needsQuotes = /[",\r\n]/.test(guarded)
  return needsQuotes ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

function toCsvRow(fields: readonly string[]): string {
  return fields.map(escapeCsvField).join(",")
}

const CSV_HEADER = ["Data", "Podgląd tekstu", "Wynik", "Ocena", "Liczba słów"] as const

export function buildHistoryCsv(rows: readonly GeoScoreCalculationSummaryDto[]): string {
  const body = rows.map((row) =>
    toCsvRow([row.createdAt, row.textPreview, row.totalScore.toFixed(1), row.grade, String(row.wordCount)]),
  )
  return BOM + [toCsvRow([...CSV_HEADER]), ...body].join("\r\n")
}

export function buildHistoryJson(rows: readonly GeoScoreCalculationSummaryDto[]): string {
  return JSON.stringify(rows, null, 2)
}

function exportFileName(extension: "csv" | "json"): string {
  const date = new Date().toISOString().slice(0, 10)
  return `historia-geo-score-${date}.${extension}`
}

export function downloadHistoryExport(
  rows: readonly GeoScoreCalculationSummaryDto[],
  format: "csv" | "json",
): void {
  const content = format === "csv" ? buildHistoryCsv(rows) : buildHistoryJson(rows)
  const mimeType = format === "csv" ? "text/csv" : "application/json"
  downloadBlob(new Blob([content], { type: `${mimeType};charset=utf-8` }), exportFileName(format))
}
