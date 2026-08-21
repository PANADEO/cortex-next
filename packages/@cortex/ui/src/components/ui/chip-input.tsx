"use client"

// Multi-value tekstowy input ("chipy"/tagi) — dziś (03.08.2026) jedyny
// prymityw tego kształtu w @cortex/ui, zbudowany przy okazji Ustawień GEO
// Score Calculatora (design doc §4.4: listy słów zamiast gołego Textarea
// "jedna fraza na linię"), ale ŚWIADOMIE generyczny — zero nazw/logiki
// specyficznej dla tego kafelka, bo design doc wprost flaguje to jako
// prawdopodobny drugi konsument (Content Guru, ekran zabronionych fraz).
//
// Zachowanie: Enter/przecinek dodaje chip (trim, dedupe case-insensitive,
// ciche ignorowanie duplikatu), Backspace na pustym polu usuwa ostatni chip,
// każdy chip ma przycisk usuwania. Przy dłuższych listach (> CHIP_SEARCH_
// THRESHOLD) doklejane jest drugie pole "Szukaj" — czysto WIZUALNY filtr
// wyświetlanych chipów, nie modyfikuje `value`.

import { X } from "lucide-react"
import * as React from "react"

import { cn } from "@cortex/utils"
import { Badge } from "./badge"
import { Input } from "./input"
import { ScrollArea } from "./scroll-area"

export interface ChipInputProps {
  id?: string
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
  "aria-label"?: string
  "aria-labelledby"?: string
}

const CHIP_SEARCH_THRESHOLD = 6

function normalize(raw: string): string {
  return raw.trim()
}

export function ChipInput({
  id,
  value,
  onChange,
  placeholder = "Dodaj i naciśnij Enter…",
  searchPlaceholder = "Szukaj…",
  disabled,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: ChipInputProps) {
  const [draft, setDraft] = React.useState("")
  const [search, setSearch] = React.useState("")

  function commit(raw: string) {
    const chip = normalize(raw)
    setDraft("")
    if (!chip) return
    const isDuplicate = value.some((existing) => existing.toLowerCase() === chip.toLowerCase())
    if (isDuplicate) return
    onChange([...value, chip])
  }

  function remove(chip: string) {
    onChange(value.filter((existing) => existing !== chip))
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      commit(draft)
      return
    }
    if (event.key === "Backspace" && draft === "" && value.length > 0) {
      remove(value[value.length - 1] as string)
    }
  }

  const trimmedSearch = search.trim().toLowerCase()
  const visible = trimmedSearch
    ? value.filter((chip) => chip.toLowerCase().includes(trimmedSearch))
    : value

  return (
    <div className={cn("space-y-2", className)}>
      <Input
        id={id}
        value={draft}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => commit(draft)}
      />

      {value.length > CHIP_SEARCH_THRESHOLD ? (
        <Input
          value={search}
          placeholder={searchPlaceholder}
          className="h-8 text-xs"
          onChange={(event) => setSearch(event.target.value)}
          aria-label={`${ariaLabel ?? "Lista"} — szukaj`}
        />
      ) : null}

      <ScrollArea className="max-h-40 rounded-md border border-input">
        <div className="flex flex-wrap gap-1.5 p-2">
          {visible.length === 0 ? (
            <p className="px-1 py-1 text-xs text-muted-foreground">
              {value.length === 0 ? "Brak elementów" : "Brak wyników wyszukiwania"}
            </p>
          ) : (
            visible.map((chip) => (
              <Badge key={chip} variant="secondary" className="gap-1 py-1 pl-2 pr-1 font-normal">
                {chip}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => remove(chip)}
                  aria-label={`Usuń „${chip}”`}
                  className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))
          )}
        </div>
      </ScrollArea>

      <p className="text-xs text-muted-foreground">
        {value.length} {value.length === 1 ? "element" : "elementów"}
      </p>
    </div>
  )
}
