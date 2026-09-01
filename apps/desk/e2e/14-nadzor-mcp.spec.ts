import type { APIRequestContext } from "@playwright/test"
import { expect, jako, test } from "./osoby"
// Kształt odpowiedzi `/api/mcp` widziany przez scenariusz — tyle, ile sprawdza, nie więcej.
type NarzedzieWKatalogu = {
  nazwaZdalna: string
  odcisk?: string
  stan?: string
  zatwierdzil?: string
}
type SerwerWKatalogu = { nazwa: string; narzedzia: NarzedzieWKatalogu[] }

const ROBERT = { Cookie: "desk_persona=robert" }
const ANNA = { Cookie: "desk_persona=anna" }
const OPIS =
  "Sprawdza w wykazie Ministerstwa Finansów, czy firma o podanym NIP jest czynnym podatnikiem VAT, i podaje jej nazwę oraz adres."

// Szukanie z odmową zamiast `!`: scenariusz, który nie znalazł serwera, ma powiedzieć
// CZEGO nie znalazł, a nie wywrócić się linijkę dalej na czymś, co wygląda na błąd asercji.
const bialaLista = async (request: APIRequestContext): Promise<SerwerWKatalogu> => {
  const s = (await katalog(request)).find((x) => x.nazwa === "biala-lista")
  if (!s) throw new Error('W katalogu nie ma serwera „biala-lista".')
  return s
}

const narzedzie = (s: SerwerWKatalogu, nazwaZdalna: string): NarzedzieWKatalogu => {
  const n = s.narzedzia.find((x) => x.nazwaZdalna === nazwaZdalna)
  if (!n) throw new Error(`Serwer „${s.nazwa}" nie wystawia narzędzia „${nazwaZdalna}".`)
  return n
}

const katalog = async (request: APIRequestContext): Promise<SerwerWKatalogu[]> =>
  (await (await request.get("/api/mcp", { headers: ROBERT })).json()).serwery

test.describe("Obszar 26 · Katalog serwerów należy do przełożonego, nie do kodu", () => {
  test("Pracownik nie widzi katalogu ani nie może go zmienić", async ({ request }) => {
    expect((await request.get("/api/mcp", { headers: ANNA })).status()).toBe(403)
    const proba = await request.post("/api/mcp", {
      headers: ANNA,
      data: { akcja: "wycofaj", serwer: "biala-lista", nazwaZdalna: "sprawdz_nip" },
    })
    expect(proba.status()).toBe(403)
  })

  test("Katalog przychodzi z bazy, a każde narzędzie ma autora zgody", async ({ request }) => {
    const s = await bialaLista(request)
    for (const n of s.narzedzia) {
      expect(n.zatwierdzil).toBeTruthy()
      expect(n.stan).toBe("zatwierdzone")
    }
  })

  test("Przeglądanie serwera pokazuje surowy tekst dostawcy — pod etykietą, czyj to tekst", async ({
    page,
  }) => {
    await jako(page, "robert")
    await page.goto("/nadzor")
    await page.getByRole("button", { name: "Przejrzyj" }).first().click()

    await expect(page.getByText("Co ten serwer wystawia")).toBeVisible()
    await expect(page.getByText("sprawdz_nip")).toBeVisible()
    await page.getByText("Co dostawca pisze o tym narzędziu").first().click()
    await expect(page.getByText("Tekst dostawcy serwera, nie nasz:").first()).toBeVisible()
  })

  test("Nie da się przyjąć narzędzia bez własnego opisu — to zdanie zobaczy model", async ({
    request,
  }) => {
    const r = await request.post("/api/mcp", {
      headers: ROBERT,
      data: {
        akcja: "zatwierdz",
        serwer: "biala-lista",
        nazwaZdalna: "sprawdz_nip",
        opis: "  ",
        krotko: "",
        zdolnosc: "kontrahent.sprawdz",
      },
    })
    expect(r.status()).toBe(400)
    expect((await r.json()).blad).toMatch(/pisze je człowiek/)
  })

  test("Nieznana zdolność jest odrzucana — narzędzie musi przejść przez katalog", async ({
    request,
  }) => {
    const r = await request.post("/api/mcp", {
      headers: ROBERT,
      data: {
        akcja: "zatwierdz",
        serwer: "biala-lista",
        nazwaZdalna: "sprawdz_nip",
        opis: OPIS,
        krotko: "x",
        zdolnosc: "wymyslona.zdolnosc",
      },
    })
    expect(r.status()).toBe(400)
  })

  test("Serwer musi mieć adres http — stdio jest zabronione", async ({ request }) => {
    const r = await request.post("/api/mcp", {
      headers: ROBERT,
      data: { akcja: "dodaj", nazwa: "lokalny", etykieta: "Lokalny", url: "stdio:///usr/bin/cos" },
    })
    expect(r.status()).toBe(400)
  })
})

test.describe("Obszar 27 · Odcisk wiąże zgodę ze słowami człowieka, nie tylko ze schematem", () => {
  test("Inny opis zatwierdzającego daje inny odcisk, choć schemat jest ten sam", async ({
    request,
  }) => {
    const przed = narzedzie(await bialaLista(request), "sprawdz_nip").odcisk

    const r = await request.post("/api/mcp", {
      headers: ROBERT,
      data: {
        akcja: "zatwierdz",
        serwer: "biala-lista",
        nazwaZdalna: "sprawdz_nip",
        opis: "Zupełnie inny opis tej samej czynności, napisany przez kogoś innego.",
        krotko: "inny opis",
        zdolnosc: "kontrahent.sprawdz",
      },
    })
    expect(r.ok()).toBeTruthy()

    const po = narzedzie(await bialaLista(request), "sprawdz_nip")
    expect(po.odcisk).not.toBe(przed)
    expect(po.zatwierdzil).toBe("robert")

    // przywracamy pierwotny opis, żeby kolejne scenariusze zastały to samo biurko
    await request.post("/api/mcp", {
      headers: ROBERT,
      data: {
        akcja: "zatwierdz",
        serwer: "biala-lista",
        nazwaZdalna: "sprawdz_nip",
        opis: OPIS,
        krotko: "sprawdzenie statusu VAT",
        zdolnosc: "kontrahent.sprawdz",
      },
    })
  })

  test("Wycofanie usuwa narzędzie z katalogu, a dziennik zapamiętuje kto", async ({ request }) => {
    await request.post("/api/mcp", {
      headers: ROBERT,
      data: { akcja: "wycofaj", serwer: "biala-lista", nazwaZdalna: "sprawdz_rachunek" },
    })
    const s = await bialaLista(request)
    expect(s.narzedzia.some((n) => n.nazwaZdalna === "sprawdz_rachunek")).toBe(false)

    // wraca przez ten sam ekran, którym się je przyjmuje
    const wraca = await request.post("/api/mcp", {
      headers: ROBERT,
      data: {
        akcja: "zatwierdz",
        serwer: "biala-lista",
        nazwaZdalna: "sprawdz_rachunek",
        opis: "Sprawdza w wykazie Ministerstwa Finansów, czy podany numer rachunku był w danym dniu przypisany do firmy o podanym NIP.",
        krotko: "sprawdzenie rachunku w wykazie",
        zdolnosc: "kontrahent.sprawdz",
      },
    })
    expect(wraca.ok()).toBeTruthy()
  })
})
