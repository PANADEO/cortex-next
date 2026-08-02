import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("content-guru") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). Narzędzie AI Tools: patrz komentarz w
// text-highlighter.manifest.ts (ten sam folder, ten sam powód).
export const contentGuruTile = defineTile({
  id: "content-guru",
  kind: "native",
  label: "Kreator treści",
  entitlementCode: "content-guru",
  route: "/ai-tools/content-guru",
})
