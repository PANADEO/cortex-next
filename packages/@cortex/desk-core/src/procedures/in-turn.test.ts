// PROCEDURA W DZIAŁAJĄCEJ TURZE — czynność i wskazówka, przez prawdziwy `toolsForPolicy`.
//
// DLACZEGO POWSTAŁ. Recenzja stanu z 03.09.2026 wykazała, że ANI JEDEN test w repozytorium
// nie podawał `toolsForPolicy` czwartego argumentu. Wszystko wokół było pokryte — parser,
// magazyn, zasięg, blok promptu, dowód — a samo WYKONANIE `open_procedure` i doklejenie
// wskazówki trybu `paths` w opakowywaczu `step()` nie było sprawdzane niczym poza ręką.
// Działało; przy pierwszej przebudowie `step()` nikt by się nie dowiedział, że przestało.
//
// Wzorzec z `runtime-step.test.ts`: baza i dysk podmienione, model niewołany, więc plik
// kosztuje zero i chodzi w zwykłym `npm test`.

import { beforeEach, describe, expect, it, vi } from "vitest"
import type { DeskEvent, Policy, User } from "../types"
import type { StoredProcedure } from "./store"

const events: DeskEvent[] = []

vi.mock("server-only", () => ({}))

vi.mock("../db", () => ({
  migrate: async () => {},
  pool: {
    query: async (_sql: string, params?: unknown[]) => {
      if (params?.[1]) events.push(JSON.parse(String(params[1])) as DeskEvent)
      return { rows: [], rowCount: 0 }
    },
  },
}))
vi.mock("../audit-log", () => ({ write: async () => {} }))
vi.mock("../memory", () => ({
  propose: async () => {},
  recallBlock: () => "",
  kept: async () => [],
}))
vi.mock("../people", () => ({
  person: async (id: string) =>
    id === "robert"
      ? { id, firstName: "Robert", lastName: "Nowak", department: "management", role: "management" }
      : null,
}))

/** Dysk DZIAŁA — inaczej nie dałoby się sprawdzić wskazówki doklejanej do udanego kroku. */
vi.mock("../desk-storage", () => ({
  caseFolder: (_u: string, c: string) => `Sprawy/${c}`,
  read: async () => "nr,netto\n1/08,1000\n",
  list: async () => [],
  write: async () => {},
  copy: async () => {},
}))

const { toolsForPolicy } = await import("../runtime")

const anna = {
  id: "anna",
  email: "anna@itsg.pl",
  firstName: "Anna",
  lastName: "Kowalska",
  department: "accounting",
  role: "member",
  quickTasks: [],
} as unknown as User

const policy = {
  user: "anna",
  role: "member",
  granted: [{ id: "files.read", department: "accounting" }],
  blocked: [],
  dailyLimitUsd: 1,
  fingerprint: "test",
} as unknown as Policy

const procedure = (over: Partial<StoredProcedure> & { name: string }): StoredProcedure => ({
  title: `Tytuł ${over.name}`,
  description: "Opis.",
  loading: "index",
  paths: [],
  scope: [],
  status: "active",
  origin: "human",
  current: {
    edition: 9,
    body: "Sumujemy po stawkach.",
    author: "robert",
    fingerprint: "abc",
    at: "2026-09-03T10:00:00.000Z",
  },
  ...over,
})

const VAT = procedure({ name: "zestawienie-vat", title: "Zestawienie VAT" })
const INVOICES = procedure({
  name: "faktury-zakupowe",
  title: "Faktury zakupowe",
  loading: "paths",
  paths: ["Moje pliki/Faktury"],
})

/** Para zdarzeń jednego kroku, dopasowana po `id` — tak jak robi to ekran. */
function step(name: string) {
  const start = events.find((e) => e.type === "tool_start" && e.name === name)
  const id = (start as { id?: string } | undefined)?.id
  const end = events.find((e) => e.type === "tool_end" && (e as { id?: string }).id === id)
  return end as Extract<DeskEvent, { type: "tool_end" }> | undefined
}

const call = (t: Record<string, unknown>, name: string, args: Record<string, unknown>) =>
  (t[name] as { execute: (a: unknown, o: unknown) => Promise<string> }).execute(args, {})

describe("otwarcie zasady firmy w turze", () => {
  beforeEach(() => {
    events.length = 0
  })

  it("oddaje treść modelowi, a dowodowi tytuł, wydanie i podpis", async () => {
    const t = toolsForPolicy(anna, policy, "c1", [VAT]) as unknown as Record<string, unknown>
    const answer = await call(t, "open_procedure", { name: "zestawienie-vat" })

    // MODEL dostaje treść — bez niej czynność nie ma po co istnieć.
    expect(answer).toContain("Sumujemy po stawkach.")
    // DOWÓD dostaje co innego: tytuł dla ludzi, wydanie i podpis. Treści w dowodzie NIE MA
    // i być nie może — dowód czyta człowiek, a nie model.
    const end = step("open_procedure")
    expect(end?.ok).toBe(true)
    expect(end?.summary).toContain("Zestawienie VAT")
    expect(end?.summary).toContain("wydanie 9")
    expect(end?.summary).toContain("Robert Nowak")
    expect(end?.summary).not.toContain("Sumujemy")
  })

  it("procedura bez podpisu człowieka NIE udaje podpisanej", async () => {
    const fromSeed = procedure({ name: "zasady", current: { ...VAT.current, author: "seed" } })
    const t = toolsForPolicy(anna, policy, "c1", [fromSeed]) as unknown as Record<string, unknown>
    await call(t, "open_procedure", { name: "zasady" })
    // „wydał seed" byłoby podpisem nieistniejącej osoby w liście, której cała wartość
    // polega na tym, że podpis jest prawdziwy.
    expect(step("open_procedure")?.summary).toContain("nikt jej nie podpisał")
    expect(step("open_procedure")?.summary).not.toContain("seed")
  })

  it("nazwa spoza zasięgu kończy się ZDARZENIEM, nie ciszą", async () => {
    // Filtr działa na odkryciu, ale model dostaje nazwę jako NAPIS — da się ją zgadnąć
    // albo przenieść ze starej sprawy. Odmowa musi zostawić ślad.
    const t = toolsForPolicy(anna, policy, "c1", [VAT]) as unknown as Record<string, unknown>
    const answer = await call(t, "open_procedure", { name: "premie-zarzadu" })
    const end = step("open_procedure")
    expect(end?.ok).toBe(false)
    expect(end?.reason).toBe("no-such-procedure")
    // Model ma NIE zgadywać treści zasady, której nie dostał.
    expect(answer).toContain("Nie zgaduj")
    expect(answer).toContain("report_gap")
  })
})

describe("wskazówka trybu `paths` w opakowywaczu kroku", () => {
  beforeEach(() => {
    events.length = 0
  })

  it("dokleja się do ODPOWIEDZI DLA MODELU, a NIE do dowodu", async () => {
    // Sedno tego trybu i jedyne miejsce, w którym da się to pomylić: `summary` jest
    // dowodem, czyli zdaniem o tym, co się WYDARZYŁO. Podpowiedź nie jest zdarzeniem.
    const t = toolsForPolicy(anna, policy, "c1", [INVOICES]) as unknown as Record<string, unknown>
    const answer = await call(t, "read_file", { path: "Moje pliki/Faktury/08/f1.csv" })

    expect(answer).toContain("Faktury zakupowe")
    expect(answer).toContain("open_procedure")
    const end = step("read_file")
    expect(end?.ok).toBe(true)
    expect(end?.summary).not.toContain("Faktury zakupowe")
    expect(end?.summary).not.toContain("open_procedure")
  })

  it("milczy przy pliku spoza wskazanego katalogu", async () => {
    // Kontrola ujemna: wskazówka doklejana zawsze byłaby szumem w każdej odpowiedzi.
    const t = toolsForPolicy(anna, policy, "c1", [INVOICES]) as unknown as Record<string, unknown>
    const answer = await call(t, "read_file", { path: "Moje pliki/Umowy/u1.csv" })
    expect(answer).not.toContain("Faktury zakupowe")
  })

  it("nie powtarza się po tym, jak model już tę procedurę otworzył", async () => {
    // Zbiór otwartych żyje w domknięciu `toolsForPolicy`, czyli w zasięgu JEDNEJ tury.
    // Bez tego model dostawałby to samo zdanie przy każdym kolejnym pliku z katalogu.
    const t = toolsForPolicy(anna, policy, "c1", [INVOICES]) as unknown as Record<string, unknown>
    await call(t, "open_procedure", { name: "faktury-zakupowe" })
    const answer = await call(t, "read_file", { path: "Moje pliki/Faktury/08/f1.csv" })
    expect(answer).not.toContain("Otwórz ją czynnością")
  })

  it("tura BEZ procedur nie dokleja niczego", async () => {
    // Druga kontrola ujemna — na wdrożeniu bez ani jednej procedury odpowiedzi mają
    // wyglądać dokładnie tak, jak przed tą zmianą.
    const t = toolsForPolicy(anna, policy, "c1", []) as unknown as Record<string, unknown>
    const answer = await call(t, "read_file", { path: "Moje pliki/Faktury/08/f1.csv" })
    expect(answer).toBe("nr,netto\n1/08,1000\n")
  })
})
