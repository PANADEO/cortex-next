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
//
// K1b dokłada trzeci test: `migrate.mjs` przed wszystkimi seedami. Do K1b ten
// plik w ogóle go NIE WIDZIAŁ (regex łapał tylko `seed-*`), więc wycięcie
// migracji z obu compose'ów zostawiało cały ten katalog zielony — a od tej
// kolejności zależy poprawność backfillu 0005_bitter_shadowcat.sql.

import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")

/** WSZYSTKIE skrypty wywoływane w `command` usługi `migrate`, w kolejności —
 *  łącznie z `migrate.mjs`. Dopasowanie po pełnej ścieżce wywołania, żeby nie
 *  łapać wzmianek o skryptach z komentarzy w tym samym pliku.
 *
 *  Wcześniej ta funkcja filtrowała po `seed-[\w-]+\.mjs` i przez to `migrate.mjs`
 *  był dla całego pliku NIEWIDZIALNY: usunięcie go z obu plików compose
 *  zostawiało komplet strażników w tym katalogu zielony. Znalezione przez
 *  review K1b mutacją, nie z lektury. */
function scriptChain(composeFile: string): string[] {
  const content = readFileSync(path.join(repoRoot, composeFile), "utf8")
  const withoutComments = content
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n")

  return [...withoutComments.matchAll(/node packages\/@cortex\/db\/scripts\/([\w-]+\.mjs)/g)].map(
    (match) => match[1] as string,
  )
}

/** Sam łańcuch seedów — to, czego dotyczyły oba pierwotne testy. */
function seedChain(composeFile: string): string[] {
  return scriptChain(composeFile).filter((script) => script.startsWith("seed-"))
}

const COMPOSE_FILES = ["docker-compose.yml", "docker-compose.image.yml"]

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
    for (const file of COMPOSE_FILES) {
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

  // Trzecie ogniwo tej samej reguły, dopisane w K1b, bo od niego zależy
  // POPRAWNOŚĆ DANYCH, nie tylko kompletność łańcucha.
  //
  // Migracja drizzle/system-config/0005_bitter_shadowcat.sql backfilluje
  // `show_on_hub` dla wierszy zarejestrowanych przed K1b. Uprawnienia dodane
  // manifestem PO K1b (K2 to faza żywej edycji manifestów) chroni przed tym
  // UPDATE-em wyłącznie to, że w chwili jego wykonania ich wiersza JESZCZE NIE
  // MA — a to jest prawdą tylko dopóki `migrate.mjs` biegnie przed
  // seed-tile-manifests.mjs. Odwrotna kolejność (albo brak migrate w łańcuchu
  // przy pierwszym deployu z 0005) wystawia takie uprawnienie na hub jako
  // kartę prowadzącą do ekranu, który kafelkiem nie jest. Objaw cichy,
  // przyczyna dwa pliki dalej.
  //
  // Asercja jest na "przed KAŻDYM seedem", nie tylko przed manifestami:
  // wszystkie seedy piszą do tabel, których schemat tworzą migracje, więc
  // dowolny seed przed `migrate` to na świeżej bazie błąd na starcie łańcucha.
  it("migrate.mjs jest w OBU plikach i wyprzedza WSZYSTKIE seedy", () => {
    for (const file of COMPOSE_FILES) {
      const chain = scriptChain(file)
      const migrateAt = chain.indexOf("migrate.mjs")
      const firstSeedAt = chain.findIndex((script) => script.startsWith("seed-"))

      expect(migrateAt, `${file}: brak migrate.mjs w łańcuchu`).toBeGreaterThanOrEqual(0)
      expect(firstSeedAt, `${file}: brak jakiegokolwiek seeda`).toBeGreaterThanOrEqual(0)
      expect(migrateAt, `${file}: migrate.mjs musi wyprzedzać pierwszy seed`).toBeLessThan(
        firstSeedAt,
      )
    }
  })
})
