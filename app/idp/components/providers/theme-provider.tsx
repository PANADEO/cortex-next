"use client"

import { useEffect } from "react"
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
