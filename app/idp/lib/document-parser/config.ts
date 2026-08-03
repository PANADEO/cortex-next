// Config TEGO modułu i tylko tego (code-config) — żadnego dopisywania do
// wspólnego, rosnącego pliku walidującego wszystkie zmienne appki.
//
// Sensowny domyślny adres, tak jak GEO_SCORE_SERVICE_URL (app/idp/lib/geo-
// score-calculator/config.ts): backend document-parser jest kontenerem W TYM
// SAMYM docker-compose.yml (services/document-parser/), więc jego adres
// Docker DNS + port (Dockerfile: EXPOSE 8000, D6 — brak `ports:`, osiągalny
// wyłącznie wewnątrz sieci compose) jest znaną z góry stałą.

import { z } from "zod"

const schema = z.object({
  DOCUMENT_PARSER_BACKEND_URL: z.string().url().default("http://document-parser-backend:8000"),
})

export interface DocumentParserConfig {
  backendUrl: string
}

/** Pusty string to NIE jest wartość — docker-compose wstawia `VAR: ${VAR:-}`,
 *  więc nieustawiona zmienna dociera tu jako "". Zodowe `.default()` łapie
 *  wyłącznie `undefined` (wzorem geo-score-calculator/config.ts). */
function orUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** Czytane przy każdym wywołaniu, nie na starcie modułu — inaczej testy i
 *  build musiałyby mieć komplet zmiennych tylko po to, żeby zaimportować plik. */
export function documentParserConfig(): DocumentParserConfig {
  const parsed = schema.parse({
    DOCUMENT_PARSER_BACKEND_URL: orUndefined(process.env.DOCUMENT_PARSER_BACKEND_URL),
  })

  return { backendUrl: parsed.DOCUMENT_PARSER_BACKEND_URL }
}
