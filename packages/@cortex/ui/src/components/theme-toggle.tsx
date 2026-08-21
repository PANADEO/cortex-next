"use client"

import { cn } from "@cortex/utils"
import type { LucideIcon } from "lucide-react"
import { Monitor, Moon, Sun } from "lucide-react"
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

const OPTIONS: { value: ThemeMode; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]

export function ThemeToggle({ mode, onModeChange, className }: ThemeToggleProps) {
  const Icon = mode === "dark" ? Moon : mode === "light" ? Sun : Monitor
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", className)}
          aria-label="Toggle theme"
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
              <span>{opt.label}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
