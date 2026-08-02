import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("text-analyzer") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). Narzędzie AI Tools: patrz komentarz w
// text-highlighter.manifest.ts (ten sam folder, ten sam powód).
export const textAnalyzerTile = defineTile({
  id: "text-analyzer",
  kind: "native",
  label: "Analizator tekstu",
  entitlementCode: "text-analyzer",
  route: "/ai-tools/text-analyzer",
})
