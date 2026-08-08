import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("text-transformer") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). Narzędzie AI Tools: patrz komentarz w
// text-highlighter.manifest.ts (ten sam folder, ten sam powód).
export const textTransformerTile = defineTile({
  id: "text-transformer",
  kind: "native",
  label: "Transformator tekstu",
  entitlementCode: "text-transformer",
  route: "/ai-tools/text-transformer",
  description: "Przekształca tekst według wybranego stylu",
  icon: "Wand2",
  color: "blue",
  categoryFunctional: "content-generation",
  categoryDepartment: ["marketing", "operations", "it"],
  sortOrder: 130,
})
