// Config TEGO modułu i tylko tego (code-config) — żadnego dopisywania do
// wspólnego, rosnącego pliku walidującego wszystkie zmienne appki.
//
// CORTEX_PROXY_URL / CORTEX_PROXY_API_KEY już istnieją i należą do adaptera
// cortex-proxy, nie do Visual Guru — świadomie NIE są tu walidowane.
//
// Jeden model w v1 (D3, design doc sekcja 2) — Visual Guru pomija krok "N
// opisów kandydatów" legacy Streamlita, więc nie potrzebuje osobnego modelu
// tekstowego jak Ilustromat (ILUSTROMAT_TEXT_MODEL).
//
// Domyślna wartość — to samo google/gemini-3.1-flash-lite-image, którego
// Ilustromat już używa produkcyjnie — POTWIERDZONA spike'em Fazy 0
// (PROJECT/cortex-frontend-visual-guru-tile-projekt.md sekcja 3/9): wywołanie
// z realnym obrazem referencyjnym przez ten model, przez multi-part content
// na /v1/chat/completions, faktycznie odtworzyło kształt/kolory referencji
// (nie zignorowało jej) — ryzyko techniczne D4 rozstrzygnięte pozytywnie.

import { z } from "zod"

const schema = z.object({
  /** Jedyny model tego modułu: generacja obrazów (z opcjonalnym obrazem
   *  referencyjnym jako część multi-part content, Ścieżka B — D4). */
  VISUAL_GURU_IMAGE_MODEL: z.string().min(1).default("google/gemini-3.1-flash-lite-image"),
})

export interface VisualGuruConfig {
  imageModel: string
}

/** Pusty string to NIE jest wartość — docker-compose wstawia `VAR: ${VAR:-}`,
 *  więc nieustawiona zmienna dociera tu jako "". Zodowe `.default()` łapie
 *  wyłącznie `undefined`, więc bez tej normalizacji pusta zmienna wywracałaby
 *  kontener na `min(1)` zamiast wziąć wartość domyślną. Wzorem
 *  lib/ilustromat/config.ts. */
function orUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** Czytane przy każdym wywołaniu, nie na starcie modułu — inaczej testy i
 *  build musiałyby mieć komplet zmiennych tylko po to, żeby zaimportować plik. */
export function visualGuruConfig(): VisualGuruConfig {
  const parsed = schema.parse({
    VISUAL_GURU_IMAGE_MODEL: orUndefined(process.env.VISUAL_GURU_IMAGE_MODEL),
  })

  return {
    imageModel: parsed.VISUAL_GURU_IMAGE_MODEL,
  }
}

/** Nagłówek X-Scope — jedna wartość, Visual Guru nie ma osobnego prompt
 *  buildera jak Ilustromat (D3). */
export const SCOPES = {
  generation: "visual-guru-generation",
} as const

export const SOURCE_APP = "Cortex360 Visual Guru"
export const APP_LABEL = "Visual Guru"
