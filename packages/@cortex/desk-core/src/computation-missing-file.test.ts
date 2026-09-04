// OBLICZENIE NIE RUSZA BEZ PLIKU, PO KTÓRY SIĘGA — i mówi to po ludzku.
//
// DLACZEGO POWSTAŁ. `sandbox-mount.test.ts` dowodzi, że piaskownica UMIE powiedzieć,
// czego nie zamontowała. To jest drugie ogniwo tej samej poprawki i psuje się osobno:
// `run_computation` może tę listę dostać i ją zignorować — dokładnie tak, jak przez
// pół roku ignorował listę `produced` (patrz `sandbox-collect.test.ts`). Wtedy kod ruszy
// mimo braku, przewróci się na `FileNotFoundError`, a wszystko wygląda jak przedtem.
//
// Sprawdzamy dwie rzeczy, których nie da się sprawdzić jedną asercją: CO wraca (zdanie
// o braku, powód `no-such-file`) i czego NIE BYŁO (`exec` nie został wywołany ani razu).
// Druga jest ważniejsza: kod, który mimo braku ruszył, potrafi coś zapisać do teczki.

import { beforeEach, describe, expect, it, vi } from "vitest"
import type { DeskEvent, Policy, User } from "./types"

const events: DeskEvent[] = []
let missing: string[] = []
let outcome = { ok: true, output: "policzone" }
const execCalls: string[] = []

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
vi.mock("./memory", () => ({
  propose: async () => {},
  recallBlock: () => "",
  kept: async () => [],
}))
vi.mock("./people", () => ({ person: async () => null }))
vi.mock("./desk-storage", () => ({
  caseFolder: (_u: string, c: string) => `Sprawy/${c}`,
  read: async () => "",
  list: async () => [],
  write: async () => {},
  copy: async () => {},
}))

vi.mock("./sandbox", () => ({
  create: async () => ({
    id: "box",
    folder: "/tmp/box",
    missing,
    exec: async (code: string) => {
      execCalls.push(code)
      return outcome
    },
    collect: async () => ({ kept: [], skipped: [] }),
    dispose: async () => {},
  }),
}))

const { toolsForPolicy } = await import("./runtime")

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
  granted: [{ id: "code.run", department: "accounting" }],
  blocked: [],
  dailyLimitUsd: 1,
  fingerprint: "test",
} as unknown as Policy

const run = (files: string[]) =>
  (
    toolsForPolicy(anna, policy, "c1") as unknown as Record<
      string,
      { execute: (a: unknown, o: unknown) => Promise<string> }
    >
  ).run_computation!.execute({ description: "policz", code: "print(1)", files }, {})

const ended = () =>
  events.find((e) => e.type === "tool_end" && e.name === "run_computation") as
    Extract<DeskEvent, { type: "tool_end" }> | undefined

describe("brakujący plik zatrzymuje obliczenie", () => {
  beforeEach(() => {
    events.length = 0
    execCalls.length = 0
    missing = []
    outcome = { ok: true, output: "policzone" }
  })

  it("KOD NIE RUSZA, a krok kończy się powodem «nie ma pliku»", async () => {
    missing = ["Sprawy/c1/widmo.xlsx"]
    const answer = await run(["Sprawy/c1/widmo.xlsx"])

    expect(execCalls).toEqual([])
    const end = ended()
    expect(end?.ok).toBe(false)
    expect(end?.reason).toBe("no-such-file")
    // Człowiek czyta `summary` — i ma tam zobaczyć nazwę pliku, a nie słowo „błąd".
    expect(end?.summary).toContain("widmo.xlsx")
    expect(end?.summary).not.toContain("błąd wykonania")
    // Model ma dostać drogę wyjścia, a nie samą odmowę.
    expect(answer).toContain("list_files")
  })

  it("brak JEDNEGO z dwóch też zatrzymuje — nie liczymy z połowy danych", async () => {
    // Najgroźniejszy przypadek: wynik z dwóch faktur zamiast trzech wygląda prawidłowo
    // i nie ma na sobie żadnego znaku.
    missing = ["Sprawy/c1/widmo.xlsx"]
    await run(["Sprawy/c1/dane.csv", "Sprawy/c1/widmo.xlsx"])
    expect(execCalls).toEqual([])
    expect(ended()?.reason).toBe("no-such-file")
  })

  it("KONTROLA UJEMNA: gdy wszystko się zamontowało, kod rusza normalnie", async () => {
    // Bez tego strażnik przechodziłby także wtedy, gdyby `run_computation` przestał
    // uruchamiać cokolwiek.
    missing = []
    await run(["Sprawy/c1/dane.csv"])
    expect(execCalls).toEqual(["print(1)"])
    expect(ended()?.ok).toBe(true)
  })
})

describe("podpowiedź o pełnej ścieżce użytej w kodzie", () => {
  beforeEach(() => {
    events.length = 0
    execCalls.length = 0
    missing = []
    outcome = { ok: true, output: "policzone" }
  })

  const boom = (line: string) =>
    (outcome = {
      ok: false,
      output: `Traceback (most recent call last):\n  File "<string>"\n${line}`,
    })

  it("odpala się, gdy WYJĄTEK mówi o pliku, który leży pod samą nazwą", async () => {
    boom("FileNotFoundError: [Errno 2] No such file or directory: 'Sprawy/c1/dane.csv'")
    const answer = await run(["Sprawy/c1/dane.csv"])
    expect(answer).toContain("«Sprawy/c1/dane.csv» to «dane.csv»")
  })

  it("MILCZY, gdy ścieżka stoi w logu, a przewróciło się co innego", async () => {
    // Warunkiem była kiedyś obecność ścieżki w CAŁYM wyjściu, więc kod, który wypisał
    // ścieżkę w logu i padł na dzieleniu przez zero, dostawał poradę o nazwie pliku —
    // czyli wskazówkę mijającą się z jego błędem. Fałszywa podpowiedź w narzędziu, które
    // ma naprowadzać, jest gorsza niż jej brak.
    outcome = {
      ok: false,
      output: "wczytuję Sprawy/c1/dane.csv\nZeroDivisionError: division by zero",
    }
    const answer = await run(["Sprawy/c1/dane.csv"])
    expect(answer).not.toContain("pełnej ścieżki")
  })

  it("MILCZY, gdy obliczenie się udało", async () => {
    const answer = await run(["Sprawy/c1/dane.csv"])
    expect(answer).not.toContain("pełnej ścieżki")
  })

  it("MILCZY przy pliku bez katalogu — nie ma czego mylić", async () => {
    boom("FileNotFoundError: [Errno 2] No such file or directory: 'dane.csv'")
    const answer = await run(["dane.csv"])
    expect(answer).not.toContain("pełnej ścieżki")
  })
})
