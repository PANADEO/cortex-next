// KOD Z MODELU NIE URUCHAMIA SIĘ BEZ PRAWDZIWEJ PIASKOWNICY.
//
// DLACZEGO POWSTAŁ — i to jest najgorsza rzecz, jaką znalazłem w tym produkcie.
//
// `sandbox.ts` ma dwie gałęzie. Pierwsza to demon `cortex-sandbox`: kontener bez sieci,
// rootfs tylko do odczytu, uid 65534. Druga to `node --permission` — odcina system plików
// i NIE ZAMYKA SIECI, co mówi wprost jej własny komentarz. O tym, która pobiegnie,
// rozstrzyga obecność `DESK_SANDBOX_SOCKET`.
//
// Tej zmiennej NIE USTAWIAŁ ŻADEN plik uruchomieniowy — w obu `docker-compose` stało
// `${DESK_SANDBOX_SOCKET:-}`, czyli pusto. Domyślnym stanem każdego wdrożenia był więc
// kod napisany przez model językowy, puszczony na dokumentach klienta, z otwartym
// internetem. I nikt się o tym nie dowiadywał, bo brak zmiennej znaczył „ścieżka
// zastępcza", a nie „błąd" — dokładnie ta klasa cichego zejścia, którą ten produkt
// tępi wszędzie indziej.
//
// Filtr stoi NA ODKRYCIU, tak jak przy zdolnościach: czynności nie ma w zestawie, więc
// model jej nie widzi i nie może o nią poprosić. Wdrożenie, które godzi się na słabszą
// izolację, mówi to wprost zmienną — a wtedy jest to podpis pod decyzją, nie przeoczenie.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Policy, User } from "./types"

vi.mock("server-only", () => ({}))
vi.mock("./db", () => ({ migrate: async () => {}, pool: { query: async () => ({ rows: [] }) } }))
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

const { toolsForPolicy } = await import("./runtime")

const robert = {
  id: "robert",
  email: "robert@itsg.pl",
  firstName: "Robert",
  lastName: "Nowak",
  department: "management",
  role: "management",
  quickTasks: [],
} as unknown as User

/** Robert MA `code.run` — cały ten plik jest o tym, że sama zdolność nie wystarcza. */
const policy = {
  user: "robert",
  role: "management",
  granted: [
    { id: "code.run", department: "management" },
    // `files.read` jest tu po to, żeby kontrola pozytywna niżej mierzyła FILTR,
    // a nie pusty zestaw: bez niej „nie ma run_computation" byłoby prawdą także wtedy,
    // gdyby `toolsForPolicy` przestało oddawać cokolwiek.
    { id: "files.read", department: "management" },
  ],
  blocked: [],
  dailyLimitUsd: 5,
  fingerprint: "test",
} as unknown as Policy

const names = () => Object.keys(toolsForPolicy(robert, policy, "c1") as object)

const before = { ...process.env }
beforeEach(() => {
  delete process.env["DESK_SANDBOX_SOCKET"]
  delete process.env["DESK_ALLOW_WEAK_SANDBOX"]
})
afterEach(() => {
  process.env = { ...before }
})

describe("czynność licząca a stan piaskownicy", () => {
  it("BEZ demona i bez zgody — czynności NIE MA w zestawie", () => {
    // Sedno. Nie „odmawia po wywołaniu", tylko nie istnieje: model nie zobaczy jej
    // w spisie, więc nie napisze kodu, który i tak nie miałby gdzie pobiec.
    expect(names()).not.toContain("run_computation")
    // Kontrola pozytywna: zestaw NIE jest pusty, czyli mierzymy filtr, a nie awarię.
    expect(names()).toContain("read_file")
  })

  it("Z demonem — czynność wchodzi normalnie", () => {
    process.env["DESK_SANDBOX_SOCKET"] = "/run/cortex-sandbox/sandbox.sock"
    expect(names()).toContain("run_computation")
  })

  it("bez demona, ale z JAWNĄ zgodą wdrożenia — wchodzi", () => {
    // Ścieżka zastępcza zostaje możliwa, ale wyłącznie jako deklaracja w pliku
    // uruchomieniowym. Kto ją włączy, ma to napisane u siebie.
    process.env["DESK_ALLOW_WEAK_SANDBOX"] = "1"
    expect(names()).toContain("run_computation")
  })

  it("zgoda musi być DOKŁADNIE «1» — «true» ani «yes» nie otwierają furtki", () => {
    // Bez tego „DESK_ALLOW_WEAK_SANDBOX=false" włączałoby słabą piaskownicę, bo każdy
    // niepusty napis jest w JavaScripcie prawdą. Ta pomyłka czyta się jak wyłączenie.
    for (const value of ["true", "yes", "0", "false", ""]) {
      process.env["DESK_ALLOW_WEAK_SANDBOX"] = value
      expect(names()).not.toContain("run_computation")
    }
  })

  it("KONTROLA UJEMNA: bez zdolności `code.run` demon niczego nie nadaje", () => {
    // Piaskownica jest WARUNKIEM, nie uprawnieniem. Gdyby zdanie brzmiało „albo",
    // każdy pracownik dostałby uruchamianie kodu w chwili podłączenia demona.
    process.env["DESK_SANDBOX_SOCKET"] = "/run/cortex-sandbox/sandbox.sock"
    const anna = { ...robert, id: "anna", role: "member" } as unknown as User
    const bezKodu = { ...policy, user: "anna", role: "member", granted: [] } as unknown as Policy
    expect(Object.keys(toolsForPolicy(anna, bezKodu, "c1") as object)).not.toContain(
      "run_computation",
    )
  })
})
