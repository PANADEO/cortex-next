// Config TEGO modułu i tylko tego (code-config) — bez dopisywania do wspólnego,
// rosnącego pliku walidującego wszystkie zmienne appki.
//
// DWA RÓŻNE SEKRETY, nie jeden:
//   CORTEX_PROXY_API_KEY        — Bearer do /v1/chat/completions. NIE działa tu.
//   CORTEX_PROXY_ADMIN_API_KEY  — wartość ADMIN_API_KEY z cortex-proxy, nagłówek
//                                 X-Admin-API-Key, jedyne, co otwiera /usage.
//
// ŚWIADOME ODSTĘPSTWO od "fail-closed na starcie" z code-config pkt 2:
// walidacja jest LENIWA (safeParse przy wywołaniu), nie `parse()` na poziomie
// importu. Powód jest konkretny, nie wygoda: moduł route'a ładuje się razem
// z resztą appki, więc rzucenie przy imporcie z powodu braku JEDNEGO sekretu
// wywróciłoby wszystkie pozostałe kafelki. Zamiast tego brak konfiguracji =
// 503 z tego jednego endpointu, reszta systemu działa dalej.

import { z } from "zod"

/** `z.string().url()` NIE wystarcza: `new URL("localhost:8240")` jest poprawne
 *  (protokół "localhost:"), więc adres bez schematu przeszedłby walidację i
 *  wywrócił się dopiero na `fetch` z mylącym komunikatem. Wymuszamy http/https. */
const httpUrl = z
  .string()
  .url()
  .refine(
    (value) => value.startsWith("http://") || value.startsWith("https://"),
    "URL musi zaczynać się od http:// albo https://",
  )

const schema = z.object({
  CORTEX_PROXY_URL: httpUrl,
  CORTEX_PROXY_ADMIN_API_KEY: z.string().min(1),
})

export interface TokenUsageConfig {
  baseUrl: string
  /** SEKRET. Wolno go przekazać wyłącznie do adaptera cortex-proxy.
   *  Nigdy do odpowiedzi HTTP, nigdy do console.*, nigdy do query stringu. */
  adminApiKey: string
}

export type TokenUsageConfigResult =
  { ok: true; config: TokenUsageConfig } | { ok: false; missing: string[] }

/** Pusty string to NIE jest wartość — docker-compose wstawia `VAR: ${VAR:-}`,
 *  więc nieustawiona zmienna dociera tu jako "". Bez tej normalizacji pusty
 *  sekret przeszedłby przez `min(1)`... nie przeszedłby, ale `.url()` na ""
 *  dałby mylący komunikat "invalid url" zamiast "brak zmiennej". */
function orUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Czytane przy KAŻDYM wywołaniu, nie raz na starcie modułu — inaczej zmiana
 * konfiguracji wymagałaby restartu, a testy musiałyby mieć komplet zmiennych
 * tylko po to, żeby zaimportować plik.
 *
 * Zwraca NAZWY brakujących zmiennych, nigdy ich wartości — ta lista trafia
 * do odpowiedzi 503 i widzi ją administrator w przeglądarce.
 */
export function tokenUsageConfig(): TokenUsageConfigResult {
  const parsed = schema.safeParse({
    CORTEX_PROXY_URL: orUndefined(process.env.CORTEX_PROXY_URL),
    CORTEX_PROXY_ADMIN_API_KEY: orUndefined(process.env.CORTEX_PROXY_ADMIN_API_KEY),
  })

  if (!parsed.success) {
    const missing = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))]
    return { ok: false, missing }
  }

  return {
    ok: true,
    config: {
      baseUrl: parsed.data.CORTEX_PROXY_URL,
      adminApiKey: parsed.data.CORTEX_PROXY_ADMIN_API_KEY,
    },
  }
}

/** Kod kafelka w rejestrze (system_config.applications) — po nim pyta
 *  requireTileAccess(). Kebab-case, spójnie z system-config/ilustromat. */
export const TOKEN_USAGE_APP_CODE = "token-usage"
