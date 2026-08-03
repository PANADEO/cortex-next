// Weryfikacja end-to-end Faza 1: PRAWDZIWE wywołanie cortex-proxy (bez i z
// obrazem referencyjnym) + PRAWDZIWY zapis do Postgresa (generations +
// generation_variants), na tej samej ścieżce, którą przechodzi
// POST /api/visual-guru/generate (adapter -> service), bez uruchamiania
// całego serwera Next.js.
//
// Domyślnie POMIJANY — bez DATABASE_URL/CORTEX_PROXY_URL `pnpm test` zostaje
// zielony. Uruchomienie (wzorem cortex-proxy-client.integration.test.ts i
// visual-guru.integration.test.ts):
//
//   docker ps  # potwierdź cortex-next-postgres (NIE "cortex") i cortex-proxy
//   DATABASE_URL=postgres://cortex:cortex@localhost:5432/cortex \
//   CORTEX_PROXY_URL=http://localhost:8240 \
//     pnpm vitest run app/idp/lib/visual-guru/generate-flow.integration.test.ts

import { closeDb, getDb } from "@cortex/db"
import { createGeneration, getMyGeneration } from "@cortex/service"
import { randomUUID } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { generateVariants } from "./integration-client"
import { buildModelPrompt } from "./prompts"

// `drizzle-orm` NIE jest zależnością bezpośrednią app/idp (żyje wyłącznie w
// packages/@cortex/{db,service}), więc bare-specifier import z pliku pod
// app/idp/ nie rozwiązałby się (Node/Vite szukają node_modules w górę OD
// pliku importującego, nie przez alias @cortex/db). Sprzątanie idzie więc
// przez surowy klient postgres-js (getDb().$client — udokumentowany w
// drizzle-orm/postgres-js/driver.d.ts), nie przez query builder Drizzle.

const baseUrl = process.env.CORTEX_PROXY_URL
const hasDatabase = Boolean(process.env.DATABASE_URL)
const hasProxy = Boolean(baseUrl)
const IMAGE_MODEL = process.env.VISUAL_GURU_IMAGE_MODEL ?? "google/gemini-3.1-flash-lite-image"

const SUFFIX = `itest-${process.pid}-${randomUUID().slice(0, 8)}`
const OWNER_EMAIL = `visual-guru-flow-${SUFFIX}@e2e.local`

// Zapisane w tmpdir() (PRZENOŚNE — działa dla każdego, kto odpali ten test
// lokalnie, nie tylko w tej sesji) wyłącznie do RĘCZNEJ inspekcji wizualnej
// po uruchomieniu (nie odczytywane z powrotem przez asercje) — dowód, że
// model faktycznie honoruje obraz referencyjny, nie tylko że request się nie
// wywalił.
const ARTIFACT_DIR = path.join(tmpdir(), "visual-guru-verify")

// 96x96 PNG: niebieskie tło, żółte koło z czarną obwódką — wygenerowany
// jednorazowo czystym Pythonem (zlib+struct, bez zależności) na potrzeby tej
// weryfikacji. Osadzony wprost w teście (nie plik obok), żeby test był
// odtwarzalny przez każdego, kto go uruchomi — bez zależności od zewnętrznego
// pliku poza repo.
const REFERENCE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAIAAABt+uBvAAABS0lEQVR42u3cu3HDQAwFQMQsQoW5YsdqSHbgyDO2KB3uBy4HDXDnHQMegLh9fKp/KhAAAgQIECBAgAApQIAAAQIEqK2O4wD0A/HqcwmgI+OpCXTy5R/3WIopJtJ8W5yvWUwxnuYll5NSWwLlujyV2gkoPTXn07QB0BiaYVGKfjoDaP5iWhRook4/oyij08koKun0MIpiOulGmUCL6Pwymgy0pk6iURQ7XOkHLarGJytEUTU+WSGKwvFJCVHU1mk3AtQBaIuvT9aXKMrHpzFEgLKBtjtfjacsrhCflhABAgQIECBAVwHaV+dtIwkCBAgQIECAAPkf5I8ioOFAbjXciwFyNz+/eUF3h/4gHWZ6FHW5rtrlqk9ap71ZDdM+5sU2mRczcWhm1dSzuXmbF+zuqLe7w/YX+4NsoFKAAAECBAgQIEAKECBAgABtU1/eUKaOq1IDeAAAAABJRU5ErkJggg=="

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47])
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff])

/** Dowód, że wrócił PRAWDZIWY obraz, nie pusty/uszkodzony bufor — bez
 *  zakładania konkretnego formatu. Odkryte tą właśnie weryfikacją: model
 *  zwraca JPEG, nie PNG (stąd integration-client.ts czyta typ MIME z data
 *  URI zamiast go zakładać, zamiast sztywnego "image/png"). */
function assertRealImage(variant: { image: Buffer; contentType: string }): void {
  const isPng = variant.image.subarray(0, 4).equals(PNG_MAGIC)
  const isJpeg = variant.image.subarray(0, 3).equals(JPEG_MAGIC)
  expect(isPng || isJpeg, `nieoczekiwana sygnatura pliku (contentType zgłoszony: ${variant.contentType})`).toBe(true)
  expect(variant.contentType).toBe(isPng ? "image/png" : "image/jpeg")
  expect(variant.image.length).toBeGreaterThan(1000)
}

function extensionFor(contentType: string): string {
  return contentType === "image/jpeg" ? "jpg" : "png"
}

async function cleanup() {
  // CortexDatabase (@cortex/db) jest otypowane jako klasa PostgresJsDatabase,
  // która NIE niesie `$client` w swojej deklaracji — ten property istnieje
  // wyłącznie na typie INTERSEKCJI zwracanym przez fabrykę `drizzle(...)`
  // (drizzle-orm/postgres-js/driver.d.ts). Realny obiekt ma to pole w
  // runtime, stąd rzut przez `unknown` zamiast węższego typu `CortexDatabase`.
  const db = getDb() as unknown as {
    $client: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>
  }
  await db.$client`DELETE FROM visual_guru.generations WHERE user_email = ${OWNER_EMAIL}`
}

describe.skipIf(!hasDatabase || !hasProxy)("Visual Guru — przepływ generacji na prawdziwym cortex-proxy + Postgresie", () => {
  beforeEach(async () => {
    await cleanup()
    mkdirSync(ARTIFACT_DIR, { recursive: true })
  })
  afterAll(async () => {
    await cleanup()
    await closeDb()
  })

  it(
    "generuje BEZ obrazu referencyjnego i zapisuje generację z hadReferenceImage=false",
    { timeout: 120_000 },
    async () => {
      const prompt = buildModelPrompt({
        prompt: "prosta, płaska ilustracja wektorowa niebieskiego lisa siedzącego na trawie",
        hasReferenceImages: false,
      })

      const variants = await generateVariants({
        baseUrl: baseUrl as string,
        email: OWNER_EMAIL,
        model: IMAGE_MODEL,
        prompt,
        referenceImages: [],
        variantCount: 2,
      })

      expect(variants).toHaveLength(2)
      for (const variant of variants) {
        assertRealImage(variant)
      }
      // eslint-disable-next-line no-console
      console.log("[visual-guru verify] bez referencji — contentType:", variants[0]!.contentType)

      writeFileSync(`${ARTIFACT_DIR}/bez-referencji-1.${extensionFor(variants[0]!.contentType)}`, variants[0]!.image)
      writeFileSync(`${ARTIFACT_DIR}/bez-referencji-2.${extensionFor(variants[1]!.contentType)}`, variants[1]!.image)

      const saved = await createGeneration(OWNER_EMAIL, {
        prompt: "prosta, płaska ilustracja wektorowa niebieskiego lisa siedzącego na trawie",
        hadReferenceImage: false,
        model: IMAGE_MODEL,
        variants: variants.map((variant, index) => ({
          variantIndex: index,
          image: variant.image,
          contentType: variant.contentType,
        })),
      })

      const reloaded = await getMyGeneration(OWNER_EMAIL, saved.id)
      expect(reloaded?.userEmail).toBe(OWNER_EMAIL)
      expect(reloaded?.hadReferenceImage).toBe(false)
      expect(reloaded?.referenceImageFileName).toBeNull()
      expect(reloaded?.variants).toHaveLength(2)
    },
  )

  it(
    "generuje Z obrazem referencyjnym (multi-part content) i zapisuje generację z hadReferenceImage=true",
    { timeout: 120_000 },
    async () => {
      const referenceDataUrl = `data:image/png;base64,${REFERENCE_PNG_BASE64}`

      const prompt = buildModelPrompt({
        prompt: "przekształć załączony obraz w ilustrację w stylu akwareli",
        fidelity: "high",
        hasReferenceImages: true,
      })
      // Dopisek o wierności faktycznie doklejony do promptu wysyłanego do modelu.
      expect(prompt).toContain("wysoką wierność")

      const variants = await generateVariants({
        baseUrl: baseUrl as string,
        email: OWNER_EMAIL,
        model: IMAGE_MODEL,
        prompt,
        referenceImages: [{ dataUrl: referenceDataUrl }],
        variantCount: 2,
      })

      expect(variants).toHaveLength(2)
      for (const variant of variants) {
        assertRealImage(variant)
      }
      // eslint-disable-next-line no-console
      console.log("[visual-guru verify] z referencją — contentType:", variants[0]!.contentType)

      writeFileSync(`${ARTIFACT_DIR}/z-referencja-1.${extensionFor(variants[0]!.contentType)}`, variants[0]!.image)
      writeFileSync(`${ARTIFACT_DIR}/z-referencja-2.${extensionFor(variants[1]!.contentType)}`, variants[1]!.image)

      const saved = await createGeneration(OWNER_EMAIL, {
        prompt: "przekształć załączony obraz w ilustrację w stylu akwareli",
        hadReferenceImage: true,
        referenceImageFileName: "reference.png",
        model: IMAGE_MODEL,
        variants: variants.map((variant, index) => ({
          variantIndex: index,
          image: variant.image,
          contentType: variant.contentType,
        })),
      })

      const reloaded = await getMyGeneration(OWNER_EMAIL, saved.id)
      expect(reloaded?.hadReferenceImage).toBe(true)
      expect(reloaded?.referenceImageFileName).toBe("reference.png")
      expect(reloaded?.variants).toHaveLength(2)
    },
  )
})
