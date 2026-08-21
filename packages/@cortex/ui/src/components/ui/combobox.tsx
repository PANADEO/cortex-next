"use client"

import { Check, Plus } from "lucide-react"
import * as React from "react"
import { useTranslation } from "react-i18next"

import { cn } from "@cortex/utils"
import { Button } from "./button"
import { Input } from "./input"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { ScrollArea } from "./scroll-area"

export interface ComboboxProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  id?: string
  disabled?: boolean
  placeholder?: string
  className?: string
}

/**
 * Combobox typu "creatable": wybór z listy istniejących wartości ALBO wpisanie
 * nowej. Ten sam szkielet co `IconPicker` (Popover + Input + lista), bez
 * `cmdk` (nie jest zależnością repo) — design doc D6. Opcje to zwykłe stringi
 * przekazywane przez wołającego (inaczej niż `IconPicker`, gdzie katalog jest
 * wewnętrzny) — ten komponent jest data-agnostyczny.
 */
export function Combobox({
  value,
  onChange,
  options,
  id,
  disabled,
  placeholder,
  className,
}: ComboboxProps) {
  const { t } = useTranslation("ui")
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = React.useMemo(
    () =>
      normalizedQuery
        ? options.filter((option) => option.toLowerCase().includes(normalizedQuery))
        : options,
    [options, normalizedQuery],
  )
  const exactMatch = options.find((option) => option.toLowerCase() === normalizedQuery)
  const canCreate = normalizedQuery.length > 0 && !exactMatch

  function commit(next: string) {
    onChange(next)
    setOpen(false)
    setQuery("")
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return
    event.preventDefault()
    if (exactMatch) commit(exactMatch)
    else if (canCreate) commit(query.trim())
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery("")
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn("w-full justify-start font-normal", className)}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder || t("combobox.placeholder")}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("combobox.searchPlaceholder")}
          aria-label={t("combobox.searchLabel")}
          className="mb-2"
        />
        <ScrollArea className="max-h-60">
          <div className="flex flex-col gap-0.5 pr-2">
            {filtered.length === 0 && !canCreate ? (
              <p className="px-2 py-3 text-center text-sm text-muted-foreground">
                {t("combobox.noResults")}
              </p>
            ) : (
              filtered.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant="ghost"
                  className="justify-start gap-2 font-normal"
                  onClick={() => commit(option)}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      option === value ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate">{option}</span>
                </Button>
              ))
            )}
            {canCreate ? (
              <Button
                type="button"
                variant="ghost"
                className="justify-start gap-2 font-normal text-primary"
                onClick={() => commit(query.trim())}
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{t("combobox.create", { value: query.trim() })}</span>
              </Button>
            ) : null}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
