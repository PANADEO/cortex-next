import { evidenceFromEvents } from "@cortex/desk-core/evidence"
import type { Locator } from "@playwright/test"
import { as, expect, test } from "./osoby"

/** Nagłówek przebiegu przełącza, więc rozwijamy tylko wtedy, gdy naprawdę jest zwinięty. */
async function rozwin(header: Locator) {
  if ((await header.getAttribute("aria-expanded")) === "false") await header.click()
}

test.describe("Obszar 3 · Zlecam robotę, dostaję dokument z dowodem", () => {
  test("Karta zlecenia wstawia treść, nie wysyła", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/")
    await page.waitForSelector(
      'button:has-text("Podpowiedzi"), button:has-text("Notatka ze spotkania")',
    )
    const rozwin = page.getByRole("button", { name: "Podpowiedzi", exact: true })
    if (await rozwin.count()) await rozwin.click()
    await page
      .getByRole("button", { name: /Notatka ze spotkania/ })
      .first()
      .click()

    const field = page.getByPlaceholder("Co mam dla Ciebie zrobić?")
    await expect(field).toHaveValue(/notatk/i)
    // nic nie zostało wysłane: zostajemy na biurku, przycisk nadal zaprasza do wysłania
    expect(new URL(page.url()).pathname).toBe("/")
    await expect(page.getByRole("button", { name: "Zleć zadanie" })).toBeVisible()
  })

  test(
    "Praca na pliku z biurka kończy się dokumentem z dowodem",
    { tag: "@model" },
    async ({ page }) => {
      test.setTimeout(180_000)
      await as(page, "anna")
      await page.goto("/")
      await page
        .getByPlaceholder("Co mam dla Ciebie zrobić?")
        .fill(
          "Przeczytaj Moje pliki/notatka-spotkanie.txt i zapisz z tego zwięzłą notatkę jako notatka.md, potem sprawdź plik po zapisie.",
        )
      await page.getByRole("button", { name: "Zleć zadanie" }).click()
      await page.waitForURL(/\/case\//)

      // przebieg mówi, co się dzieje, jeszcze zanim skończy
      const przebieg = page.getByRole("region", { name: "Przebieg pracy" })
      await expect(przebieg).toBeVisible({ timeout: 120_000 })

      // po zakończeniu grupa zwija się do jednego zdania o wykonanej pracy
      const summary = przebieg.getByRole("button", { name: /przeczytałem 1 plik/i })
      await expect(summary).toBeVisible({ timeout: 120_000 })

      // wynik trafia do panelu obok, nie w środek historii
      await expect(page.getByText("notatka.md").first()).toBeVisible()
      await expect(page.getByText(/Dokument · .* zapisany/)).toBeVisible()

      // dowód jest dostępny po rozwinięciu przebiegu
      await rozwin(summary)
      await expect(przebieg.getByText("Sprawdzone:")).toBeVisible()
      await expect(
        przebieg.getByText(/To jest lista tego, co faktycznie się wydarzyło/),
      ).toBeVisible()

      // Reguła rzeczownika: żaden wiersz przebiegu nie jest ogólny.
      const rows = przebieg.getByRole("list", { name: "Kroki pracy" }).getByRole("button")
      const n = await rows.count()
      expect(n).toBeGreaterThan(0)
      for (let i = 0; i < n; i++) {
        const t = (await rows.nth(i).innerText()).trim()
        expect(t).not.toMatch(/^(Narzędzie|Tool)[: ]/)
        expect(t.length).toBeGreaterThan(10)
      }
    },
  )

  test(
    'Zakończony przebieg mówi w czasie przeszłym, nie „zapisuję" o czymś zapisanym',
    { tag: "@model" },
    async ({ page }) => {
      test.setTimeout(180_000)
      await as(page, "anna")
      await page.goto("/")
      await page
        .getByPlaceholder("Co mam dla Ciebie zrobić?")
        .fill(
          "Przeczytaj Moje pliki/notatka-spotkanie.txt i zapisz streszczenie jako streszczenie.md, potem sprawdź plik po zapisie.",
        )
      await page.getByRole("button", { name: "Zleć zadanie" }).click()
      await page.waitForURL(/\/case\//)

      const przebieg = page.getByRole("region", { name: "Przebieg pracy" })
      const summary = przebieg.getByRole("button", { name: /zapisałem 1 dokument/i })
      await expect(summary).toBeVisible({ timeout: 120_000 })
      await rozwin(summary)
      const steps = await przebieg
        .getByRole("list", { name: "Kroki pracy" })
        .getByRole("button")
        .allInnerTexts()
      expect(steps.join(" ")).toMatch(/Przeczytałem|Zapisałem|Przejrzałem/)
      expect(steps.join(" ")).not.toMatch(/Zapisuję|Czytam |Przeglądam/)
    },
  )
})

test.describe("Reguła dowodu — dowód pochodzi ze zdarzeń, nie z opowieści modelu", () => {
  test('Zapisany dokument bez sprawdzenia trafia do „Nie sprawdzone"', () => {
    const d = evidenceFromEvents([
      {
        type: "tool_start",
        id: "a",
        name: "read_file",
        label: "Czytam a.csv",
        args: { path: "a.csv" },
      },
      {
        type: "tool_end",
        id: "a",
        name: "read_file",
        ok: true,
        summary: "10 wierszy",
        ms: 5,
      },
      {
        type: "tool_start",
        id: "b",
        name: "write_document",
        label: "Zapisuję w.md",
        args: { name: "w.md" },
      },
      {
        type: "tool_end",
        id: "b",
        name: "write_document",
        ok: true,
        summary: "100 znaków",
        ms: 5,
      },
      { type: "assistant", text: "Sprawdziłem wszystkie pola, wszystko się zgadza." },
    ])
    expect(d.unverified).toContain("zawartość pliku w.md po zapisie")
    expect(d.produced.join(" ")).not.toMatch(/sprawdzi/i)
  })

  test('Sprawdzony dokument nie trafia do „Nie sprawdzone"', () => {
    const d = evidenceFromEvents([
      {
        type: "tool_start",
        id: "a",
        name: "read_file",
        label: "Czytam a.csv",
        args: { path: "a.csv" },
      },
      {
        type: "tool_end",
        id: "a",
        name: "read_file",
        ok: true,
        summary: "10 wierszy",
        ms: 5,
      },
      {
        type: "tool_start",
        id: "b",
        name: "write_document",
        label: "Zapisuję w.md",
        args: { name: "w.md" },
      },
      {
        type: "tool_end",
        id: "b",
        name: "write_document",
        ok: true,
        summary: "100 znaków",
        ms: 5,
      },
      {
        type: "tool_start",
        id: "c",
        name: "verify_document",
        label: "Sprawdzam w.md",
        args: { name: "w.md" },
      },
      {
        type: "tool_end",
        id: "c",
        name: "verify_document",
        ok: true,
        summary: "0 pustych pól",
        ms: 5,
      },
    ])
    expect(d.unverified).toHaveLength(0)
  })

  test("Przeplecione wywołania narzędzi parują się po identyfikatorze, nie po kolejności", () => {
    const d = evidenceFromEvents([
      {
        type: "tool_start",
        id: "x",
        name: "read_file",
        label: "Czytam a.csv",
        args: { path: "a.csv" },
      },
      {
        type: "tool_start",
        id: "y",
        name: "write_document",
        label: "Zapisuję w.md",
        args: { name: "w.md" },
      },
      // koniec przychodzi w odwrotnej kolejności — tak wygląda równoległe wywołanie narzędzi
      {
        type: "tool_end",
        id: "y",
        name: "write_document",
        ok: false,
        summary: "dysk pełny",
        ms: 5,
      },
      {
        type: "tool_end",
        id: "x",
        name: "read_file",
        ok: true,
        summary: "10 wierszy",
        ms: 5,
      },
    ])
    // nieudany zapis nie może przypisać sobie sukcesu odczytu
    expect(d.intake.join(" ")).toMatch(/a\.csv/)
    expect(d.produced.join(" ")).not.toMatch(/w\.md/)
  })
})

test.describe("Plakietka sprawdzenia mówi tylko to, co widać w zdarzeniach", () => {
  test(
    'Obraz nie dostaje plakietki „sprawdzony" — nikt go po zapisie nie odczytał',
    { tag: "@model" },
    async ({ page, request }) => {
      test.setTimeout(180_000)
      await as(page, "robert")
      const r = await request.post("/api/case/new", {
        headers: { Cookie: "desk_persona=robert" },
        data: { title: "Grafika" },
      })
      const { id } = await r.json()
      await request.post(`/api/case/${id}/turn`, {
        headers: { Cookie: "desk_persona=robert" },
        data: { text: "Narysuj prostą ikonę oszczędności i zapisz jako ikona.png." },
      })
      await page.goto(`/case/${id}`)
      await expect(page.getByText("ikona.png").first()).toBeVisible({ timeout: 120_000 })
      // plik powstał, ale nikt go nie sprawdzał — więc żadna plakietka nie może twierdzić, że tak
      await expect(page.getByText("sprawdzony po zapisie")).toHaveCount(0)
    },
  )
})
