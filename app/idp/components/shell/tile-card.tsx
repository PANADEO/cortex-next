"use client"

import { cn } from "@cortex/utils"
import { Star } from "lucide-react"
import Link from "next/link"
import type { Tile, TileCategoryFunctional } from "@/lib/tiles"

const ACCENTS = ["amber", "teal", "terracotta"] as const

/** Deterministic chiclet accent: hash of the functional category, cycling
 *  the Domino palette (amber / teal / terracotta).
 *
 *  `null` jest tu realnym wejściem, nie defensywą: kafelek bez kategorii
 *  funkcjonalnej istnieje w bazie (manifest bez pól prezentacyjnych —
 *  `document-parser`, `visual-guru` — oraz każdy kafelek założony z UI).
 *  Wersja z `main`, skąd ten kod przyszedł, brała `string` i wołała `.length`
 *  wprost, bo tam kategoria płynęła ze statycznej listy i była zawsze
 *  ustawiona. */
function accentFor(categoryFunctional: TileCategoryFunctional | null): (typeof ACCENTS)[number] {
  if (!categoryFunctional) return "amber"
  let hash = 0
  for (let i = 0; i < categoryFunctional.length; i++) {
    hash = (hash + categoryFunctional.charCodeAt(i)) % ACCENTS.length
  }
  return ACCENTS[hash] ?? "amber"
}

interface TileCardProps {
  tile: Tile
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
  /** Uppercase micro tag rendered under the description (current grouping). */
  categoryTag: string
  /** Position in the grid — drives the load-in stagger delay. */
  index: number
}

export function TileCard({
  tile,
  isFavorite,
  onToggleFavorite,
  categoryTag,
  index,
}: TileCardProps) {
  const Icon = tile.icon
  return (
    <Link
      href={tile.href}
      target={tile.external ? "_blank" : undefined}
      rel={tile.external ? "noopener noreferrer" : undefined}
      className={cn("ch-tile", `ch-acc-${accentFor(tile.categoryFunctional)}`)}
      style={{ "--ch-delay": `${Math.min(index, 24) * 28}ms` } as React.CSSProperties}
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
        className={cn("ch-fav", isFavorite && "is-active")}
      >
        <Star className="ch-fav-star" aria-hidden="true" />
      </button>
      {/* `iconBg`/`iconFg` zostają obok klas `ch-*`, choć wersja z `main` je
          wyrzuciła: to jest 11-kolorowa paleta per aplikacja, którą admin
          ustawia w Konfiguracji Systemu (`applications.color`). Skin Domino
          i tak ją przykryje własnym akcentem (D6), ale przykrycie jest
          odwracalne, a usunięcie z TSX zabiłoby ją we wszystkich wariantach
          naraz i zamieniło pole w panelu w martwą kontrolkę. */}
      <div className={cn("ch-tile-icon", tile.iconBg)}>
        <Icon className={cn("ch-tile-glyph", tile.iconFg)} aria-hidden="true" />
      </div>
      <div className="ch-tile-name">{tile.label}</div>
      <div className="ch-tile-desc">{tile.description}</div>
      <div className="ch-tile-tag">{categoryTag}</div>
    </Link>
  )
}
