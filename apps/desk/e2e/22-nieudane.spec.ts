import type { DeskEvent } from "@cortex/desk-core/types"
import type { APIRequestContext } from "@playwright/test"
import { as, expect, otworz, test } from "./osoby"

/**
 * Obszar 32 · PRZEŁOŻONY WIDZI, CO SIĘ NIE UDAŁO.
 *
 * Robert ma odpowiedzieć swojemu szefowi na dwa pytania: „czy to działa" i „czy warto
 * płacić". Dane na oba leżały w bazie od pierwszego dnia — stany spraw, powody
 * zatrzymania, nieudane czynności, kłódki — a ekran nadzoru nie miał ANI JEDNEJ pozycji
 * o tym, co się nie udało. Odpowiedź brzmiała więc „chyba działa".
 *
 * DWA SCENARIUSZE NIOSĄ TU CAŁY CIĘŻAR. Pierwszy: Anna dostaje na to zestawienie 403,
 * a nie pustą listę — bo „zero porażek" i „nie wolno ci tego widzieć" to dwie różne
 * odpowiedzi, a ta druga podana jako pierwsza jest kłamstwem. Drugi: na ekranie Roberta
 * nie ma ANI JEDNEGO znaku z treści sprawy Anny, choć wszystkie liczby pochodzą właśnie
 * z niej. Sprawa jest prywatna i to jest jedno z trzech ustaleń, których nie wolno ruszyć.
 */

const ANNA = { Cookie: "desk_persona=anna" }
const ROBERT = { Cookie: "desk_persona=robert" }

/**
 * TYTUŁ JEST TREŚCIĄ i to nie jest przenośnia: `case-turn.ts` wpisuje w tytuł sprawy
 * sześćdziesiąt pierwszych znaków zlecenia, czyli dosłownie zdanie, które napisał
 * człowiek. Ten tytuł ma więc wyglądać jak prawdziwe zlecenie pani Basi — po to, żeby
 * dało się sprawdzić, że przełożony go NIE zobaczy.
 */
const TYTUL = "Rozlicz faktury od Kowalski i Wspólnicy za sierpień"

/** Zdolność, której rola pracownika nie ma — inaczej kłódka nie miałaby jak powstać. */
const KONTRAHENCI = "counterparty.verify"

const krok = (name: string, ok: boolean, reason?: string): DeskEvent =>
  ({ type: "tool_end", name, ok, summary: "", ms: 12, ...(reason ? { reason } : {}) }) as DeskEvent

async function zasiej(
  request: APIRequestContext,
  title: string,
  status: string,
  events: DeskEvent[],
) {
  const r = await request.post("/api/test/seed-turn", {
    headers: ANNA,
    data: { title, status, events },
  })
  expect(r.ok(), `nie udało się zasiać sprawy „${title}”`).toBe(true)
}

test.beforeAll(async ({ request }) => {
  // Sprawa NIEUDANA: dwie wywrotki tej samej czynności, jedna kłódka, pół dolara kosztu.
  await zasiej(request, TYTUL, "failed", [
    krok("read_file", false, "no-such-file"),
    krok("read_file", false, "no-such-file"),
    {
      type: "blocked",
      // Opis układa model z treści zlecenia — czyli jest treścią tak samo jak tytuł.
      description: "sprawdzić w wykazie VAT kontrahenta Kowalski i Wspólnicy",
      capabilityId: KONTRAHENCI,
      department: "accounting",
    },
    { type: "cost", usd: 0.5, basis: "provider" },
  ])
  // Sprawa UDANA — bez niej zestawienie nie ma czego porównać i procent nie ma sensu.
  await zasiej(request, `${TYTUL} (druga tura)`, "done", [
    krok("write_sheet", true),
    { type: "cost", usd: 1, basis: "provider" },
  ])
})

test.describe("Obszar 32 · Co się nie udało", () => {
  test("Pracownica dostaje na zestawienie 403, a nie pustą listę", async ({ request }) => {
    const r = await request.get("/api/outcomes", { headers: ANNA })
    expect(r.status(), "cudze porażki nie są dla pracownicy — i ma to być odmowa").toBe(403)
    // Pusta lista byłaby ODPOWIEDZIĄ: „nic się nie zepsuło". Sprawdzamy więc, że w ciele
    // odmowy nie ma ani jednej z tabel zestawienia — inaczej front narysowałby zera.
    const body = await r.json()
    expect(body.cases).toBeUndefined()
    expect(body.steps).toBeUndefined()
    expect(body.missing).toBeUndefined()
  })

  test("Przełożony dostaje liczby, powody i zdolności", async ({ request }) => {
    const r = await request.get("/api/outcomes", { headers: ROBERT })
    expect(r.status()).toBe(200)
    const d = await r.json()

    // „Czy to działa" — sprawy po zakończeniu.
    const ile = (status: string) =>
      (d.cases as { status: string; cases: number }[]).find((x) => x.status === status)?.cases ?? 0
    expect(ile("failed")).toBeGreaterThanOrEqual(1)
    expect(ile("done")).toBeGreaterThanOrEqual(1)
    expect(d.resultShare).not.toBeNull()

    // „Co się psuje" — powód ze skończonej listy, razy osobno od spraw.
    const brak = (d.steps as { reason: string; times: number; cases: number }[]).find(
      (x) => x.reason === "no-such-file",
    )
    expect(brak, "nie ma powodu, który właśnie zasialiśmy dwa razy").toBeTruthy()
    expect(brak!.times).toBeGreaterThanOrEqual(2)
    expect(brak!.cases).toBeGreaterThanOrEqual(1)
    // Dwie wywrotki w JEDNEJ sprawie: liczba spraw nie może rosnąć razem z liczbą razy.
    expect(brak!.cases).toBeLessThanOrEqual(brak!.times)

    // „Czego ludziom brakuje" — kłódka niesie TOŻSAMOŚĆ zdolności, nie jej nazwę.
    const klodka = (d.missing as { capabilityId: string | null; times: number }[]).find(
      (x) => x.capabilityId === KONTRAHENCI,
    )
    expect(klodka, "kłódka nie trafiła do zestawienia po zdolnościach").toBeTruthy()
    expect(klodka!.times).toBeGreaterThanOrEqual(1)

    // „Czy warto płacić" — koszt rozbity na ten z wynikiem i ten bez.
    expect(d.cost.withoutResult).toBeGreaterThanOrEqual(0.5)
    expect(d.cost.withResult).toBeGreaterThanOrEqual(1)
  })

  test("Zestawienie nie niesie ANI JEDNEGO pola z treścią cudzej sprawy", async ({ request }) => {
    // Reguła produktu: przełożony nie ma wglądu w treść cudzych spraw z urzędu.
    //
    // PYTAMY O KSZTAŁT, NIE O SŁOWA — i to jest cała różnica między tym sprawdzeniem
    // a jego pierwszą wersją. Tamta szukała w odpowiedzi słowa „Kowalski" z zasianej
    // sprawy i przepuściła prawdziwy przeciek: dopisane do zapytania pole `description`
    // grupuje się razem z wierszami, więc na ekran wyszedł opis z CUDZEJ sprawy, nie
    // z naszej — treść wyciekła, a asercja o naszym słowie została zielona. Wystarczy
    // więc pilnować, żeby nie przybyło ŻADNE pole poza tymi trzema, bo każde następne
    // niesie coś, czego nie da się policzyć.
    const d = await (await request.get("/api/outcomes", { headers: ROBERT })).json()
    const keys = new Set<string>()
    const walk = (node: unknown) => {
      if (Array.isArray(node)) node.forEach(walk)
      else if (node && typeof node === "object") {
        for (const [k, v] of Object.entries(node)) {
          keys.add(k)
          walk(v)
        }
      }
    }
    walk(d)
    expect([...keys].sort()).toEqual([
      "capabilityId",
      "cases",
      "cost",
      "days",
      "missing",
      "people",
      "reason",
      "resultShare",
      "status",
      "steps",
      "stops",
      "times",
      "unfinished",
      "withResult",
      "withoutResult",
    ])
    // A dla pewności także słowami: nasza zasiana sprawa niesie firmę, plik i czynność,
    // których nie ma prawa być nigdzie w odpowiedzi.
    const all = JSON.stringify(d)
    expect(all).not.toContain("Kowalski")
    expect(all).not.toContain("wykazie VAT")
    expect(all).not.toContain("faktury")
  })

  test("Robert widzi sekcję, jej liczby i zdanie po polsku", async ({ page }) => {
    await as(page, "robert")
    await otworz(page, "/supervision?section=outcomes")

    await expect(page.getByRole("heading", { name: "Co się nie udało" })).toBeVisible()
    // Zdanie o powodzie dobiera EKRAN ze skończonej listy — w bazie leży `no-such-file`.
    await expect(page.getByText("Tego pliku nie ma tam, gdzie go szukałem.")).toBeVisible()
    // Kłódka pokazuje NAZWĘ zdolności ze słownika, a nie identyfikator z bazy.
    await expect(page.getByText("Sprawdzanie kontrahenta w wykazie VAT")).toBeVisible()
    await expect(page.getByText("zakończone wynikiem")).toBeVisible()
    // Z porażki ma wynikać DECYZJA, a nie kolejna tabela do oglądania.
    await expect(page.getByRole("link", { name: /Włącz zdolność w Zespole/ })).toBeVisible()

    // I ani słowa z treści sprawy Anny, mimo że wszystkie te liczby pochodzą z niej.
    await expect(page.getByText(/Kowalski/)).toHaveCount(0)
  })

  test("Zakładka niesie liczbę porażek, zanim ktokolwiek ją otworzy", async ({ page }) => {
    await as(page, "robert")
    await otworz(page, "/supervision")
    const tab = page.getByRole("link", { name: /Nieudane/ })
    await expect(tab).toBeVisible()
    // Plakietka jest po to, żeby przełożony wiedział, że jest o czym rozmawiać, ZANIM
    // cokolwiek otworzy. Zakładka bez liczby wygląda jak pusta.
    expect(Number((await tab.innerText()).replace(/\D+/g, ""))).toBeGreaterThanOrEqual(1)
  })

  test("Sekcja siedzi w adresie i przeżywa odświeżenie", async ({ page }) => {
    await as(page, "robert")
    await otworz(page, "/supervision")
    await page.getByRole("link", { name: /Nieudane/ }).click()
    await expect(page).toHaveURL(/section=outcomes/)
    await page.reload()
    await expect(page.getByRole("heading", { name: "Co się nie udało" })).toBeVisible()
  })
})
