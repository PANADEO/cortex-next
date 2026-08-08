"use client"

import { cn } from "@cortex/utils"
import { Star } from "lucide-react"
import Link from "next/link"
import type { Tile } from "@/lib/tiles"

interface TileCardProps {
  tile: Tile
  isFavorite: boolean
  onToggleFavorite: (id: string) => void
}

export function TileCard({ tile, isFavorite, onToggleFavorite }: TileCardProps) {
  const Icon = tile.icon
  return (
    <Link
      href={tile.href}
      target={tile.external ? "_blank" : undefined}
      rel={tile.external ? "noopener noreferrer" : undefined}
      className="group relative flex min-h-[184px] flex-col rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-[3px] hover:border-cortex hover:shadow-lg hover:shadow-cortex/20"
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
        className={cn(
          "absolute right-3 top-3 rounded p-1 transition-opacity hover:bg-muted",
          isFavorite ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100",
        )}
      >
        <Star
          className={cn(
            "h-4 w-4",
            isFavorite ? "fill-amber-500 text-amber-500" : "text-muted-foreground",
          )}
        />
      </button>
      <div
        className={cn(
          "mb-4 flex h-12 w-12 items-center justify-center rounded-lg",
          tile.iconBg,
        )}
      >
        <Icon className={cn("h-6 w-6", tile.iconFg)} />
      </div>
      <div className="text-base font-semibold leading-tight">{tile.label}</div>
      <div className="mt-auto line-clamp-2 pt-2 text-xs leading-relaxed text-muted-foreground">
        {tile.description}
      </div>
    </Link>
  )
}
