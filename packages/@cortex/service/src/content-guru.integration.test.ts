// Archiwum + zakazane frazy Content Guru na PRAWDZIWYM Postgresie — dowód, że
// filtr `userEmail` w .where() (code-service/SKILL.md "Rekordy per-user")
// faktycznie izoluje właściciela od cudzych rekordów, i że saveArchiveEntry()/
// addForbiddenPhrase()/removeForbiddenPhrase() faktycznie piszą/czytają/
// kasują wiersze.
//
// Domyślnie POMIJANY — bez DATABASE_URL `pnpm test` zostaje zielony.
// Uruchomienie (przeciw izolowanej cortex-next-postgres, NIGDY współdzielonej
// `cortex` — patrz PROJECT/cortex-frontend-content-guru-full-port-projekt.md):
//   docker ps  # potwierdź cortex-next-postgres, nie shared `cortex`
//   DATABASE_URL=postgres://cortex:cortex@localhost:5432/cortex \
//     pnpm --filter @cortex/db db:migrate:apply
//   DATABASE_URL=postgres://cortex:cortex@localhost:5432/cortex pnpm vitest run \
//     packages/@cortex/service/src/content-guru.integration.test.ts

import { closeDb, contentArchive, forbiddenPhrases, getDb } from "@cortex/db"
import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import {
  addForbiddenPhrase,
  getMyArchiveEntry,
  listMyArchive,
  listMyForbiddenPhrases,
  removeForbiddenPhrase,
  saveArchiveEntry,
} from "./content-guru"

const hasDatabase = Boolean(process.env.DATABASE_URL)

// Sufiks per proces, wzorem visual-guru.integration.test.ts — testy
// integracyjne mogą startować równolegle, stałe adresy kolidowałyby.
const SUFFIX = `itest-${process.pid}-${randomUUID().slice(0, 8)}`
const OWNER_EMAIL = `content-guru-owner-${SUFFIX}@e2e.local`
const FOREIGN_OWNER_EMAIL = `content-guru-foreign-${SUFFIX}@e2e.local`

async function cleanup() {
  const db = getDb()
  await db.delete(contentArchive).where(eq(contentArchive.userEmail, OWNER_EMAIL))
  await db.delete(contentArchive).where(eq(contentArchive.userEmail, FOREIGN_OWNER_EMAIL))
  await db.delete(forbiddenPhrases).where(eq(forbiddenPhrases.userEmail, OWNER_EMAIL))
  await db.delete(forbiddenPhrases).where(eq(forbiddenPhrases.userEmail, FOREIGN_OWNER_EMAIL))
}

describe.skipIf(!hasDatabase)("content-guru service — prawdziwy Postgres", () => {
  beforeEach(cleanup)
  afterAll(async () => {
    await cleanup()
    await closeDb()
  })

  describe("content_archive", () => {
    it("saveArchiveEntry zapisuje wpis z modelUsed/status/matchedForbiddenPhrases", async () => {
      const saved = await saveArchiveEntry(OWNER_EMAIL, {
        contentType: "post na LinkedIn",
        topic: "premiera modułu",
        generatedContent: "treść wygenerowana przez model",
        status: "done-with-warnings",
        matchedForbiddenPhrases: ["najlepszy na rynku"],
        targetAudience: "dyrektorzy IT",
        additionalInfo: null,
        keywordPhrase: null,
        metaDescription: null,
        modelUsed: "anthropic/claude-sonnet-4.6",
        metadata: { generationMode: "single" },
      })

      expect(saved.userEmail).toBe(OWNER_EMAIL)
      expect(saved.status).toBe("done-with-warnings")
      expect(saved.matchedForbiddenPhrases).toEqual(["najlepszy na rynku"])
      expect(saved.modelUsed).toBe("anthropic/claude-sonnet-4.6")
    })

    it("saveArchiveEntry z pustą listą matchedForbiddenPhrases zapisuje null, nie []", async () => {
      const saved = await saveArchiveEntry(OWNER_EMAIL, {
        contentType: "post",
        topic: "temat",
        generatedContent: "treść",
        status: "done",
        matchedForbiddenPhrases: [],
        targetAudience: null,
        additionalInfo: null,
        keywordPhrase: null,
        metaDescription: null,
        modelUsed: "anthropic/claude-sonnet-4.6",
      })

      expect(saved.matchedForbiddenPhrases).toBeNull()
    })

    it("listMyArchive zwraca WYŁĄCZNIE rekordy właściciela, nigdy cudze", async () => {
      await saveArchiveEntry(OWNER_EMAIL, {
        contentType: "post",
        topic: "temat właściciela",
        generatedContent: "treść właściciela",
        status: "done",
        matchedForbiddenPhrases: [],
        targetAudience: null,
        additionalInfo: null,
        keywordPhrase: null,
        metaDescription: null,
        modelUsed: "anthropic/claude-sonnet-4.6",
      })
      await saveArchiveEntry(FOREIGN_OWNER_EMAIL, {
        contentType: "post",
        topic: "cudzy temat",
        generatedContent: "cudza treść",
        status: "done",
        matchedForbiddenPhrases: [],
        targetAudience: null,
        additionalInfo: null,
        keywordPhrase: null,
        metaDescription: null,
        modelUsed: "anthropic/claude-sonnet-4.6",
      })

      const rows = await listMyArchive(OWNER_EMAIL)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.topic).toBe("temat właściciela")
      expect(rows.some((row) => row.userEmail === FOREIGN_OWNER_EMAIL)).toBe(false)
    })

    it("getMyArchiveEntry zwraca undefined dla cudzego id (nigdy nie przecieka)", async () => {
      const foreign = await saveArchiveEntry(FOREIGN_OWNER_EMAIL, {
        contentType: "post",
        topic: "cudzy temat",
        generatedContent: "cudza treść",
        status: "done",
        matchedForbiddenPhrases: [],
        targetAudience: null,
        additionalInfo: null,
        keywordPhrase: null,
        metaDescription: null,
        modelUsed: "anthropic/claude-sonnet-4.6",
      })

      const asOwner = await getMyArchiveEntry(OWNER_EMAIL, foreign.id)
      expect(asOwner).toBeUndefined()
    })

    it("getMyArchiveEntry zwraca undefined dla nieistniejącego id", async () => {
      const result = await getMyArchiveEntry(OWNER_EMAIL, "00000000-0000-0000-0000-000000000000")
      expect(result).toBeUndefined()
    })
  })

  describe("forbidden_phrases", () => {
    it("addForbiddenPhrase + listMyForbiddenPhrases zwraca WYŁĄCZNIE frazy właściciela", async () => {
      await addForbiddenPhrase(OWNER_EMAIL, { phrase: "najlepszy na rynku" })
      await addForbiddenPhrase(FOREIGN_OWNER_EMAIL, { phrase: "cudza fraza" })

      const rows = await listMyForbiddenPhrases(OWNER_EMAIL)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.phrase).toBe("najlepszy na rynku")
      expect(rows.some((row) => row.userEmail === FOREIGN_OWNER_EMAIL)).toBe(false)
    })

    it("removeForbiddenPhrase usuwa własną frazę i zwraca true", async () => {
      const created = await addForbiddenPhrase(OWNER_EMAIL, { phrase: "do usunięcia" })

      const removed = await removeForbiddenPhrase(OWNER_EMAIL, created.id)
      expect(removed).toBe(true)

      const rows = await listMyForbiddenPhrases(OWNER_EMAIL)
      expect(rows.some((row) => row.id === created.id)).toBe(false)
    })

    it("removeForbiddenPhrase zwraca false dla cudzej frazy, nie usuwa jej", async () => {
      const foreign = await addForbiddenPhrase(FOREIGN_OWNER_EMAIL, { phrase: "cudza fraza" })

      const removed = await removeForbiddenPhrase(OWNER_EMAIL, foreign.id)
      expect(removed).toBe(false)

      const stillThere = await listMyForbiddenPhrases(FOREIGN_OWNER_EMAIL)
      expect(stillThere.some((row) => row.id === foreign.id)).toBe(true)
    })
  })
})
