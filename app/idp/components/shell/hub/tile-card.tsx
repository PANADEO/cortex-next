"use client"

import { cn } from "@cortex/utils"
import { cva } from "class-variance-authority"
import { Star } from "lucide-react"
import Link from "next/link"
import type { CSSProperties } from "react"
import type { TileVariant } from "@/lib/presets/registry"
import type { Tile } from "@/lib/tiles"
import { type Accent, accentFor } from "./accent"

/**
 * Warstwa 2 (D3): jeden kafelek, dwa wyglądy, ZERO forka komponentu. `card` to
 * kafelek sprzed redesignu, `chiclet` to ikona bazy Domino — DOM jest ten sam
 * co do elementu poza mikroetykietą kategorii, więc różnicę da się zamknąć w
 * tabeli klas zamiast w drugim pliku.
 *
 * DLACZEGO BAZY SĄ TAK CHUDE, a prawie wszystko siedzi w gałęziach wariantu.
 * Bramka tego etapu wymaga, żeby DOM presetów `neutral` i `customs` był po E4
 * BAJT W BAJT taki jak przed nim — a atrybut `class` to bajty, więc liczy się
 * też KOLEJNOŚĆ tokenów. `cva` skleja bazę przed wariantem, więc do bazy może
 * wejść wyłącznie wspólny PREFIKS dawnego napisu, nie wspólne znaczenie.
 * Gdzie prefiksu nie ma (kafelek `card` zaczyna się od `mb-4`, `chiclet` od
 * `flex`), baza zostaje pusta i to jest rozstrzygnięcie pomiarowe, nie
 * niechlujstwo.
 *
 * Z tego samego powodu `card` trzyma `min-h-[184px]` zamiast `min-h-tile`,
 * choć token `--tile-min-height` ma dokładnie tę wartość domyślną i po to
 * powstał w E2: podmiana daje identyczny styl wyliczony, ale inny napis w
 * atrybucie. Wariant `chiclet` używa już tokena, więc pod Dominem kafelek ma
 * 178 px z `.skin-domino`.
 */
const slots = {
  root: cva("group relative flex", {
    variants: {
      variant: {
        card: "min-h-[184px] flex-col rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-[3px] hover:border-cortex hover:shadow-lg hover:shadow-cortex/20",
        // `hover` przesuwa kafelek w LEWO I W GÓRĘ, a cień offsetowy
        // (`--shadow-card` = `2px 2px 0`, bez rozmycia) zostaje pod nim — to
        // jest podniesienie wycinanki z papieru, nie unoszenie karty.
        chiclet:
          "min-h-tile flex-col rounded-sm border-token border-border bg-card px-4 pb-3 pt-3.5 text-card-foreground transition-[transform,box-shadow] animate-tile-in hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:animate-none motion-reduce:transition-none",
      },
    },
  }),
  fav: cva("absolute", {
    variants: {
      variant: {
        card: "right-3 top-3 rounded p-1 transition-opacity hover:bg-muted",
        chiclet:
          "right-2 top-2 flex h-[26px] w-[26px] items-center justify-center rounded-sm border-token border-transparent transition-[opacity,border-color] hover:border-border motion-reduce:transition-none",
      },
      active: { true: "opacity-100", false: "" },
    },
    compoundVariants: [
      { variant: "card", active: false, class: "opacity-0 group-hover:opacity-100 focus:opacity-100" },
      // `group-focus-within` zamiast `focus` z gałęzi `card`: u Cezarego
      // gwiazdka wychodzi także wtedy, gdy fokus jest gdziekolwiek w kafelku,
      // nie tylko na niej samej.
      {
        variant: "chiclet",
        active: false,
        class: "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
      },
    ],
  }),
  favStar: cva("", {
    variants: {
      variant: { card: "h-4 w-4", chiclet: "h-3.5 w-3.5" },
      active: { true: "", false: "text-muted-foreground" },
    },
    compoundVariants: [
      { variant: "card", active: true, class: "fill-amber-500 text-amber-500" },
      { variant: "chiclet", active: true, class: "fill-chart-1 text-foreground" },
    ],
  }),
  icon: cva("", {
    variants: {
      variant: {
        card: "mb-4 flex h-12 w-12 items-center justify-center rounded-lg",
        chiclet: "flex h-[42px] w-[42px] items-center justify-center rounded-sm border-token border-border",
      },
    },
  }),
  glyph: cva("", {
    variants: { variant: { card: "h-6 w-6", chiclet: "h-5 w-5" } },
  }),
  name: cva("", {
    variants: {
      variant: {
        card: "text-base font-semibold leading-tight",
        chiclet: "mt-3 text-[15px] font-semibold leading-tight",
      },
    },
  }),
  desc: cva("", {
    variants: {
      variant: {
        card: "mt-auto line-clamp-2 pt-2 text-xs leading-relaxed text-muted-foreground",
        chiclet: "mt-1 line-clamp-2 text-[13px] leading-[1.45] text-muted-foreground",
      },
    },
  }),
  /** Mikroetykieta kategorii — `--label-transform` i `--label-tracking` z E2
   *  dostają tu pierwszego konsumenta, więc skin decyduje o wersalikach, a nie
   *  komponent. Kolor z `--primary` (teal rozjaśniany w ciemnym), a nie z
   *  `--chart-2` (teal stały): to jest cienki typ, nie wypełnienie. */
  tag: cva(
    "mt-auto pt-2.5 font-mono text-[11px] tracking-label text-primary [text-transform:var(--label-transform)]",
  ),
} as const

/** Akcent numerem, nie nazwą — mapa jest jedynym miejscem, gdzie `1|2|3`
 *  spotyka klasę Tailwinda. Pary `-foreground` są tokenami, bo treść na
 *  wypełnieniu musi zostać czytelna także w ciemnym, gdzie samo wypełnienie
 *  się nie zmienia (patrz `globals.css`). */
const ACCENT_BG: Readonly<Record<Accent, string>> = {
  1: "bg-chart-1",
  2: "bg-chart-2",
  3: "bg-chart-3",
}
const ACCENT_FG: Readonly<Record<Accent, string>> = {
  1: "text-chart-1-foreground",
  2: "text-chart-2-foreground",
  3: "text-chart-3-foreground",
}

/** Kaskada wejścia: 28 ms na pozycję, ucięta na 24 kafelku. Bez ucięcia ostatni
 *  kafelek pełnego katalogu czekałby ponad sekundę i wyglądałby na zawieszony. */
const STAGGER_STEP_MS = 28
const STAGGER_LAST_INDEX = 24

interface TileCardProps {
  tile: Tile
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  variant: TileVariant
  /** Pozycja w siatce — steruje kaskadą wejścia w wariancie `chiclet`. */
  index: number
  /** Etykieta kategorii w bieżącym przekroju; renderowana tylko w `chiclet`. */
  categoryTag: string
}

export function TileCard({
  tile,
  isFavorite,
  onToggleFavorite,
  variant,
  index,
  categoryTag,
}: TileCardProps) {
  const Icon = tile.icon
  const isChiclet = variant === "chiclet"
  const accent = accentFor(tile.categoryFunctional)
  // Opóźnienie stylem inline, a nie zmienną CSS na kafelku i regułą w arkuszu:
  // wartość jest per element, więc arkusz i tak by jej nie znał, a reguła
  // czytająca `var(--tile-delay)` istniałaby wyłącznie po to, żeby ją odczytać.
  // Kasuje ją `motion-reduce:animate-none` — bez nazwy animacji opóźnienie nie
  // ma czego opóźniać, więc styl inline nie musi być nadpisywany.
  const style: CSSProperties | undefined = isChiclet
    ? { animationDelay: `${Math.min(index, STAGGER_LAST_INDEX) * STAGGER_STEP_MS}ms` }
    : undefined

  return (
    <Link
      href={tile.href}
      target={tile.external ? "_blank" : undefined}
      rel={tile.external ? "noopener noreferrer" : undefined}
      className={slots.root({ variant })}
      style={style}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onToggleFavorite(tile.id)
        }}
        aria-label={isFavorite ? `Usuń ${tile.label} z ulubionych` : `Dodaj ${tile.label} do ulubionych`}
        aria-pressed={isFavorite}
        className={slots.fav({ variant, active: isFavorite })}
      >
        <Star className={slots.favStar({ variant, active: isFavorite })} />
      </button>
      {/* D6 w jednej linii: `chiclet` bierze akcent z mapy kategorii
          (`accent.ts`), `card` zostaje przy 11-kolorowej palecie per
          aplikacja, którą admin ustawia w Konfiguracji Systemu
          (`applications.color`). Pole nie staje się więc martwe globalnie —
          traci wpływ wyłącznie tam, gdzie wygląd z założenia ma trzy kolory i
          ani jednego więcej; formularz Aplikacji mówi o tym wprost, pytając
          `presetUsesApplicationColor` o AKTYWNY wygląd (ta gałąź niżej jest
          jedynym miejscem, które o tym rozstrzyga). Odrzucone: zostawić
          `tile.iconBg` obok akcentu i liczyć na `tailwind-merge` — wygrywałby
          ostatni napis, czyli o kolorze rozstrzygałaby kolejność argumentów. */}
      <div className={cn(slots.icon({ variant }), isChiclet ? ACCENT_BG[accent] : tile.iconBg)}>
        <Icon className={cn(slots.glyph({ variant }), isChiclet ? ACCENT_FG[accent] : tile.iconFg)} />
      </div>
      <div className={slots.name({ variant })}>{tile.label}</div>
      <div className={slots.desc({ variant })}>{tile.description}</div>
      {isChiclet ? <div className={slots.tag()}>{categoryTag}</div> : null}
    </Link>
  )
}
