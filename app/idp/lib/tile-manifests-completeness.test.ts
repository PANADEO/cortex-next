// Strażnik kompletności barrela: KAŻDY plik definiujący kafelek musi być
// zaimportowany w app/idp/lib/tile-manifests.ts.
//
// CO SIĘ STANIE BEZ TEGO PO K3. Dziś zapomniany import jest maskowany:
// statyczna lista APPLICATIONS w seed-system-config.mjs i tak zakłada wiersz dla
// większości kodów, więc kafelek pojawia się w bazie mimo że barrel go nie zna.
// K3 tę listę usuwa. Od tego momentu barrel jest JEDYNĄ drogą, którą kafelek
// trafia do `tile-manifests.generated.json`, a stamtąd do rejestru — więc
// zapomniany import znaczy, że moduł NIE ZAREJESTRUJE SIĘ W ŻADNEJ INSTANCJI.
//
// Tryb awarii jest cichy w każdym punkcie: plik manifestu istnieje, `defineTile()`
// waliduje go poprawnie, `tsc` przechodzi (nikt go nie importuje, więc nie ma
// czego sprawdzić), build przechodzi, seed przechodzi. Kafelek po prostu nie
// istnieje dla platformy — nie ma go w pickerze aktywacji, nie da się nadać do
// niego uprawnień, a jego trasa zwraca 403 z bramki, bo `requireTileAccess()`
// pyta o kod, którego nie ma w `applications`. Komentarz w samym barrelu ostrzega
// przed tym od zawsze ("Import zapomniany tutaj = moduł nigdy nie zarejestruje
// się jako kandydat do aktywacji w żadnej instancji") — ale komentarz nie jest
// egzekwowalny, a to repo ma już udokumentowane, że ostrzeżenie w nagłówku nie
// wystarczyło dwa razy z rzędu (rozjazd łańcucha seedów, commit 672632a).
//
// DLACZEGO NIE LICZBA PLIKÓW, TYLKO ZBIÓR KODÓW. Porównanie `27 === 27` przeszłoby
// przy jednoczesnym dodaniu jednego manifestu i usunięciu innego. Zbiór
// `entitlementCode` wskazuje winowajcę po imieniu, a to jest cała wartość tego
// testu — bez tego komunikat nie prowadzi do pliku.
//
// DLACZEGO REGEX, A NIE IMPORT. Ten test musi widzieć pliki, których barrel NIE
// importuje — z definicji. Zaimportowanie ich tutaj (choćby przez `import.meta.glob`)
// zmieniłoby graf modułów tak, że sprawdzana właściwość przestałaby istnieć:
// plik nieimportowany nigdzie to dokładnie ten przypadek, którego szukamy.
// Dlatego skanujemy dysk.
//
// Wzorzec `export const <nazwa> = defineTile({` na początku linii jest celowo
// wąski: w repo jest plik trasy, który wspomina `defineTile()` w komentarzu
// (app/api/system-config/applications/unactivated-native/route.ts), i szersze
// dopasowanie meldowałoby go jako manifest bez `entitlementCode`.

import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { ALL_TILE_MANIFESTS } from "./tile-manifests"

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const TILE_DEFINITION = /^export const \w+ = defineTile\(\{/m
const ENTITLEMENT_CODE = /^\s+entitlementCode:\s*"([a-z0-9-]+)"/m

/** Wszystkie pliki `.ts` pod app/idp, z pominięciem artefaktów buildu i testów. */
function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".next")) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full))
    } else if (entry.name.endsWith(".ts") && !entry.name.includes(".test.")) {
      out.push(full)
    }
  }
  return out
}

/** kod kafelka -> ścieżka pliku, który go definiuje. Mapa, nie zbiór, bo przy
 *  porażce trzeba pokazać plik do poprawienia, a nie sam kod. */
function definedOnDisk(): Map<string, string> {
  const found = new Map<string, string>()
  for (const file of sourceFiles(appRoot)) {
    const content = readFileSync(file, "utf8")
    if (!TILE_DEFINITION.test(content)) continue

    const code = ENTITLEMENT_CODE.exec(content)?.[1]
    // Manifest bez czytelnego `entitlementCode` to sam w sobie defekt — zgłoś
    // ścieżką zamiast po cichu pominąć, bo pominięty nie trafi do porównania.
    expect(
      code,
      `${path.relative(appRoot, file)} woła defineTile(), ale nie da się z niego odczytać ` +
        "entitlementCode. Ten test skanuje dysk regexem (patrz nagłówek), więc nietypowe " +
        "formatowanie tego pola czyni manifest niewidzialnym dla strażnika.",
    ).toBeDefined()

    found.set(code as string, path.relative(appRoot, file))
  }
  return found
}

describe("kompletność barrela manifestów", () => {
  it("każdy plik definiujący kafelek jest zaimportowany w tile-manifests.ts", () => {
    const onDisk = definedOnDisk()
    const inBarrel = new Set(ALL_TILE_MANIFESTS.map((manifest) => manifest.entitlementCode))

    const missing = [...onDisk.entries()]
      .filter(([code]) => !inBarrel.has(code))
      .map(([code, file]) => `${code}  (${file})`)
      .sort()

    expect(
      missing,
      [
        `Manifesty istnieją na dysku, ale barrel ich nie importuje (${missing.length}):`,
        ...missing.map((entry) => `  - ${entry}`),
        "",
        "Po K3 barrel jest JEDYNĄ drogą do rejestru aplikacji. Kafelek spoza niego nie",
        "zarejestruje się w żadnej instancji: nie pojawi się w pickerze aktywacji, nie da",
        "się nadać do niego uprawnień, a jego trasa zwróci 403, bo requireTileAccess()",
        "pyta o kod, którego nie ma w applications.",
        "",
        "Nic tego nie zgłosi samo: tsc nie sprawdza pliku, którego nikt nie importuje,",
        "a build i seed przechodzą.",
        "",
        "Naprawa: dopisz import i wpis w app/idp/lib/tile-manifests.ts.",
      ].join("\n"),
    ).toEqual([])
  })

  it("barrel nie zawiera kodu, którego nie ma na dysku", () => {
    // Kierunek odwrotny — łapie wpis, który przetrwał usunięcie modułu. Sam
    // barrel by się wtedy nie skompilował (martwy import), więc to asercja
    // dopełniająca, nie druga linia obrony. Jest tu, żeby porównanie zbiorów
    // było pełne: bez niej test przechodziłby przy KAŻDYM barrelu, który jest
    // nadzbiorem dysku.
    const onDisk = definedOnDisk()
    const orphaned = ALL_TILE_MANIFESTS.map((manifest) => manifest.entitlementCode)
      .filter((code) => !onDisk.has(code))
      .sort()

    expect(
      orphaned,
      `Barrel eksportuje kody bez pliku definiującego na dysku: ${orphaned.join(", ")}.`,
    ).toEqual([])
  })
})
