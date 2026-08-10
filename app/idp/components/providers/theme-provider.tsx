"use client"

import { useUserPreferences } from "@cortex/api"
import { useEffect, useRef } from "react"
import { usePreset } from "@/lib/presets/preset-store"
import { PRESETS, type PresetId } from "@/lib/presets/registry"
import { useThemeStore } from "@/lib/stores/theme-store"

const DARK_QUERY = "(prefers-color-scheme: dark)"

function applyMode(mode: "light" | "dark") {
  const root = document.documentElement
  if (mode === "dark") root.classList.add("dark")
  else root.classList.remove("dark")
  root.style.colorScheme = mode
}

/**
 * Następca `applySkin()` — ta sama mechanika (`classList` na
 * `documentElement`, żeby `.skin-x.dark` łapało oba tokeny na jednym
 * elemencie), tylko klasa czytana z presetu zamiast z identyfikatora skinu.
 * Pętla po WSZYSTKICH presetach, a nie sam `add` aktywnego: przełączenie musi
 * zdejmować poprzednią klasę, inaczej dwa skiny siedzą na `<html>` naraz i
 * wygrywa ten, który stoi później w `globals.css`.
 *
 * ROZSTRZYGNIĘCIE FOUC (E4, zaktualizowane po E5). Preset INSTANCJI ląduje na
 * `<html>` po stronie serwera — `app/idp/app/layout.tsx` czyta go z bazy i emituje
 * w pierwszych bajtach dokumentu, więc odwiedzający bez własnego wyboru dostaje
 * właściwy wygląd od razu. Efekt poniżej obsługuje wyłącznie wybór LOKALNY
 * i przełączanie w locie; tam pierwsze malowanie wyprzedza klasę o ~70 ms
 * (~1,2 s przy procesorze ×20). Poniższe rozumowanie powstało, gdy OBIE ścieżki
 * były asynchroniczne, i pozostaje w mocy — dotyczy tego, czego w CSS-ie NIE
 * warunkujemy.
 * E3 ostrzegał, że jeśli reguły UKŁADU Domina zawisną na `[data-preset]`, to
 * przez te ~0,4 s hub maluje się całkiem nieostylowany. E4 nie zawiesił na nim
 * ani jednej reguły — nie przez ostrożność, tylko dlatego, że taki warunek nic
 * nie wnosi: wybór layoutu i wariantów robi już preset w Reakcie
 * (`authed-home.tsx`), a klasy Domina jadą na komponentach, które pod innym
 * presetem po prostu się nie renderują. Warunek w CSS-ie byłby powtórzeniem
 * decyzji już podjętej, opłaconym pełnym mignięciem układu.
 *
 * Odrzucony BLOKUJĄCY SKRYPT W NAGŁÓWKU. Usunąłby też mignięcie kolorów, ale
 * musiałby przed startem Reacta odtworzyć w gołym JS-ie całą ścieżkę
 * rozstrzygania presetu: nazwę klucza `localStorage`, kopertę `persist`
 * zustanda, migrację z wersji 0 i pierwszeństwo źródeł z `resolvePresetId()`.
 * To druga, nietypowana kopia rzeczy, która ma jedno źródło prawdy — a E5
 * dokłada preset INSTANCJI z bazy, którego skrypt czytający wyłącznie
 * `localStorage` nie ma jak zobaczyć, więc byłby błędny w dniu, w którym E5
 * wejdzie. Właściwym rozwiązaniem kolorów jest ciastko czytane na serwerze i
 * `data-preset` renderowane w HTML-u — to jednak zmiana w warstwie
 * dostarczania, należy do E5 razem z resztą źródeł presetu.
 *
 * Sam atrybut zostaje mimo braku konsumenta w CSS: jest jedynym zewnętrznym
 * świadectwem, który preset jest aktywny (klasa skinu tego nie mówi — dwa
 * presety mogą dzielić skin i różnić się layoutem), i czyta go aparatura
 * pomiarowa oraz devtools.
 */
function applyPreset(id: PresetId) {
  const root = document.documentElement
  for (const preset of Object.values(PRESETS)) {
    if (preset.skin) root.classList.toggle(preset.skin, preset.id === id)
  }
  root.dataset.preset = id
}

export function ThemeProvider() {
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)
  const preset = usePreset()
  const preferences = useUserPreferences()
  const seededRef = useRef(false)

  // One-shot merge: adopt remote theme_mode on first successful load.
  useEffect(() => {
    if (seededRef.current) return
    if (!preferences.data) return
    seededRef.current = true
    const remote = preferences.data.theme_mode
    if (remote && remote !== mode) setMode(remote)
  }, [preferences.data, mode, setMode])

  useEffect(() => {
    if (mode !== "system") {
      applyMode(mode)
      return
    }
    const mq = window.matchMedia(DARK_QUERY)
    const sync = () => applyMode(mq.matches ? "dark" : "light")
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [mode])

  useEffect(() => {
    applyPreset(preset.id)
  }, [preset.id])

  return null
}
