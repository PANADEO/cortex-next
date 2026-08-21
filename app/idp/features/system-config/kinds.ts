import type { TileKind } from "@cortex/tile-sdk"

/**
 * Rodzaj kafelka -> KLUCZ tłumaczenia w przestrzeni `system-config`, nie gotowy
 * napis: ten moduł nie jest komponentem, więc nie ma skąd wziąć `t`. Mapa
 * zostaje (a nie derywacja klucza z wartości `TileKind`), bo `Record<TileKind,
 * string>` wymusza dopisanie klucza przy każdym nowym rodzaju kafelka.
 */
export const KIND_LABEL_KEYS: Record<TileKind, string> = {
  native: "applications.kind.native",
  "external-link": "applications.kind.externalLink",
  iframe: "applications.kind.iframe",
}

export const KIND_SHORT_LABEL_KEYS: Record<TileKind, string> = {
  native: "applications.kindShort.native",
  "external-link": "applications.kindShort.externalLink",
  iframe: "applications.kindShort.iframe",
}
