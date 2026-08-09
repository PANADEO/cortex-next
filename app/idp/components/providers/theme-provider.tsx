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
 * `data-preset` jest tu z wyprzedzeniem dla E4: warianty `folder`/`chiclet`
 * robi CVA w TSX, ale reguły sięgające wyżej niż pojedynczy komponent (u
 * Cezarego cały blok pod `.cortex-home`, ze staggerem `--ch-delay` i
 * `prefers-reduced-motion`) potrzebują przodka do zakresowania. Klasa skinu
 * się do tego nie nadaje, bo opisuje PALETĘ, nie wiązkę — dwa presety mogą
 * dzielić skin i różnić się layoutem. Atrybut jest dziś martwy z wyboru:
 * żaden selektor w `globals.css` go nie czyta.
 *
 * OSTRZEŻENIE DLA E4, jeśli zechce pod ten atrybut zakresować reguły układu.
 * Zarówno klasa, jak i `data-preset` lądują na `<html>` dopiero w efekcie
 * poniżej, bo `app/idp/app/layout.tsx` nie ma blokującego skryptu w nagłówku.
 * Zmierzone na tej gałęzi: pierwsze malowanie ~22 ms, klasa skinu ~408 ms
 * (bazowo 14 / 362 — stan zastany, E3 go nie dokłada). Dla samych kolorów to
 * mignięcie do przeżycia. Ale gdyby ~60 reguł układu Domino wisiało na
 * `[data-preset="domino"]`, przez te ~0,4 s hub malowałby się CAŁKIEM
 * nieostylowany i dopiero potem przeskakiwał. Pytanie o blokujący skrypt
 * należy rozstrzygnąć WEWNĄTRZ E4, razem z decyzją o zakresowaniu — nie po.
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
