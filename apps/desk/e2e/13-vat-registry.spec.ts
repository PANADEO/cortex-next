import { evidenceFromEvents } from "@cortex/desk-core/evidence"
import { SERVER_CATALOGUE, VAT_REGISTRY_TOOLS } from "@cortex/desk-core/mcp/catalogue"
import type { DeskEvent } from "@cortex/desk-core/types"
import type { APIRequestContext } from "@playwright/test"
import { expect, test } from "./osoby"

const ANNA = { Cookie: "desk_persona=anna" }
const ROBERT = { Cookie: "desk_persona=robert" }
const NIP_MF = "5260250274"

/** Nadanie przez przełożonego — tą samą drogą, którą klika się w Nadzorze. */
async function nadaj(request: APIRequestContext, capability: string) {
  await request.post("/api/request", { headers: ANNA, data: { capability } })
  const moje = await (await request.get("/api/request", { headers: ANNA })).json()
  const p = moje.requests.find((x: { capability: string }) => x.capability === capability)
  const r = await request.patch("/api/request", {
    headers: ROBERT,
    data: { id: p.id, decision: "granted" },
  })
  expect(r.ok()).toBeTruthy()
}

async function turn(request: APIRequestContext, title: string, text: string) {
  const { id } = await (
    await request.post("/api/case/new", { headers: ANNA, data: { title } })
  ).json()
  const start = await request.post(`/api/case/${id}/turn`, { headers: ANNA, data: { text } })
  // odmowa (np. wyczerpany dzienny limit) ma zgasić test od razu i po imieniu,
  // a nie udawać tury, która się nie kończy przez sto sześćdziesiąt sekund
  if (!start.ok())
    throw new Error(`tura odrzucona (${start.status()}): ${(await start.text()).slice(0, 200)}`)
  for (let i = 0; i < 80; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const d = await (await request.get(`/api/case/${id}/events`, { headers: ANNA })).json()
    if (d.caseFile.status !== "working" && d.caseFile.status !== "new")
      return { id, events: d.events as { event: DeskEvent }[] }
  }
  throw new Error("tura się nie skończyła")
}

const names = (z: { event: DeskEvent }[]) =>
  z.filter((x) => x.event.type === "tool_start").map((x) => (x.event as { name: string }).name)

test.describe("Obszar 24 · Zdolność sięgająca poza firmę przechodzi tą samą bramą", () => {
  test("Wykaz jest zatwierdzony narzędzie po narzędziu, nie w całości", () => {
    expect(VAT_REGISTRY_TOOLS.length).toBeGreaterThan(1)
    // każde narzędzie ma własny odcisk i własny opis pisany po polsku przez człowieka
    for (const n of VAT_REGISTRY_TOOLS) {
      expect(n.fingerprint).toMatch(/^[0-9a-f]{64}$/)
      expect(n.description.length).toBeGreaterThan(40)
      expect(n.shortLabel.length).toBeLessThan(40)
      expect(n.capabilityId).toBe("counterparty.verify")
    }
    // odciski są RÓŻNE — inaczej zgoda na jedno narzędzie otwierałaby drugie
    expect(new Set(VAT_REGISTRY_TOOLS.map((n) => n.fingerprint)).size).toBe(
      VAT_REGISTRY_TOOLS.length,
    )
  })

  test("Instancja bez skonfigurowanego adresu nie zna żadnego serwera", () => {
    // zatwierdzenia zostają danymi, ale bez adresu nic się nie rejestruje
    if (!process.env.MCP_VAT_REGISTRY_URL) expect(SERVER_CATALOGUE).toHaveLength(0)
    else expect(SERVER_CATALOGUE[0]?.tools).toEqual(VAT_REGISTRY_TOOLS)
  })

  test(
    "Bez zgody przełożonego agent nie dostaje narzędzia z wykazu, tylko zgłasza brak",
    { tag: "@model" },
    async ({ request }) => {
      test.setTimeout(200_000)
      await request.post("/api/test/reset-permissions")
      const { events } = await turn(
        request,
        "Kontrahent bez zgody",
        `Sprawdź w wykazie, czy firma o NIP ${NIP_MF} jest czynnym podatnikiem VAT.`,
      )

      // filtr na odkryciu: narzędzia po prostu nie ma w rejestrze modelu
      expect(names(events).filter((n) => n.startsWith("mcp_"))).toHaveLength(0)
      expect(events.some((x) => x.event.type === "blocked")).toBeTruthy()
    },
  )

  test(
    "Po nadaniu agent naprawdę odpytuje wykaz Ministerstwa Finansów",
    { tag: "@model" },
    async ({ request }) => {
      test.setTimeout(200_000)
      await request.post("/api/test/reset-permissions")
      await nadaj(request, "counterparty.verify")

      const { events } = await turn(
        request,
        "Kontrahent po zgodzie",
        `Sprawdź w wykazie, czy firma o NIP ${NIP_MF} jest czynnym podatnikiem VAT i jak się nazywa.`,
      )

      expect(names(events)).toContain("mcp_vat_registry_vat_status")
      const koniec = events.find((x) => x.event.type === "tool_end")
      expect((koniec!.event as { ok: boolean }).ok).toBe(true)
      // odpowiedź pochodzi z wykazu, nie z pamięci modelu
      const odpowiedz = events
        .filter((x) => x.event.type === "assistant")
        .map((x) => (x.event as { text: string }).text)
        .join(" ")
      expect(odpowiedz).toMatch(/MINISTERSTWO FINANSÓW|Ministerstwo Finansów/i)
    },
  )
})

test.describe("Obszar 25 · Odpowiedź obcego serwera nie udaje wykonanej pracy", () => {
  const obce: DeskEvent[] = [
    {
      type: "tool_start",
      id: "z",
      name: "mcp_vat_registry_bank_account_check",
      label: "sprawdzenie rachunku w wykazie",
      source: "wykaz podatników VAT",
      args: { nip: NIP_MF },
    },
    {
      type: "tool_end",
      id: "z",
      name: "mcp_vat_registry_bank_account_check",
      ok: true,
      summary: "serwer odpowiedział",
      ms: 110,
    },
  ]

  test("Odpytanie trafia do osobnej listy, nie między rzeczy zrobione", () => {
    const d = evidenceFromEvents(obce)
    expect(d.external).toHaveLength(1)
    expect(d.produced).toHaveLength(0)
    expect(d.intake).toHaveLength(0)
  })

  test("Wiersz nazywa źródło po ludzku, a nie kluczem narzędzia", () => {
    const [w] = evidenceFromEvents(obce).external
    expect(w).toContain("wykaz podatników VAT")
    expect(w).toContain("sprawdzenie rachunku w wykazie")
    expect(w).not.toContain("mcp_")
  })

  test(
    "Przebieg mówi o odpytaniu wykazu, nie o slugu serwera",
    { tag: "@model" },
    async ({ page, request }) => {
      test.setTimeout(200_000)
      await request.post("/api/test/reset-permissions")
      await nadaj(request, "counterparty.verify")
      const { id } = await turn(
        request,
        "Wykaz na ekranie",
        `Sprawdź w wykazie status VAT firmy o NIP ${NIP_MF}.`,
      )

      await page
        .context()
        .addCookies([{ name: "desk_persona", value: "anna", url: "http://localhost:3210" }])
      await page.goto(`/case/${id}`)
      await expect(page.getByText("wykaz podatników VAT").first()).toBeVisible()
      await expect(page.getByText("Pytałem poza firmą:")).toBeVisible()
      // najważniejsze: odpytanie obcego serwera NIE jest opisane jako sprawdzone
      await expect(page.getByText("Sprawdzone:")).toHaveCount(0)
    },
  )
})
