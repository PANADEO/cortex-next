"use client"

import { cn } from "@cortex/utils"
import { Search } from "lucide-react"

export type HeroView = "functional" | "department"

interface HeroSearchProps {
  value: string
  onChange: (value: string) => void
  view: HeroView
  onViewChange: (view: HeroView) => void
  tileCount: number
  categoryCount: number
}

export function HeroSearch({
  value,
  onChange,
  view,
  onViewChange,
  tileCount,
  categoryCount,
}: HeroSearchProps) {
  return (
    <header className="ch-mast">
      <div className="ch-mast-row">
        <div className="ch-mast-head">
          <h1 className="ch-title">Enterprise AI Hub</h1>
          <p className="ch-sub">Wybierz aplikację, której chcesz użyć</p>
        </div>

        <div className="ch-search">
          <Search className="ch-search-icon" aria-hidden="true" />
          <input
            type="text"
            placeholder="Szukaj aplikacji…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="ch-search-input"
            aria-label="Szukaj aplikacji"
          />
          <span className="ch-search-kbd">⌘K</span>
        </div>
      </div>

      <div className="ch-rule" aria-hidden="true" />

      <div className="ch-meta">
        <span>
          Narzędzia: {tileCount} · Kategorie: {categoryCount}
        </span>
        <span className="ch-view" role="group" aria-label="Sposób grupowania">
          <button
            type="button"
            onClick={() => onViewChange("functional")}
            aria-pressed={view === "functional"}
            className={cn("ch-view-btn", view === "functional" && "is-active")}
          >
            Funkcjonalnie
          </button>
          <button
            type="button"
            onClick={() => onViewChange("department")}
            aria-pressed={view === "department"}
            className={cn("ch-view-btn", view === "department" && "is-active")}
          >
            Wg działu
          </button>
        </span>
      </div>
    </header>
  )
}
