// Rozwiązywanie fontów biblioteki DO ŚCIEŻEK NA DYSKU — wyłącznie serwer.
// Czyste metadane (do wyboru w UI) żyją w font-catalog.ts, bez importów node:*.
//
// Te pliki jadą RAZEM Z OBRAZEM (app/idp/public/fonts/ilustromat/), nie są
// danymi użytkownika, więc zostają w kodzie, nie w bazie. Katalog `public` jest
// już kopiowany do obrazu Dockera, więc dołożenie fontu nie wymaga zmian
// w Dockerfile. Licencja OFL pozwala je serwować i osadzać.

import path from "node:path"
import { appIdpDir } from "../data-dir"
import { DEFAULT_FONT_LIBRARY_ID, FONT_CATALOG, type FontCatalogEntry } from "./font-catalog"

export interface FontLibraryEntry extends FontCatalogEntry {
  regularPath: string
  boldPath: string
}

/** Rozwiązanie ścieżki przez appIdpDir(), nie przez process.cwd(): `next dev|
 *  build|start app/idp` startuje z katalogu repo, a standalone server.js
 *  chdir()uje do siebie — ta różnica wywróciła już realny deploy (patrz
 *  komentarz w lib/data-dir.ts). */
export function fontsDirectory(): string {
  return path.join(appIdpDir(), "public", "fonts", "ilustromat")
}

function withPaths(entry: FontCatalogEntry): FontLibraryEntry {
  const directory = fontsDirectory()
  return {
    ...entry,
    regularPath: path.join(directory, entry.regularFile),
    boldPath: path.join(directory, entry.boldFile),
  }
}

export function resolveFontLibraryEntry(id: string | null): FontLibraryEntry {
  const entry =
    FONT_CATALOG[id ?? DEFAULT_FONT_LIBRARY_ID] ?? FONT_CATALOG[DEFAULT_FONT_LIBRARY_ID]!
  return withPaths(entry)
}

export { DEFAULT_FONT_LIBRARY_ID, fontLibraryOptions } from "./font-catalog"
