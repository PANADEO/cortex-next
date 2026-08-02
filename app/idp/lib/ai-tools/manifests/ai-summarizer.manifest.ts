import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("ai-summarizer") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). Narzędzie AI Tools: patrz komentarz w
// text-highlighter.manifest.ts (ten sam folder, ten sam powód).
export const aiSummarizerTile = defineTile({
  id: "ai-summarizer",
  kind: "native",
  label: "Sumaryzator",
  entitlementCode: "ai-summarizer",
  route: "/ai-tools/ai-summarizer",
})
