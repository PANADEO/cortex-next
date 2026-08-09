"use client"

import { useSetUserPreferences, useShellUser } from "@cortex/api"
import { ThemeToggle, UserMenu } from "@cortex/ui"
import Image from "next/image"
import { useThemeStore } from "@/lib/stores/theme-store"

export function ShellHeader() {
  const themeMode = useThemeStore((s) => s.mode)
  const setThemeMode = useThemeStore((s) => s.setMode)
  const persistPreferences = useSetUserPreferences()
  const shellUser = useShellUser()

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
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
          {/* Bez przełącznika wyglądu do E4 — uzasadnienie przy
              `DEFAULT_PRESET` w `lib/presets/registry.ts`. */}
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
