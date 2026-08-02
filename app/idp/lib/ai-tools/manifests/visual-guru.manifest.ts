import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("visual-guru") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). Generator PREZENTACJI, nie obrazów (znana kolizja
// nazw — patrz .claude/skills/code-tile). Narzędzie AI Tools: patrz
// komentarz w text-highlighter.manifest.ts (ten sam folder, ten sam powód).
export const visualGuruTile = defineTile({
  id: "visual-guru",
  kind: "native",
  label: "Generator prezentacji",
  entitlementCode: "visual-guru",
  route: "/ai-tools/visual-guru",
})
