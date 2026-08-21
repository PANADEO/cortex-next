"use client"

import { useTranslation } from "react-i18next"

import { cn } from "@cortex/utils"
import { Search } from "lucide-react"
import type { HeroView } from "../../types"

interface HeroSearchProps {
  value: string
  onChange: (value: string) => void
  view: HeroView
  onViewChange: (view: HeroView) => void
}

export function HeroSearch({ value, onChange, view, onViewChange }: HeroSearchProps) {
  const { t } = useTranslation("shell")
  return (
    <section className="mb-8 text-center">
      <h1 className="text-xl font-semibold">Enterprise AI Hub</h1>
      <p className="mt-0.5 text-xs text-muted-foreground">{t("hub.subtitle")}</p>

      <div className="mx-auto mt-4 max-w-xl">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-ring">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Szukaj aplikacji…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Szukaj aplikacji"
          />
          <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ⌘K
          </span>
        </div>
      </div>

      <div className="mt-3 inline-flex rounded-md border border-border bg-card p-0.5">
        <button
          type="button"
          onClick={() => onViewChange("functional")}
          className={cn(
            "rounded px-3 py-1 text-xs font-medium transition-colors",
            view === "functional"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Funkcjonalnie
        </button>
        <button
          type="button"
          onClick={() => onViewChange("department")}
          className={cn(
            "rounded px-3 py-1 text-xs font-medium transition-colors",
            view === "department"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t("hub.byDepartment")}
        </button>
      </div>
    </section>
  )
}
