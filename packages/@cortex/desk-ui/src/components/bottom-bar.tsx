"use client"
import type { LucideIcon } from "lucide-react"
import { CircleUser, FolderOpen, LayoutList } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { t } from "../routes"
import { Icon } from "./icon"

const MENU_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Sprawy", icon: LayoutList },
  { href: "/files", label: "Pliki", icon: FolderOpen },
  { href: "/me", label: "Ja", icon: CircleUser },
]

/** Na telefonie nawigacja musi być pod kciukiem — bez tego z ekranu plików nie ma jak wyjść. */
export function BottomBar() {
  const path = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex h-desk-bar border-t bg-desk-surface md:hidden">
      {MENU_ITEMS.map((p) => {
        const href = t(p.href)
        const active = p.href === "/" ? path === href : path.startsWith(href)
        return (
          <Link
            key={p.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 ${active ? "text-desk-ink" : "text-desk-muted"}`}
          >
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-6 top-0 h-0.5 rounded-desk-pill bg-desk-accent"
              />
            )}
            <Icon as={p.icon} px={20} />
            <span className="text-[11px] leading-none">{p.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
