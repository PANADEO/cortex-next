// Katalog fontów jako CZYSTE DANE — zero importów z node:*, więc wolno go
// zaciągnąć do bundla klienckiego (kreator szablonów pokazuje listę do wyboru).
//
// Ścieżki na dysku świadomie NIE są tutaj: rozwiązuje je font-library.ts po
// stronie serwera. Bez tego podziału klient ciągnąłby node:fs przez data-dir
// i build wywracał się na "Reading from node:fs is not handled by plugins".

export interface FontCatalogEntry {
  id: string
  /** Nazwa rodziny DOKŁADNIE tak, jak widzi ją Pango (LUKA 3 projektu). */
  family: string
  regularFile: string
  boldFile: string
}

export const DEFAULT_FONT_LIBRARY_ID = "noto-sans"

export const FONT_CATALOG: Record<string, FontCatalogEntry> = {
  "noto-sans": {
    id: "noto-sans",
    family: "Noto Sans",
    regularFile: "NotoSans-Regular.ttf",
    boldFile: "NotoSans-Bold.ttf",
  },
}

/** Lista dla UI kreatora — bez ścieżek dyskowych, których klient nie potrzebuje.
 *  Napis pozycji bierze się z `options.font.<id>` w przestrzeni `ilustromat`. */
export function fontLibraryOptions(): { id: string }[] {
  return Object.values(FONT_CATALOG).map(({ id }) => ({ id }))
}
