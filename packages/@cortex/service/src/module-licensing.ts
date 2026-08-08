// Minimalna lista dozwolonych modułów instancji (PROJECT/cortex-frontend-
// module-licensing-mvp.md, decyzja Alexa): "Config/tabela z listą kodów
// modułów włączonych dla danej instancji... Zero kluczy/pakietów/wygasania —
// pierwszy krok w stronę modularności, nie cały system."
//
// `ENABLED_MODULES` (comma-separated, ten sam wzorzec co `CONTENT_GURU_MODELS`
// w app/idp/lib/content-guru/config.ts) bramkuje WYŁĄCZNIE kandydatów
// `kind=native` w picker'ze "Dodaj aplikację" (listUnactivatedNativeApplications
// w system-config.ts) — NIE dotyka już aktywowanych/legacy wierszy (D2 w
// design docu, uzasadnienie zakresu). Nieustawione/puste = bez ograniczeń,
// dokładnie dzisiejsze zachowanie (backward compatible).
//
// code-config: config WYŁĄCZNIE tej jednej funkcji (bramka licencyjna), nie
// dopisywany do żadnego modułowego config.ts ani odwrotnie.
//
// ISTNIEJE DRUGA IMPLEMENTACJA `isModuleEnabled()`: packages/@cortex/db/
// scripts/module-licensing.mjs, wykonywana przez seed (BOOTSTRAP_MODULES musi
// przechodzić przez tę samą bramkę, a seedy są czystym .mjs bez toolchainu TS
// — uzasadnienie w nagłówku tamtego pliku). Zmiana SEMANTYKI tutaj — zwłaszcza
// kierunku fail-open/fail-closed przy pustej liście — musi trafić tam też.
// Pilnuje tego module-licensing.parity.test.mjs obok tamtej kopii.

import { z } from "zod"

/** Pusty string to NIE jest wartość — docker-compose wstawia `VAR: ${VAR:-}`,
 *  więc nieustawiona zmienna dociera tu jako "" (ten sam wzorzec co
 *  `orUndefined()` w app/idp/lib/content-guru/config.ts). */
function orUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** `"a, b,,c"` -> `["a", "b", "c"]`. Pusta lista po filtrowaniu (same
 *  przecinki) liczy się jak brak wartości — `null`, nie pusta tablica
 *  (pusta tablica oznaczałaby "zero modułów dozwolonych", co NIE jest tym,
 *  co ma robić nieustawiona/pusta zmienna). */
function parseModuleList(value: string | undefined): string[] | undefined {
  if (!value) return undefined
  const codes = value
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean)
  return codes.length > 0 ? codes : undefined
}

const schema = z.object({
  ENABLED_MODULES: z.array(z.string().min(1)).min(1).nullable().default(null),
})

export interface ModuleLicensingConfig {
  /** `null` = bez ograniczeń, wszystkie zarejestrowane manifesty widoczne w
   *  picker'ze "Dodaj aplikację" — zachowanie identyczne z dzisiejszym, dla
   *  instancji która nie opt-in'uje w licencjonowanie modułów. Niepusta
   *  tablica = wyłącznie te kody. */
  enabledModules: string[] | null
}

/** Czytane przy każdym wywołaniu, nie na starcie modułu — ten sam powód co
 *  `contentGuruConfig()`: testy i build nie muszą mieć kompletu zmiennych
 *  tylko po to, żeby zaimportować plik. */
export function moduleLicensingConfig(): ModuleLicensingConfig {
  const parsed = schema.parse({
    ENABLED_MODULES: parseModuleList(orUndefined(process.env.ENABLED_MODULES)) ?? null,
  })

  return { enabledModules: parsed.ENABLED_MODULES }
}

/** Fail-open przy braku konfiguracji (bez ograniczeń), fail-closed przy
 *  ustawionej liście (kod spoza niej -> false) — ten sam kształt reguły co
 *  `isAllowedContentGuruModel()`. */
export function isModuleEnabled(code: string): boolean {
  const { enabledModules } = moduleLicensingConfig()
  return enabledModules === null || enabledModules.includes(code)
}
