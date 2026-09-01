import { test as base, type Page } from "@playwright/test"

/** Wejście „jako kto" — jedyny sposób, w jaki testy poznają tożsamość. */
export async function as(page: Page, who: "anna" | "robert") {
  await page
    .context()
    .addCookies([{ name: "desk_persona", value: who, url: "http://localhost:3210" }])
}

/**
 * Wejście na stronę Biurka i odczekanie, aż będzie KLIKALNA.
 *
 * `goto` kończy się, gdy dokument jest wczytany — a ekrany Biurka rysuje potem React,
 * który dopina obsługę zdarzeń dopiero przy hydratacji. Kliknięcie albo `setInputFiles`
 * w tym oknie trafia w element BEZ obsługi: nic się nie dzieje i nic o tym nie mówi.
 * W trybie deweloperskim okno bywa długie, bo pierwsza wizyta na trasie kompiluje ją.
 *
 * `networkidle` jest tu dobrym sygnałem, bo ekrany Biurka dociągają swoje dane z tras
 * API w efekcie — czyli PO hydratacji. NIE używamy go na widoku sprawy: tam wisi
 * strumień zdarzeń i sieć nigdy nie ucichnie.
 */
export async function otworz(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState("networkidle")
}

export const test = base
export { expect } from "@playwright/test"
