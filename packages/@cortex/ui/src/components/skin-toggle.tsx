"use client"

import { cn } from "@cortex/utils"
import { Palette } from "lucide-react"
import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

export interface SkinOption<T extends string = string> {
  id: T
  label: string
  description: string
  swatch: readonly [string, string, string]
}

interface Props<T extends string> {
  skin: T
  options: readonly SkinOption<T>[]
  onSkinChange: (skin: T) => void
  className?: string | undefined
}

export function SkinToggle<T extends string>({ skin, options, onSkinChange, className }: Props<T>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", className)}
          aria-label="Choose skin"
        >
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Skin
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((opt) => {
          const active = opt.id === skin
          return (
            <DropdownMenuItem
              key={opt.id}
              onClick={() => onSkinChange(opt.id)}
              className={cn(active && "bg-muted")}
            >
              <div className="mr-2 flex gap-0.5">
                {opt.swatch.map((color, i) => (
                  <span
                    key={i}
                    className="h-4 w-1.5 rounded-sm ring-1 ring-border"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="truncate text-[10px] text-muted-foreground">{opt.description}</p>
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
