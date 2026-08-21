"use client"

import { cn } from "@cortex/utils"
import type { LucideIcon } from "lucide-react"
import { Monitor, Moon, Sun } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

export type ThemeMode = "light" | "dark" | "system"

interface ThemeToggleProps {
  mode: ThemeMode
  onModeChange: (mode: ThemeMode) => void
  className?: string | undefined
}

/** Etykiety NIE są tu wpisane — `labelKey` wskazuje klucz w przestrzeni `ui`,
 *  bo mapa jest stałą modułu i powstaje raz, poza cyklem renderu. */
const OPTIONS: { value: ThemeMode; labelKey: string; icon: LucideIcon }[] = [
  { value: "light", labelKey: "themeToggle.light", icon: Sun },
  { value: "dark", labelKey: "themeToggle.dark", icon: Moon },
  { value: "system", labelKey: "themeToggle.system", icon: Monitor },
]

export function ThemeToggle({ mode, onModeChange, className }: ThemeToggleProps) {
  const { t } = useTranslation("ui")
  const Icon = mode === "dark" ? Moon : mode === "light" ? Sun : Monitor
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", className)}
          aria-label={t("themeToggle.trigger")}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {OPTIONS.map((opt) => {
          const OptIcon = opt.icon
          const active = opt.value === mode
          return (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => onModeChange(opt.value)}
              className={cn(active && "bg-muted")}
            >
              <OptIcon className="mr-2 h-4 w-4" />
              <span>{t(opt.labelKey)}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
