import * as Icons from "lucide-react"
import { LayoutDashboard, type LucideIcon } from "lucide-react"

// Cały katalog lucide-react (design doc D4) — lista Aplikacje renderuje
// wszystkie ikony na raz (jedna per wiersz), więc w przeciwieństwie do
// `IconPicker` (@cortex/ui, dociągany przez next/dynamic dopiero przy
// otwarciu) tu ładujemy namespace eagerly: nie ma czego opóźniać, skoro
// strona i tak od razu potrzebuje wszystkich ikon naraz.
const ICONS = Icons as unknown as Record<string, LucideIcon>

/** `applications.icon` (nazwa z lucide-react) → komponent, z fallbackiem dla
 *  pustej/nieznanej nazwy (literówka, legacy wpis w bazie). */
export function resolveApplicationIcon(name: string | null | undefined): LucideIcon {
  if (!name) return LayoutDashboard
  return ICONS[name] ?? LayoutDashboard
}
