// Serializacja eksportów — czysta i testowalna. Wołane WYŁĄCZNIE z przeglądarki,
// z modelu widoku, który klient już ma (Blob + URL.createObjectURL). Zero
// dodatkowego round-tripu do serwera: te same dane są już na ekranie, a drugie
// zapytanie do cortex-proxy tylko po to, żeby zbudować plik, byłoby czystym
// marnotrawstwem cudzego serwisu.

import type { TFunction } from "i18next"
import type { UsageDetailRow, UsageGroup, UsageReport } from "./aggregate"

/**
 * Excel czyta UTF-8 z pliku .csv tylko wtedy, gdy zobaczy BOM — bez niego
 * "Użytkownik" otwiera się jako "UÅ¼ytkownik". To jedyny powód obecności BOM-u.
 */
const BOM = "﻿"

/**
 * Przecinek, zgodnie z RFC 4180 i z zachowaniem oryginału (pandas .to_csv()).
 *
 * ZNANY KOMPROMIS: Excel w polskiej lokalizacji domyślnie dzieli po średniku,
 * więc plik otworzy się w jednej kolumnie i będzie wymagał "Tekst jako kolumny"
 * albo importu. Zmiana separatora na średnik naprawiłaby Excela i zepsułaby
 * każdy inny czytnik CSV — to decyzja produktowa, nie techniczna, więc
 * zostawiamy parytet z tym, co użytkownicy dostawali dotychczas.
 */
const SEPARATOR = ","

/**
 * Escapowanie wg RFC 4180: pole idzie w cudzysłowy, gdy zawiera separator,
 * cudzysłów, CR albo LF; wewnętrzny cudzysłów podwajamy.
 *
 * Wiodące "=", "+", "-", "@" są neutralizowane apostrofem — bez tego arkusz
 * potraktowałby wartość jako FORMUŁĘ (CSV injection). Nazwy modeli i scope'ów
 * pochodzą z nagłówków HTTP wysyłanych przez kilkanaście obcych repozytoriów,
 * więc nie są zaufanym wejściem.
 */
export function escapeCsvField(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  const needsQuotes = /[",\r\n]/.test(guarded)
  return needsQuotes ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  return BOM + rows.map((row) => row.map(escapeCsvField).join(SEPARATOR)).join("\r\n")
}

/** Kropka dziesiętna, nie przecinek — przecinek jest separatorem pól, a poza
 *  tym liczba ma się re-importować jako liczba, nie jako tekst. */
function formatShare(share: number): string {
  return share.toFixed(1)
}

/**
 * Eksport jednego wymiaru (użytkownicy / modele / aplikacje / zakresy).
 * `dimensionLabel` to nagłówek pierwszej kolumny — dla wymiaru użytkownika
 * brzmi "Użytkownik", nigdy "E-mail": X-User-ID to dowolny string od dowolnego
 * konsumenta proxy, nie gwarantowany adres pocztowy.
 *
 * `t` przychodzi parametrem, bo to nie jest komponent: plik ma pozostać czysty
 * i testowalny, a język wybiera ekran, z którego kliknięto eksport.
 */
export function buildGroupCsv(
  groups: readonly UsageGroup[],
  dimensionLabel: string,
  t: TFunction<"token-usage">,
): string {
  const header = [
    dimensionLabel,
    t("export.columns.totalTokens"),
    t("export.columns.requestTokens"),
    t("export.columns.responseTokens"),
    t("export.columns.reasoningTokens"),
    t("export.columns.cachedTokens"),
    t("export.columns.requestCount"),
    t("export.columns.userCount"),
    t("export.columns.share"),
  ]

  const rows = groups.map((group) => [
    group.key,
    String(group.totalTokens),
    String(group.requestTokens),
    String(group.responseTokens),
    String(group.reasoningTokens),
    String(group.cachedTokens),
    String(group.requestCount),
    String(group.userCount),
    formatShare(group.share),
  ])

  return toCsv([header, ...rows])
}

export function buildDetailCsv(
  rows: readonly UsageDetailRow[],
  t: TFunction<"token-usage">,
): string {
  const header = [
    t("export.columns.user"),
    t("export.columns.app"),
    t("export.columns.scope"),
    t("export.columns.model"),
    t("export.columns.totalTokens"),
    t("export.columns.requestTokens"),
    t("export.columns.responseTokens"),
    t("export.columns.reasoningTokens"),
    t("export.columns.cachedTokens"),
    t("export.columns.requestCount"),
  ]

  const body = rows.map((row) => [
    row.user,
    row.app,
    row.scope,
    row.model,
    String(row.totalTokens),
    String(row.requestTokens),
    String(row.responseTokens),
    String(row.reasoningTokens),
    String(row.cachedTokens),
    String(row.requestCount),
  ])

  return toCsv([header, ...body])
}

/**
 * JSON szczegółowy. Niesie zakres dat i jawną notę o jakości danych — plik
 * bywa przekazywany dalej bez ekranu, na którym ta nota jest widoczna, a bez
 * niej łatwo wziąć te liczby za rozliczenie co do tokena (patrz 1.4 projektu).
 *
 * NAZWY PÓL zostają polskie i nietłumaczone — to kontrakt danych, po którym
 * ktoś już parsuje pobrane pliki, a nie napis na ekranie. Tłumaczona jest
 * wyłącznie treść noty, bo ona jest zdaniem dla człowieka.
 */
export function buildDetailJson(
  report: UsageReport,
  range: { start: string; end: string },
  t: TFunction<"token-usage">,
): string {
  return JSON.stringify(
    {
      zakres: { od: range.start, do: range.end, strefa: "Europe/Warsaw (cortex-proxy)" },
      uwaga: t("export.dataQualityNote"),
      podsumowanie: report.totals,
      uzytkownicy: report.byUser,
      modele: report.byModel,
      aplikacje: report.byApp,
      zakresy: report.byScope,
      szczegoly: report.rows,
    },
    null,
    2,
  )
}

/** Nazwa pliku niesie zakres dat — bez tego dwa eksporty z różnych okresów są
 *  w katalogu Pobrane nierozróżnialne. */
export function buildExportFileName(
  kind: string,
  range: { start: string; end: string },
  extension: "csv" | "json",
): string {
  return `zuzycie-tokenow-${kind}-${range.start}-${range.end}.${extension}`
}
