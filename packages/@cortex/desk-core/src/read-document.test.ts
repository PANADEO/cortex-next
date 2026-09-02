// Czynność `read_document` w pętli agenta — bez usługi, bez bazy, bez modelu.
//
// DLACZEGO POWSTAŁ. Ta czynność jest pierwszą, która wychodzi po treść POZA to biurko
// i wraca z tekstem MODELU. Wiszą na tym trzy własności, z których żadna nie broni się sama:
//
//   1. para `tool_start`/`tool_end` domyka się także wtedy, gdy usługa nie odpowiada
//      — inaczej krok wisi na ekranie „w toku" na zawsze i znika z dowodu;
//   2. obcięcie na `MAX_PAGES` dojeżdża do PODSUMOWANIA, czyli do jedynego miejsca,
//      w którym człowiek je zobaczy;
//   3. plik tekstowy nie idzie do usługi wcale — bo `read_file` czyta go dosłownie
//      i za darmo, a rozpoznawanie oddałoby domysł modelu i policzyło za to pieniądze.
//
// Osobno sprawdzamy ślepy zaułek, od którego się to zaczęło: `read_file` na PDF-ie
// odpowiadał „nie umiem odczytać PDF-a" mimo usługi stojącej obok.

import { beforeEach, describe, expect, it, vi } from "vitest"
import type { DeskEvent, Policy, User } from "./types"

const events: DeskEvent[] = []

vi.mock("server-only", () => ({}))

vi.mock("./db", () => ({
  migrate: async () => {},
  pool: {
    query: async (_sql: string, params?: unknown[]) => {
      if (params?.[1]) events.push(JSON.parse(String(params[1])) as DeskEvent)
      return { rows: [], rowCount: 0 }
    },
  },
}))

vi.mock("./audit-log", () => ({ write: async () => {} }))

vi.mock("./desk-storage", () => ({
  caseFolder: (_u: string, c: string) => `Sprawy/${c}`,
  readBinary: async (_u: string, path: string) => {
    if (path.includes("nie-ma")) throw new Error("ENOENT")
    return Buffer.from("%PDF-1.4 udawany")
  },
  read: async () => "treść",
  list: async () => [],
  write: async () => {},
  copy: async () => "",
}))

/** Usługa podmieniona; reszta modułu (lista formatów, podsumowanie, ramka) prawdziwa. */
const service = vi.hoisted(() => ({ recognise: vi.fn() }))
vi.mock("./document-parser", async (original) => {
  const real = await original<typeof import("./document-parser")>()
  return { ...real, recogniseDocument: service.recognise }
})

const { toolsForPolicy } = await import("./runtime")
const { DocumentParserFailure, notReadable } = await import("./document-parser")

const anna = {
  id: "anna",
  firstName: "Anna",
  lastName: "Kowalska",
  department: "accounting",
  role: "member",
  quickTasks: [],
} as unknown as User

const policy = (...ids: string[]): Policy =>
  ({
    user: "anna",
    role: "member",
    granted: ids.map((id) => ({ id, department: "everyone" })),
    blocked: [],
    dailyLimitUsd: 1,
    fingerprint: "test",
  }) as unknown as Policy

type Executable = { execute: (a: unknown, o: unknown) => Promise<unknown> }

const call = (tools: ReturnType<typeof toolsForPolicy>, name: string, args: object) =>
  (tools[name] as unknown as Executable).execute(args, {})

/** Para zdarzeń jednego kroku, dopasowana po `id` — tak jak robi to ekran. */
function step(name: string) {
  const start = events.find((e) => e.type === "tool_start" && e.name === name)
  const id = (start as { id?: string } | undefined)?.id
  const end = events.find((e) => e.type === "tool_end" && (e as { id?: string }).id === id)
  return { start, end: end as Extract<DeskEvent, { type: "tool_end" }> | undefined }
}

const recognised = (over: Partial<Record<string, unknown>> = {}) => ({
  markdown: "# Faktura FV/2026/08/117\nDo zapłaty: 4 672,77 zł",
  pages: 1,
  recognisedPages: 1,
  truncated: false,
  model: "google/gemini-2.5-flash-lite",
  ...over,
})

describe("czynność rozpoznawania dokumentu", () => {
  beforeEach(() => {
    events.length = 0
    service.recognise.mockReset()
  })

  it("bez zdolności model w ogóle jej nie widzi", () => {
    // Filtr stoi NA ODKRYCIU: nie ma czego odmawiać, bo narzędzia nie ma w rejestrze.
    expect(toolsForPolicy(anna, policy("files.read"), "c1").read_document).toBeUndefined()
    expect(toolsForPolicy(anna, policy("document.read"), "c1").read_document).toBeDefined()
  })

  it("udane rozpoznanie zamyka parę zdarzeń i wpisuje liczbę stron do dowodu", async () => {
    service.recognise.mockResolvedValue(recognised())
    const answer = await call(toolsForPolicy(anna, policy("document.read"), "c1"), "read_document", {
      path: "Moje pliki/faktura.pdf",
    })

    const { start, end } = step("read_document")
    expect(start, "brak tool_start").toBeTruthy()
    expect(end, "brak tool_end — krok zostałby „w toku” na zawsze").toBeTruthy()
    expect(end!.ok).toBe(true)
    expect(end!.summary).toBe("1 strona")
    // Ścieżka MUSI być w argumentach zdarzenia: dowód powstaje wyłącznie ze zdarzeń,
    // więc bez niej wiersz „Co weszło" nie ma czego nazwać.
    expect((start as { args: { path?: unknown } }).args.path).toBe("Moje pliki/faktura.pdf")
    expect(String(answer)).toContain("4 672,77")
  })

  it("OBCIĘCIE dojeżdża do podsumowania kroku, a nie zostaje w usłudze", async () => {
    // Ta asercja jest powodem istnienia tego pliku. Bez niej sprawa mówi „rozpoznano
    // umowa.pdf — 34 strony" o dokumencie, z którego model widział dwadzieścia.
    service.recognise.mockResolvedValue(
      recognised({ pages: 34, recognisedPages: 20, truncated: true }),
    )
    await call(toolsForPolicy(anna, policy("document.read"), "c1"), "read_document", {
      path: "Moje pliki/umowa.pdf",
    })
    const { end } = step("read_document")
    expect(end!.summary).toContain("20")
    expect(end!.summary).toContain("34")
    expect(end!.ok, "obcięty wynik to nadal wynik — to nie jest awaria").toBe(true)
  })

  it("padnięta usługa też domyka krok i mówi w dowodzie, CO się zepsuło", async () => {
    service.recognise.mockRejectedValue(new DocumentParserFailure("usługa zgubiła zadanie"))
    const answer = await call(toolsForPolicy(anna, policy("document.read"), "c1"), "read_document", {
      path: "Moje pliki/faktura.pdf",
    })
    const { end } = step("read_document")
    expect(end, "brak tool_end przy awarii usługi").toBeTruthy()
    expect(end!.ok).toBe(false)
    expect(end!.summary).toContain("zgubiła zadanie")
    // Model dostaje zdanie, nie wyjątek — inaczej wywraca się cała tura.
    expect(String(answer)).toMatch(/Nie udało się rozpoznać/)
  })

  it("nieistniejący plik nie dobija się do usługi", async () => {
    service.recognise.mockResolvedValue(recognised())
    await call(toolsForPolicy(anna, policy("document.read"), "c1"), "read_document", {
      path: "Moje pliki/nie-ma-tego.pdf",
    })
    expect(service.recognise).not.toHaveBeenCalled()
    expect(step("read_document").end!.ok).toBe(false)
  })

  it("plik tekstowy odsyła do `read_file` i NIE kosztuje ani jednego wywołania modelu", async () => {
    service.recognise.mockResolvedValue(recognised())
    const answer = await call(toolsForPolicy(anna, policy("document.read"), "c1"), "read_document", {
      path: "Moje pliki/faktury-08.csv",
    })
    expect(service.recognise).not.toHaveBeenCalled()
    expect(String(answer)).toContain("read_file")
    expect(step("read_document").end!.ok).toBe(false)
  })

  it("wspólna półka pyta o zdolność do niej, a nie o zdolność rozpoznawania", async () => {
    service.recognise.mockResolvedValue(recognised())
    const answer = await call(toolsForPolicy(anna, policy("document.read"), "c1"), "read_document", {
      path: "Wspólne pliki/cennik.pdf",
    })
    expect(service.recognise).not.toHaveBeenCalled()
    expect(String(answer)).toMatch(/wspólna półka/)
  })
})

describe("ślepy zaułek na PDF-ie", () => {
  beforeEach(() => {
    events.length = 0
    service.recognise.mockReset()
  })

  it("ze zdolnością — `read_file` ODSYŁA do właściwej czynności, zamiast mówić „nie umiem”", () => {
    // To był moment, w którym produkt przestawał działać: faktury przychodzą jako PDF-y,
    // usługa stała obok i nie była wołana ani razu.
    const sentence = notReadable("Moje pliki/faktura.pdf", true)!
    expect(sentence).toContain("read_document")
    expect(sentence).toContain("Moje pliki/faktura.pdf")
    // i mówi, czym ta treść będzie — inaczej agent zacytuje ją jako zawartość pliku
    expect(sentence).toMatch(/rozpozna/i)
  })

  it("bez zdolności — zostaje odmowa, ale z drogą do zgody", () => {
    const sentence = notReadable("Moje pliki/faktura.pdf", false)!
    expect(sentence).toContain("Nie umiem odczytać PDF-a")
    expect(sentence).not.toContain("read_document")
    expect(sentence).toContain("report_gap")
  })

  it("arkusz i tak najpierw prosi o CSV — liczby z obrazu są domysłem", () => {
    const sentence = notReadable("Moje pliki/zestawienie.xlsx", true)!
    expect(sentence.indexOf("CSV")).toBeLessThan(sentence.indexOf("read_document"))
  })

  it("archiwum nie dostaje obietnicy, której nikt nie dotrzyma", () => {
    // Ani `read_file`, ani rozpoznawanie tego nie otworzy — odesłanie byłoby kłamstwem.
    expect(notReadable("Moje pliki/paczka.zip", true)).not.toContain("read_document")
  })

  it("plik tekstowy dalej przechodzi bez słowa", () => {
    expect(notReadable("Moje pliki/faktury.csv", true)).toBeNull()
  })

  it("`read_file` na PDF-ie zamyka krok, choć niczego nie przeczytał", async () => {
    const answer = await call(
      toolsForPolicy(anna, policy("files.read", "document.read"), "c1"),
      "read_file",
      { path: "Moje pliki/faktura.pdf" },
    )
    const { end } = step("read_file")
    expect(end!.ok).toBe(false)
    expect(String(answer)).toContain("read_document")
  })
})
