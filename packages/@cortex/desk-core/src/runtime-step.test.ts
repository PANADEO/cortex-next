// Krok narzędzia zapisuje się ZAWSZE — także wtedy, gdy narzędzie się przewróci.
//
// DLACZEGO POWSTAŁ. Sześć z dziesięciu narzędzi nie miało `try/catch`. Wyjątek w środku
// (brak pliku, padnięta piaskownica, zerwane połączenie do dostawcy obrazów) gubił
// zdarzenie `tool_end`. Skutek był podwójny i cichy: na ekranie krok zostawał „w toku"
// NA ZAWSZE, a `evidenceFromEvents` pomijało go w dowodzie, bo bierze wyłącznie pary
// ze statusem. Produkt, którego jedynym argumentem jest dowód, przestawał dowodzić —
// i nic tego nie zgłaszało.
//
// Ten plik jest pierwszym testem PĘTLI, który nie woła modelu. Baza i dysk są podmienione,
// więc kosztuje zero i chodzi w zwykłym `npm test`.

import { beforeEach, describe, expect, it, vi } from "vitest"
import type { DeskEvent, Policy, User } from "./types"

const events: DeskEvent[] = []

// `server-only` rzuca wyjątkiem przy imporcie poza Next — a to jest jego cała treść.
// Poza serwerem Next nic nie chroni, więc podmiana niczego nie osłabia.
vi.mock("server-only", () => ({}))

// Baza: `appendEvent` woła `pool.query`, a my chcemy zdarzeń w tablicy, nie w Postgresie.
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
vi.mock("./memory", () => ({
  propose: async () => {
    throw new Error("baza pamięci nie odpowiada")
  },
  recallBlock: () => "",
  kept: async () => [],
}))

// Dysk: KAŻDA czynność się przewraca. To jest cały sens tego pliku.
vi.mock("./desk-storage", () => ({
  caseFolder: (_u: string, c: string) => `Sprawy/${c}`,
  list: async () => {
    throw new Error("dysk niedostępny")
  },
  read: async () => {
    throw new Error("dysk niedostępny")
  },
  write: async () => {
    throw new Error("dysk pełny")
  },
  copy: async () => {
    throw new Error("dysk niedostępny")
  },
}))

const { toolsForPolicy } = await import("./runtime")

const anna: User = {
  id: "anna",
  email: "anna@itsg.pl",
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
    granted: ids.map((id) => ({ id, department: "accounting" })),
    blocked: [],
    dailyLimitUsd: 1,
    fingerprint: "test",
  }) as unknown as Policy

const everything = policy(
  "files.list",
  "files.read",
  "document.write",
  "document.verify",
  "files.keep",
  "sheet.write",
  "memory.write",
  "code.run",
)

/** Para zdarzeń jednego kroku, dopasowana po `id` — tak jak robi to ekran. */
function step(name: string) {
  const start = events.find((e) => e.type === "tool_start" && e.name === name)
  const id = (start as { id?: string } | undefined)?.id
  const end = events.find((e) => e.type === "tool_end" && (e as { id?: string }).id === id)
  return { start, end: end as Extract<DeskEvent, { type: "tool_end" }> | undefined }
}

describe("krok narzędzia, gdy narzędzie się przewraca", () => {
  beforeEach(() => {
    events.length = 0
  })

  const cases: [string, () => Promise<unknown>][] = []
  const t = toolsForPolicy(anna, everything, "c1")
  const call = (name: string, args: Record<string, unknown>) => async () => {
    const tool = t[name] as { execute: (a: unknown, o: unknown) => Promise<unknown> }
    return tool.execute(args, {})
  }
  cases.push(["list_files", call("list_files", { folder: "Moje pliki" })])
  cases.push(["read_file", call("read_file", { path: "Moje pliki/x.csv" })])
  cases.push(["write_document", call("write_document", { name: "raport.md", text: "treść" })])
  cases.push(["verify_document", call("verify_document", { name: "raport.md" })])
  cases.push(["save_to_my_files", call("save_to_my_files", { name: "raport.md" })])
  cases.push(["write_sheet", call("write_sheet", { name: "a.csv", csv: "a,b" })])
  cases.push(["remember", call("remember", { what: "Faktury dostaję jako CSV." })])

  it.each(cases)("%s zamyka krok zamiast zostawić go w toku", async (name, run) => {
    const answer = await run()

    const { start, end } = step(name)
    expect(start, `${name}: brak tool_start`).toBeTruthy()
    // TO JEST TA ASERCJA. Bez niej krok wisi na ekranie i znika z dowodu.
    expect(end, `${name}: brak tool_end — krok zostałby „w toku” na zawsze`).toBeTruthy()
    expect(end!.ok, `${name}: dowód twierdzi, że się udało`).toBe(false)
    expect(end!.summary.length, `${name}: pusty opis w dowodzie`).toBeGreaterThan(0)
    // Model dostaje zdanie, a nie wyjątek — inaczej tura kończy się awarią całej pracy.
    expect(typeof answer).toBe("string")
    expect(String(answer).length).toBeGreaterThan(0)
  })

  it("obliczenie zapisuje w zdarzeniu, KTÓRE pliki do niego weszły", async () => {
    // Druga połowa tej samej poprawki co w evidence.test.ts, i ta ważniejsza: dowód
    // powstaje wyłącznie ze zdarzeń, więc karta z osią wejścia nie ma czego czytać,
    // dopóki `run_computation` nie zapisze listy plików w `tool_start`. Wcześniej szedł
    // tam sam opis, i sprawa policzona na fakturach twierdziła w panelu, że nikt do
    // żadnego pliku nie zajrzał. Piaskownica się tu przewróci i to nie szkodzi —
    // `tool_start` leci PRZED wykonaniem, więc asercja mierzy dokładnie to, co ma.
    await call("run_computation", {
      description: "sumuję faktury",
      code: "console.log(1)",
      files: ["Moje pliki/f1.csv", "Moje pliki/f2.csv"],
    })()
    const { start } = step("run_computation")
    expect(start, "brak tool_start dla obliczenia").toBeTruthy()
    expect((start as { args: { files?: unknown } }).args.files).toEqual([
      "Moje pliki/f1.csv",
      "Moje pliki/f2.csv",
    ])
  })

  it.each(cases)("%s: krok nieudany niesie POWÓD, nie tylko zdanie", async (name, run) => {
    // Powód jest wartością ze skończonej listy, a `summary` polskim zdaniem. Ekran
    // wyprowadza z powodu radę „co teraz”; ze zdania dałoby się to zrobić wyłącznie
    // dopasowaniem napisu — a dopasowanie napisu do decyzji zerwało w tym repozytorium
    // już raz plakietkę „sprawdzony”, po cichu i w obu językach.
    await run()
    const { end } = step(name)
    expect(end!.ok).toBe(false)
    expect(end!.reason, `${name}: nieudany krok bez powodu`).toBeTruthy()
  })

  it("surowa treść wyjątku nie wychodzi do dowodu", async () => {
    // Dowód czyta człowiek i audytor. Ścieżki z serwera ani treści wyjątków tam nie ma;
    // pełna treść zostaje w odpowiedzi dla modelu i w dzienniku.
    await call("write_document", { name: "a.md", text: "x" })()
    const { end } = step("write_document")
    expect(end!.summary).not.toContain("dysk pełny")
  })

  it("krok, który się udał, nadal mówi że się udał", async () => {
    // Kontrola negatywna: opakowywacz nie może po prostu zawsze pisać „nie udało się".
    const { toolsForPolicy: fresh } = await import("./runtime")
    const tools = fresh(anna, policy("memory.write"), "c2")
    const remember = tools.remember as { execute: (a: unknown, o: unknown) => Promise<unknown> }
    const memory = await import("./memory")
    vi.spyOn(memory, "propose").mockResolvedValue(undefined as never)
    events.length = 0
    await remember.execute({ what: "Zapamiętaj to." }, {})
    expect(step("remember").end!.ok).toBe(true)
  })
})
