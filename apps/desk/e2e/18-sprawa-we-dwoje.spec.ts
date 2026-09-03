import type { APIRequestContext } from "@playwright/test"
import { as, expect, otworz, test } from "./osoby"

/**
 * Obszar 27 · SPRAWA WE DWOJE — dowód przestaje kończyć się na granicy jednego biurka.
 *
 * Sprawy nie widział nikt poza właścicielem i to jest dobra domyślna reguła — brakowało
 * od niej JAKIEGOKOLWIEK wyjątku. Koleżanka pytała „a skąd te liczby?" i jedyną
 * odpowiedzią był zrzut ekranu.
 *
 * Najważniejszy scenariusz tego pliku to ten o tym, że WIADOMOŚĆ NIE JEST ZDARZENIEM.
 * Wrzucenie rozmowy ludzi do strumienia zdarzeń jest o połowę krótsze niż zrobienie
 * tego dobrze — i zamienia uwagę rzuconą na boku w polecenie dla agenta.
 */

const anna = { Cookie: "desk_persona=anna" }
const robert = { Cookie: "desk_persona=robert" }

async function nowaSprawa(request: APIRequestContext): Promise<string> {
  const r = await request.post("/api/case/new", { headers: anna, data: { title: "Sprawa próbna" } })
  const { id } = await r.json()
  return id
}

test.describe("Obszar 27 · Udostępnienie sprawy do wglądu", () => {
  test("Obcy nie widzi sprawy, dopóki właściciel jej nie pokaże", async ({ request }) => {
    const id = await nowaSprawa(request)
    expect((await request.get(`/api/case/${id}/events`, { headers: robert })).status()).toBe(403)

    await request.post(`/api/case/${id}/talk`, {
      headers: anna,
      data: { action: "share", who: "robert" },
    })
    expect((await request.get(`/api/case/${id}/events`, { headers: robert })).status()).toBe(200)
  })

  test("Cofnięcie wglądu NAPRAWDĘ odbiera, a nie tylko chowa plakietkę", async ({ request }) => {
    const id = await nowaSprawa(request)
    await request.post(`/api/case/${id}/talk`, {
      headers: anna,
      data: { action: "share", who: "robert" },
    })
    await request.post(`/api/case/${id}/talk`, {
      headers: anna,
      data: { action: "unshare", who: "robert" },
    })
    expect((await request.get(`/api/case/${id}/events`, { headers: robert })).status()).toBe(403)
  })

  test("Gość nie rozdaje sprawy dalej", async ({ request }) => {
    // Wgląd w cudzą pracę dostaje się od właściciela i wyłącznie od niego. Gość, który
    // mógłby udostępniać dalej, zamieniłby jedną zgodę w łańcuszek bez końca.
    const id = await nowaSprawa(request)
    await request.post(`/api/case/${id}/talk`, {
      headers: anna,
      data: { action: "share", who: "robert" },
    })
    const dalej = await request.post(`/api/case/${id}/talk`, {
      headers: robert,
      data: { action: "share", who: "anna" },
    })
    expect(dalej.status()).toBe(403)
  })

  test("Pisania wiadomości NIE MA — także wtedy, gdy ktoś zapyta o nie wprost trasą", async ({
    request,
  }) => {
    // Warstwa wiadomości między ludźmi została zdjęta 03.09.2026 decyzją właściciela
    // produktu: udostępnienie ma dawać PODGLĄD i nic więcej. Sprawdzamy to na TRASIE,
    // nie na ekranie — schowanie pola przy działającej trasie znaczyłoby, że funkcja
    // dalej jest, tylko bez klamki.
    const id = await nowaSprawa(request)
    const r = await request.post(`/api/case/${id}/talk`, {
      headers: anna,
      data: { action: "say", text: "Kasia, zerknij na to proszę." },
    })
    expect(r.status(), "trasa nadal przyjmuje wiadomości").toBe(400)

    const po = await (await request.get(`/api/case/${id}/events`, { headers: anna })).json()
    expect(JSON.stringify(po)).not.toContain("Kasia, zerknij")
    // Sprawa dalej daje się udostępnić — usunięto rozmowę, nie wgląd.
    const dalej = await request.post(`/api/case/${id}/talk`, {
      headers: anna,
      data: { action: "share", who: "robert" },
    })
    expect(dalej.ok()).toBe(true)
  })

  test("Gość ogląda sprawę i nie ma czym w niej pisać — ani do agenta, ani do ludzi", async ({
    page,
    request,
  }) => {
    const id = await nowaSprawa(request)
    await request.post(`/api/case/${id}/talk`, {
      headers: anna,
      data: { action: "share", who: "robert" },
    })

    await as(page, "robert")
    await otworz(page, `/case/${id}`)
    // Sprawa naprawdę się otwiera — bez tego wiersza reszta byłaby zielona także wtedy,
    // gdyby gość dostał stronę odmowy.
    await expect(page.getByText("Sprawa próbna").first()).toBeVisible()
    // pole zlecenia dostaje wyłącznie właściciel — gość ogląda, nie zleca
    await expect(page.getByRole("button", { name: "Zleć zadanie" })).toHaveCount(0)
    // ...i nie ma też DRUGIEGO pola, do ludzi. Udostępnienie znaczy podgląd, kropka.
    await expect(page.getByRole("textbox")).toHaveCount(0)
    // Gość nie rozdaje sprawy dalej, więc nie widzi nawet ikony udostępniania.
    await expect(page.getByRole("button", { name: /Udostępnij/ })).toHaveCount(0)
  })

  test("Dziennik notuje NADANIE i COFNIĘCIE wglądu, po imieniu", async ({ page, request }) => {
    // Wpis o wiadomościach zniknął razem z wiadomościami. Zostaje to, co przy udostępnianiu
    // naprawdę jest decyzją: komu pokazano cudzą pracę i kiedy mu to zabrano.
    const id = await nowaSprawa(request)
    await request.post(`/api/case/${id}/talk`, {
      headers: anna,
      data: { action: "share", who: "robert" },
    })
    await request.post(`/api/case/${id}/talk`, {
      headers: anna,
      data: { action: "unshare", who: "robert" },
    })
    await as(page, "robert")
    await otworz(page, "/supervision?section=log")
    await expect(page.getByText(/udostępnia sprawę/).first()).toBeVisible()
    await expect(page.getByText(/cofa wgląd w sprawę/).first()).toBeVisible()
  })
})
