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
  categories: CategoryTab[]
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
    <nav className="ch-tabs" aria-label="Kategorie aplikacji">
      <TabButton
        isActive={isActive("all")}
        onClick={() => onSelect("all")}
        aria-label="Wszystkie aplikacje"
      >
        Wszystkie <span className="ch-tab-count">{totalCount}</span>
      </TabButton>
      <TabButton
        isActive={isActive("favorites")}
        onClick={() => onSelect("favorites")}
        aria-label="Ulubione aplikacje"
      >
        <Star className="ch-tab-star" aria-hidden="true" />
        Ulubione <span className="ch-tab-count">{favoritesCount}</span>
      </TabButton>
      {categories.map((cat) => (
        <TabButton
          key={cat.id}
          isActive={isActive(cat.id)}
          onClick={() => onSelect(cat.id)}
        >
          {cat.label} <span className="ch-tab-count">{cat.count}</span>
        </TabButton>
      ))}
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
      className={cn("ch-tab", isActive && "is-active")}
      {...rest}
    >
      {children}
    </button>
  )
}
