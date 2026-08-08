"use client"

import { cn } from "@cortex/utils"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { Badge } from "./ui/badge"

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
  activeItemId?: string
  brand?: ReactNode
  brandIcon?: ReactNode
  collapsed?: boolean
  footerSlot?: ReactNode
}

export function TileMenu({
  sections,
  activeItemId,
  brand,
  brandIcon,
  collapsed = false,
  footerSlot,
}: TileMenuProps) {
  return (
    <div className="flex h-full flex-col">
      {brand || brandIcon ? (
        <div
          className={cn(
            "flex h-header items-center",
            collapsed ? "justify-center px-0" : "px-5",
          )}
        >
          {collapsed ? brandIcon ?? brand : brand}
        </div>
      ) : null}

      <nav className={cn("flex-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
        {sections.map((section) => (
          <div key={section.id} className="mb-5 last:mb-0">
            {section.label && !collapsed ? (
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </p>
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
                        "group flex h-8 items-center rounded-md text-sm transition-colors",
                        collapsed ? "justify-center px-0" : "gap-2.5 px-2",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
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

      {footerSlot && !collapsed ? (
        <div className="border-t border-sidebar-border p-3">{footerSlot}</div>
      ) : null}
    </div>
  )
}
