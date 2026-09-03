import { quickTasksByRole } from "@cortex/desk-core/people"
import { makeDeskT } from "@cortex/desk-ui/i18n/locale"
import { as, expect, test } from "./osoby"

/** Napisy czyta człowiek po polsku — bierzemy je stąd, nie z pamięci. */
const pl = makeDeskT("pl")

/**
 * Gotowe zlecenia mają JEDNĄ postać: trzy kafle, zawsze widoczne. Wcześniej były trzy
 * postacie zależne od liczby spraw (karty, chipy, zwinięta lista „Podpowiedzi”) i test
 * musiał zgadywać, którą akurat zobaczy — czyli sam potwierdzał defekt, zamiast go łapać.
 */
const POLE = "Napisz, co mam zrobić"

test.describe("Obszar 1 · To jest MOJE biurko", () => {
  test("Pierwsze wejście wita po imieniu i nie zostawia pustego pola", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/")
    await expect(page.getByRole("heading", { name: /Dzień dobry, Anna/ })).toBeVisible()
    await expect(page.getByText("Nikt inny go nie widzi")).toBeVisible()
    await expect(page.getByLabel(POLE)).toBeVisible()
  })

  test("Gotowe zlecenia stoją na wierzchu — bez rozwijania, przy każdej liczbie spraw", async ({
    page,
    request,
  }) => {
    // Sprawdzamy PRZY SPRAWACH, bo to ten stan chował kafle pod „Podpowiedzi”: pani Basia,
    // która pracuje tu codziennie, traciła je pierwsza.
    await as(page, "anna")
    for (const title of ["Sprawa jedna", "Sprawa druga", "Sprawa trzecia"]) {
      await request.post("/api/case/new", {
        headers: { Cookie: "desk_persona=anna" },
        data: { title },
      })
    }
    await page.goto("/")
    await expect(page.getByRole("button", { name: "Podpowiedzi", exact: true })).toHaveCount(0)
    // Tytuły ZE SŁOWNIKA i wyliczone z zasiewu — nie wpisane tutaj. Wpisany napis czyni
    // z tego testu strażnika MOJEJ pamięci o brzmieniu kafelków, a nie tego, że one stoją.
    const tytuly = (quickTasksByRole["member"] ?? []).map((id) =>
      pl(`quickTask.${id}.title`),
    )
    expect(tytuly.length).toBeGreaterThanOrEqual(3)
    for (const tytul of tytuly.slice(0, 3)) {
      await expect(page.getByRole("button", { name: tytul })).toBeVisible()
    }
  })

  test("Kliknięcie gotowego zlecenia wstawia treść do pola, ale nie wysyła", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/")
    // TYTUŁ ZE SŁOWNIKA, nie wpisany tutaj. Poprzednia wersja szukała „Zestawienie
    // kosztów" i zerwała się przy pierwszej zmianie napisu — a zmiana była naprawą:
    // dwa kafelki miały ten sam tytuł i nie dało się między nimi wybrać.
    await page.getByRole("button", { name: pl("quickTask.expensesSheet.title") }).click()
    await expect(page.getByLabel(POLE)).not.toBeEmpty()
    await expect(page).toHaveURL("http://localhost:3210/")
  })

  test("Sprawy są prywatne — Robert nie widzi spraw Anny", async ({ page, request }) => {
    await as(page, "anna")
    const r = await request.post("/api/case/new", {
      headers: { Cookie: "desk_persona=anna" },
      data: { title: "Prywatna sprawa Anny" },
    })
    expect(r.ok()).toBeTruthy()
    await as(page, "robert")
    await page.goto("/")
    await expect(page.getByText("Prywatna sprawa Anny")).toHaveCount(0)
  })

  test("Cudzej sprawy nie da się otworzyć z adresu", async ({ page, request }) => {
    const r = await request.post("/api/case/new", {
      headers: { Cookie: "desk_persona=anna" },
      data: { title: "Case do podejrzenia" },
    })
    const { id } = await r.json()
    await as(page, "robert")
    await page.goto(`/case/${id}`)
    await expect(page.getByText("To nie jest Twoja sprawa")).toBeVisible()
  })
})
