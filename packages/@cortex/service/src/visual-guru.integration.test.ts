// Archiwum Visual Guru na PRAWDZIWYM Postgresie — dowód, że filtr `userEmail`
// w .where() (code-service/SKILL.md "Rekordy per-user") faktycznie izoluje
// właściciela od cudzych rekordów, i że createGeneration() zapisuje wiersz
// `generations` + N wierszy `generation_variants` transakcyjnie.
//
// Domyślnie POMIJANY — bez DATABASE_URL `pnpm test` zostaje zielony.
// Uruchomienie:
//   docker compose up -d postgres
//   pnpm --filter @cortex/db db:migrate:apply
//   DATABASE_URL=postgres://cortex:cortex@localhost:5432/cortex pnpm vitest run \
//     packages/@cortex/service/src/visual-guru.integration.test.ts

import { closeDb, generations, getDb } from "@cortex/db"
import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { createGeneration, getMyGeneration, listMyGenerations } from "./visual-guru"

const hasDatabase = Boolean(process.env.DATABASE_URL)

// Sufiks per proces, wzorem rbac.integration.test.ts — testy integracyjne
// mogą startować równolegle, stałe adresy kolidowałyby.
const SUFFIX = `itest-${process.pid}-${randomUUID().slice(0, 8)}`
const OWNER_EMAIL = `visual-guru-owner-${SUFFIX}@e2e.local`
const FOREIGN_OWNER_EMAIL = `visual-guru-foreign-${SUFFIX}@e2e.local`

async function cleanup() {
  const db = getDb()
  await db.delete(generations).where(eq(generations.userEmail, OWNER_EMAIL))
  await db.delete(generations).where(eq(generations.userEmail, FOREIGN_OWNER_EMAIL))
}

describe.skipIf(!hasDatabase)("visual-guru service — prawdziwy Postgres", () => {
  beforeEach(cleanup)
  afterAll(async () => {
    await cleanup()
    await closeDb()
  })

  it("createGeneration zapisuje generation + warianty w jednej transakcji", async () => {
    const result = await createGeneration(OWNER_EMAIL, {
      prompt: "gwiazda na tle mórz",
      additionalContext: null,
      hadReferenceImage: false,
      referenceImageFileName: null,
      model: "google/gemini-3.1-flash-lite-image",
      variants: [
        { variantIndex: 0, image: Buffer.from("aaa"), contentType: "image/png" },
        { variantIndex: 1, image: Buffer.from("bbb"), contentType: "image/png" },
      ],
    })

    expect(result.userEmail).toBe(OWNER_EMAIL)
    expect(result.variantCount).toBe(2)
    expect(result.variants).toHaveLength(2)
    expect(result.variants[0]?.image.toString()).toBe("aaa")
  })

  it("listMyGenerations zwraca WYŁĄCZNIE rekordy właściciela, nigdy cudze", async () => {
    await createGeneration(OWNER_EMAIL, {
      prompt: "prompt właściciela",
      hadReferenceImage: false,
      model: "google/gemini-3.1-flash-lite-image",
      variants: [{ variantIndex: 0, image: Buffer.from("owner") }],
    })
    await createGeneration(FOREIGN_OWNER_EMAIL, {
      prompt: "cudzy prompt",
      hadReferenceImage: false,
      model: "google/gemini-3.1-flash-lite-image",
      variants: [{ variantIndex: 0, image: Buffer.from("foreign") }],
    })

    const rows = await listMyGenerations(OWNER_EMAIL)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.prompt).toBe("prompt właściciela")
    expect(rows.some((row) => row.userEmail === FOREIGN_OWNER_EMAIL)).toBe(false)
  })

  it("getMyGeneration zwraca undefined dla cudzego id (nigdy nie przecieka)", async () => {
    const foreign = await createGeneration(FOREIGN_OWNER_EMAIL, {
      prompt: "cudzy prompt",
      hadReferenceImage: false,
      model: "google/gemini-3.1-flash-lite-image",
      variants: [{ variantIndex: 0, image: Buffer.from("foreign") }],
    })

    const asOwner = await getMyGeneration(OWNER_EMAIL, foreign.id)
    expect(asOwner).toBeUndefined()
  })

  it("getMyGeneration zwraca undefined dla nieistniejącego id", async () => {
    const result = await getMyGeneration(OWNER_EMAIL, "00000000-0000-0000-0000-000000000000")
    expect(result).toBeUndefined()
  })

  it("getMyGeneration zwraca komplet wariantów posortowanych po variantIndex", async () => {
    const created = await createGeneration(OWNER_EMAIL, {
      prompt: "trzy warianty",
      hadReferenceImage: true,
      referenceImageFileName: "logo.png",
      model: "google/gemini-3.1-flash-lite-image",
      variants: [
        { variantIndex: 2, image: Buffer.from("c") },
        { variantIndex: 0, image: Buffer.from("a") },
        { variantIndex: 1, image: Buffer.from("b") },
      ],
    })

    const found = await getMyGeneration(OWNER_EMAIL, created.id)
    expect(found?.hadReferenceImage).toBe(true)
    expect(found?.referenceImageFileName).toBe("logo.png")
    expect(found?.variants.map((v) => v.variantIndex)).toEqual([0, 1, 2])
  })
})
