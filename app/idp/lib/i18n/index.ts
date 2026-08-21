"use client"

import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import { DEFAULT_LOCALE, DEFAULT_NS, resources } from "./config"

/**
 * Jedna instancja i18next na proces przeglądarki. `init()` jest idempotentny
 * przez `isInitialized` — Fast Refresh w dev potrafi ten moduł przeładować,
 * a druga inicjalizacja gubi aktualnie wybrany język.
 */
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: DEFAULT_LOCALE,
    fallbackLng: DEFAULT_LOCALE,
    defaultNS: DEFAULT_NS,
    // BRAK KLUCZA W `en` MA POKAZAĆ POLSKI ORYGINAŁ, nie surowy klucz.
    // Klient zobaczy wtedy niedokończone tłumaczenie zamiast czegoś, co
    // wygląda na zepsutą aplikację (§Ryzyka projektu).
    fallbackNS: false,
    interpolation: { escapeValue: false },
    // Klucz z kropką jest u nas ścieżką zagnieżdżenia, a nie literałem.
    keySeparator: ".",
    nsSeparator: ":",
    returnNull: false,
  })
}

export default i18n
