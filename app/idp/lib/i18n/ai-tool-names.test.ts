import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { AI_TOOL_DEFINITIONS } from "../ai-tools/registry"
import { aiToolShortLabel } from "./ai-tool-names"
import { LOCALES } from "./config"
import i18n from "./index"

/**
 * Bramka na klucze SKLEJANE z identyfikatora narzędzia.
 *
 * `keys-exist` sprawdza wyłącznie klucze podane literałem, a
 * `shortLabels.${tool.id}` literałem nie jest — literówka w identyfikatorze
 * albo narzędzie dołożone do rejestru bez wpisu w tłumaczeniach przechodzi
 * przez wszystkie pozostałe strażniki i objawia się dopiero na ekranie:
 * w menu bocznym staje polska nazwa z rejestru zamiast angielskiej.
 * Źródłem prawdy o tym, ILE tych kluczy ma być, jest rejestr — dlatego test
 * czyta `AI_TOOL_DEFINITIONS`, a nie drugą, ręczną listę.
 */
const localesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../locales")

function shortLabels(locale: string): Record<string, unknown> {
  const bundle = JSON.parse(
    readFileSync(path.join(localesDir, locale, "ai-tools.json"), "utf8"),
  ) as Record<string, unknown>
  return (bundle.shortLabels ?? {}) as Record<string, unknown>
}

describe("krótkie nazwy narzędzi AI", () => {
  it.each(LOCALES)("%s: każde narzędzie z rejestru ma swoją krótką nazwę", (locale) => {
    const labels = shortLabels(locale)
    const missing = AI_TOOL_DEFINITIONS.filter((tool) => typeof labels[tool.id] !== "string").map(
      (tool) => tool.id,
    )

    expect({ bezKrotkiejNazwy: missing }).toEqual({ bezKrotkiejNazwy: [] })
  })

  it.each(LOCALES)("%s: żadna krótka nazwa nie wisi bez narzędzia", (locale) => {
    const ids: readonly string[] = AI_TOOL_DEFINITIONS.map((tool) => tool.id)
    const orphans = Object.keys(shortLabels(locale)).filter((id) => !ids.includes(id))

    expect({ withoutTools: orphans }).toEqual({ withoutTools: [] })
  })

  it("brak wpisu spada na nazwę z rejestru, nie na surowy klucz", () => {
    const t = i18n.getFixedT("en", "ai-tools")
    expect(aiToolShortLabel(t, "narzedzie-bez-tlumaczenia", "Zapas")).toBe("Zapas")
  })
})
