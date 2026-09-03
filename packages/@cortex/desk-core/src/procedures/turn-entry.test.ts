// CO Z PROCEDUR WCHODZI DO TURY — trzy moduły, jedno pytanie, więc jeden plik.
//
// `visible.ts` mówi KTÓRE, `prompt-block.ts` mówi ILE z nich i za jaką cenę, `hint.ts`
// mówi KIEDY dla tych przypiętych do katalogu. Rozbite na trzy pliki po dwie asercje
// gubiłyby to, co je łączy: każdy z tych modułów da się zepsuć osobno tak, że procedura
// przestaje działać BEZ JEDNEGO BŁĘDU — po prostu nie wchodzi, a tura wygląda normalnie.

import { describe, expect, it } from "vitest"
import { hintFor, pathMatches, touchedPaths } from "./hint"
import { promptBlock } from "./prompt-block"
import type { StoredProcedure } from "./store"
import { appliesTo, visibleFor } from "./visible"

const make = (over: Partial<StoredProcedure> & { name: string }): StoredProcedure => ({
  title: `Tytuł ${over.name}`,
  description: `Opis ${over.name}.`,
  loading: "index",
  paths: [],
  scope: [],
  status: "active",
  origin: "human",
  current: {
    edition: 1,
    body: `Treść ${over.name}.`,
    author: "robert",
    fingerprint: "abc123",
    at: "2026-09-03T10:00:00.000Z",
  },
  ...over,
})

describe("kto widzi którą procedurę", () => {
  it("pusty zasięg znaczy WSZYSCY", () => {
    const p = make({ name: "zasady" })
    expect(appliesTo(p, "accounting")).toBe(true)
    expect(appliesTo(p, "marketing")).toBe(true)
  })

  it("zasięg wpuszcza wymieniony dział i tylko jego", () => {
    const p = make({ name: "vat", scope: ["accounting", "finance"] })
    expect(appliesTo(p, "accounting")).toBe(true)
    expect(appliesTo(p, "finance")).toBe(true)
    expect(appliesTo(p, "marketing")).toBe(false)
  })

  it("PRZEŁOŻONY NIE MA OBEJŚCIA — i to jest decyzja, nie przeoczenie", () => {
    // Na ekranie nadzoru widzi wszystko, bo tam pyta „co w firmie istnieje". W turze pyta
    // o co innego: „według czego mam pracować JA". Procedura księgowości w turze osoby
    // z zarządu to koszt w prompcie i szansa, że model zastosuje cudzą regułę.
    const p = make({ name: "vat", scope: ["accounting"] })
    expect(appliesTo(p, "management")).toBe(false)
  })

  it("wycofana nie wchodzi do niczyjej tury, nawet bez zasięgu", () => {
    expect(appliesTo(make({ name: "stara", status: "withdrawn" }), "accounting")).toBe(false)
  })

  it("filtr oddaje tylko te, które przechodzą", () => {
    const all = [
      make({ name: "zasady" }),
      make({ name: "vat", scope: ["accounting"] }),
      make({ name: "kampanie", scope: ["marketing"] }),
      make({ name: "stara", status: "withdrawn" }),
    ]
    expect(visibleFor(all, "accounting").map((p) => p.name)).toEqual(["zasady", "vat"])
  })
})

describe("co idzie do promptu i ile kosztuje", () => {
  it("procedura `always` wchodzi TREŚCIĄ, z tytułem nad nią", () => {
    const b = promptBlock([make({ name: "zasady", loading: "always" })])
    expect(b.text).toContain("Treść zasady.")
    // Tytuł jest po to, żeby model mógł powiedzieć CZŁOWIEKOWI, na co się powołuje.
    expect(b.text).toContain("Tytuł zasady")
    expect(b.alwaysChars).toBeGreaterThan(0)
  })

  it("procedura `index` wchodzi JEDNYM wierszem, bez treści", () => {
    const b = promptBlock([make({ name: "vat" })])
    expect(b.text).toContain("vat — «Tytuł vat»: Opis vat.")
    expect(b.text).not.toContain("Treść vat.")
    expect(b.indexed).toBe(1)
    expect(b.alwaysChars).toBe(0)
  })

  it("procedura `always` NIE dubluje się w indeksie", () => {
    // Wiersz w indeksie byłby zaproszeniem do otwarcia rzeczy, którą model właśnie czyta —
    // czyli tury zmarnowanej na czynność bez skutku.
    const b = promptBlock([make({ name: "zasady", loading: "always" })])
    expect(b.indexed).toBe(0)
    expect(b.text).not.toContain("zasady — «")
  })

  it("procedura `paths` nie kosztuje w prompcie ANI ZNAKU", () => {
    // To jest cały sens tego trybu. Gdyby wchodziła do indeksu, byłaby zwykłym `index`.
    const b = promptBlock([make({ name: "faktury", loading: "paths", paths: ["Moje pliki/F"] })])
    expect(b.text).toBe("")
    expect(b.indexed).toBe(0)
    expect(b.alwaysChars).toBe(0)
  })

  it("brak procedur to pusty fragment, nie nagłówek nad pustką", () => {
    expect(promptBlock([]).text).toBe("")
  })

  it("licznik znaków `always` liczy to, co naprawdę idzie do modelu", () => {
    // Licznik stoi na ekranie przełożonego i ma być prawdą o rachunku, a nie o długości
    // samej treści: nagłówek też jedzie w każdej turze.
    const p = make({ name: "zasady", loading: "always" })
    const b = promptBlock([p])
    expect(b.alwaysChars).toBe(b.text.length)
    expect(b.alwaysChars).toBeGreaterThan(p.current.body.length)
  })
})

describe("wskazówka przy dotknięciu ścieżki", () => {
  const invoices = make({
    name: "faktury-zakupowe",
    loading: "paths",
    paths: ["Moje pliki/Faktury"],
  })

  it("dopasowuje katalog i wszystko w nim, ale nie sąsiada o podobnej nazwie", () => {
    expect(pathMatches("Moje pliki/Faktury", "Moje pliki/Faktury")).toBe(true)
    expect(pathMatches("Moje pliki/Faktury", "Moje pliki/Faktury/08/f1.pdf")).toBe(true)
    // Bez tej asercji przedrostkowe dopasowanie łapałoby „Faktury-archiwum" i procedura
    // księgowa wchodziłaby do spraw, których nie dotyczy.
    expect(pathMatches("Moje pliki/Faktury", "Moje pliki/Faktury-archiwum/f.pdf")).toBe(false)
    expect(pathMatches("Moje pliki/Faktury", "Moje pliki/Umowy/f.pdf")).toBe(false)
  })

  it("gwiazdka zastępuje jeden człon ścieżki", () => {
    expect(pathMatches("Moje pliki/*/Faktury", "Moje pliki/2026/Faktury/f.pdf")).toBe(true)
    expect(pathMatches("Moje pliki/*/Faktury", "Moje pliki/2026/08/Faktury/f.pdf")).toBe(false)
  })

  it("czyta ścieżki z ARGUMENTÓW, niezależnie od tego, jak nazwano pole", () => {
    // Czynności nazywają to raz `path`, raz `folder`, raz `files`, a dopisana za rok
    // nazwie inaczej. Lista nazw do sprawdzenia byłaby czwartym miejscem do pamiętania.
    expect(touchedPaths({ path: "Moje pliki/a.csv" })).toEqual(["Moje pliki/a.csv"])
    expect(touchedPaths({ files: ["Moje pliki/a.csv", "Moje pliki/b.csv"] })).toHaveLength(2)
    // Zdania nie są ścieżkami — bez odsiewu „policz koszty" trafiałoby do dopasowania.
    expect(touchedPaths({ description: "policz koszty sierpnia", query: "VAT" })).toEqual([])
  })

  it("mówi o procedurze, gdy czynność sięgnęła po pasujący plik", () => {
    const s = hintFor([invoices], { path: "Moje pliki/Faktury/08/f1.pdf" }, new Set())
    expect(s).toContain("«Tytuł faktury-zakupowe»")
    expect(s).toContain("open_procedure")
    // Wskazówka NIE niesie treści procedury. Gdyby niosła, procedura weszłaby do tury
    // BEZ ŚLADU — a otwarcie zostawia zdarzenie i wiersz „Wg czego".
    expect(s).not.toContain("Treść faktury-zakupowe.")
  })

  it("milczy, gdy nic nie pasuje", () => {
    expect(hintFor([invoices], { path: "Moje pliki/Umowy/u1.pdf" }, new Set())).toBe("")
    expect(hintFor([invoices], { description: "policz coś" }, new Set())).toBe("")
  })

  it("nie przypomina o procedurze już otwartej w tej turze", () => {
    // Inaczej model dostawałby to samo zdanie przy każdym kolejnym pliku i marnował
    // kroki na drugie wywołanie tej samej czynności.
    const s = hintFor(
      [invoices],
      { path: "Moje pliki/Faktury/f.pdf" },
      new Set(["faktury-zakupowe"]),
    )
    expect(s).toBe("")
  })

  it("procedura w innym trybie NIE zapala wskazówki", () => {
    // Kontrola ujemna: bez niej `index` z wypełnionym `paths` (czego parser zresztą nie
    // wpuści) dublowałby się między indeksem a wskazówką.
    const asIndex = make({ name: "vat", loading: "index", paths: ["Moje pliki/Faktury"] })
    expect(hintFor([asIndex], { path: "Moje pliki/Faktury/f.pdf" }, new Set())).toBe("")
  })
})
