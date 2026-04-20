"use client"

import { useUserPreferences } from "@cortex/api"
import { useEffect, useRef } from "react"
import { useThemeStore } from "@/lib/stores/theme-store"

const DARK_QUERY = "(prefers-color-scheme: dark)"

function apply(mode: "light" | "dark") {
  const root = document.documentElement
  if (mode === "dark") root.classList.add("dark")
  else root.classList.remove("dark")
  root.style.colorScheme = mode
}

export function ThemeProvider() {
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)
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
      apply(mode)
      return
    }
    const mq = window.matchMedia(DARK_QUERY)
    const sync = () => apply(mq.matches ? "dark" : "light")
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [mode])

  return null
}
