"use client"

import { useUserPreferences } from "@cortex/api"
import { useEffect, useRef } from "react"
import { SKINS, useSkinStore, type SkinId } from "@/lib/stores/skin-store"
import { useThemeStore } from "@/lib/stores/theme-store"

const DARK_QUERY = "(prefers-color-scheme: dark)"

function applyMode(mode: "light" | "dark") {
  const root = document.documentElement
  if (mode === "dark") root.classList.add("dark")
  else root.classList.remove("dark")
  root.style.colorScheme = mode
}

function applySkin(skin: SkinId) {
  const root = document.documentElement
  for (const s of SKINS) {
    if (s.id === "default") continue
    root.classList.toggle(`skin-${s.id}`, skin === s.id)
  }
}

export function ThemeProvider() {
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)
  const skin = useSkinStore((s) => s.skin)
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
    applySkin(skin)
  }, [skin])

  return null
}
