"use client"

import { AppGate } from "@/components/shell/app-gate"
import { isLocale } from "@/lib/i18n/config"
import { useLocaleStore } from "@/lib/i18n/locale-store"
import { usePresetStore } from "@/lib/presets/preset-store"
import {
  presetChoiceToStored,
  presetChoices,
  storedToPresetChoice,
  type PresetChoiceId,
} from "@/lib/presets/registry"
import { DESK_APP_CODE } from "@/lib/tiles"
import { DeskAppearanceProvider, DeskShellLocaleProvider } from "@cortex/desk-ui/i18n/client"
import { useMemo, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

// Arkusz Biurka wchodzi TUTAJ, nie w layoucie korzenia: jest wspólny z aplikacją
// `apps/desk`, a poza tym kafelkiem nie ma go po co ładować. Kolejność wynika
// z drzewa — CSS layoutu korzenia idzie pierwszy, więc ręczne reguły Biurka
// trafiają za `@tailwind utilities` i wygrywają z narzędziami o tej samej
// swoistości, dokładnie tak jak w aplikacji samodzielnej.
import "@cortex/styles/desk.css"

/**
 * Wygląd wstrzykiwany DO Biurka, a nie importowany PRZEZ nie.
 *
 * Presety żyją w `app/idp/lib/presets` i są własnością powłoki. `@cortex/desk-ui` jest
 * pakietem, który stoi też w `apps/desk` — nie może po nie sięgnąć i nie powinien. Kafelek
 * podaje je więc przez kontekst, a aplikacja samodzielna nie podaje nic i sekcja „Wygląd"
 * w menu osoby po prostu się nie pokazuje. To jest cała różnica między tymi dwoma
 * wcieleniami i mieszka w jednym miejscu.
 */
function Appearance({ children }: { children: ReactNode }) {
  const { t } = useTranslation("common")
  const stored = usePresetStore((s) => s.preset)
  const setPreset = usePresetStore((s) => s.setPreset)
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)

  const appearance = useMemo(
    () => ({
      current: storedToPresetChoice(stored),
      choices: presetChoices(t).map(({ id, label }) => ({ id, label })),
      set: (id: string) => setPreset(presetChoiceToStored(id as PresetChoiceId)),
    }),
    [stored, setPreset, t],
  )

  // Język powłoki wstrzykiwany tą samą drogą i z tego samego powodu co wygląd: Biurko
  // trzyma swój w ciasteczku (czyta je serwer), powłoka w `localStorage` (serwer go nie
  // widzi). Bez tego mostu przełącznik w menu osoby przestawiał wyłącznie Biurko,
  // a katalog aplikacji witał po powrocie w poprzednim języku.
  const shellLocale = useMemo(
    () => ({
      current: locale,
      set: (next: string) => {
        if (isLocale(next)) setLocale(next)
      },
    }),
    [locale, setLocale],
  )

  return (
    <DeskShellLocaleProvider shell={shellLocale}>
      <DeskAppearanceProvider appearance={appearance}>{children}</DeskAppearanceProvider>
    </DeskShellLocaleProvider>
  )
}

/**
 * Kafelek `desk` przychodzi z WŁASNĄ powłoką (list spraw po lewej, pasek dolny
 * na telefonie), więc stoi w osobnej grupie tras — tak samo jak Cortex Cowork.
 * Pod generycznym `AppShell` miałby dwa sidebary obok siebie.
 *
 * Bramka dostaje kod kafelka JAWNIE. Bez niego `AppGate` przepuszcza każdego,
 * kto ma jakikolwiek grant — a Biurko wydaje agentowi zdolności, w tym takie,
 * które sięgają poza firmę.
 */
export default function DeskLayout({ children }: { children: ReactNode }) {
  return (
    <AppGate tileId={DESK_APP_CODE}>
      <Appearance>{children}</Appearance>
    </AppGate>
  )
}
