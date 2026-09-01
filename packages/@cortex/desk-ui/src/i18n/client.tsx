"use client"
import { useRouter } from "next/navigation"
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react"
import {
  adoptableShellLocale,
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

/**
 * Język RESZTY POWŁOKI — wstrzykiwany tak samo jak wygląd i z tego samego powodu.
 *
 * Biurko trzyma swój język w ciasteczku, bo czyta go serwer przy renderze; powłoka
 * trzyma swój w `localStorage`, o którym serwer nic nie wie. Dwa niezależne
 * przełączniki dawały stan, w którym Biurko mówi po angielsku, a katalog aplikacji
 * po powrocie wita po polsku — i nie da się tego naprawić po żadnej z tych stron
 * osobno, bo żadna nie widzi drugiej.
 */
export type DeskShellLocale = { current: string; set: (locale: string) => void }

const ShellLocaleContext = createContext<DeskShellLocale | null>(null)

export function DeskShellLocaleProvider({
  shell,
  children,
}: {
  shell: DeskShellLocale
  children: ReactNode
}) {
  return <ShellLocaleContext.Provider value={shell}>{children}</ShellLocaleContext.Provider>
}

export function useDeskShellLocale(): DeskShellLocale | null {
  return useContext(ShellLocaleContext)
}

const writeCookie = (next: DeskLocale) => {
  // Zapis wprost w `document.cookie`, bez trasy API. To preferencja widoku, nie sekret:
  // ciasteczko musi być czytelne dla JS-a, żeby przełącznik działał bez rundy do serwera.
  document.cookie = `${DESK_LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
}

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

/**
 * Przestawia język Biurka I CAŁEJ POWŁOKI. Przełącznik w menu osoby jest na trasach
 * Biurka jedynym widocznym, więc przestawienie go tylko u siebie zostawiałoby katalog
 * aplikacji w poprzednim języku. `router.refresh()` każe serwerowi przerysować ekrany
 * już w nowym języku.
 */
export function useSetDeskLocale(): (locale: DeskLocale) => void {
  const router = useRouter()
  const shell = useDeskShellLocale()
  return useCallback(
    (next: DeskLocale) => {
      writeCookie(next)
      shell?.set(next)
      router.refresh()
    },
    [router, shell],
  )
}

/**
 * Druga strona mostu: język zmieniony W POWŁOCE (w katalogu aplikacji, gdzie Biurka
 * nie ma) dogania Biurko przy wejściu. Rozjazd może powstać wyłącznie tą drogą — zmiana
 * po stronie Biurka ustawia od razu obie strony — więc gdy się różnią, prawdziwa jest
 * powłoka. Wywołane raz, przez przełącznik osoby: on stoi na każdym ekranie Biurka.
 */
export function useShellLocaleBridge(): void {
  const locale = useDeskLocale()
  const shell = useDeskShellLocale()
  const router = useRouter()
  const wanted = shell?.current
  useEffect(() => {
    const next = adoptableShellLocale(wanted, locale)
    if (!next) return
    writeCookie(next)
    router.refresh()
  }, [wanted, locale, router])
}

export function useDeskT(): DeskT {
  const locale = useDeskLocale()
  return useMemo(() => makeDeskT(locale), [locale])
}
