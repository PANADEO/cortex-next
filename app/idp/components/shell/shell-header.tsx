"use client"

import { useMe, useSetUserPreferences } from "@cortex/api"
import { SkinToggle, type SkinOption, ThemeToggle, UserMenu } from "@cortex/ui"
import Image from "next/image"
import { SKINS, type SkinId, useSkinStore } from "@/lib/stores/skin-store"
import { useThemeStore } from "@/lib/stores/theme-store"

const SKIN_SWATCHES: Record<SkinId, readonly [string, string, string]> = {
  default: ["#0a0a0a", "#f5f5f5", "#a3a3a3"],
  customs: ["#f97316", "#15803d", "#fbbf24"],
}

const SKIN_OPTIONS: readonly SkinOption<SkinId>[] = SKINS.map((s) => ({
  id: s.id,
  label: s.label,
  description: s.description,
  swatch: SKIN_SWATCHES[s.id],
}))

export function ShellHeader() {
  const themeMode = useThemeStore((s) => s.mode)
  const setThemeMode = useThemeStore((s) => s.setMode)
  const skin = useSkinStore((s) => s.skin)
  const setSkin = useSkinStore((s) => s.setSkin)
  const persistPreferences = useSetUserPreferences()
  const me = useMe()

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
          <SkinToggle skin={skin} options={SKIN_OPTIONS} onSkinChange={setSkin} />
          <ThemeToggle
            mode={themeMode}
            onModeChange={(next) => {
              setThemeMode(next)
              persistPreferences.mutate({ theme_mode: next })
            }}
          />
          <UserMenu user={me.data ?? null} />
        </div>
      </div>
    </header>
  )
}
