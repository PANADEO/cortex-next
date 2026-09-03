// PROCEDURY: KTO MOŻE CZYTAĆ, KTO MOŻE WYDAWAĆ I CZY TEKST WRACA TAKI, JAKI POSZEDŁ.
//
// DLACZEGO TEST ZACHOWANIA, A NIE SKAN KODU. Bramka roli jest zdaniem `if` w jednej
// funkcji i jej złamanie nie psuje niczego widocznego: ekran przełożonego dalej wygląda
// tak samo, bo pracownik i tak nie ma tam zakładki. Widać to dopiero wtedy, gdy ktoś
// zawoła trasę ręcznie — czyli tak, jak woła ją ten plik.
//
// DRUGA POŁOWA to przebieg tam i z powrotem: formularz wysyła POLA, trasa składa z nich
// `SKILL.md` i przepuszcza przez `parseSkill`. Znak, którego ten format nie unosi
// (przecinek we wzorcu ścieżki), nie wywala parsera — daje procedurę, która wygląda na
// wydaną i niesie CO INNEGO, niż wpisał człowiek. Tej klasy szkody nie widać ani
// w `tsc`, ani na ekranie.
//
// CZEGO TEN PLIK NIE SPRAWDZA: samego `parseSkill` (ma własny plik obok) ani zapisu do
// bazy (`store.integration.test.ts`). Tutaj sprawdzamy WYŁĄCZNIE to, co robi trasa.

import { parseSkill } from "@cortex/desk-core/procedures/frontmatter"
import { promptBlock } from "@cortex/desk-core/procedures/prompt-block"
import type { StoredProcedure } from "@cortex/desk-core/procedures/store"
import { beforeEach, describe, expect, it, vi } from "vitest"

/** Kto woła trasę w danym przebiegu — podmieniane per test. */
let me = { id: "anna", role: "member", department: "accounting" }

/** Co udaje baza. Wiersze podmieniane per test, czynności zapisu podglądane przez `vi.fn`. */
const shelf = {
  rows: [] as StoredProcedure[],
  publish: vi.fn(async () => 2),
  withdraw: vi.fn(async () => {}),
  restore: vi.fn(async () => {}),
}

vi.mock("@cortex/desk-ui/i18n/server", () => ({ deskT: async () => (key: string) => key }))
vi.mock("@cortex/desk-core/identity", () => ({ whoAmI: async () => me }))
vi.mock("@cortex/desk-core/audit-log", () => ({ write: async () => {} }))
vi.mock("@cortex/desk-core/people", () => ({
  DEPARTMENTS: ["accounting", "finance", "it", "marketing", "management"],
  names: async () => ({ robert: "Robert Nowak" }),
}))
vi.mock("@cortex/desk-core/procedures/store", () => ({
  allProcedures: async () => shelf.rows,
  activeProcedures: async () => shelf.rows.filter((p) => p.status === "active"),
  procedureByName: async (name: string) => shelf.rows.find((p) => p.name === name) ?? null,
  editionsOf: async (name: string) => {
    const found = shelf.rows.find((p) => p.name === name)
    return found ? [found.current] : []
  },
  publish: shelf.publish,
  withdraw: shelf.withdraw,
  restore: shelf.restore,
}))

const made = (over: Partial<StoredProcedure>): StoredProcedure => ({
  name: "rule",
  title: "Zasada",
  description: "O czymś.",
  loading: "index",
  paths: [],
  scope: [],
  status: "active",
  origin: "human",
  current: {
    edition: 1,
    body: "Robimy tak i tak.",
    author: "robert",
    fingerprint: "abc",
    at: "2026-09-01T08:00:00.000Z",
  },
  ...over,
})

const ALL_OF_US = made({ name: "company-rules", title: "Zasady firmy", scope: [] })
const ACCOUNTING = made({ name: "vat", title: "VAT", scope: ["accounting", "finance"] })
const MARKETING = made({ name: "posts", title: "Wpisy", scope: ["marketing"] })
const GONE = made({ name: "old", title: "Stara", status: "withdrawn" })

const publishing = (over: Record<string, unknown> = {}) =>
  new Request("http://d/api/procedures/supervision", {
    method: "POST",
    body: JSON.stringify({
      action: "publish",
      title: "Zestawienie VAT",
      description: "Jak je składamy.",
      loading: "index",
      paths: "",
      scope: [],
      body: "Bierzemy faktury i sumujemy.",
      ...over,
    }),
  })

const supervision = async () => await import("./procedure-supervision")

beforeEach(() => {
  me = { id: "anna", role: "member", department: "accounting" }
  shelf.rows = [ALL_OF_US, ACCOUNTING, MARKETING, GONE]
  shelf.publish.mockClear()
  shelf.withdraw.mockClear()
  shelf.restore.mockClear()
})

describe("procedury czyta każdy, wydaje wyłącznie przełożony", () => {
  it("pracownik nie dostaje katalogu przełożonego", async () => {
    const { GET } = await supervision()
    expect((await GET()).status).toBe(403)
  })

  it("pracownik nie wyda procedury, choćby zawołał trasę z palca", async () => {
    const { POST } = await supervision()
    const r = await POST(publishing())
    expect(r.status).toBe(403)
    // Sam kod odpowiedzi nie wystarczy: odmowa PO zapisie wygląda identycznie.
    expect(shelf.publish).not.toHaveBeenCalled()
  })

  it("pracownik nie wycofa ani nie przywróci procedury", async () => {
    const { POST } = await supervision()
    for (const action of ["withdraw", "restore"]) {
      const r = await POST(
        new Request("http://d/api/procedures/supervision", {
          method: "POST",
          body: JSON.stringify({ action, name: "vat" }),
        }),
      )
      expect(r.status).toBe(403)
    }
    expect(shelf.withdraw).not.toHaveBeenCalled()
    expect(shelf.restore).not.toHaveBeenCalled()
  })

  it("przełożony widzi wszystko, także wycofane, i przy każdym podpis", async () => {
    me = { id: "robert", role: "management", department: "management" }
    const { GET } = await supervision()
    const r = await GET()
    expect(r.status).toBe(200)
    const d = await r.json()
    expect(d.procedures.map((p: { name: string }) => p.name)).toEqual([
      "company-rules",
      "vat",
      "posts",
      "old",
    ])
    expect(d.procedures[0].signedBy).toBe("Robert Nowak")
  })

  it("zasiew nie dostaje cudzego nazwiska, tylko puste miejsce", async () => {
    me = { id: "robert", role: "management", department: "management" }
    shelf.rows = [
      made({ name: "seeded", origin: "seed", current: { ...ALL_OF_US.current, author: "seed" } }),
    ]
    const { GET } = await supervision()
    const d = await (await GET()).json()
    expect(d.procedures[0].signedBy).toBeNull()
  })
})

describe("pracownik widzi dokładnie to, co wchodzi do jego tury", () => {
  it("swój dział i to, co dotyczy wszystkich — nic ponadto", async () => {
    const { GET } = await import("./procedures")
    const d = await (await GET()).json()
    expect(d.procedures.map((p: { name: string }) => p.name)).toEqual(["company-rules", "vat"])
  })

  it("przełożony też nie ma tu obejścia — pyta o SWOJĄ pracę", async () => {
    me = { id: "robert", role: "management", department: "management" }
    const { GET } = await import("./procedures")
    const d = await (await GET()).json()
    expect(d.procedures.map((p: { name: string }) => p.name)).toEqual(["company-rules"])
  })
})

describe("formularz składa się w ten sam tekst, który czyta plik od człowieka", () => {
  beforeEach(() => {
    me = { id: "robert", role: "management", department: "management" }
  })

  it("nowa procedura bierze nazwę z tytułu, z ogonkami sprowadzonymi do liter", async () => {
    shelf.rows = []
    const { POST } = await supervision()
    expect((await POST(publishing({ title: "Zestawienie VAT — Łódź" }))).status).toBe(200)
    expect(shelf.publish.mock.calls[0]?.[1]).toMatchObject({ name: "zestawienie-vat-lodz" })
  })

  it("kolejne wydanie zostaje przy STAREJ nazwie, choćby tytuł poprawiono", async () => {
    const { POST } = await supervision()
    await POST(publishing({ name: "vat", title: "Zestawienie VAT po poprawce" }))
    expect(shelf.publish.mock.calls[0]?.[1]).toMatchObject({ name: "vat" })
  })

  it("nowa procedura o zajętej nazwie nie podmienia cudzego tekstu", async () => {
    const { POST } = await supervision()
    const r = await POST(publishing({ title: "VAT" }))
    expect(r.status).toBe(409)
    expect(await r.json()).toEqual({ error: "api.procedureExists" })
    expect(shelf.publish).not.toHaveBeenCalled()
  })

  it("tytuł bez ani jednej litery nie daje nazwy i mówi o tym wprost", async () => {
    shelf.rows = []
    const { POST } = await supervision()
    const r = await POST(publishing({ title: "???" }))
    expect(await r.json()).toEqual({ error: "api.procedureBadTitle" })
  })

  it("tryb wskazanych folderów bez ani jednego folderu jest odrzucony zdaniem o folderach", async () => {
    shelf.rows = []
    const { POST } = await supervision()
    const r = await POST(publishing({ loading: "paths", paths: "" }))
    expect(await r.json()).toEqual({ error: "api.procedureNeedsPaths" })
  })

  it("pusta treść jest odrzucona — procedurą jest treść", async () => {
    shelf.rows = []
    const { POST } = await supervision()
    const r = await POST(publishing({ body: "   " }))
    expect(await r.json()).toEqual({ error: "api.procedureNeedsBody" })
  })

  it("dział spoza listy nie wchodzi do zasięgu", async () => {
    shelf.rows = []
    const { POST } = await supervision()
    const r = await POST(publishing({ scope: ["ksiegowosc"] }))
    expect(await r.json()).toEqual({ error: "api.procedureNoSuchDepartment" })
    expect(shelf.publish).not.toHaveBeenCalled()
  })

  /**
   * TU MIESZKA CAŁY POWÓD, DLA KTÓREGO SKŁADAMY TEKST I ZARAZ GO CZYTAMY.
   *
   * `paths: [Faktury, korekty]` rozjeżdża się na przecinku w DWA wzorce i `parseSkill`
   * nie ma o tym pojęcia — dostaje poprawną listę. Bez porównania tam i z powrotem
   * przełożony wydałby procedurę przypiętą do folderu „korekty", którego nie ma.
   */
  it("przecinek we wzorcu folderu jest odmową, nie cichym rozcięciem na dwa", async () => {
    shelf.rows = []
    const { POST } = await supervision()
    const r = await POST(publishing({ loading: "paths", paths: "Moje pliki/Faktury, korekty" }))
    expect(await r.json()).toEqual({ error: "api.procedureBadPath" })
    expect(shelf.publish).not.toHaveBeenCalled()
  })

  it("wzorce folderów przepadają razem z trybem, zamiast blokować zapis", async () => {
    // `parseSkill` odrzuca wzorce bez trybu `paths` — a przełożony, który wpisał foldery
    // i zmienił zdanie co do trybu, ma dostać to, co wybrał na końcu.
    shelf.rows = []
    const { POST } = await supervision()
    expect((await POST(publishing({ loading: "index", paths: "Moje pliki/Faktury" }))).status).toBe(
      200,
    )
    expect(shelf.publish.mock.calls[0]?.[1]).toMatchObject({ paths: [] })
  })
})

describe("licznik kosztu liczy to samo, co prompt tury", () => {
  it("oddaje dokładnie `alwaysChars` z `promptBlock`, a nie długość tekstu", async () => {
    me = { id: "robert", role: "management", department: "management" }
    const title = "Zasady naszej firmy"
    const body = "Kwoty zapisujemy po polsku."
    const { POST } = await supervision()
    const d = await (
      await POST(
        new Request("http://d/api/procedures/supervision", {
          method: "POST",
          body: JSON.stringify({ action: "measure", title, body }),
        }),
      )
    ).json()
    const wanted = promptBlock([
      made({ title, loading: "always", current: { ...ALL_OF_US.current, body } }),
    ])
    expect(d.alwaysChars).toBe(wanted.alwaysChars)
    // Kontrola dodatnia: gdyby licznik oddawał samą długość treści, ta asercja przeszłaby
    // dalej, a ta niżej — nie. Blok niesie jeszcze nagłówek z tytułem.
    expect(d.alwaysChars).toBeGreaterThan(body.length)
  })
})

describe("złożony tekst wraca taki, jaki poszedł", () => {
  it("dwukropek w opisie, myślnik w tytule i kreski w treści przeżywają przebieg", async () => {
    const { composeSkill } = await supervision()
    const draft = {
      name: "faktury-zakupowe",
      title: "Faktury zakupowe — co sprawdzamy",
      description: "Uwaga: sprawdzamy NIP, datę i kwotę.",
      loading: "paths" as const,
      paths: ["Moje pliki/Faktury", "Sprawy/*/Faktury"],
      scope: ["accounting"],
      body: "1. Sprawdzamy NIP.\n\n---\n\n2. Sprawdzamy datę.",
    }
    const back = parseSkill(composeSkill(draft))
    expect(back).toEqual({ ...draft, body: draft.body.trim() })
  })
})
