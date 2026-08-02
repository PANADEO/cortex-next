import * as Icons from "lucide-react"
import type { LucideIcon } from "lucide-react"

// Siostrzany plik `icon-picker.tsx` obok — TA SAMA izolacja i TEN SAM powód
// (komentarz w ../../index.ts, regresja bundle-size 31.07.2026: `import *
// as Icons from "lucide-react"` w module ładowanym eagerly psuje tree-shaking
// DLA CAŁEJ APLIKACJI, +~183-187 kB First Load JS na KAŻDEJ trasie).
//
// Ten plik jest WYŁĄCZNYM konsumentem katalogu poza samym pickerem — patrz
// `resolveDynamicIcon()` w app/idp/features/system-config/icons.ts (Krok 4,
// PROJECT/cortex-frontend-hub-db-driven-projekt.md). Import WYŁĄCZNIE przez
// subpath (`@cortex/ui/components/ui/icon-catalog`) + `next/dynamic()`,
// nigdy statyczny top-level import — dokładnie jak `IconPicker`. Zero
// reeksportu z `../../index.ts`.
//
// `resolveApplicationIcon()` renderuje jawną, statyczną listę nazw ikon
// faktycznie używanych przez dzisiejszy katalog (`applications.icon`) bez
// dotykania tego modułu w ogóle — ten katalog dociąga się WYŁĄCZNIE gdy ktoś
// zapisze `applications.icon` spoza tej listy (admin wybrał ikonę spoza
// jawnej listy przez `IconPicker` w UI Aplikacje), czyli w praktyce rzadko.
export function lookupLucideIcon(name: string): LucideIcon | undefined {
  const candidate = (Icons as unknown as Record<string, unknown>)[name]
  return typeof candidate === "object" || typeof candidate === "function"
    ? (candidate as LucideIcon)
    : undefined
}
