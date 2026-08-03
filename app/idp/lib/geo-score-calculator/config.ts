// Config TEGO modułu i tylko tego (code-config) — żadnego dopisywania do
// wspólnego, rosnącego pliku walidującego wszystkie zmienne appki.
//
// Sensowny domyślny adres, w odróżnieniu od CORTEX_PROXY_URL (serwis POZA
// tym compose, wymaga jawnej konfiguracji): mikroserwis geo-score-calculator
// jest kontenerem W TYM SAMYM docker-compose.yml (services/geo-score-
// calculator/), więc jego nazwa Docker DNS jest znaną z góry stałą — patrz
// docker-compose.yml/docker-compose.image.yml.

import { z } from "zod"

const schema = z.object({
  GEO_SCORE_SERVICE_URL: z.string().url().default("http://geo-score-calculator:8000"),
})

export interface GeoScoreCalculatorConfig {
  serviceUrl: string
}

/** Pusty string to NIE jest wartość — docker-compose wstawia `VAR: ${VAR:-}`,
 *  więc nieustawiona zmienna dociera tu jako "". Zodowe `.default()` łapie
 *  wyłącznie `undefined` (wzorem app/idp/lib/ilustromat/config.ts — bez tej
 *  normalizacji pusta zmienna wywracałaby kontener na `z.string().url()`
 *  zamiast wziąć wartość domyślną). */
function orUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** Czytane przy każdym wywołaniu, nie na starcie modułu — inaczej testy i
 *  build musiałyby mieć komplet zmiennych tylko po to, żeby zaimportować plik
 *  (ten sam powód co ilustromatConfig()). */
export function geoScoreCalculatorConfig(): GeoScoreCalculatorConfig {
  const parsed = schema.parse({
    GEO_SCORE_SERVICE_URL: orUndefined(process.env.GEO_SCORE_SERVICE_URL),
  })

  return { serviceUrl: parsed.GEO_SCORE_SERVICE_URL }
}
