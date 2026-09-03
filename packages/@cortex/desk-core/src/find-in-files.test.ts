// Czynność `find_in_files` — szukanie w plikach biegnące W TYM PROCESIE, bez bazy i bez modelu.
//
// DLACZEGO POWSTAŁ. Ta czynność jest pierwszą, która dotyka WIELU plików naraz, i przez to
// pierwszą, w której da się skrzywdzić człowieka ciszą, a nie błędem. Trzy własności, z których
// żadna nie broni się sama:
//
//   1. plik POMINIĘTY musi być POLICZONY i nazwany — plik ze wspólnej półki bez zgody,
//      plik nietekstowy, plik za duży. Odpowiedź „nic nie znalazłem" o katalogu pełnym
//      PDF-ów jest nieprawdą wypisaną z powagą, czyli najgorszym wynikiem w produkcie
//      księgowym: pani Basia nie ma jak się dowiedzieć, że nikt tam nie zaglądał;
//   2. obcięcie listy trafień musi MÓWIĆ O SOBIE — ten sam sufit bez zdania o sobie
//      zdarzył się w tym repozytorium już dwa razy (`read_file` podawał w dowodzie pełną
//      długość pliku, który uciął; `run_computation` mylił „za duże" z „nie udało się");
//   3. do „Co weszło" mają wejść pliki, których fragment NAPRAWDĘ trafił do odpowiedzi —
//      bo to one weszły do kontekstu modelu.

import { makeDeskT } from "@cortex/desk-ui/i18n/locale"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { DeskEvent, FileMeta, Policy, User } from "./types"

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

/**
 * Biurko na niby: ścieżka logiczna → treść i rozmiar. Rozmiar jest OSOBNY od treści, bo
 * prawdziwy `desk-storage` bierze go ze `stat`, a plik za duży trzeba móc postawić w korpusie
 * bez trzymania dwóch megabajtów w pamięci testu.
 */
const disk = new Map<string, { text: string; size?: number }>()

vi.mock("./desk-storage", () => ({
  caseFolder: (_u: string, id: string) => `Sprawy/${id}`,
  /** Jedno piętro naraz, razem z katalogami — dokładnie tak, jak oddaje to prawdziwa lista. */
  list: async (_user: string, folder: string): Promise<FileMeta[]> => {
    const prefix = `${folder}/`
    const entries = new Map<string, FileMeta>()
    for (const [path, file] of disk) {
      if (!path.startsWith(prefix)) continue
      const rest = path.slice(prefix.length)
      const slash = rest.indexOf("/")
      if (slash < 0) {
        entries.set(path, {
          path,
          name: rest,
          folder: false,
          size: file.size ?? file.text.length,
          modifiedAt: "2026-09-03T00:00:00.000Z",
        })
      } else {
        const child = `${prefix}${rest.slice(0, slash)}`
        entries.set(child, {
          path: child,
          name: rest.slice(0, slash),
          folder: true,
          size: 0,
          modifiedAt: "2026-09-03T00:00:00.000Z",
        })
      }
    }
    return [...entries.values()]
  },
  read: async (_user: string, path: string) => {
    const file = disk.get(path)
    if (!file) throw new Error("ENOENT")
    return file.text
  },
  readBinary: async () => Buffer.from(""),
  write: async () => {},
  copy: async () => "",
}))

const { toolsForPolicy } = await import("./runtime")
const { evidenceFromEvents } = await import("./evidence")

const translate = makeDeskT("pl")

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

const search = async (given: Policy, args: { query: string; folder?: string }) => {
  const tools = toolsForPolicy(anna, given, "c1")
  const one = tools.find_in_files as unknown as Executable
  return String(await one.execute(args, {}))
}

/** Para zdarzeń jednego kroku, dopasowana po `id` — tak jak robi to ekran. */
function step(name: string) {
  const start = events.find((e) => e.type === "tool_start" && e.name === name)
  const id = (start as { id?: string } | undefined)?.id
  const end = events.find((e) => e.type === "tool_end" && (e as { id?: string }).id === id)
  return { start, end: end as Extract<DeskEvent, { type: "tool_end" }> | undefined }
}

const put = (path: string, text: string, size?: number) =>
  disk.set(path, size === undefined ? { text } : { text, size })

beforeEach(() => {
  events.length = 0
  disk.clear()
})

describe("szukanie w plikach", () => {
  it("bez zdolności czytania model w ogóle jej nie widzi", () => {
    // Filtr stoi NA ODKRYCIU. Osobnej zdolności ta czynność nie ma i mieć nie ma:
    // szukanie JEST czytaniem, a nowa kłódka stanęłaby pani Basi w podstawowym zadaniu.
    expect(toolsForPolicy(anna, policy("files.list"), "c1").find_in_files).toBeUndefined()
    expect(toolsForPolicy(anna, policy("files.read"), "c1").find_in_files).toBeDefined()
  })

  it("trafienie wraca ze ŚCIEŻKĄ i z fragmentem, w którym widać kontekst", async () => {
    put(
      "Moje pliki/faktury-08.csv",
      "data;numer;kontrahent;kwota\n2026-08-14;FV/2026/08/117;Orange Polska S.A.;1 230,00\n2026-08-15;FV/2026/08/118;Enea S.A.;540,00",
    )
    put("Moje pliki/notatki.txt", "nic tu nie ma")

    const answer = await search(policy("files.read"), { query: "orange" })

    // Ścieżka, bo bez niej model nie ma czego otworzyć ani czego wymienić człowiekowi.
    expect(answer).toContain("Moje pliki/faktury-08.csv")
    // Fragment, bo sama ścieżka nie mówi, czy to jest to, czego szukamy.
    expect(answer).toContain("Orange Polska S.A.")
    // Numer wiersza — pani Basia otwiera plik i patrzy w to samo miejsce.
    expect(answer).toContain("faktury-08.csv:2")
    // Wielkość liter nie może decydować: człowiek pisze „orange", w pliku stoi „Orange".
    expect(answer).toMatch(/Trafienia: 1/)

    const { end } = step("find_in_files")
    expect(end, "brak tool_end — krok zostałby „w toku” na zawsze").toBeTruthy()
    expect(end!.ok).toBe(true)
    expect(end!.summary).toContain("trafienia: 1")
    // Ile plików przeszukano, mówi PODSUMOWANIE — to jedyne miejsce, w którym człowiek
    // zobaczy, że pusty wynik nie znaczy pustego katalogu.
    expect(end!.summary).toContain("przeszukane: 2")
  })

  it("plik ze wspólnej półki jest pominięty bez `shared.read` i POLICZONY w podsumowaniu", async () => {
    put("Wspólne pliki/cennik.csv", "usługa;cena\nOrange hurt;1 000,00")

    const answer = await search(policy("files.read"), { query: "orange", folder: "Wspólne pliki" })
    const { end } = step("find_in_files")

    // Cisza jest tu zakazana: pominięcie ma być POLICZONE i powiedziane.
    expect(end!.summary).toContain("bez wglądu we wspólne: 1")
    expect(answer).toContain("Pominięte, bo leżą na wspólnej półce: 1")
    // I z drogą wyjścia, a nie samą odmową — brama pisze to zdanie sama, jednym miejscem.
    expect(answer).toContain("przełożonego")
    // Nazwa pliku ze wspólnej półki jest treścią, której ta osoba nie ma prawa zobaczyć.
    expect(answer).not.toContain("cennik.csv")
    expect(answer).toContain("Ani jednego trafienia")
    // Brama pominęła plik, ale czynność się UDAŁA — to nie jest awaria szukania.
    expect(end!.ok).toBe(true)
  })

  it("ta sama półka ze zgodą JEST przeszukana — kontrola negatywna bramy", async () => {
    // Bez tego test wyżej byłby zielony także wtedy, gdyby czynność nie przeszukiwała
    // wspólnej półki NIGDY, i nikt by się nie dowiedział.
    put("Wspólne pliki/cennik.csv", "usługa;cena\nOrange hurt;1 000,00")

    const answer = await search(policy("files.read", "shared.read"), {
      query: "orange",
      folder: "Wspólne pliki",
    })
    expect(answer).toContain("Wspólne pliki/cennik.csv")
    expect(step("find_in_files").end!.summary).toContain("przeszukane: 1")
  })

  it("plik nietekstowy jest pominięty i NAZWANY jako ten do rozpoznania", async () => {
    // To jest moment, w którym produkt przestaje działać po cichu: 24 faktury w PDF-ach,
    // szukanie nie znajduje nic, bo to nie jest tekst, a człowiek słyszy „nie ma".
    put("Moje pliki/faktura-117.pdf", "%PDF-1.4 udawany")
    put("Moje pliki/notatki.txt", "nic tu nie ma")

    const answer = await search(policy("files.read", "document.read"), { query: "orange" })
    const { end } = step("find_in_files")

    expect(end!.summary).toContain("nietekstowe: 1")
    expect(answer).toContain("faktura-117.pdf")
    // Nie dość, że jest — ma być powiedziane, KTĘDY się do niego dostać.
    expect(answer).toContain("read_document")
    // I ostrzeżenie wprost, bo to model pisze zdanie, które przeczyta pani Basia.
    expect(answer).toMatch(/nie mów człowiekowi, że czegoś tam nie ma/i)
    expect(answer).toContain("Ani jednego trafienia")
  })

  it("plik za duży jest pominięty, policzony i nazwany", async () => {
    put("Moje pliki/eksport.csv", "Orange;1", 9_000_000)
    put("Moje pliki/notatki.txt", "nic tu nie ma")

    const answer = await search(policy("files.read"), { query: "orange" })

    expect(step("find_in_files").end!.summary).toContain("za duże: 1")
    expect(answer).toContain("eksport.csv")
    expect(answer).toContain("read_file")
  })

  it("obcięta lista trafień MÓWI O SOBIE — i mówi, ile ich było naprawdę", async () => {
    // Sufit stoi na WYNIKU, nie na wejściu: 5000 dokumentów przechodzi w 339 ms, ale niesie
    // 743 trafienia. Turę zabijają trafienia, więc to je ograniczamy — i mówimy o tym.
    const many = Array.from({ length: 150 }, (_, i) => `${i};Orange Polska;100,00`).join("\n")
    put("Moje pliki/faktury-08.csv", many)

    const answer = await search(policy("files.read"), { query: "orange" })
    const { end } = step("find_in_files")

    expect(end!.summary).toContain("trafienia: 150")
    expect(end!.summary).toContain("pokazane pierwsze: 100")
    expect(answer).toContain("POWYŻEJ JEST PIERWSZE 100 TRAFIEŃ")
    // Liczba, której nie widać, ma być powiedziana — inaczej wynik ucięty jest
    // nieodróżnialny od kompletnego.
    expect(answer).toContain("Trafienia: 150")
    // Sto wierszy, ani jednego więcej.
    expect(answer.split("\n").filter((one) => one.includes("faktury-08.csv:"))).toHaveLength(100)
  })

  it("korpus bez ani jednego trafienia mówi to WPROST, a nie milczy", async () => {
    put("Moje pliki/notatki.txt", "spotkanie w czwartek")
    put("Moje pliki/lista.csv", "pozycja;ilość\nkawa;2")

    const answer = await search(policy("files.read"), { query: "orange" })

    expect(answer).toContain("Ani jednego trafienia")
    // Razem z liczbą przeszukanych — bez niej „nie ma" nie różni się od „nie szukałem".
    expect(answer).toContain("Przeszukane pliki: 2")
    expect(step("find_in_files").end!.ok, "pusty wynik to nie jest awaria").toBe(true)
  })

  it("szuka także w podkatalogach", async () => {
    put("Moje pliki/2026/08/faktury.csv", "FV/117;Orange Polska;1 230,00")

    const answer = await search(policy("files.read"), { query: "orange" })
    expect(answer).toContain("Moje pliki/2026/08/faktury.csv")
  })

  it("katalog, do którego nie dało się zajrzeć, WYWRACA szukanie zamiast oddać pustkę", async () => {
    // Po cichu pominięty katalog dałby „nic nie znalazłem" o korpusie, którego nikt
    // nie oglądał — czyli cichą złą odpowiedź.
    const storage = await import("./desk-storage")
    vi.spyOn(storage, "list").mockRejectedValueOnce(new Error("dysk niedostępny"))

    const answer = await search(policy("files.read"), { query: "orange" })
    const { end } = step("find_in_files")

    expect(end!.ok).toBe(false)
    expect(end!.reason, "nieudany krok bez powodu").toBe("cannot-open")
    expect(answer).toContain("list_files")
  })
})

describe("dowód po szukaniu", () => {
  it("wymienia w „Co weszło” pliki Z TRAFIENIAMI, a liczbę przeszukanych w podsumowaniu", async () => {
    // To jest wymóg całej czynności ujęty jednym zdaniem: do kontekstu modelu weszły
    // wyłącznie pliki, których fragment naprawdę wrócił — i tylko one mają prawo stać
    // w „Co weszło". Wypisanie tam 5000 przeszukanych byłoby nieczytelne, a wypisanie
    // pliku bez trafienia — nieprawdziwe.
    put("Moje pliki/faktury-08.csv", "FV/117;Orange Polska;1 230,00")
    put("Moje pliki/notatki.txt", "spotkanie w czwartek")

    await search(policy("files.read"), { query: "orange" })
    const evidence = evidenceFromEvents(events, translate)

    expect(evidence.intake).toContain("znaleziono w: Moje pliki/faktury-08.csv")
    // Plik bez trafienia został przeszukany, ale do sprawy nie wniósł NICZEGO.
    expect(evidence.intake.join(" ")).not.toContain("notatki.txt")
    // Liczby idą wierszem podsumowania, nie listą plików.
    expect(evidence.intake.some((one) => one.startsWith("przeszukano pliki —"))).toBe(true)
    expect(evidence.intake.join(" ")).toContain("przeszukane: 2")
  })

  it("szukanie stoi po stronie CZYTANIA, nie liczenia", async () => {
    // Gdyby czynność wylądowała w „Co zrobione" jako obliczenie, dowód mówiłby
    // „policzono" o czymś, po czym w teczce nie przybyło nic.
    put("Moje pliki/faktury-08.csv", "FV/117;Orange Polska;1 230,00")

    await search(policy("files.read"), { query: "orange" })
    const evidence = evidenceFromEvents(events, translate)

    expect(evidence.produced).toEqual([])
    expect(evidence.intake.length).toBeGreaterThan(0)
  })
})
