// Bramka kafelka. Wzorzec 1:1 z system-config/_lib/guard.ts.
//
// WYŁĄCZNIE warstwa gruboziarnista (requireTileAccess) — bez requireTileScope().
// To nie jest niedopatrzenie: cały ekran ma jeden poziom dostępu (albo widzisz
// raport, albo nie), dokładnie jak dziś w cortex-admin. Warstwa granularna ma
// dziś jednego konsumenta (Ilustromat) i niech tak zostanie; drugi konsument
// w tym samym tygodniu to sprzężenie bez powodu.
//
// Za tą bramką leży lista e-maili WSZYSTKICH użytkowników wraz z ich
// aktywnością — waga tego pliku jest wyższa niż przy zwykłym kafelku.

import { requireTileAccess } from "@cortex/service"
import { NextResponse } from "next/server"
import { CortexProxyUsageError } from "@cortex/api/cortex-proxy-client"
import { TOKEN_USAGE_APP_CODE } from "@/lib/token-usage/config"

/**
 * Zwraca gotową odpowiedź odmowną albo null, gdy wolno przepuścić dalej.
 * Kolejność wg code-api/SKILL.md: auth PRZED jakąkolwiek pracą — także przed
 * odczytem konfiguracji i przed dotknięciem cortex-proxy.
 */
export async function denyUnlessAllowed(request: Request): Promise<NextResponse | null> {
  const access = await requireTileAccess(request, TOKEN_USAGE_APP_CODE)
  if (access.allowed) return null

  // Brak tożsamości to 401, tożsamość bez grantu to 403 — rozróżnienie ma
  // znaczenie dla klienta (zaloguj się vs poproś o uprawnienia).
  return access.email
    ? NextResponse.json({ error: "forbidden" }, { status: 403 })
    : NextResponse.json({ error: "missing-email" }, { status: 401 })
}

/**
 * Mapuje awarię integracji na odpowiedź HTTP. Każdy rodzaj dostaje WŁASNY kod
 * w ciele, żeby UI mógł powiedzieć administratorowi coś konkretnego zamiast
 * uniwersalnego "wystąpił błąd".
 *
 * BEZPIECZEŃSTWO: do odpowiedzi trafia wyłącznie nasz własny komunikat.
 * Ani sekret, ani ciało odpowiedzi z cortex-proxy, ani URL nie przechodzą tędy
 * dalej — CortexProxyUsageError jest konstruowany po naszej stronie właśnie po to.
 */
export function toUsageErrorResponse(error: unknown): NextResponse {
  if (error instanceof CortexProxyUsageError) {
    // Klucz jest ustawiony, ale proxy go odrzuciło — to nasza konfiguracja,
    // nie wina użytkownika. Logujemy sam fakt; wartość klucza nie istnieje
    // w treści błędu, więc nie ma czym wyciec.
    if (error.failure === "unauthorized") {
      console.error("[token-usage] cortex-proxy odrzucił klucz administracyjny")
      return NextResponse.json(
        {
          error: "cortex-proxy-unauthorized",
          message: "cortex-proxy odrzucił klucz administracyjny.",
        },
        { status: 502 },
      )
    }

    if (error.failure === "unreachable") {
      console.error("[token-usage] cortex-proxy nieosiągalny:", error.message)
      return NextResponse.json(
        { error: "cortex-proxy-unreachable", message: "cortex-proxy nie odpowiada." },
        { status: 502 },
      )
    }

    console.error("[token-usage] błąd odpowiedzi cortex-proxy:", error.failure, error.message)
    return NextResponse.json(
      { error: "cortex-proxy-error", message: "cortex-proxy zwrócił nieoczekiwaną odpowiedź." },
      { status: 502 },
    )
  }

  console.error("[token-usage] nieoczekiwany błąd obsługi żądania:", error)
  return NextResponse.json({ error: "internal-error" }, { status: 500 })
}
