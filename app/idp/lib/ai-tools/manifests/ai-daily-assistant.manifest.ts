import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("ai-daily-assistant")
// jest wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). Narzędzie AI Tools: patrz komentarz w
// text-highlighter.manifest.ts (ten sam folder, ten sam powód).
export const aiDailyAssistantTile = defineTile({
  id: "ai-daily-assistant",
  kind: "native",
  label: "Chatbot AI",
  entitlementCode: "ai-daily-assistant",
  route: "/ai-tools/ai-daily-assistant",
})
