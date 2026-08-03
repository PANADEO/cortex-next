// E2E kafelka GEO Score Calculator — dowód przyczynowości: zmiana wag w
// Ustawieniach GENUINE zmienia wynik KOLEJNEJ analizy tego samego tekstu
// (weryfikacja manualna z review Fazy 3, teraz jako powtarzalny test
// automatyczny — design doc §6 pkt "confirming a settings change genuinely
// affects a subsequent analysis").
//
// Zmiana configu idzie przez PRAWDZIWE API (`page.request.put`), nie przez
// suwaki UI — POM-owa notatka w settings-page.ts tłumaczy, dlaczego suwaki
// nie mają realnej etykiety dostępności; API jest tu równie "genuine" (realny
// Postgres, realna walidacja Zod na serwerze) i pozwala postawić dokładną,
// odtwarzalną tezę o kierunku i wielkości zmiany wyniku. Sama analiza idzie
// PRZEZ PRAWDZIWY mikroserwis Python (design doc §6) w obu przebiegach.
//
// Tekst i para wag zweryfikowane bezpośrednim wywołaniem POST /analyze na
// uruchomionym kontenerze przed napisaniem tego testu: wagi domyślne dają
// totalScore 80.0/ocena B (structure.score=0, bo tekst nie ma bulletów/
// nagłówków — pozostałe trzy wymiary są 100.0), wagi "cała waga na
// strukturę" dają totalScore 0.0/ocena F — deterministyczna, duża różnica.

import { expect, test } from "../fixtures/fixtures"
import { asUser } from "../fixtures/fixtures"
import { mockShellAccess } from "../support/mocks/shell-access"
import { GeoScoreCalculatorPage } from "../poms/geo-score-calculator/calculator-page"

const CAUSALITY_TEXT =
  "Firma wdrożyła nowy system i zwiększyła przychody o 15 procent. Zespół opracował plan rozwoju na kolejny rok. Zarząd ogłosił dalsze inwestycje w infrastrukturę."

// Timeout hojniejszy niż domyślne 5s — pierwsza kompilacja trasy w danym
// przebiegu `next dev` PLUS realne wywołanie mikroserwisu Python (spaCy)
// dwa razy w tym samym teście, dodatkowo w PEŁNYM przebiegu suity ten test
// idzie jako jeden z ostatnich (kumulacja obciążenia, patrz analogiczny
// komentarz w history-scenario.spec.ts — ten sam scenariusz w izolacji jest
// szybki). `test.slow()` niżej potraja OGÓLNY limit czasu testu (30s→90s).
const SLOW = { timeout: 45_000 }

// Ponowienie NA POZIOMIE CAŁEGO TESTU (nie samej akcji) przy sporadycznym
// zawieszeniu — patrz pełne uzasadnienie nad analyzeAndExpectScore() niżej.
// Wzorem `test.describe.configure({ timeout })` już używanego per-plik w
// tym repo (np. ilustromat-scenario.spec.ts), tylko dla `retries` zamiast
// `timeout` — lokalne dla tego pliku, NIE dotyka globalnego `retries: 0`
// w playwright.config.ts ani innych modułów.
test.describe.configure({ retries: 1 })

/**
 * Klika "Analizuj" i czeka na wynik — bez własnego mechanizmu ponawiania
 * kliknięcia.
 *
 * Wcześniejsza wersja tej funkcji ponawiała sam klik po niepowodzeniu, z
 * uzasadnieniem "10-sekundowy, niekonfigurowalny timeout POŁĄCZENIA undici
 * do kontenera Docker, wyczerpujący się pod obciążeniem maszyny". To
 * uzasadnienie okazało się błędne — zweryfikowane empirycznie przy review
 * Fazy 4 (E2E): odtworzony powtarzalny ~90-sekundowy hang (przycisk
 * "Analizuj" `disabled` przez CAŁY budżet `test.slow()`, ~130 ponowień
 * "element is not enabled" w logu), ale logi Dockera mikroserwisu w TYM
 * DOKŁADNIE oknie pokazują ZERO przychodzących żądań — więc mikroserwis
 * nigdy nie dostał połączenia do "wyczerpania". Do tego `REQUEST_TIMEOUT_MS`
 * w integration-client.ts to w rzeczywistości zwykła, KONFIGUROWALNA stała
 * (30 sekund, `AbortController` na całe żądanie), nie "niekonfigurowalny
 * 10s limit undici na samo połączenie" — opis pierwotnej przyczyny mijał
 * się z kodem na dwóch frontach naraz.
 *
 * Rzeczywisty mechanizm NIE jest w pełni wyizolowany. Obserwacje są
 * bardziej zgodne z zawieszeniem się samego dev servera Next.js (np.
 * kompilacja route handlera pod obciążeniem współdzielonej maszyny
 * deweloperskiej) ZANIM żądanie wychodzące do mikroserwisu w ogóle
 * zostanie wysłane, niż z siecią do kontenera — ale to obserwacja, nie
 * potwierdzona przyczyna.
 *
 * Poprzedni click-retry miał niezależny, głębszy błąd: ponawiał samo
 * KLIKNIĘCIE bez sprawdzenia, czy pierwsza próba wciąż trwa
 * (`analyze.isPending` w page.tsx) — przy realnym zawieszeniu pierwszej
 * mutacji drugi klik trafiał w wciąż zablokowany (disabled) przycisk, więc
 * "ponowienie" gwarantowało pełny hang zamiast się z niego wydostać.
 * Mitygacja jest teraz na poziomie CAŁEGO testu
 * (`test.describe.configure({ retries: 1 })` wyżej): ponowienie odpala test
 * od zera, łącznie z reseedem danych (`seed()` na początku funkcji testu),
 * więc nie ma ryzyka nałożenia dwóch równoległych mutacji na tę samą sesję.
 *
 * UWAGA: ta mitygacja zakłada brak INNEGO ciężkiego procesu e2e/dev-server
 * działającego równolegle na tej samej maszynie. Niezależnie zweryfikowane
 * (review 03.08.2026): pod realnym obciążeniem współdzielonego hosta (drugi
 * pełny przebieg Playwrighta w tle) pojedyncze ponowienie bywa niewystarczające
 * — kilka testów zawiodło zarówno przy pierwszej próbie, jak i po retry. To
 * nie regresja tej poprawki, tylko sufit tego, co `retries: 1` może wchłonąć
 * — w stanie ustalonym (bez konkurencyjnego obciążenia) mitygacja jest solidna
 * (14/14 przebiegów w izolacji bez ani jednego retry w niezależnej weryfikacji).
 */
async function analyzeAndExpectScore(
  pom: GeoScoreCalculatorPage,
  score: string,
  grade: "A" | "B" | "C" | "D" | "F",
): Promise<void> {
  await pom.analyzeButton.click()
  await expect(pom.scoreText(score)).toBeVisible(SLOW)
  await expect(pom.gradeText(grade)).toBeVisible(SLOW)
}

test("zmiana wag w Ustawieniach realnie zmienia wynik kolejnej analizy tego samego tekstu", async ({
  page,
  seed,
  geoScoreCalculatorPage,
}) => {
  test.slow()
  const { email } = await seed("geo-score-calculator-user")
  await asUser(page, email)
  await mockShellAccess(page, { email, apps: ["geo-score-calculator"] })

  await geoScoreCalculatorPage.goto()
  await expect(geoScoreCalculatorPage.heading).toBeVisible(SLOW)
  await geoScoreCalculatorPage.textInput.fill(CAUSALITY_TEXT)
  await analyzeAndExpectScore(geoScoreCalculatorPage, "80.0", "B")

  // Zmiana configu przez prawdziwe API — cała waga na Strukturę (0 dla tego
  // tekstu, bo brak bulletów/nagłówków), zero na pozostałych trzech
  // wymiarach (każdy 100.0 dla tego tekstu pod domyślnymi wagami).
  const currentConfigResponse = await page.request.get("/api/geo-score-calculator/config", {
    headers: { "x-auth-request-email": email },
  })
  expect(currentConfigResponse.ok()).toBe(true)
  const fullConfig = await currentConfigResponse.json()
  const currentConfig = { ...fullConfig }
  delete currentConfig.updatedAt
  delete currentConfig.updatedBy

  const putResponse = await page.request.put("/api/geo-score-calculator/config", {
    headers: { "x-auth-request-email": email },
    data: {
      ...currentConfig,
      weightStatistics: 0,
      weightActionVerbs: 0,
      weightStructure: 1,
      weightObjectivity: 0,
    },
  })
  expect(putResponse.ok()).toBe(true)

  // Ta sama strona, TEN SAM tekst (state `text` przetrwał "Edytuj ponownie"
  // — page.tsx czyści tylko `result`, nie `text`) — jedyna zmienna, która
  // się zmieniła, to config w Postgresie.
  await geoScoreCalculatorPage.editAgainButton.click()
  await analyzeAndExpectScore(geoScoreCalculatorPage, "0.0", "F")

  // Plakietka delty w sesji (§4.1 "Delta w sesji") potwierdza kierunek i
  // wielkość zmiany: -80.0 punktu względem poprzedniej próby.
  await expect(geoScoreCalculatorPage.deltaBadge).toContainText("-80.0", SLOW)

  // Obie analizy trafiły do historii tego samego usera, z RÓŻNYMI wynikami
  // dla identycznego textContent — bezpośredni dowód w Postgresie, nie
  // tylko na ekranie.
  const history = await page.request.get("/api/geo-score-calculator/history", {
    headers: { "x-auth-request-email": email },
  })
  const rows: Array<{ totalScore: number; grade: string }> = await history.json()
  expect(rows).toHaveLength(2)
  expect(rows.map((row) => row.grade).sort()).toEqual(["B", "F"])
})
