"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import i18n from "./index"
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config"

interface LocaleState {
  locale: Locale
  setLocale: (locale: Locale) => void
}

/**
 * Wybór języka użytkownika — ten sam wzorzec co `preset-store.ts`: zustand
 * z `persist`, więc wybór przeżywa przeładowanie bez zapytania do sieci.
 *
 * Zapis do `i18next` idzie TUTAJ, a nie w komponencie: gdyby robił to efekt
 * w widoku, pierwszy render po przeładowaniu pokazywałby język domyślny,
 * dopóki efekt się nie wykona — czyli mignięcie polskim u kogoś, kto wybrał
 * angielski.
 */
export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: DEFAULT_LOCALE,
      setLocale: (locale) => {
        void i18n.changeLanguage(locale)
        set({ locale })
      },
    }),
    {
      name: "cortex.locale",
      version: 1,
      onRehydrateStorage: () => (state) => {
        // Rehydracja jest synchroniczna, ale `i18next` o niej nie wie —
        // bez tego wybrany wcześniej język siedzi w store i nigdzie indziej.
        if (state && isLocale(state.locale)) void i18n.changeLanguage(state.locale)
      },
    },
  ),
)
