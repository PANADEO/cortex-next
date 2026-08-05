// Sedno tej suity: reakcja klienta na 403. `forbiddenHandler` (podpięty w
// provider.tsx) traktuje 403 jako "ten użytkownik stracił dostęp" — unieważnia
// user() + authorizedApps() i pokazuje toast "Brak uprawnień". To jest właściwe
// zachowanie tylko wtedy, gdy 403 rzeczywiście mówi coś o WOŁAJĄCYM.
//
// Odkąd istnieje bramka licencyjna (system-config.ts, 05.08.2026), jest 403,
// które mówi o MODULE, a nie o użytkowniku: próba aktywacji modułu spoza
// ENABLED_MODULES. Bez wyjątku admin dostawał najpierw mylące "Brak uprawnień",
// a wymuszony refetch authorizedApps() mógł go w skrajnym przypadku wyrzucić na
// pełnoekranowy <AccessDeniedScreen> (app-gate.tsx) za czynność, do której ma
// pełne prawo. Ten plik powstał, bo review 05.08.2026 wskazało, że NIC nie
// pilnowało tej listy — wpis dało się usunąć refaktorem i cała suita zostawała
// zielona.

import { afterEach, describe, expect, it, vi } from "vitest"
import { apiClient, setForbiddenHandler } from "./client"

afterEach(() => {
  setForbiddenHandler(null)
  vi.unstubAllGlobals()
})

/** Zbiera ścieżki, na których klient uznał 403 za utratę dostępu. */
function captureForbidden(): string[] {
  const seen: string[] = []
  setForbiddenHandler((path) => seen.push(path))
  return seen
}

function stubForbidden(message = "nie"): void {
  vi.stubGlobal("fetch", async () =>
    Promise.resolve(
      new Response(JSON.stringify({ message }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  )
}

describe("apiClient — 403 a globalny handler utraty dostępu", () => {
  it("zgłasza utratę dostępu na zwykłej ścieżce", async () => {
    const seen = captureForbidden()
    stubForbidden()

    await expect(apiClient.get("/api/system-config/users")).rejects.toThrow()

    expect(seen).toEqual(["/api/system-config/users"])
  })

  it("NIE zgłasza utraty dostępu, gdy 403 dotyczy licencji modułu", async () => {
    // Ta ścieżka MUSI zostać na liście wyjątków. Jej usunięcie sprawia, że
    // odmowa licencyjna udaje odebranie uprawnień adminowi.
    const seen = captureForbidden()
    stubForbidden("Moduł geo-score-calculator nie jest objęty licencją")

    await expect(
      apiClient.post("/api/system-config/applications/activate", {
        jsonBody: { code: "geo-score-calculator" },
      }),
    ).rejects.toThrow()

    expect(seen).toEqual([])
  })

  it("przepuszcza komunikat serwera nietknięty — to on niesie powód odmowy", async () => {
    // Bez tego admin zobaczyłby wyłącznie generyczny fallback i nie wiedziałby,
    // że chodzi o licencję, a nie o jego konto.
    stubForbidden("Moduł geo-score-calculator nie jest objęty licencją")

    await expect(
      apiClient.post("/api/system-config/applications/activate", {
        jsonBody: { code: "geo-score-calculator" },
      }),
    ).rejects.toThrow("Moduł geo-score-calculator nie jest objęty licencją")
  })

  it("nie rusza handlera przy innych statusach niż 403", async () => {
    const seen = captureForbidden()
    vi.stubGlobal("fetch", async () => Promise.resolve(new Response("{}", { status: 409 })))

    await expect(apiClient.post("/api/system-config/applications")).rejects.toThrow()

    expect(seen).toEqual([])
  })
})
