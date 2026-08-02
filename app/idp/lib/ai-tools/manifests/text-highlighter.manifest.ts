import { defineTile } from "@cortex/tile-sdk"

// Rejestr: patrz docs/tile-registry.md. Ten sam kod ("text-highlighter") jest
// wierszem w tabeli system_config.applications — to po nim pyta
// requireTileAccess(). Narzędzie AI Tools: dziś nie ma własnego folderu pod
// app/idp/app/(main)/ — renderuje się przez współdzieloną dynamiczną stronę
// `ai-tools/[tool]/page.tsx` (dispatcher po AI_TOOL_DEFINITIONS w
// ../registry.ts), stąd manifest siedzi obok rejestru, nie obok strony.
export const textHighlighterTile = defineTile({
  id: "text-highlighter",
  kind: "native",
  label: "Podświetlacz tekstu",
  entitlementCode: "text-highlighter",
  route: "/ai-tools/text-highlighter",
})
