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

  test("Wiadomość ludzi NIE jest zdarzeniem sprawy — model jej nie dostaje", async ({
    request,
  }) => {
    // Sprawdzane na ZDARZENIACH, nie na ekranie: to one jadą do modelu jako historia.
    const id = await nowaSprawa(request)
    const przed = await (await request.get(`/api/case/${id}/events`, { headers: anna })).json()

    await request.post(`/api/case/${id}/talk`, {
      headers: anna,
      data: { action: "say", text: "Kasia, zerknij na to proszę." },
    })

    const po = await (await request.get(`/api/case/${id}/events`, { headers: anna })).json()
    expect(po.events.length).toBe(przed.events.length)
    expect(po.messages.map((m: { text: string }) => m.text)).toContain(
      "Kasia, zerknij na to proszę.",
    )
    // ...i ani śladu treści w samych zdarzeniach
    expect(JSON.stringify(po.events)).not.toContain("Kasia, zerknij")
  })

  test("Gość widzi sprawę i rozmowę, ale nie dostaje pola zlecenia", async ({ page, request }) => {
    const id = await nowaSprawa(request)
    await request.post(`/api/case/${id}/talk`, {
      headers: anna,
      data: { action: "share", who: "robert" },
    })
    await request.post(`/api/case/${id}/talk`, {
      headers: anna,
      data: { action: "say", text: "Zerknij, proszę, na to zestawienie." },
    })

    await as(page, "robert")
    await otworz(page, `/case/${id}`)
    await expect(page.getByText("Zerknij, proszę, na to zestawienie.")).toBeVisible()
    // pole zlecenia dostaje wyłącznie właściciel — gość ogląda, nie zleca
    await expect(page.getByRole("button", { name: "Wyślij zlecenie" })).toHaveCount(0)
    // ...ale odpisać może, bo po to mu tę sprawę pokazano
    await expect(page.getByRole("textbox", { name: /Napisz do osób/ })).toBeVisible()
  })

  test("Dziennik notuje rozmowę, ale nie jej treść", async ({ page, request }) => {
    const id = await nowaSprawa(request)
    await request.post(`/api/case/${id}/talk`, {
      headers: anna,
      data: { action: "say", text: "Poufna uwaga o kliencie." },
    })
    await as(page, "robert")
    await otworz(page, "/supervision?section=log")
    await expect(page.getByText("pisze wiadomość przy sprawie").first()).toBeVisible()
    await expect(page.getByText("Poufna uwaga o kliencie.")).toHaveCount(0)
  })
})
