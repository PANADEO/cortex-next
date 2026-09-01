"use client"
import { useRouter } from "next/navigation"
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react"
import {
  DEFAULT_DESK_LOCALE,
  DESK_LOCALE_COOKIE,
  makeDeskT,
  type DeskLocale,
  type DeskT,
} from "./locale"

/**
 * DWA dostawcy, nie jeden, bo mają dwóch różnych właścicieli.
 *
 * Język zna SERWER — czyta ciasteczko przy renderze i podaje wynik przez `Shell`,
 * więc pierwszy render jest już we właściwym języku, bez mignięcia.
 *
 * Wygląd zna POWŁOKA — presety żyją w `app/idp/lib/presets`, a Biurko jest pakietem,
 * który nie ma prawa po nie sięgnąć. Kafelek wstrzykuje je więc ze swojego layoutu,
 * a aplikacja samodzielna nie wstrzykuje nic i sekcja wyglądu po prostu się nie
 * pokazuje. Bez tego rozdziału trzeba by albo przeciągać element przez siedem stron,
 * albo wpuścić zależność od powłoki do pakietu, który ma być od niej niezależny.
 */
const LocaleContext = createContext<DeskLocale | null>(null)

export type DeskAppearance = {
  current: string
  choices: { id: string; label: string }[]
  set: (id: string) => void
}

const AppearanceContext = createContext<DeskAppearance | null>(null)

export function DeskLocaleProvider({
  locale,
  children,
}: {
  locale: DeskLocale
  children: ReactNode
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export function DeskAppearanceProvider({
  appearance,
  children,
}: {
  appearance: DeskAppearance
  children: ReactNode
}) {
  return <AppearanceContext.Provider value={appearance}>{children}</AppearanceContext.Provider>
}

/**
 * Poza dostawcą oddajemy język domyślny zamiast rzucać wyjątkiem: komponenty Biurka
 * bywają montowane w testach bez powłoki, a przewrócenie się na braku kontekstu
 * zamieniłoby „nie ma tłumaczeń" w „nie ma ekranu".
 */
export function useDeskLocale(): DeskLocale {
  return useContext(LocaleContext) ?? DEFAULT_DESK_LOCALE
}

export function useDeskAppearance(): DeskAppearance | null {
  return useContext(AppearanceContext)
}

export function useSetDeskLocale(): (locale: DeskLocale) => void {
  const router = useRouter()
  // Zapis wprost w `document.cookie`, bez trasy API. To preferencja widoku, nie sekret:
  // ciasteczko musi być czytelne dla JS-a, żeby przełącznik działał bez rundy do serwera,
  // a `router.refresh()` każe serwerowi przerysować ekrany już w nowym języku.
  return useCallback(
    (next: DeskLocale) => {
      document.cookie = `${DESK_LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
      router.refresh()
    },
    [router],
  )
}

export function useDeskT(): DeskT {
  const locale = useDeskLocale()
  return useMemo(() => makeDeskT(locale), [locale])
}
