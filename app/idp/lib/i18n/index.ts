"use client"

import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import { DEFAULT_LOCALE, DEFAULT_NS, FALLBACK_LOCALE, resources } from "./config"

/**
 * Jedna instancja i18next na proces przeglądarki. `init()` jest idempotentny
 * przez `isInitialized` — Fast Refresh w dev potrafi ten moduł przeładować,
 * a druga inicjalizacja gubi aktualnie wybrany język.
 */
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: DEFAULT_LOCALE,
    fallbackLng: FALLBACK_LOCALE,
    defaultNS: DEFAULT_NS,
    // Zapas na angielskim — uzasadnienie przy `FALLBACK_LOCALE` w config.ts.
    fallbackNS: false,
    interpolation: { escapeValue: false },
    // Klucz z kropką jest u nas ścieżką zagnieżdżenia, a nie literałem.
    keySeparator: ".",
    nsSeparator: ":",
    returnNull: false,
  })
}

export default i18n
