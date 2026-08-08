import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("presentation-generator")
// jest wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). Generator PREZENTACJI, nie obrazów — dawniej `id:
// "visual-guru"` (leftover niedokończonego renamu, PROJECT/cortex-next-todo.md
// "visual-guru: dokończyć rename"), skorygowane 03.08.2026 żeby uwolnić nazwę
// `visual-guru` dla nadchodzącego prawdziwego generatora obrazów — patrz
// PROJECT/cortex-frontend-visual-guru-tile-projekt.md D8. Narzędzie AI Tools:
// patrz komentarz w text-highlighter.manifest.ts (ten sam folder, ten sam powód).
export const presentationGeneratorTile = defineTile({
  id: "presentation-generator",
  kind: "native",
  label: "Generator prezentacji",
  entitlementCode: "presentation-generator",
  route: "/ai-tools/presentation-generator",
  description: "Buduje szkielet prezentacji z opisu",
  icon: "Presentation",
  color: "violet",
  categoryFunctional: "content-generation",
  categoryDepartment: ["marketing", "hr", "operations"],
  sortOrder: 180,
})
