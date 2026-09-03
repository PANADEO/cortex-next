import type { APIRequestContext, Page } from "@playwright/test"
import { as, expect, test } from "./osoby"

/**
 * Obszar 31 · CZEKANIE — ekran mówi „jeszcze nie wiem", zanim powie „nie masz nic".
 *
 * Cały ten plik pilnuje JEDNEGO rozróżnienia, które do 03.09.2026 nie istniało:
 *
 *     pusty stan  = ODPOWIEDŹ        „nie masz nic zapisanego"
 *     czekanie    = BRAK ODPOWIEDZI  „jeszcze nie wiem"
 *
 * Listy Biurka pobierają dane z tras API PO hydratacji, a ich stanem startowym była
 * pusta tablica — więc każdy ekran przez cały czas pobierania twierdził, że jest pusty.
 * Zmierzone przed poprawką (`/api/memory` odpowiadające w 800 ms): zdanie „Asystent
 * jeszcze nic o Tobie nie wie" stało na ekranie 826 ms, mając w bazie dwa wspomnienia.
 * `loading.tsx` trasy tego nie łapał i nie mógł — on kończy się, gdy dojdzie odpowiedź
 * SERWERA, a to pobieranie startuje dopiero w przeglądarce.
 *
 * DLACZEGO ODPOWIEDŹ JEST WSTRZYMYWANA, A NIE OPÓŹNIANA O LICZBĘ MILISEKUND. Test na
 * `setTimeout` mierzy się z prędkością maszyny i przegrywa: na wolniejszym przebiegu
 * okno czekania mija, zanim asercja zdąży spojrzeć. Tutaj trasa API stoi, dopóki test
 * jej nie puści — okno czekania jest więc nieskończone i obserwowalne bez wyścigu.
 */

const jako = { Cookie: "desk_persona=anna" }

/** Uchwyt do trasy API, którą test trzyma zamkniętą tak długo, jak chce. */
function hold(page: Page, pattern: string) {
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const routed = page.route(pattern, async (route) => {
    if (route.request().method() === "GET") await held
    await route.continue()
  })
  return { release, ready: routed }
}

/**
 * Czy wskaźnik jest NAPRAWDĘ WIDOCZNY.
 *
 * `toBeVisible()` Playwrighta nie wystarczy: sprawdza układ i `display`, a nie krycie —
 * a wskaźnik startuje przezroczysty i ujawnia się dopiero po 100 ms (patrz `.desk-wait`
 * w `desk.css`). Test przepuszczający element o kryciu zero przepuściłby też regresję,
 * w której wskaźnik nigdy się nie zapala.
 */
async function indicatorOpacity(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector('main [role="status"][aria-busy="true"]')
    return el ? Number(getComputedStyle(el).opacity) : -1
  })
}

async function forgetEverything(request: APIRequestContext) {
  const { memories } = await (await request.get("/api/memory", { headers: jako })).json()
  for (const m of memories ?? [])
    await request.post("/api/memory", { headers: jako, data: { action: "forget", id: m.id } })
}

const NOTHING_KNOWN = "Asystent jeszcze nic o Tobie nie wie"

test.describe("Obszar 31 · Ekran pokazuje, że czeka", () => {
  test.beforeEach(async ({ request }) => {
    await forgetEverything(request)
  })

  test.afterAll(async ({ request }) => {
    await forgetEverything(request)
  })

  test("Pamięć: w czasie pobierania stoi wskaźnik, a NIE zdanie o pustej pamięci", async ({
    page,
    request,
  }) => {
    await request.post("/api/memory", {
      headers: jako,
      data: { action: "add", text: "Faktury dostaję jako CSV." },
    })

    await as(page, "anna")
    const memory = hold(page, "**/api/memory")
    await memory.ready
    await page.goto("/memory")

    // JEDNO ZDANIE, KTÓRE MUSI TU PAŚĆ: dopóki nie wiadomo, nie wolno twierdzić, że pusto.
    await expect(page.getByText(NOTHING_KNOWN)).toHaveCount(0)
    await expect.poll(() => indicatorOpacity(page)).toBeGreaterThan(0)

    memory.release()
    await expect(page.getByText("Faktury dostaję jako CSV.")).toBeVisible()
    // Wskaźnik znika razem z odpowiedzią — inaczej ekran mówiłby dwie rzeczy naraz.
    await expect(page.locator('main [role="status"][aria-busy="true"]')).toHaveCount(0)
  })

  test("Pamięć: pusty stan pojawia się DOPIERO, gdy naprawdę nic nie ma", async ({ page }) => {
    // Druga połowa reguły. Gdyby ją pominąć, poprawkę dałoby się „zaliczyć", chowając
    // pusty stan na zawsze — a wtedy człowiek z pustą pamięcią nie dowiedziałby się
    // o niej nigdy i patrzyłby na wieczny szkielet.
    await as(page, "anna")
    const memory = hold(page, "**/api/memory")
    await memory.ready
    await page.goto("/memory")

    await expect(page.getByText(NOTHING_KNOWN)).toHaveCount(0)
    await expect.poll(() => indicatorOpacity(page)).toBeGreaterThan(0)

    memory.release()
    await expect(page.getByText(NOTHING_KNOWN)).toBeVisible()
  })

  test("Moje pliki: w czasie pobierania stoi wskaźnik, a NIE „tu nic nie ma”", async ({ page }) => {
    await as(page, "anna")
    const files = hold(page, "**/api/files**")
    await files.ready
    await page.goto("/files")

    await expect(page.getByText("Tu jeszcze nic nie ma")).toHaveCount(0)
    await expect.poll(() => indicatorOpacity(page)).toBeGreaterThan(0)

    files.release()
    await expect(page.locator('main [role="status"][aria-busy="true"]')).toHaveCount(0)
  })

  test("Wskaźnik zapala się z opóźnieniem, żeby nie mrugać przy szybkiej odpowiedzi", async ({
    page,
  }) => {
    // Umowa, nie pomiar czasu — i celowo. Zmierzyć „nie mrugnął" nie da się uczciwie:
    // przy szybkiej odpowiedzi okno trwa kilkanaście milisekund i wynik zależałby od
    // obciążenia maszyny. Sprawdzalne jest to, co tę własność WYTWARZA: wskaźnik ma
    // niezerowe opóźnienie zapłonu. Bez tego wracamy do mrugnięcia z pomiaru w `desk.css`.
    await as(page, "anna")
    const memory = hold(page, "**/api/memory")
    await memory.ready
    await page.goto("/memory")

    const delay = await page.evaluate(() => {
      const el = document.querySelector('main [role="status"][aria-busy="true"]')
      return el ? getComputedStyle(el).animationDelay : "brak"
    })
    expect(delay).toBe("0.1s")
    memory.release()
  })

  test("Redukcja ruchu gasi RUCH, nie SYGNAŁ — wskaźnik nadal się pokazuje", async ({
    browser,
  }) => {
    // Reguła Biurka spisana w `desk.css` przy `prefers-reduced-motion`. Wskaźnik bez ruchu
    // ma być nadal widoczny; wskaźnik, który przy redukcji nie zapala się wcale, zabiera
    // odpowiedź „jeszcze nie wiem" akurat tej osobie, która najmniej lubi niespodzianki.
    const context = await browser.newContext({ reducedMotion: "reduce" })
    const page = await context.newPage()
    await as(page, "anna")
    const memory = hold(page, "**/api/memory")
    await memory.ready
    await page.goto("/memory")

    await expect.poll(() => indicatorOpacity(page)).toBeGreaterThan(0)
    await expect(page.getByText(NOTHING_KNOWN)).toHaveCount(0)
    memory.release()
    await context.close()
  })
})
