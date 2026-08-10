"use client"

import { useSetUserPreferences, useShellUser } from "@cortex/api"
import { SkinToggle, ThemeToggle, UserMenu } from "@cortex/ui"
import { cva } from "class-variance-authority"
import Image from "next/image"
import { usePreset, usePresetStore } from "@/lib/presets/preset-store"
import { PRESET_CHOICES, presetChoiceToStored, storedToPresetChoice } from "@/lib/presets/registry"
import { useThemeStore } from "@/lib/stores/theme-store"

/**
 * Pasek ekranu startowego — odpowiednik `.ch-shellbar` z oryginału. Ta sama
 * zasada co w powłoce `(main)`: kolory zostają tokenami, wariant rozstrzyga
 * grubość linii i rolę semantyczną tła.
 *
 * UWAGA NA ZAKRES PRESETU TUTAJ. Ten ekran ogląda też NIEZALOGOWANY, a wybór
 * użytkownika mieszka w `localStorage` — przy pierwszej wizycie go nie ma.
 * W praktyce więc ekran logowania pokazuje wygląd INSTANCJI, nigdy osobisty,
 * i to jest zachowanie zamierzone: wygląd bramy wejściowej należy do
 * właściciela instancji, nie do odwiedzającego.
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

  return (
    <header className={shellBar({ variant })}>
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-6">
        <div className="flex shrink-0 items-center gap-2.5">
          <Image
            src="/cortex-logo.png"
            alt="Cortex360"
            width={28}
            height={28}
            className="dark:invert dark:hue-rotate-180"
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
          <SkinToggle
            skin={storedToPresetChoice(storedPreset)}
            options={PRESET_CHOICES}
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
