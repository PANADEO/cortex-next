// Config TEGO modułu i tylko tego (code-config) — żadnego dopisywania do
// wspólnego, rosnącego pliku walidującego wszystkie zmienne appki.
//
// CORTEX_PROXY_URL / CORTEX_PROXY_API_KEY już istnieją i należą do adaptera
// cortex-proxy, nie do Ilustromatu — świadomie NIE są tu walidowane.
//
// Modele są konfigurowalne per instancja klienta (nie zaszyte w kodzie),
// z domyślnymi wartościami sprawdzonymi produkcyjnie w PoC u Crido.

import { z } from "zod"

const schema = z.object({
  /** Tani model tekstowy: prompt builder + "Popraw (AI)". */
  ILUSTROMAT_TEXT_MODEL: z.string().min(1).default("openai/gpt-4o-mini"),
  /** Model obrazkowy: generacja teł (~0,034 USD/obraz przy domyślnym). */
  ILUSTROMAT_IMAGE_MODEL: z.string().min(1).default("google/gemini-3.1-flash-lite-image"),
})

export interface IlustromatConfig {
  textModel: string
  imageModel: string
}

/** Czytane przy każdym wywołaniu, nie na starcie modułu — inaczej testy i
 *  build musiałyby mieć komplet zmiennych tylko po to, żeby zaimportować plik. */
export function ilustromatConfig(): IlustromatConfig {
  const parsed = schema.parse({
    ILUSTROMAT_TEXT_MODEL: process.env.ILUSTROMAT_TEXT_MODEL,
    ILUSTROMAT_IMAGE_MODEL: process.env.ILUSTROMAT_IMAGE_MODEL,
  })

  return {
    textModel: parsed.ILUSTROMAT_TEXT_MODEL,
    imageModel: parsed.ILUSTROMAT_IMAGE_MODEL,
  }
}

/** Nagłówek X-Scope — te same wartości co w PoC, żeby nie rozjechać
 *  atrybucji kosztów po stronie cortex-proxy. */
export const SCOPES = {
  generation: "ilustromat-generation",
  promptBuilder: "ilustromat-prompt-builder",
  textEnhance: "ilustromat-text-enhance",
} as const

export const SOURCE_APP = "Cortex360 Ilustromat"
export const APP_LABEL = "Ilustromat"
