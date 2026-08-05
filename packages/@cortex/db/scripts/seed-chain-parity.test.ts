// Strażnik parzystości łańcuchów seedów w docker-compose.yml (lokalnie) i
// docker-compose.image.yml (wdrożone obrazy).
//
// Nagłówek docker-compose.image.yml od dawna WYMAGA, żeby oba łańcuchy były
// identyczne, i nazywa skutek rozjazdu wprost: kafelek token-usage był martwy
// po `docker compose up` do 30.07.2026. Mimo tego ostrzeżenia rozjazd
// powtórzył się — seed-geo-score-calculator.mjs trafił 05.08.2026 tylko do
// wersji lokalnej. Skutek był ostrzejszy niż za pierwszym razem, bo
// `getGeoScoreConfig()` rzuca `GeoScoreConfigMissingError` przy braku wiersza
// (singleton konfiguracji), więc na KAŻDYM wdrożeniu z obrazu cały kafelek GEO
// Score był niesprawny — każda analiza wywalała się na starcie, mimo że
// lokalnie wszystko działało.
//
// Komentarz w nagłówku nie wystarczył dwa razy, więc reguła dostaje test.
// Dlaczego akurat test, a nie lint: `pnpm lint` obejmuje wyłącznie
// `{app,packages}/**/*.{ts,tsx}`, a pliki compose nie są sprawdzane przez nic.
//
// Test celowo NIE porównuje całych plików ani całych `command` — te dwie usługi
// mają się prawnie różnić (build vs `image:`, nazwy kontenerów, ENVIRONMENT_TAG).
// Porównywana jest wyłącznie lista wywoływanych skryptów seedowych, RAZEM
// Z KOLEJNOŚCIĄ, bo kolejność jest tu znacząca (seed-tile-manifests.mjs musi
// wyprzedzać seed-system-config.mjs — patrz komentarz przy usłudze `migrate`).

import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")

/** Nazwy skryptów seedowych w kolejności wywołania, wyciągnięte z `command`
 *  usługi `migrate`. Dopasowanie po pełnej ścieżce wywołania, żeby nie łapać
 *  wzmianek o seedach z komentarzy w tym samym pliku. */
function seedChain(composeFile: string): string[] {
  const content = readFileSync(path.join(repoRoot, composeFile), "utf8")
  const withoutComments = content
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n")

  return [...withoutComments.matchAll(/node packages\/@cortex\/db\/scripts\/(seed-[\w-]+\.mjs)/g)].map(
    (match) => match[1] as string,
  )
}

describe("łańcuchy seedów w plikach compose", () => {
  it("docker-compose.image.yml wywołuje DOKŁADNIE te same seedy, w tej samej kolejności, co docker-compose.yml", () => {
    const local = seedChain("docker-compose.yml")
    const image = seedChain("docker-compose.image.yml")

    // Asercja na niepustość osobno: gdyby regex przestał pasować (zmiana
    // formatowania `command`), obie listy byłyby puste i porównanie przeszłoby
    // triumfalnie, nie sprawdzając niczego.
    expect(local.length).toBeGreaterThan(0)
    expect(image).toEqual(local)
  })

  it("kolejność wymuszona przez komentarz przy usłudze migrate jest zachowana w OBU plikach", () => {
    // seed-system-config.mjs grantuje adminowi wszystkie wiersze `applications`,
    // więc musi biec PO rejestracji manifestów — inaczej świeża instancja ma
    // admina bez dostępu do kafelków zarejestrowanych z manifestu.
    for (const file of ["docker-compose.yml", "docker-compose.image.yml"]) {
      const chain = seedChain(file)
      const manifests = chain.indexOf("seed-tile-manifests.mjs")
      const systemConfig = chain.indexOf("seed-system-config.mjs")

      expect(manifests, `${file}: brak seed-tile-manifests.mjs`).toBeGreaterThanOrEqual(0)
      expect(systemConfig, `${file}: brak seed-system-config.mjs`).toBeGreaterThanOrEqual(0)
      expect(manifests, `${file}: manifesty muszą wyprzedzać seed-system-config`).toBeLessThan(
        systemConfig,
      )
    }
  })
})
