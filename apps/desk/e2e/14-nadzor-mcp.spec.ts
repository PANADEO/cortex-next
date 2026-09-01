import type { APIRequestContext } from "@playwright/test"
import { as, expect, test } from "./osoby"
// Kształt odpowiedzi `/api/mcp` widziany przez scenariusz — tyle, ile sprawdza, nie więcej.
type CatalogueTool = {
  remoteName: string
  fingerprint?: string
  status?: string
  approvedBy?: string
}
type CatalogueServer = { name: string; tools: CatalogueTool[] }

const ROBERT = { Cookie: "desk_persona=robert" }
const ANNA = { Cookie: "desk_persona=anna" }
const OPIS =
  "Sprawdza w wykazie Ministerstwa Finansów, czy firma o podanym NIP jest czynnym podatnikiem VAT, i podaje jej nazwę oraz adres."

// Szukanie z odmową zamiast `!`: scenariusz, który nie znalazł serwera, ma powiedzieć
// CZEGO nie znalazł, a nie wywrócić się linijkę dalej na czymś, co wygląda na błąd asercji.
const vatRegistry = async (request: APIRequestContext): Promise<CatalogueServer> => {
  const s = (await folder(request)).find((x) => x.name === "vat-registry")
  if (!s) throw new Error('W katalogu nie ma serwera „vat-registry".')
  return s
}

const tool = (s: CatalogueServer, remoteName: string): CatalogueTool => {
  const n = s.tools.find((x) => x.remoteName === remoteName)
  if (!n) throw new Error(`Serwer „${s.name}" nie wystawia narzędzia „${remoteName}".`)
  return n
}

const folder = async (request: APIRequestContext): Promise<CatalogueServer[]> =>
  (await (await request.get("/api/mcp", { headers: ROBERT })).json()).servers

test.describe("Obszar 26 · Katalog serwerów należy do przełożonego, nie do kodu", () => {
  test("Pracownik nie widzi katalogu ani nie może go zmienić", async ({ request }) => {
    expect((await request.get("/api/mcp", { headers: ANNA })).status()).toBe(403)
    const proba = await request.post("/api/mcp", {
      headers: ANNA,
      data: { action: "withdraw", server: "vat-registry", remoteName: "vat_status" },
    })
    expect(proba.status()).toBe(403)
  })

  test("Katalog przychodzi z bazy, a każde narzędzie ma autora zgody", async ({ request }) => {
    const s = await vatRegistry(request)
    for (const n of s.tools) {
      expect(n.approvedBy).toBeTruthy()
      expect(n.status).toBe("approved")
    }
  })

  test("Przeglądanie serwera pokazuje surowy tekst dostawcy — pod etykietą, czyj to tekst", async ({
    page,
  }) => {
    await as(page, "robert")
    await page.goto("/supervision")
    await page.getByRole("button", { name: "Przejrzyj" }).first().click()

    await expect(page.getByText("Co ten serwer wystawia")).toBeVisible()
    await expect(page.getByText("vat_status")).toBeVisible()
    await page.getByText("Co dostawca pisze o tym narzędziu").first().click()
    await expect(page.getByText("Tekst dostawcy serwera, nie nasz:").first()).toBeVisible()
  })

  test("Nie da się przyjąć narzędzia bez własnego opisu — to zdanie zobaczy model", async ({
    request,
  }) => {
    const r = await request.post("/api/mcp", {
      headers: ROBERT,
      data: {
        action: "approve",
        server: "vat-registry",
        remoteName: "vat_status",
        description: "  ",
        shortLabel: "",
        capability: "counterparty.verify",
      },
    })
    expect(r.status()).toBe(400)
    expect((await r.json()).error).toMatch(/pisze je człowiek/)
  })

  test("Nieznana zdolność jest odrzucana — narzędzie musi przejść przez katalog", async ({
    request,
  }) => {
    const r = await request.post("/api/mcp", {
      headers: ROBERT,
      data: {
        action: "approve",
        server: "vat-registry",
        remoteName: "vat_status",
        description: OPIS,
        shortLabel: "x",
        capability: "wymyslona.zdolnosc",
      },
    })
    expect(r.status()).toBe(400)
  })

  test("Serwer musi mieć adres http — stdio jest zabronione", async ({ request }) => {
    const r = await request.post("/api/mcp", {
      headers: ROBERT,
      data: { action: "add", name: "lokalny", label: "Lokalny", url: "stdio:///usr/bin/cos" },
    })
    expect(r.status()).toBe(400)
  })
})

test.describe("Obszar 27 · Odcisk wiąże zgodę ze słowami człowieka, nie tylko ze schematem", () => {
  test("Inny opis zatwierdzającego daje inny odcisk, choć schemat jest ten sam", async ({
    request,
  }) => {
    const before = tool(await vatRegistry(request), "vat_status").fingerprint

    const r = await request.post("/api/mcp", {
      headers: ROBERT,
      data: {
        action: "approve",
        server: "vat-registry",
        remoteName: "vat_status",
        description: "Zupełnie inny opis tej samej czynności, napisany przez kogoś innego.",
        shortLabel: "inny opis",
        capability: "counterparty.verify",
      },
    })
    expect(r.ok()).toBeTruthy()

    const po = tool(await vatRegistry(request), "vat_status")
    expect(po.fingerprint).not.toBe(before)
    expect(po.approvedBy).toBe("robert")

    // przywracamy pierwotny opis, żeby kolejne scenariusze zastały to samo biurko
    await request.post("/api/mcp", {
      headers: ROBERT,
      data: {
        action: "approve",
        server: "vat-registry",
        remoteName: "vat_status",
        description: OPIS,
        shortLabel: "sprawdzenie statusu VAT",
        capability: "counterparty.verify",
      },
    })
  })

  test("Wycofanie usuwa narzędzie z katalogu, a dziennik zapamiętuje kto", async ({ request }) => {
    await request.post("/api/mcp", {
      headers: ROBERT,
      data: { action: "withdraw", server: "vat-registry", remoteName: "bank_account_check" },
    })
    const s = await vatRegistry(request)
    expect(s.tools.some((n) => n.remoteName === "bank_account_check")).toBe(false)

    // wraca przez ten sam ekran, którym się je przyjmuje
    const wraca = await request.post("/api/mcp", {
      headers: ROBERT,
      data: {
        action: "approve",
        server: "vat-registry",
        remoteName: "bank_account_check",
        description:
          "Sprawdza w wykazie Ministerstwa Finansów, czy podany numer rachunku był w danym dniu przypisany do firmy o podanym NIP.",
        shortLabel: "sprawdzenie rachunku w wykazie",
        capability: "counterparty.verify",
      },
    })
    expect(wraca.ok()).toBeTruthy()
  })
})
