// DECYZJA O PROŚBIE ZOSTAWIA JEDEN STAN, NIE TRZY RÓŻNE.
//
// DLACZEGO POWSTAŁ. Prośba „o coś spoza katalogu" (`capability: "other"`) nie ma czego
// nadać i ekran przełożonego słusznie nie rysuje przy niej przycisku nadania — jest tylko
// „Zamknij". Ale trasa dawała się zawołać wprost, a wtedy działy się trzy rzeczy naraz
// i każda mówiła co innego:
//
//   1. `update … set status='granted'`   → baza: PRZYZNANE
//   2. `return 400 notGrantable`         → wołający: BŁĄD
//   3. `audit.write(…)` za tym zwrotem   → dziennik: NIC SIĘ NIE STAŁO
//
// A prośby nie dało się już rozpatrzyć drugi raz — kolejne wywołanie odbijało się o 409
// „już rozstrzygnięta". Odmowa stała ZA zapisem zamiast przed nim.
//
// Ten plik pilnuje jednej zasady: gdy trasa odmawia, NIE ZOSTAWIA PO SOBIE ŚLADU —
// ani w bazie, ani w dzienniku. I kontroli ujemnej: gdy nie odmawia, zostawia oba.

import { beforeEach, describe, expect, it, vi } from "vitest"

let me = { id: "robert", role: "management", department: "management" }

/** Zapytania w kolejności — po nich widać, co trasa zdążyła zrobić przed odpowiedzią. */
const asked: string[] = []
const audited: string[] = []
let row = { who: "anna", capability: "other", status: "pending" }

vi.mock("@cortex/desk-ui/i18n/server", () => ({ deskT: async () => (key: string) => key }))
vi.mock("@cortex/desk-core/identity", () => ({ whoAmI: async () => me }))
vi.mock("@cortex/desk-core/audit-log", () => ({
  write: async (_who: string, what: string) => {
    audited.push(what)
  },
}))
vi.mock("@cortex/desk-core/db", () => ({
  migrate: async () => {},
  pool: {
    query: async (sql: string, params?: unknown[]) => {
      const one = sql.trim().split("\n")[0]!.trim()
      asked.push(one)
      if (one.startsWith("select")) return { rows: [row], rowCount: 1 }
      // PODKŁAD MUSI PAMIĘTAĆ ZAPIS. Bez tego test „prośba dalej czeka" przechodził
      // także na kodzie z usterką: prawdziwa baza zapisywała `granted`, więc drugie
      // wywołanie odbijało się o 409 — a podkład oddawał w kółko `pending` i udawał,
      // że wszystko gra. Strażnik, który nie widzi skutku, nie jest strażnikiem.
      if (one.startsWith("update desk.access_request set status"))
        row = { ...row, status: String(params?.[1] ?? row.status) }
      return { rows: [], rowCount: 1 }
    },
  },
}))

const { PATCH } = await import("./request")

const decide = (decision: string) =>
  PATCH(
    new Request("http://x/api/request/7", { method: "PATCH", body: JSON.stringify({ decision }) }),
    {
      params: Promise.resolve({ id: "7" }),
    },
  )

const wrote = () => asked.filter((z) => z.startsWith("update") || z.startsWith("insert"))

describe("prośba spoza katalogu", () => {
  beforeEach(() => {
    asked.length = 0
    audited.length = 0
    me = { id: "robert", role: "management", department: "management" }
    row = { who: "anna", capability: "other", status: "pending" }
  })

  it("nadania odmawia ZANIM cokolwiek zapisze", async () => {
    const r = await decide("granted")
    expect(r.status).toBe(400)
    // Sedno: żadnego `update`, żadnego `insert`, żadnego wpisu w dzienniku.
    expect(wrote()).toEqual([])
    expect(audited).toEqual([])
  })

  it("po odmowie prośba dalej CZEKA, więc da się ją zamknąć", async () => {
    // To jest szkoda, której nie widać w kodzie odpowiedzi: prośba przestawiona na
    // „rozstrzygnięta" odbijała każde kolejne wywołanie o 409 i zostawała na ekranie
    // przełożonego na zawsze.
    await decide("granted")
    const r = await decide("denied")
    expect(r.status).toBe(200)
    expect(wrote().some((z) => z.startsWith("update"))).toBe(true)
    expect(audited).toEqual(["request.denied"])
  })

  it("zamknięcie NIE tworzy zdolności o nazwie «other»", async () => {
    // Kontrola ujemna do samej odmowy: gdyby ktoś ją usunął jako zbędną, prośba opisowa
    // wsypałaby do `desk.grant` wiersz z nieistniejącą zdolnością.
    await decide("denied")
    expect(wrote().some((z) => z.startsWith("insert"))).toBe(false)
  })
})

describe("zwykła prośba o zdolność — kontrola ujemna", () => {
  beforeEach(() => {
    asked.length = 0
    audited.length = 0
    me = { id: "robert", role: "management", department: "management" }
    row = { who: "anna", capability: "code.run", status: "pending" }
  })

  it("nadanie zapisuje stan, zdolność i wpis do dziennika", async () => {
    const r = await decide("granted")
    expect(r.status).toBe(200)
    expect(wrote().some((z) => z.startsWith("update"))).toBe(true)
    expect(wrote().some((z) => z.startsWith("insert"))).toBe(true)
    expect(audited).toEqual(["request.granted"])
  })
})
