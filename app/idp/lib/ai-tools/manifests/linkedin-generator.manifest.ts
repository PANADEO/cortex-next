import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("linkedin-generator")
// jest wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). Narzędzie AI Tools: patrz komentarz w
// text-highlighter.manifest.ts (ten sam folder, ten sam powód).
export const linkedinGeneratorTile = defineTile({
  id: "linkedin-generator",
  kind: "native",
  label: "Generator LinkedIn",
  entitlementCode: "linkedin-generator",
  route: "/ai-tools/linkedin-generator",
  description: "Tworzy posty na LinkedIn",
  icon: "MessageSquareText",
  color: "violet",
  categoryFunctional: "content-generation",
  categoryDepartment: ["marketing", "hr", "operations"],
  sortOrder: 170,
})
