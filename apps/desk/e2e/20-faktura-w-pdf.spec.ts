import { evidenceFromEvents } from "@cortex/desk-core/evidence"
import { notReadable } from "@cortex/desk-core/document-parser"
import { pairSteps, summariseGroup } from "@cortex/desk-core/steps"
import type { DeskEvent } from "@cortex/desk-core/types"
import { makeDeskT } from "@cortex/desk-ui/i18n/locale"
import { as, expect, otworz, test } from "./osoby"

/**
 * Scenariusze czyta człowiek po polsku, więc zdania budujemy polskim tłumaczem —
 * tak samo jak w Obszarze 19, i z tego samego powodu: przebieg i dowód powstają
 * przy RENDERZE, a nie przy zapisie zdarzenia.
 */
const pl = makeDeskT("pl")

/** Para start/koniec jednego narzędzia — tak, jak zapisuje ją runtime. */
const para = (
  id: string,
  name: string,
  args: Record<string, unknown>,
  summary: string,
  ok = true,
): DeskEvent[] => [
  { type: "tool_start", id, name, label: `etykieta ${name}`, args },
  { type: "tool_end", id, name, ok, summary, ms: 5 },
]

test.describe("Obszar 29 · Faktura w PDF przestaje być ślepym zaułkiem", () => {
  test("Pracownica widzi rozpoznawanie dokumentów jako osobną pozycję na „Co potrafię”", async ({
    page,
  }) => {
    // Test wiersza z ADR-0001: jeśli zdolność ma istnieć, pracownik ma ją widzieć
    // OSOBNO — obok „Czytania moich plików", a nie schowaną w jego opisie.
    await as(page, "anna")
    await otworz(page, "/capabilities")
    await expect(page.getByText("Rozpoznawanie dokumentów")).toBeVisible()
    await expect(page.getByText("Czytanie moich plików")).toBeVisible()
  })

  test("Dowód mówi „rozpoznano”, bo to nie było czytanie pliku", () => {
    // Treść PDF-a odczytana tą drogą JEST TEKSTEM MODELU (ADR-0001 §8). Produkt, którego
    // cała teza brzmi „dowód nigdy nie pochodzi z tekstu modelu", nie może zapisać tego
    // tym samym zdaniem, co odczyt bajtów z dysku.
    const d = evidenceFromEvents(
      [
        ...para("a", "read_file", { path: "Moje pliki/faktury-08.csv" }, "10 wierszy"),
        ...para("b", "read_document", { path: "Moje pliki/faktura.pdf" }, "1 strona"),
      ],
      pl,
    )
    expect(d.intake).toEqual([
      "Moje pliki/faktury-08.csv — 10 wierszy",
      "rozpoznano Moje pliki/faktura.pdf — 1 strona",
    ])
  })

  test("Rozpoznany PDF liczy się jako wniesiona treść, więc dokument nie jest oskarżany bez powodu", () => {
    // Sprawa zrobiona WYŁĄCZNIE z faktury w PDF-ie to typowa sprawa księgowej. Gdyby
    // rozpoznanie nie karmiło „Co weszło", panel wypisywałby nad nią zdanie o dokumencie
    // powstałym bez zajrzenia do czegokolwiek — nieprawdę w jedynym miejscu, które
    // nie ma prawa się mylić.
    const d = evidenceFromEvents(
      [
        ...para("a", "read_document", { path: "Moje pliki/faktura.pdf" }, "1 strona"),
        ...para("b", "write_document", { name: "zestawienie.md" }, "800 znaków"),
        ...para("c", "verify_document", { name: "zestawienie.md" }, "0 pustych pól"),
      ],
      pl,
    )
    expect(d.unverified).toEqual([])
  })

  test("Obcięcie długiego dokumentu widać w dowodzie, a nie dopiero w rachunku za pomyłkę", () => {
    // Usługa przetwarza najwyżej MAX_PAGES stron i resztę pomija PO CICHU. Wynik obcięty,
    // nieodróżnialny od kompletnego, zdarzył się w tym produkcie już pięć razy.
    const d = evidenceFromEvents(
      [...para("a", "read_document", { path: "umowa.pdf" }, "20 z 34 stron; dalszych nie odczytano")],
      pl,
    )
    expect(d.intake).toEqual(["rozpoznano umowa.pdf — 20 z 34 stron; dalszych nie odczytano"])
  })

  test("Odczyt i rozpoznanie nie zlewają się w jedno zdanie, bo to dwie różne rzeczy", () => {
    const zdanie = summariseGroup(
      pairSteps([
        ...para("a", "read_file", { path: "faktury.csv" }, "10 wierszy"),
        ...para("b", "read_document", { path: "faktura.pdf" }, "1 strona"),
      ]),
      pl,
    )
    expect(zdanie).toBe("Przeczytałem 1 plik i rozpoznałem 1 dokument")
    expect(zdanie, "„przeczytałem 2 pliki” ukryłoby, skąd wzięła się połowa treści").not.toBe(
      "Przeczytałem 2 pliki",
    )
  })

  test("Agent z nadaną zdolnością dostaje ADRES czynności, a nie zdanie „nie umiem”", () => {
    // To był moment, w którym produkt przestawał działać dla księgowej: faktury
    // przychodzą jako PDF-y, usługa stała w compose osiem dni i nie była wołana ani razu.
    const zdanie = notReadable("Moje pliki/faktura.pdf", true)!
    expect(zdanie).toContain("read_document")
    expect(zdanie).toContain("Moje pliki/faktura.pdf")
    expect(zdanie).not.toContain("Poproś użytkownika o wersję tekstową")
  })

  test("Agent bez tej zdolności dalej odmawia, ale mówi, jak o nią poprosić", () => {
    const zdanie = notReadable("Moje pliki/faktura.pdf", false)!
    expect(zdanie).toContain("Nie umiem odczytać PDF-a")
    expect(zdanie).toContain("report_gap")
  })
})
