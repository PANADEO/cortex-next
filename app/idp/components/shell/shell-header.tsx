"use client"

import { localeChoices } from "@/lib/i18n/config"
import { useLocaleStore } from "@/lib/i18n/locale-store"
import { usePreset, usePresetStore } from "@/lib/presets/preset-store"
import { presetChoices, presetChoiceToStored, storedToPresetChoice } from "@/lib/presets/registry"
import { useThemeStore } from "@/lib/stores/theme-store"
import { useSetUserPreferences, useShellUser } from "@cortex/api"
import { LocaleToggle, SkinToggle, ThemeToggle, UserMenu } from "@cortex/ui"
import { cva } from "class-variance-authority"
import Image from "next/image"
import { useTranslation } from "react-i18next"

/**
 * Pasek nad hubem — odpowiednik `.ch-shellbar`. Ta sama zasada co w powłoce
 * `(main)`: wartości kolorów zostają tokenami, wariant rozstrzyga grubość
 * linii i rolę semantyczną tła.
 *
 * KOREKTA ZAKRESU. Komentarz w tym miejscu twierdził, że to pasek EKRANU
 * LOGOWANIA i wywodził z tego rozważania o niezalogowanym użytkowniku. To
 * nieprawda: `ShellHeader` renderuje się WYŁĄCZNIE z `authed-home.tsx`, czyli
 * na hubie po zalogowaniu. Ekran logowania (`landing-hero.tsx`) ma własny,
 * bezramkowy `<header>` i ten wariant go NIE dotyczy — `.ch-shellbar` nie
 * został tam przeniesiony i jest to otwarte zadanie, nie zrobione.
 *
 * Rozważanie o presecie instancji zostaje aktualne dla `ShellFooter`, który
 * renderuje się w obu miejscach — patrz komentarz tam.
 */
const shellBar = cva("sticky top-0 z-30 border-border backdrop-blur", {
  variants: {
    variant: {
      plain: "border-b bg-card/80",
      ruled: "border-b-2 bg-background/80",
    },
  },
  defaultVariants: { variant: "plain" },
})

export function ShellHeader() {
  const themeMode = useThemeStore((s) => s.mode)
  const setThemeMode = useThemeStore((s) => s.setMode)
  // WYBÓR ze store'a, nie rozwiązany preset z `usePreset()`. Rozwiązany nigdy
  // nie jest pusty (spada na `DEFAULT_PRESET`), więc przełącznik pokazywałby
  // „Neutral" komuś, kto nie wybrał niczego — i pozycja „domyślny instancji"
  // byłaby nieosiągalna do zaznaczenia mimo że jest na liście.
  const storedPreset = usePresetStore((s) => s.preset)
  const setPreset = usePresetStore((s) => s.setPreset)
  const persistPreferences = useSetUserPreferences()
  const shellUser = useShellUser()
  // Tu odwrotnie niż przy przełączniku wyżej: kształt idzie za tym, co
  // użytkownik REALNIE widzi, więc rozwiązany preset, nie sam wybór.
  const variant = usePreset().variants.shell
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)
  const { t: tCommon } = useTranslation("common")

  return (
    <header className={shellBar({ variant })}>
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-6">
        <div className="flex shrink-0 items-center gap-2.5">
          <Image
            src="/cortex-logo.png"
            alt="Cortex360"
            width={28}
            height={28}
            className="dark:hue-rotate-180 dark:invert"
            priority
          />
          <span className="text-sm font-semibold">Cortex360</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          {/* `SkinToggle` bez adaptera: jego props to `SkinOption<T extends
              string>[]`, a `PRESET_CHOICES` jest strukturalnie właśnie tym —
              E3 zbudował sentinel jako NAPIS dokładnie po to. Para mapperów
              zamienia go na `null` w store i z powrotem, więc pierwsze
              kliknięcie nie zabetonowuje wyboru i preset instancji z E5 ma jak
              wygrać. */}
          <LocaleToggle
            locale={locale}
            options={localeChoices(tCommon)}
            onLocaleChange={setLocale}
          />
          <SkinToggle
            skin={storedToPresetChoice(storedPreset)}
            options={presetChoices(tCommon)}
            onSkinChange={(choice) => setPreset(presetChoiceToStored(choice))}
          />
          <ThemeToggle
            mode={themeMode}
            onModeChange={(next) => {
              setThemeMode(next)
              persistPreferences.mutate({ theme_mode: next })
            }}
          />
          <UserMenu user={shellUser} />
        </div>
      </div>
    </header>
  )
}
