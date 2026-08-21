"use client"

import { cn } from "@cortex/utils"
import { Check, Globe } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"

export interface LocaleOption<T extends string = string> {
  id: T
  /** ENDONIM — nazwa języka w nim samym („Polski", „English"). Nigdy
   *  tłumaczona: lista języków ma być czytelna dla kogoś, kto NIE zna
   *  aktualnie ustawionego języka i właśnie dlatego jej szuka. */
  label: string
}

interface Props<T extends string> {
  locale: T
  options: readonly LocaleOption<T>[]
  onLocaleChange: (locale: T) => void
  className?: string | undefined
}

/**
 * Przełącznik języka w pasku górnym, obok motywu i skórki.
 *
 * Miejsce nie jest przypadkowe: to ta sama klasa ustawienia co tamte dwa —
 * preferencja wyglądu użytkownika, nie stan aplikacji. Wcześniej wybór stał
 * wyłącznie w pasku diagnostycznym stopki, który pokazuje wersję, czas
 * i rozdzielczość; język do tego zbioru nie należy, a stopka żyje tylko na
 * hubie, więc z wnętrza kafelka nie dało się przełączyć wcale.
 *
 * Aktywny język niesie `aria-checked` przez `role="menuitemradio"`, nie sam
 * znaczek — inaczej czytnik ekranu ogłasza listę pozycji bez informacji,
 * która obowiązuje.
 */
export function LocaleToggle<T extends string>({
  locale,
  options,
  onLocaleChange,
  className,
}: Props<T>) {
  const { t } = useTranslation("ui")
  const active = options.find((option) => option.id === locale)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", className)}
          aria-label={`${t("localeToggle.trigger")}: ${active?.label ?? locale}`}
        >
          <Globe className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {t("localeToggle.heading")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => {
          const selected = option.id === locale
          return (
            <DropdownMenuItem
              key={option.id}
              role="menuitemradio"
              aria-checked={selected}
              onClick={() => onLocaleChange(option.id)}
              className={cn(selected && "bg-muted")}
            >
              <Check className={cn("mr-2 h-3.5 w-3.5", selected ? "opacity-100" : "opacity-0")} />
              <span className="text-sm">{option.label}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
