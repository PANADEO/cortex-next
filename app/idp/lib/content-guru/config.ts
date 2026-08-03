// Config TEGO modułu i tylko tego (code-config) — żadnego dopisywania do
// wspólnego, rosnącego pliku walidującego wszystkie zmienne appki.
//
// D3, ZREWIDOWANE przez Alexa 03.08.2026 względem pierwotnego szkicu design
// docu (PROJECT/cortex-frontend-content-guru-full-port-projekt.md §9 p.4):
// NIE pojedynczy `CONTENT_GURU_MODEL` (wzorem `ILUSTROMAT_TEXT_MODEL`) —
// Alex wybrał "wybór z ograniczonej, skonfigurowanej listy". `CONTENT_GURU_MODELS`
// to lista (comma-separated w env, jak `categoryDepartment` w seedzie —
// jedyny precedens listy w tym repo, tam jako kolumna Postgres array, tu
// jako env var), a wybór KONKRETNEGO modelu per generacja przenosi się na
// `Select` na ekranie generowania (Faza 1, jeszcze nie zbudowany) + Zod
// walidacja "czy wybrany model jest w tej liście" (fail-closed, nie dowolny
// string jak w legacy `llm_model`). Ten plik dostarcza WYŁĄCZNIE listę +
// walidator przynależności — sam UI/request handling jest poza zakresem
// Fazy 0.
//
// Wywołania idą przez cortex-proxy (integration-client.ts w tym samym
// folderze), nie bezpośrednio do dostawcy — ta sama zasada co Ilustromat.

import { z } from "zod"

const DEFAULT_MODELS = ["anthropic/claude-sonnet-4.6", "openai/gpt-4o-mini"] as const

/** Pusty string to NIE jest wartość — docker-compose wstawia `VAR: ${VAR:-}`,
 *  więc nieustawiona zmienna dociera tu jako "". Bez tej normalizacji pusta
 *  zmienna wywracałaby walidację zamiast wziąć wartość domyślną (wzorem
 *  `orUndefined()` w app/idp/lib/ilustromat/config.ts). */
function orUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** `"model-a, model-b,,model-c"` -> `["model-a", "model-b", "model-c"]`.
 *  Pusta lista po filtrowaniu (np. same przecinki) liczy się jak brak
 *  wartości — Zod bierze wtedy `.default()`, nie pustą tablicę. */
function parseModelList(value: string | undefined): string[] | undefined {
  if (!value) return undefined
  const models = value
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean)
  return models.length > 0 ? models : undefined
}

const schema = z.object({
  CONTENT_GURU_MODELS: z
    .array(z.string().min(1))
    .min(1)
    .default([...DEFAULT_MODELS]),
})

export interface ContentGuruConfig {
  /** Dozwolone modele, w kolejności z konfiguracji — pierwszy jest domyślnie
   *  zaznaczony w Select na ekranie generowania (Faza 1). */
  models: string[]
}

/** Czytane przy każdym wywołaniu, nie na starcie modułu — inaczej testy i
 *  build musiałyby mieć komplet zmiennych tylko po to, żeby zaimportować
 *  plik (ten sam powód co `ilustromatConfig()`). */
export function contentGuruConfig(): ContentGuruConfig {
  const parsed = schema.parse({
    CONTENT_GURU_MODELS: parseModelList(orUndefined(process.env.CONTENT_GURU_MODELS)),
  })

  return { models: parsed.CONTENT_GURU_MODELS }
}

/** Fail-closed: request handler (Faza 1) odrzuca każdy model spoza tej
 *  listy zamiast przepuścić dowolny string do cortex-proxy, jak robił
 *  legacy `llm_model`. */
export function isAllowedContentGuruModel(model: string): boolean {
  return contentGuruConfig().models.includes(model)
}

/** Nagłówek X-Scope — atrybucja kosztów po stronie cortex-proxy, wzorem
 *  `SCOPES` w app/idp/lib/ilustromat/config.ts. Rozszerzane w kolejnych
 *  fazach (mini-generatory mają własny scope w design doc D8) — na razie
 *  tylko generacja właściwa, jedyna ścieżka, którą Faza 0 przewiduje
 *  jako przyszłego konsumenta integration-client.ts. */
export const SCOPES = {
  generation: "content-guru-generation",
} as const

export const SOURCE_APP = "Cortex360 Content Guru"
export const APP_LABEL = "Content Guru"

/** Kod kafelka w rejestrze (system_config.applications) — po nim pyta
 *  requireTileAccess(). Ten sam, niezmieniony kod co dzisiejsze AI-Tools-hub
 *  narzędzie (D1 — zachowuje istniejące granty RBAC). */
export const CONTENT_GURU_APP_CODE = "content-guru"

/** Warstwa GRANULARNA (Round B, design doc D6/D9) — kto może zarządzać
 *  szablonami (zasobem WSPÓLNYM między userami kafelka). Identyczna nazwa
 *  kodu co w Ilustromacie (`MANAGE_TEMPLATES_SCOPE` w
 *  packages/@cortex/service/src/ilustromat.ts) — to NIE jest kolizja,
 *  `application_scopes` jest per-`application_id`, każdy kafelek ma własną
 *  przestrzeń nazw scope'ów. Sama dostępność kafelka (`requireTileAccess`)
 *  wystarcza do UŻYWANIA szablonów w generowaniu; edycja wymaga tego scope'u
 *  (`requireTileScope`, patrz api/content-guru/_lib/guard.ts). Seedowany w
 *  packages/@cortex/db/scripts/seed-content-guru.mjs. */
export const CONTENT_GURU_MANAGE_TEMPLATES_SCOPE = "manage-templates"
