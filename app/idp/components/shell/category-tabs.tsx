"use client"

import { cn } from "@cortex/utils"
import { Star } from "lucide-react"

export interface CategoryTab {
  id: string
  label: string
  count: number
}

interface CategoryTabsProps {
  totalCount: number
  favoritesCount: number
  // `readonly`, bo lista przychodzi z HubModel, który celowo oddaje kolekcje
  // tylko do odczytu — komponent i tak jej nie modyfikuje.
  categories: readonly CategoryTab[]
  activeId: string
  onSelect: (id: string) => void
}

export function CategoryTabs({
  totalCount,
  favoritesCount,
  categories,
  activeId,
  onSelect,
}: CategoryTabsProps) {
  const isActive = (id: string) => id === activeId
  return (
    <nav className="mb-8 border-b border-border">
      <div className="flex flex-wrap items-center gap-0.5">
        <TabButton
          isActive={isActive("all")}
          onClick={() => onSelect("all")}
          aria-label="Wszystkie aplikacje"
        >
          Wszystkie{" "}
          <span className="ml-1 text-xs tabular-nums text-muted-foreground">{totalCount}</span>
        </TabButton>
        <TabButton
          isActive={isActive("favorites")}
          onClick={() => onSelect("favorites")}
          aria-label="Ulubione aplikacje"
        >
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5" />
            Ulubione{" "}
            <span className="text-xs tabular-nums text-muted-foreground">
              {favoritesCount}
            </span>
          </span>
        </TabButton>
        {categories.length > 0 ? (
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        ) : null}
        {categories.map((cat) => (
          <TabButton
            key={cat.id}
            isActive={isActive(cat.id)}
            onClick={() => onSelect(cat.id)}
          >
            {cat.label}
          </TabButton>
        ))}
      </div>
    </nav>
  )
}

interface TabButtonProps {
  isActive: boolean
  onClick: () => void
  children: React.ReactNode
  "aria-label"?: string
}

function TabButton({ isActive, onClick, children, ...rest }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "border-cortex text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
