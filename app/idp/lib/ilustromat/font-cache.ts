// LUKA 1 projektu: sharp przyjmuje `fontfile` WYŁĄCZNIE jako ścieżkę na dysku
// ("Absolute filesystem path to a font file"), nie jako bufor. Własne fonty
// szablonów żyją w bazie (bytea), więc przed renderem trzeba je zmaterializować.
//
// Cache jest ZAWARTOŚCIĄ-ADRESOWALNY (nazwa pliku = sha256 zawartości):
//   - materializacja dzieje się raz na proces, nie raz na żądanie,
//   - podmiana fontu w szablonie nie wymaga inwalidacji niczego — nowa treść
//     to po prostu inna nazwa pliku,
//   - dwa szablony z tym samym plikiem fontu dzielą jedną materializację.

import { createHash } from "node:crypto"
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const CACHE_DIRECTORY_NAME = "ilustromat-fonts"

/** Ścieżki już zmaterializowane w TYM procesie — oszczędza stat() na dysku
 *  przy każdym renderze (rekompozycja leci przy każdym naciśnięciu klawisza). */
const materialized = new Set<string>()

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex")
}

export function fontCacheDirectory(): string {
  return path.join(tmpdir(), CACHE_DIRECTORY_NAME)
}

/**
 * Zapisuje bajty fontu do cache'a i zwraca ścieżkę gotową dla sharp.
 * Zapis idzie przez plik tymczasowy + rename (atomowo), żeby równoległe
 * żądania nigdy nie podsunęły sharpowi pliku zapisanego w połowie — taki
 * plik renderowałby się fontem zastępczym, czyli dokładnie tym, czego
 * LUKA 2 zabrania.
 */
export function materializeFont(bytes: Buffer, digest?: string): string {
  const hash = digest ?? sha256(bytes)
  const directory = fontCacheDirectory()
  const target = path.join(directory, `${hash}.ttf`)

  if (materialized.has(target)) return target
  if (existsSync(target)) {
    materialized.add(target)
    return target
  }

  mkdirSync(directory, { recursive: true })
  const temporary = path.join(directory, `${hash}.${process.pid}.tmp`)
  writeFileSync(temporary, bytes)
  renameSync(temporary, target)
  materialized.add(target)
  return target
}

/** Wyłącznie dla testów — cache w pamięci procesu przeżywa import modułu. */
export function clearFontCacheMemo(): void {
  materialized.clear()
}
