import i18n from "@/lib/i18n"
import { describe, expect, it } from "vitest"
import { buildUsageReport, type ProxyUsageRow } from "./aggregate"
import {
  buildDetailCsv,
  buildDetailJson,
  buildExportFileName,
  buildGroupCsv,
  escapeCsvField,
  toCsv,
} from "./csv"

const BOM = "﻿"

// Nagłówki eksportu są tłumaczone, więc test bierze REALNE zasoby w języku
// źródłowym — nie atrapę. Dzięki temu literówka w kluczu wywala asercję na
// treści zamiast przechodzić na podmienionym tłumaczeniu.
const t = i18n.getFixedT("pl", "token-usage")

function row(overrides: Partial<ProxyUsageRow> = {}): ProxyUsageRow {
  return {
    user_id: "u1",
    source_app: "app",
    scope: "scope",
    model: "gpt-4o",
    request_tokens: 1,
    response_tokens: 1,
    reasoning_tokens: 0,
    cached_tokens: 0,
    total_tokens: 2,
    request_count: 1,
    ...overrides,
  }
}

describe("escapeCsvField", () => {
  it("zostawia zwykłą wartość bez cudzysłowów", () => {
    expect(escapeCsvField("gpt-4o")).toBe("gpt-4o")
  })

  it.each([
    ["a,b", '"a,b"'],
    ['a"b', '"a""b"'],
    ["a\nb", '"a\nb"'],
    ["a\r\nb", '"a\r\nb"'],
  ])("cytuje i escapuje %s", (input, expected) => {
    expect(escapeCsvField(input)).toBe(expected)
  })

  // Nazwy modeli i scope'ów pochodzą z nagłówków HTTP wysyłanych przez
  // kilkanaście obcych repozytoriów — to nie jest zaufane wejście, a arkusz
  // wykonałby taką wartość jako formułę.
  it.each(["=1+1", "+cmd", "-2+3", "@SUM(A1)"])("neutralizuje formułę %s", (input) => {
    expect(escapeCsvField(input).startsWith("'")).toBe(true)
  })
})

describe("toCsv", () => {
  it("dokleja BOM, żeby Excel odczytał polskie znaki", () => {
    expect(toCsv([["Użytkownik"]]).startsWith(BOM)).toBe(true)
  })

  it("rozdziela wiersze CRLF zgodnie z RFC 4180", () => {
    expect(
      toCsv([
        ["a", "b"],
        ["c", "d"],
      ]),
    ).toBe(`${BOM}a,b\r\nc,d`)
  })
})

describe("buildGroupCsv", () => {
  const report = buildUsageReport([
    row({ user_id: "jan@firma.pl", total_tokens: 75, request_count: 3 }),
    row({ user_id: "anna@firma.pl", total_tokens: 25, request_count: 1 }),
  ])

  it("nagłówek pierwszej kolumny mówi Użytkownik, nie E-mail", () => {
    const csv = buildGroupCsv(report.byUser, "Użytkownik", t)

    expect(csv.split("\r\n")[0]).toContain("Użytkownik")
    expect(csv).not.toContain("E-mail")
  })

  it("zawiera kolumnę tokenów rozumowania, której oryginał nie eksportował", () => {
    expect(buildGroupCsv(report.byUser, "Użytkownik", t)).toContain("Tokeny rozumowania")
  })

  it("zachowuje kolejność malejącą i udział z kropką dziesiętną", () => {
    const lines = buildGroupCsv(report.byUser, "Użytkownik", t).split("\r\n")

    expect(lines[1]).toBe("jan@firma.pl,75,1,1,0,0,3,1,75.0")
    expect(lines[2]).toBe("anna@firma.pl,25,1,1,0,0,1,1,25.0")
  })

  // Pusty zakres dat to realny przypadek — oryginał wywalał się na nim NameError-em.
  it("pusty wymiar daje sam nagłówek, nie wyjątek", () => {
    const csv = buildGroupCsv([], "Zakres", t)

    expect(csv.split("\r\n")).toHaveLength(1)
  })
})

describe("buildDetailCsv", () => {
  it("niesie komplet czterech wymiarów i pięć liczników", () => {
    const report = buildUsageReport([row({ user_id: "a", scope: "summarizer" })])
    const lines = buildDetailCsv(report.rows, t).split("\r\n")

    expect(lines[0]).toContain("Aplikacja")
    expect(lines[0]).toContain("Zakres")
    expect(lines[1]).toBe("a,app,summarizer,gpt-4o,2,1,1,0,0,1")
  })
})

describe("buildDetailJson", () => {
  const report = buildUsageReport([row({ user_id: "a", total_tokens: 10 })])
  const json = buildDetailJson(report, { start: "2026-07-01", end: "2026-07-30" }, t)

  it("niesie zakres dat i strefę, w której proxy parsuje daty", () => {
    const parsed = JSON.parse(json) as Record<string, unknown>

    expect(parsed.zakres).toMatchObject({ od: "2026-07-01", do: "2026-07-30" })
    expect(JSON.stringify(parsed.zakres)).toContain("Europe/Warsaw")
  })

  // Plik bywa przekazywany dalej bez ekranu, na którym nota jest widoczna.
  it("niesie notę o szacunkowym charakterze części wartości", () => {
    expect(JSON.parse(json).uwaga).toContain("szacunki")
  })
})

describe("buildExportFileName", () => {
  it("nazwa pliku niesie zakres dat", () => {
    expect(
      buildExportFileName("uzytkownicy", { start: "2026-07-01", end: "2026-07-30" }, "csv"),
    ).toBe("zuzycie-tokenow-uzytkownicy-2026-07-01-2026-07-30.csv")
  })
})
