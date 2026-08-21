"use client"

import { useVirtualizer } from "@tanstack/react-virtual"
import type { LucideIcon } from "lucide-react"
import * as Icons from "lucide-react"
import * as React from "react"

import { cn } from "@cortex/utils"
import { Button } from "./button"
import { Input } from "./input"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { ScrollArea } from "./scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip"

export interface IconPickerProps {
  value: string
  onChange: (value: string) => void
  id?: string
  disabled?: boolean
  className?: string
  /** Otwiera popover od razu przy montowaniu. Konsument, który montuje ten
   *  komponent dopiero w reakcji na pierwsze kliknięcie/focus placeholdera
   *  (bundle-split, D4/D5 — patrz system-config/applications/[code]/page.tsx),
   *  inaczej wymagałby DRUGIEGO kliknięcia: pierwsze tylko podmienia
   *  placeholder na ten komponent, więc żaden `PopoverTrigger` jeszcze go nie
   *  odebrał. Z `autoOpen` ten sam gest robi jedno i drugie. */
  autoOpen?: boolean
}

// `lucide-react` eksportuje trzy aliasy per ikona (np. `ChevronRight`,
// `ChevronRightIcon`, `LucideChevronRight`) plus kilka bytów, które nie są
// pojedynczą ikoną (`icons` — cały namespace, `createLucideIcon` — fabryka,
// `Icon` — bazowy prymityw). Katalog picker'a ma pokazywać każdą ikonę
// dokładnie raz, pod jej kanoniczną nazwą.
const NON_ICON_EXPORTS = new Set(["icons", "createLucideIcon", "Icon", "default"])

function isCanonicalIconExport(name: string): boolean {
  return !NON_ICON_EXPORTS.has(name) && !name.endsWith("Icon") && !name.startsWith("Lucide")
}

// "ChevronRight" -> "Chevron Right" — prosty regex wstawiający spację przed
// wielką literą, zero ręcznie kurowanej listy etykiet (design doc D4).
function humanizeIconName(name: string): string {
  return name.replace(/([A-Z])/g, " $1").trim()
}

interface IconOption {
  name: string
  label: string
  Icon: LucideIcon
}

// Cały katalog lucide-react, policzony raz przy pierwszym imporcie tego
// modułu. Moduł jest ładowany przez wołającego wyłącznie przez
// `next/dynamic(..., { ssr: false })`, więc ten koszt płaci tylko
// administrator, który faktycznie otworzy picker (D4/D5).
const ICON_CATALOG: IconOption[] = Object.entries(Icons as unknown as Record<string, unknown>)
  .filter((entry): entry is [string, LucideIcon] => {
    const [name, value] = entry
    return isCanonicalIconExport(name) && typeof value !== "function"
  })
  .map(([name, Icon]) => ({ name, label: humanizeIconName(name), Icon }))
  .sort((a, b) => a.name.localeCompare(b.name))

const ICON_BY_NAME = new Map(ICON_CATALOG.map((option) => [option.name, option]))

const FALLBACK_ICON: LucideIcon = Icons.LayoutDashboard
const COLUMN_COUNT = 6
const ROW_HEIGHT = 44

/**
 * Wybór ikony z całego katalogu `lucide-react` (bez ręcznie kurowanej listy —
 * design doc D4/D5). Popover + pole filtra + wirtualizowana siatka
 * (`@tanstack/react-virtual`), bez `cmdk` (nie jest zależnością repo).
 */
export function IconPicker({
  value,
  onChange,
  id,
  disabled,
  className,
  autoOpen,
}: IconPickerProps) {
  // Wartość początkowa czytana raz, na pierwszym renderze — dokładnie tyle
  // potrzeba: ten komponent montuje się raz na czas życia strony (gate
  // `isIconPickerActive` w wołającym nie wraca do false), więc `autoOpen`
  // nie ma się do czego "przełączyć" później.
  const [open, setOpen] = React.useState(autoOpen ?? false)
  const [query, setQuery] = React.useState("")

  const selected = value ? ICON_BY_NAME.get(value) : undefined
  const SelectedIcon = selected?.Icon ?? FALLBACK_ICON

  function handleSelect(name: string) {
    onChange(name)
    setOpen(false)
    setQuery("")
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
          className={cn("w-full justify-start gap-2 font-normal", className)}
        >
          <SelectedIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{selected ? selected.label : value || "Wybierz ikonę"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Szukaj ikony…"
          aria-label="Szukaj ikony"
          className="mb-2"
        />
        <IconGrid query={query} value={value} onSelect={handleSelect} />
      </PopoverContent>
    </Popover>
  )
}

function IconGrid({
  query,
  value,
  onSelect,
}: {
  query: string
  value: string
  onSelect: (name: string) => void
}) {
  const scrollAreaRef = React.useRef<HTMLDivElement>(null)

  const filtered = React.useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return ICON_CATALOG
    return ICON_CATALOG.filter(
      (option) =>
        option.name.toLowerCase().includes(normalized) ||
        option.label.toLowerCase().includes(normalized),
    )
  }, [query])

  const rowCount = Math.ceil(filtered.length / COLUMN_COUNT)

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    // Radix ScrollArea renderuje właściwy scrollowalny element jako Viewport
    // wewnątrz Root (na który wskazuje ref); Viewport ma stały atrybut
    // `data-radix-scroll-area-viewport`, więc odnajdujemy go relatywnie.
    getScrollElement: () =>
      scrollAreaRef.current?.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]") ??
      null,
    estimateSize: () => ROW_HEIGHT,
    overscan: 6,
  })

  if (filtered.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Brak wyników</p>
  }

  return (
    <TooltipProvider delayDuration={300}>
      <ScrollArea ref={scrollAreaRef} className="h-72">
        <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const rowStart = virtualRow.index * COLUMN_COUNT
            const rowItems = filtered.slice(rowStart, rowStart + COLUMN_COUNT)
            return (
              <div
                key={virtualRow.key}
                className="absolute left-0 top-0 grid w-full grid-cols-6 items-center justify-items-center gap-1"
                style={{ height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
              >
                {rowItems.map((option) => (
                  <Tooltip key={option.name}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant={option.name === value ? "secondary" : "ghost"}
                        aria-label={option.label}
                        onClick={() => onSelect(option.name)}
                      >
                        <option.Icon className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{option.label}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </TooltipProvider>
  )
}
