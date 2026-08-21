"use client"

import { cn } from "@cortex/utils"
import { cva } from "class-variance-authority"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import type { AppShellVariant } from "./app-shell"
import { Badge } from "./ui/badge"

/**
 * Kształt paska bocznego. Kolory zostają tokenami i nie zależą od wariantu —
 * od niego zależy grubość linii, krój etykiety sekcji i sposób wyrażenia stanu
 * aktywnego (podświetlenie tła kontra wypełnienie akcentem).
 *
 * Promień CELOWO siedzi w bazie jako `rounded-md`, a nie w wariancie:
 * rozwija się przez `--radius-md`, który `.skin-domino` ustawia na 2px. Twarda
 * krawędź przychodzi więc z palety. Wpisanie jej tutaj rozdwoiłoby źródło
 * promienia między warstwę 1 i 2.
 */
const menu = {
  brand: cva("flex h-header items-center", {
    variants: {
      variant: { plain: "", ruled: "border-b-2 border-sidebar-border" },
    },
    defaultVariants: { variant: "plain" },
  }),
  label: cva("mb-2 px-2 font-semibold uppercase", {
    variants: {
      variant: {
        plain: "text-[10px] tracking-wider text-muted-foreground",
        ruled: "font-mono text-[11px] tracking-[0.14em] text-sidebar-primary",
      },
    },
    defaultVariants: { variant: "plain" },
  }),
  link: cva(
    "group flex h-8 items-center rounded-md text-sm transition-colors motion-reduce:transition-none",
    {
      variants: {
        variant: { plain: "", ruled: "border-[1.5px] border-transparent" },
        active: { true: "", false: "" },
      },
      compoundVariants: [
        {
          variant: "plain",
          active: true,
          class: "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
        },
        {
          variant: "plain",
          active: false,
          class:
            "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        },
        {
          variant: "ruled",
          active: true,
          // `border-sidebar-border` nadpisuje `border-transparent` z wariantu
          // WYŁĄCZNIE dlatego, że konsument owija wynik w `cn()` — twMerge
          // wyrzuca wcześniejszą klasę tej samej rodziny. Wywołane surowo
          // (`menu.link(...)` bez `cn`) pojechałyby obie i o kolorze
          // rozstrzygałaby kolejność reguł w arkuszu. Nośne, nie kosmetyczne.
          class: "bg-chart-1 text-chart-1-foreground border-sidebar-border font-semibold",
        },
        {
          variant: "ruled",
          active: false,
          class: "text-sidebar-foreground hover:bg-sidebar-accent",
        },
      ],
      defaultVariants: { variant: "plain", active: false },
    },
  ),
  foot: cva("border-sidebar-border p-3", {
    variants: {
      variant: { plain: "border-t", ruled: "border-t-2" },
    },
    defaultVariants: { variant: "plain" },
  }),
}

export interface TileMenuItem {
  id: string
  label: string
  icon: LucideIcon
  href: string
  badge?: string | number
  disabled?: boolean
}

export interface TileMenuSection {
  id: string
  label?: string
  items: TileMenuItem[]
}

interface TileMenuProps {
  sections: TileMenuSection[]
  /** `undefined` znaczy „żadna pozycja nie jest aktywna" i jest stanem
   *  LEGALNYM — trasa spoza menu (np. ekran szczegółów otwierany z tabeli) nie
   *  ma prawa podświetlać przypadkowej pozycji. Typ jest jawnie rozszerzony o
   *  `undefined`, bo repo działa z `exactOptionalPropertyTypes`. */
  activeItemId?: string | undefined
  brand?: ReactNode
  brandIcon?: ReactNode
  collapsed?: boolean
  footerSlot?: ReactNode
  /** Domyślnie `plain` — wygląd sprzed wprowadzenia wariantów. */
  variant?: AppShellVariant
}

/**
 * Stan aktywny pozycji (`bg-sidebar-accent`, `text-sidebar-accent-foreground`),
 * kolor pozycji nieaktywnej i separator stopki są TOKENAMI — i tak zostaje,
 * E2 tego nie tknie. Uzasadnienie w całości: nagłówek `app-shell.tsx` obok.
 *
 * Tutaj stawka jest wyższa niż samo tło: bez tych klas jedyną pozostałą
 * oznaką „gdzie jestem" w nawigacji jest `aria-current`, czyli sygnał
 * niewidoczny dla wzroku. Przemalowanie sidebara pod nowy skin robi się przez
 * `--sidebar-accent` w bloku `.skin-*`, bez dotykania tego pliku.
 */
export function TileMenu({
  sections,
  activeItemId,
  brand,
  brandIcon,
  collapsed = false,
  footerSlot,
  variant = "plain",
}: TileMenuProps) {
  return (
    <div className="flex h-full flex-col">
      {brand || brandIcon ? (
        <div className={cn(menu.brand({ variant }), collapsed ? "justify-center px-0" : "px-5")}>
          {collapsed ? (brandIcon ?? brand) : brand}
        </div>
      ) : null}

      <nav className={cn("flex-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
        {sections.map((section) => (
          <div key={section.id} className="mb-5 last:mb-0">
            {section.label && !collapsed ? (
              <p className={menu.label({ variant })}>{section.label}</p>
            ) : null}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = item.id === activeItemId
                const Icon = item.icon
                return (
                  <li key={item.id}>
                    <Link
                      href={item.disabled ? "#" : item.href}
                      aria-disabled={item.disabled || undefined}
                      aria-current={isActive ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        menu.link({ variant, active: isActive }),
                        collapsed ? "justify-center px-0" : "gap-2.5 px-2",
                        item.disabled && "pointer-events-none opacity-50",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed ? (
                        <>
                          <span className="truncate">{item.label}</span>
                          {item.badge != null ? (
                            <Badge
                              variant="secondary"
                              className="ml-auto h-5 min-w-5 justify-center px-1.5 text-[10px]"
                            >
                              {item.badge}
                            </Badge>
                          ) : null}
                        </>
                      ) : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {footerSlot && !collapsed ? <div className={menu.foot({ variant })}>{footerSlot}</div> : null}
    </div>
  )
}
