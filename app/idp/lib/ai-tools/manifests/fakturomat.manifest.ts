import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("fakturomat") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). Narzędzie AI Tools: patrz komentarz w
// text-highlighter.manifest.ts (ten sam folder, ten sam powód).
export const fakturomatTile = defineTile({
  id: "fakturomat",
  kind: "native",
  label: "Analizator faktur",
  entitlementCode: "fakturomat",
  route: "/ai-tools/fakturomat",
})
