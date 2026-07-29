// Kuratorowana biblioteka fontów — port FONT_LIBRARY z core/templates.py.
//
// Te pliki jadą RAZEM Z OBRAZEM (app/idp/public/fonts/ilustromat/), nie są
// danymi użytkownika, więc zostają w kodzie, nie w bazie. Katalog `public` jest
// już kopiowany do obrazu Dockera, więc dołożenie fontu nie wymaga zmian
// w Dockerfile. Licencja OFL pozwala je serwować i osadzać.
//
// Rozszerzenie o kolejne fonty (Inter, Source Sans 3, IBM Plex Sans) to jeden
// wpis w tej mapie i zero zmian gdzie indziej — pod warunkiem zweryfikowania
// pokrycia polskich znaków (glyph-coverage.ts).

import path from "node:path"
import { appIdpDir } from "../data-dir"

export interface FontLibraryEntry {
  id: string
  label: string
  /** Nazwa rodziny widziana przez Pango — musi zgadzać się z zawartością
   *  pliku, inaczej Pango po cichu dobierze inny font (LUKA 3 projektu). */
  family: string
  regularPath: string
  boldPath: string
  note: string
}

/** Fonty leżą w `public`, a route'y serwerowe czytają je z dysku po ścieżce
 *  bezwzględnej — sharp przyjmuje `fontfile` wyłącznie jako ścieżkę.
 *
 *  Rozwiązanie ścieżki przez appIdpDir(), nie przez process.cwd(): `next dev|
 *  build|start app/idp` startuje z katalogu repo, a standalone server.js
 *  chdir()uje do siebie — ta różnica wywróciła już realny deploy (patrz
 *  komentarz w lib/data-dir.ts). */
export function fontsDirectory(): string {
  return path.join(appIdpDir(), "public", "fonts", "ilustromat")
}

export const DEFAULT_FONT_LIBRARY_ID = "noto-sans"

export function fontLibrary(): Record<string, FontLibraryEntry> {
  const directory = fontsDirectory()
  return {
    "noto-sans": {
      id: "noto-sans",
      label: "Noto Sans (biblioteka, domyślny)",
      family: "Noto Sans",
      regularPath: path.join(directory, "NotoSans-Regular.ttf"),
      boldPath: path.join(directory, "NotoSans-Bold.ttf"),
      note: "Neutralny, bezpieczny wybór — pełne pokrycie polskich znaków.",
    },
  }
}

export function resolveFontLibraryEntry(id: string | null): FontLibraryEntry {
  const library = fontLibrary()
  return library[id ?? DEFAULT_FONT_LIBRARY_ID] ?? library[DEFAULT_FONT_LIBRARY_ID]!
}

/** Lista dla UI kreatora — bez ścieżek dyskowych, których klient nie potrzebuje. */
export function fontLibraryOptions(): { id: string; label: string; note: string }[] {
  return Object.values(fontLibrary()).map(({ id, label, note }) => ({ id, label, note }))
}
