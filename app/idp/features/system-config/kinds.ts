import type { TileKind } from "@cortex/tile-sdk"

export const KIND_LABELS: Record<TileKind, string> = {
  native: "Natywny (strona w tej aplikacji)",
  "external-link": "Link zewnętrzny (nowa karta)",
  iframe: "Osadzony (iframe)",
}

export const KIND_SHORT_LABELS: Record<TileKind, string> = {
  native: "Natywny",
  "external-link": "Link zewnętrzny",
  iframe: "Osadzony",
}
