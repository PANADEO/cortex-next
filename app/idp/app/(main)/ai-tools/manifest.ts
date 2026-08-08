import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("ai-tools") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). Grant ZBIORCZY: sam kod nigdy nie renderuje własnej
// karty na hubie — bramkuje "wszystkie narzędzia AI naraz" (canAccessAiTool w
// app/idp/lib/ai-tools/app-codes.ts). Stąd `entitlementOnly` niżej: to ono
// daje `show_on_hub=false` na INSERCIE i powstrzymuje activateApplication()
// przed wystawieniem karty (K1b).
// Poszczególne narzędzia mają WŁASNE manifesty w
// app/idp/lib/ai-tools/manifests/ (współdzielą jedną dynamiczną stronę
// `ai-tools/[tool]/page.tsx`, więc nie mają osobnych folderów pod `(main)`).
export const aiToolsTile = defineTile({
  id: "ai-tools",
  kind: "native",
  label: "AI Tools",
  entitlementCode: "ai-tools",
  route: "/ai-tools",
  entitlementOnly: true,
})
