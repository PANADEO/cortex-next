"use client"

import * as React from "react"

import { cn } from "@cortex/utils"
import { Input } from "./input"

export interface ColorInputProps {
  value: string
  onChange: (value: string) => void
  id?: string
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

/**
 * Wybór koloru: natywny `input[type=color]` + pole tekstowe z zapisem hex.
 * Bez nowej zależności — natywny picker jest dostępny z klawiatury i wspierany
 * wszędzie, a pole tekstowe pozwala wkleić dokładny HEX z księgi znaku
 * (czego sam picker nie umożliwia).
 *
 * Wartość jest DANĄ (kolor marki klienta), nie stylowaniem chrome'u aplikacji —
 * dlatego hex trafia tutaj do atrybutu, mimo zakazu inline hex w UI.
 */
const ColorInput = React.forwardRef<HTMLInputElement, ColorInputProps>(
  ({ value, onChange, id, disabled, className, ...props }, ref) => {
    const [draft, setDraft] = React.useState(value)

    React.useEffect(() => {
      setDraft(value)
    }, [value])

    const commit = (next: string) => {
      const normalized = next.trim().toUpperCase()
      setDraft(normalized)
      if (/^#[0-9A-F]{6}$/.test(normalized)) onChange(normalized)
    }

    return (
      <div className={cn("flex items-center gap-2", className)}>
        <input
          ref={ref}
          id={id}
          type="color"
          value={/^#[0-9A-Fa-f]{6}$/.test(value) ? value : "#000000"}
          disabled={disabled}
          onChange={(event) => commit(event.target.value)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={props["aria-label"]}
        />
        <Input
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          spellCheck={false}
          className="font-mono uppercase"
        />
      </div>
    )
  },
)
ColorInput.displayName = "ColorInput"

export { ColorInput }
