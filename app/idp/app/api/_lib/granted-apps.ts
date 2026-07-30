// Jedno miejsce, w którym warstwa HTTP zamienia "nie dało się odczytać
// uprawnień" na "użytkownik nie ma żadnych". Zastępuje dawne _lib/access.ts
// (HTTP do zewnętrznego cortex-admin + własny, drugi cache) — źródłem jest
// teraz wyłącznie własny Postgres przez @cortex/service.
//
// Dlaczego fail-closed jest TUTAJ, a nie w @cortex/service:
// getGrantedApplicationCodes() celowo propaguje wyjątek, żeby awaria bazy
// została zalogowana i była odróżnialna od pustej listy grantów. Kontroler
// jest jedynym miejscem, które wie, co z tym zrobić w odpowiedzi HTTP —
// a odpowiedź jest zawsze ta sama: zero uprawnień, nigdy przepuszczenie.

import { getGrantedApplicationCodes } from "@cortex/service"

export async function grantedAppCodes(email: string): Promise<string[]> {
  try {
    return await getGrantedApplicationCodes(email)
  } catch (error) {
    console.error("[api] odmowa dostępu — błąd odczytu uprawnień:", error)
    return []
  }
}
