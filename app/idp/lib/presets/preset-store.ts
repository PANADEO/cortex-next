"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { useInstancePreset } from "./instance-preset"
import { PRESETS, type Preset, type PresetId, isPresetId, resolvePresetId } from "./registry"

/**
 * Kształt tego, co ląduje w `localStorage` — osobno od stanu store'a, bo
 * `migrate()` operuje na NIM, nie na stanie z akcjami. Dzięki temu funkcja
 * migrująca zwraca dokładnie ten obiekt i nie potrzebuje rzutowania.
 */
interface PersistedPreset {
  preset: PresetId | null
}

interface PresetState extends PersistedPreset {
  /**
   * `null` w argumencie to nie niechlujstwo, tylko jedyna droga POWROTU do
   * stanu „nic nie wybrałem". Bez niej store umie ten stan reprezentować, ale
   * nie umie go przywrócić — a wtedy pierwsze kliknięcie w przełączniku z E4
   * jest drzwiami w jedną stronę: `preset` tego użytkownika zostaje niepusty
   * na zawsze i domyślna wartość instancji z E5 nigdy go już nie dosięgnie.
   * Dziś to jeden znak w sygnaturze, po wypuszczeniu przełącznika — migracja
   * danych. Pozycję dla UI niesie `PRESET_CHOICES`.
   */
  setPreset: (preset: PresetId | null) => void
}

/**
 * `null`, a nie `DEFAULT_PRESET`, jako wartość początkowa — bo to dwie różne
 * rzeczy: „user nic nie wybrał" (wtedy rozstrzyga preset instancji z E5, a
 * dopiero po nim wartość domyślna) kontra „user wybrał Neutral" (wtedy preset
 * instancji ma przegrać). Zapisanie domyślnego jako zwykłego wyboru
 * zabetonowałoby każdą świeżą przeglądarkę na Neutral, zanim E5 zdąży dać
 * instancji cokolwiek do powiedzenia.
 */
const NO_CHOICE: PersistedPreset = { preset: null }

/** Skiny sprzed presetów w mapowaniu 1:1 na presety. `default` to nazwa
 *  ze starego store'a, nie brak wyboru — stary store zapisywał do
 *  `localStorage` dopiero przy zmianie, więc obecność klucza znaczy, że ktoś
 *  tego wyboru realnie dokonał. */
const LEGACY_SKIN_TO_PRESET: Readonly<Record<string, PresetId>> = {
  default: "neutral",
  customs: "customs",
}

/**
 * Przeniesienie wyboru ze `skin-store.ts` (`{ skin: "default" | "customs" }`,
 * wersja 0) na preset. Nieznana wartość — skin skasowany między wersjami
 * albo ręczna zabawa w devtoolsach — daje `null`, czyli „brak wyboru", a nie
 * wyjątek: to jest kod na ścieżce startu aplikacji.
 */
export function migrateLegacySkin(persisted: unknown): PersistedPreset {
  if (typeof persisted !== "object" || persisted === null) return NO_CHOICE
  const skin = (persisted as { skin?: unknown }).skin
  if (typeof skin !== "string") return NO_CHOICE
  const preset = LEGACY_SKIN_TO_PRESET[skin]
  return isPresetId(preset) ? { preset } : NO_CHOICE
}

/**
 * Store wybranego presetu — następca `skin-store.ts`, który znika (§4).
 *
 * KLUCZ ZOSTAJE `cortex.skin`, mimo że store nazywa się teraz presetem. To
 * jest cena za jedyną ścieżkę, na której zustand wykonuje migrację sam:
 * `version` + `migrate` są zakresowane DO KLUCZA, więc zmiana nazwy na
 * `cortex.preset` znaczy, że stary wpis nigdy nie zostaje przeczytany i
 * każdy, kto ma dziś wybrany skin Customs, dostaje ciche zresetowanie do
 * wartości domyślnej — czyli przemalowanie aplikacji w kroku, który ma być
 * niewidoczny.
 *
 * Odrzucone: `cortex.preset` + własne czytanie `cortex.skin` przy starcie.
 * Działa, ale znaczy wejście w `onRehydrateStorage` albo własne `storage` i
 * ręczne odtworzenie tego, co `migrate` robi z definicji — więcej kodu na
 * ścieżce startu, żeby ładniej nazwać klucz, którego nikt poza tym plikiem
 * nie czyta. (Argumentem NIE jest mignięcie palety: klasa skinu i tak ląduje
 * dopiero w `useEffect` — patrz `theme-provider.tsx`.)
 *
 * Klucz jest za to CZYTANY PRZEZ APARATURĘ POMIAROWĄ (`capture.mjs` seeduje
 * `cortex.skin` w kształcie sprzed migracji), więc zostawienie go daje bramce
 * pełną macierz skinów bez zmiany w harnessie.
 *
 * Krawędź świadomie nieobsłużona: wpis BEZ pola `version` (zustand woła
 * `migrate` tylko dla `typeof version === "number"`) przechodzi obok migracji
 * i ląduje na wartości domyślnej. Stary store zawsze zapisywał `version: 0`,
 * więc jest to osiągalne wyłącznie ręczną edycją `localStorage`.
 */
export const usePresetStore = create<PresetState>()(
  persist(
    (set) => ({
      ...NO_CHOICE,
      setPreset: (preset) => set({ preset }),
    }),
    {
      name: "cortex.skin",
      version: 1,
      partialize: (state): PersistedPreset => ({ preset: state.preset }),
      migrate: (persisted, version) =>
        version === 0 ? migrateLegacySkin(persisted) : (persisted as PersistedPreset),
    },
  ),
)

/**
 * Aktywny preset. Jedyne wejście dla widoków — nikt poza tym plikiem nie
 * składa kolejności źródeł.
 *
 * OBA ŹRÓDŁA SĄ SYNCHRONICZNE I TO JEST WŁASNOŚĆ, NIE PRZYPADEK. Wybór
 * użytkownika czyta `persist` zustanda z `localStorage` przy tworzeniu store'a,
 * preset instancji przychodzi propsem z renderu serwerowego (patrz
 * `instance-preset.tsx`). Ani jedno nie jest zapytaniem, więc ta funkcja zwraca
 * ostateczną odpowiedź już w pierwszym renderze — a hub, który i tak czeka na
 * katalog z sieci, nie ma jak pokazać najpierw jednego layoutu, a potem
 * drugiego. Podmiana któregokolwiek ze źródeł na `useQuery` łamie tę własność
 * i wprowadza wyścig sieciowy o UKŁAD STRONY.
 *
 * SZEW DLA NOGI PER-UŻYTKOWNIK (`user_preferences` w `idp-app`, poza tym repo).
 * Właściwy kształt to TA SAMA DROGA, którą przychodzi preset instancji: odczyt
 * po stronie serwera w `app/idp/app/layout.tsx` (tożsamość jest w nagłówku od
 * oauth2-proxy, więc `headers()` wystarcza, żeby zapytać o preferencje w
 * imieniu zalogowanego) i drugi props przez tego samego dostawcę, obok
 * `instancePreset`. Wtedy oba źródła zostają synchroniczne i własność wyżej
 * przeżywa.
 *
 * ODRZUCONE: „zasiej store z `useUserPreferences()` w `theme-provider.tsx`, tak
 * jak `theme_mode`". To jest ścieżka, którą sam ten plik polecał do E5, i jest
 * błędna — `theme_mode` steruje wyłącznie klasą `.dark`, więc spóźnione
 * zasianie kosztuje mignięcie KOLORU. Ten store karmi `hubLayout`, więc
 * spóźnione zasianie kosztuje PEŁNY PRZESKOK UKŁADU, i to dokładnie dla
 * populacji, dla której noga per-user w ogóle powstaje: użytkownika, którego
 * zdalny wybór różni się od presetu instancji. Analogia do `theme_mode` jest
 * więc fałszywa w tym jednym miejscu, w którym miała być argumentem.
 */
export function usePreset(): Preset {
  const user = usePresetStore((state) => state.preset)
  const instance = useInstancePreset()
  return PRESETS[resolvePresetId({ instance, user })]
}
