import enAiTools from "@/locales/en/ai-tools.json"
import enCommon from "@/locales/en/common.json"
import enContentGuru from "@/locales/en/content-guru.json"
import enCortexConfig from "@/locales/en/cortex-config.json"
import enCortexCowork from "@/locales/en/cortex-cowork.json"
import enDocumentParser from "@/locales/en/document-parser.json"
import enGeoScoreCalculator from "@/locales/en/geo-score-calculator.json"
import enIdpBasic from "@/locales/en/idp-basic.json"
import enIdp from "@/locales/en/idp.json"
import enIlustromat from "@/locales/en/ilustromat.json"
import enIntrastat from "@/locales/en/intrastat.json"
import enInvoiceSupervisor from "@/locales/en/invoice-supervisor.json"
import enOknaCzasowe from "@/locales/en/okna-czasowe.json"
import enShell from "@/locales/en/shell.json"
import enStorePit from "@/locales/en/store-pit.json"
import enSystemConfig from "@/locales/en/system-config.json"
import enTiles from "@/locales/en/tiles.json"
import enTokenUsage from "@/locales/en/token-usage.json"
import enUi from "@/locales/en/ui.json"
import enVisualGuru from "@/locales/en/visual-guru.json"
import plAiTools from "@/locales/pl/ai-tools.json"
import plCommon from "@/locales/pl/common.json"
import plContentGuru from "@/locales/pl/content-guru.json"
import plCortexConfig from "@/locales/pl/cortex-config.json"
import plCortexCowork from "@/locales/pl/cortex-cowork.json"
import plDocumentParser from "@/locales/pl/document-parser.json"
import plGeoScoreCalculator from "@/locales/pl/geo-score-calculator.json"
import plIdpBasic from "@/locales/pl/idp-basic.json"
import plIdp from "@/locales/pl/idp.json"
import plIlustromat from "@/locales/pl/ilustromat.json"
import plIntrastat from "@/locales/pl/intrastat.json"
import plInvoiceSupervisor from "@/locales/pl/invoice-supervisor.json"
import plOknaCzasowe from "@/locales/pl/okna-czasowe.json"
import plShell from "@/locales/pl/shell.json"
import plStorePit from "@/locales/pl/store-pit.json"
import plSystemConfig from "@/locales/pl/system-config.json"
import plTokenUsage from "@/locales/pl/token-usage.json"
import plUi from "@/locales/pl/ui.json"
import plVisualGuru from "@/locales/pl/visual-guru.json"

/**
 * Języki interfejsu. `pl` jest źródłowy — to w nim pisze się nowe napisy,
 * a `en` jest tłumaczeniem, nigdy odwrotnie.
 */
export const LOCALES = ["pl", "en"] as const
export type Locale = (typeof LOCALES)[number]

/** Język, w którym pisze się nowe napisy i w którym baza jest źródłem prawdy
 *  dla nazw kafelków. Tłumaczenia powstają Z niego, nigdy do niego. */
export const SOURCE_LOCALE: Locale = "pl"

/** Język pokazywany przy pierwszej wizycie. Zostaje polski, bo instancja jest
 *  dziś polska; wybór użytkownika i tak go nadpisuje. */
export const DEFAULT_LOCALE: Locale = "pl"

/**
 * Język, na który spada BRAK KLUCZA. Angielski, nie polski — decyzja Alexa
 * (21.08.2026: „będzie bardziej międzynarodowe").
 *
 * Rozstrzyga asymetria skutków, nie preferencja: luka pokazana Polakowi po
 * angielsku jest niewygodna, luka pokazana klientowi ze Szwajcarii po polsku
 * wygląda na produkt niegotowy. Cezary sam to zresztą przesądził — „Polakom
 * można pokazywać trudne kafelki po angielsku".
 *
 * Przy `pl` i `en` o identycznych zestawach kluczy (pilnuje test parzystości)
 * ten zapas prawie nigdy się nie odpala. Ma znaczenie dopiero dla przestrzeni
 * dokładanych później i dla przyszłego trzeciego języka.
 */
export const FALLBACK_LOCALE: Locale = "en"

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value)
}

/**
 * Przestrzenie nazw = pliki JSON. Jedna na powłokę (`common`), jedna na
 * katalog kafelków (`tiles`), dalej po jednej na kafelek — dzięki temu nowy
 * kafelek dokłada dwa pliki i nie dotyka cudzych tłumaczeń (D3).
 *
 * Zasoby są WBUDOWANE w bundel, nie dociągane po sieci. Powód jest ten sam,
 * dla którego preset instancji czyta się na serwerze: przełączenie języka nie
 * ma prawa pokazać na moment surowych kluczy ani pustego ekranu. Cena to
 * kilkadziesiąt kilobajtów w bundlu — przy dwóch językach akceptowalna.
 */
export const resources = {
  pl: {
    common: plCommon,
    shell: plShell,
    "system-config": plSystemConfig,
    "ai-tools": plAiTools,
    "invoice-supervisor": plInvoiceSupervisor,
    intrastat: plIntrastat,
    "cortex-config": plCortexConfig,
    "cortex-cowork": plCortexCowork,
    "content-guru": plContentGuru,
    "document-parser": plDocumentParser,
    "geo-score-calculator": plGeoScoreCalculator,
    "visual-guru": plVisualGuru,
    "token-usage": plTokenUsage,
    ilustromat: plIlustromat,
    "okna-czasowe": plOknaCzasowe,
    idp: plIdp,
    ui: plUi,
    "idp-basic": plIdpBasic,
    "store-pit": plStorePit,
  },
  en: {
    common: enCommon,
    shell: enShell,
    tiles: enTiles,
    "system-config": enSystemConfig,
    "ai-tools": enAiTools,
    "invoice-supervisor": enInvoiceSupervisor,
    intrastat: enIntrastat,
    "cortex-config": enCortexConfig,
    "cortex-cowork": enCortexCowork,
    "content-guru": enContentGuru,
    "document-parser": enDocumentParser,
    "geo-score-calculator": enGeoScoreCalculator,
    "visual-guru": enVisualGuru,
    "token-usage": enTokenUsage,
    ilustromat: enIlustromat,
    "okna-czasowe": enOknaCzasowe,
    idp: enIdp,
    ui: enUi,
    "idp-basic": enIdpBasic,
    "store-pit": enStorePit,
  },
} as const

export const DEFAULT_NS = "common"
