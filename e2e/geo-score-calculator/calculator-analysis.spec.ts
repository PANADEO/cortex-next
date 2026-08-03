// E2E kafelka GEO Score Calculator — Kalkulator, przez PRAWDZIWY mikroserwis
// Python (design doc §6): "w przeciwieństwie do np. Ilustromatu (LLM, koszt,
// niedeterminizm), ten mikroserwis jest w pełni deterministyczny i
// bezpłatny (...) — rekomendacja: uruchamiać PRAWDZIWY mikroserwis (...),
// bo to jedyny sposób, żeby test faktycznie dowodził, że kontrakt
// Next↔Python działa, nie tylko że UI renderuje zamockowany JSON." Zero
// `page.route` na `/api/geo-score-calculator/analyze` w tym pliku —
// jedyny moduł dzisiejszej rundy testowany bez mocka granicy sieciowej.
//
// Wymaga URUCHOMIONEGO kontenera services/geo-score-calculator, osiągalnego
// przez GEO_SCORE_SERVICE_URL widziane przez proces `npm run dev` (webServer
// Playwrighta) — patrz .claude/skills/code-e2e/SKILL.md i notatka w
// raporcie weryfikacyjnym tej zmiany.

import { expect, test } from "../fixtures/fixtures"
import { asUser } from "../fixtures/fixtures"
import { mockShellAccess } from "../support/mocks/shell-access"

// Timeout hojniejszy niż domyślne 5s — pierwsza kompilacja trasy/route
// handlera w danym przebiegu `next dev` PLUS realne wywołanie mikroserwisu
// Python (spaCy) w tym samym oczekiwaniu. Patrz też analogiczny komentarz
// w history-scenario.spec.ts.
const SLOW = { timeout: 45_000 }

test.describe("GEO Score Calculator — Kalkulator (mikroserwis realny)", () => {
  test("analizuje przykładowy tekst przez prawdziwy mikroserwis i renderuje wynik z podświetleniami", async ({
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

    // "Wczytaj przykład" wczytuje EXAMPLE_TEXT (lib/geo-score-calculator/
    // example-text.ts) — świadomie BEZ słów subiektywnych, z dużą liczbą
    // danych/czasowników akcji i bullet-listą (§4.1 pkt 5), więc pod
    // domyślnym configiem daje deterministycznie wynik 100.0/ocena A
    // (zweryfikowane bezpośrednim wywołaniem POST /analyze na uruchomionym
    // kontenerze przed napisaniem tego testu).
    await geoScoreCalculatorPage.loadExampleButton.click()
    await expect(geoScoreCalculatorPage.textInput).not.toBeEmpty()
    await geoScoreCalculatorPage.analyzeButton.click()

    await expect(geoScoreCalculatorPage.scoreText("100.0")).toBeVisible(SLOW)
    await expect(geoScoreCalculatorPage.gradeText("A")).toBeVisible(SLOW)

    // Dowód, że to PRAWDZIWY mikroserwis (spaCy realnie załadowany w
    // obrazie, nie fallback heurystyczny) — method: "spacy" w odpowiedzi
    // renderuje się jako etykieta "spaCy" (design doc §3, komentarz przy
    // AnalyzeGeoScoreResponse.actionVerbs.method).
    await expect(geoScoreCalculatorPage.actionVerbsMethod("spaCy")).toBeVisible()

    // Podświetlenia inline (§4.1/§4.2 luka UX z legacy) — `position` z
    // odpowiedzi Pythona realnie trafia w tekst źródłowy.
    await expect(geoScoreCalculatorPage.highlightMarks.first()).toBeVisible(SLOW)
    expect(await geoScoreCalculatorPage.highlightMarks.count()).toBeGreaterThan(0)

    // Zapis do historii jest efektem ubocznym udanej analizy (analyze/
    // route.ts) — dowód, że request faktycznie przeszedł całą trasę
    // Next → Postgres, nie tylko Next → Python.
    const history = await page.request.get("/api/geo-score-calculator/history", {
      headers: { "x-auth-request-email": email },
    })
    expect(history.ok()).toBe(true)
    const rows = await history.json()
    expect(rows).toHaveLength(1)
    expect(rows[0].grade).toBe("A")
  })

  test("pusty tekst: walidacja klienta blokuje analizę — zero żądania do serwera", async ({
    page,
    seed,
    geoScoreCalculatorPage,
  }) => {
    const { email } = await seed("geo-score-calculator-user")
    await asUser(page, email)
    await mockShellAccess(page, { email, apps: ["geo-score-calculator"] })

    await geoScoreCalculatorPage.goto()
    await expect(geoScoreCalculatorPage.analyzeButton).toBeDisabled(SLOW)

    const history = await page.request.get("/api/geo-score-calculator/history", {
      headers: { "x-auth-request-email": email },
    })
    expect(await history.json()).toHaveLength(0)
  })
})
