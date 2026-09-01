import type { APIRequestContext } from "@playwright/test"
import { as, expect, test } from "./osoby"
type Zdarzenie = { event: { type: string } }

const DLUGIE =
  "Przeczytaj Moje pliki/faktury-08.csv, a potem napisz obszerną analizę kosztów: dla każdej z kategorii osobny akapit z komentarzem, rekomendacje oszczędnościowe i podsumowanie. Na koniec zapisz to jako analiza.md i sprawdź plik po zapisie."

async function nowaZTura(request: APIRequestContext, text: string) {
  const r = await request.post("/api/case/new", {
    headers: { Cookie: "desk_persona=anna" },
    data: { title: "Trwałość" },
  })
  const { id } = await r.json()
  await request.post(`/api/case/${id}/turn`, {
    headers: { Cookie: "desk_persona=anna" },
    data: { text },
  })
  return id as string
}

test.describe("Obszar 4 · Praca nie ginie", () => {
  test(
    "Odświeżenie w trakcie tury pokazuje znacznik pracy i cały przebieg",
    { tag: "@model" },
    async ({ page, request }) => {
      test.setTimeout(180_000)
      await as(page, "anna")
      const id = await nowaZTura(request, DLUGIE)
      await page.goto(`/case/${id}`)
      await expect(page.getByText(/pracuje ·/)).toBeVisible({ timeout: 30_000 })
      const steps = page.getByRole("list", { name: "Kroki pracy" }).getByRole("button")
      await expect(steps.first()).toBeVisible({ timeout: 60_000 })
      const before = await steps.count()

      await page.reload()

      await expect(page.getByText(/pracuje ·|gotowe/).first()).toBeVisible()
      // po odświeżeniu przebieg mógł się zwinąć — rozwijamy, żeby policzyć kroki
      const header = page
        .getByRole("region", { name: "Przebieg pracy" })
        .getByRole("button")
        .first()
      if ((await header.getAttribute("aria-expanded")) === "false") await header.click()
      const po = await page.getByRole("list", { name: "Kroki pracy" }).getByRole("button").count()
      expect(po).toBeGreaterThanOrEqual(before)
      expect(po).toBeGreaterThan(0)
      // historia jest kompletna także w źródle prawdy, nie tylko na ekranie
      const h = await request.get(`/api/case/${id}/events?od=0`, {
        headers: { Cookie: "desk_persona=anna" },
      })
      const d = await h.json()
      expect(d.events.some((z: Zdarzenie) => z.event.type === "prompt")).toBe(true)
      expect(
        d.events.filter((z: Zdarzenie) => z.event.type === "tool_start").length,
      ).toBeGreaterThan(0)
    },
  )

  test(
    "Stop kończy turę jako przerwaną, nie jako błąd",
    { tag: "@model" },
    async ({ page, request }) => {
      test.setTimeout(120_000)
      await as(page, "anna")
      const id = await nowaZTura(request, DLUGIE)
      await page.goto(`/case/${id}`)
      await page.getByRole("button", { name: "Stop" }).click({ timeout: 30_000 })
      await expect(page.getByText("Praca przerwana.")).toBeVisible({ timeout: 20_000 })
      await expect(page.getByText("Nie udało się wykonać zlecenia")).toHaveCount(0)
    },
  )
})
