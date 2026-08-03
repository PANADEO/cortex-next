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

import {
  applicationScopes,
  applications,
  clientProfiles,
  closeDb,
  contentArchive,
  forbiddenPhrases,
  getDb,
  marketProfiles,
  permissionsMatrix,
  roleApplicationScopes,
  roles,
  templates,
  userRoles,
  users,
} from "@cortex/db"
import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import {
  addForbiddenPhrase,
  clientProfileInputSchema,
  createClientProfile,
  createMarketProfile,
  createTemplate,
  deleteMyClientProfile,
  deleteMyMarketProfile,
  deleteTemplate,
  duplicateTemplate,
  getMyArchiveEntry,
  getMyClientProfile,
  getMyMarketProfile,
  getTemplate,
  listMyArchive,
  listMyClientProfiles,
  listMyForbiddenPhrases,
  listMyMarketProfiles,
  listTemplates,
  marketProfileInputSchema,
  removeForbiddenPhrase,
  saveArchiveEntry,
  updateMyClientProfile,
  updateMyMarketProfile,
  updateTemplate,
} from "./content-guru"
import { clearTileAccessCache, requireTileAccess, requireTileScope } from "./rbac"

const hasDatabase = Boolean(process.env.DATABASE_URL)

// Sufiks per proces, wzorem visual-guru.integration.test.ts — testy
// integracyjne mogą startować równolegle, stałe adresy kolidowałyby.
const SUFFIX = `itest-${process.pid}-${randomUUID().slice(0, 8)}`
const OWNER_EMAIL = `content-guru-owner-${SUFFIX}@e2e.local`
const FOREIGN_OWNER_EMAIL = `content-guru-foreign-${SUFFIX}@e2e.local`
// Kategoria z sufiksem procesu — testy szablonów (zasób WSPÓLNY, bez
// userEmail) mogłyby się zderzyć między równoległymi uruchomieniami inaczej.
const TEMPLATE_CATEGORY = `Kategoria testowa ${SUFFIX}`

// Dla testów manage-templates scope (real Postgres) niżej — WŁASNA,
// zsufiksowana rola/user, żeby zero ryzyka starcia z równoległą pracą innych
// agentów na tej samej instancji cortex-next-postgres (patrz komentarz przy
// describe "manage-templates scope").
const SCOPE_ROLE_CODE = `content-guru-scope-tester-${SUFFIX}`
const SCOPE_TESTER_EMAIL = `content-guru-scope-tester-${SUFFIX}@e2e.local`
const APP_CODE = "content-guru"
const SCOPE_CODE = "manage-templates"

async function cleanup() {
  const db = getDb()
  await db.delete(contentArchive).where(eq(contentArchive.userEmail, OWNER_EMAIL))
  await db.delete(contentArchive).where(eq(contentArchive.userEmail, FOREIGN_OWNER_EMAIL))
  await db.delete(forbiddenPhrases).where(eq(forbiddenPhrases.userEmail, OWNER_EMAIL))
  await db.delete(forbiddenPhrases).where(eq(forbiddenPhrases.userEmail, FOREIGN_OWNER_EMAIL))
  await db.delete(clientProfiles).where(eq(clientProfiles.userEmail, OWNER_EMAIL))
  await db.delete(clientProfiles).where(eq(clientProfiles.userEmail, FOREIGN_OWNER_EMAIL))
  await db.delete(marketProfiles).where(eq(marketProfiles.userEmail, OWNER_EMAIL))
  await db.delete(marketProfiles).where(eq(marketProfiles.userEmail, FOREIGN_OWNER_EMAIL))
  await db.delete(templates).where(eq(templates.category, TEMPLATE_CATEGORY))
  // Kasuje WYŁĄCZNIE własną rolę/usera (kaskadowo user_roles/permissions_
  // matrix/role_application_scopes) — NIGDY wiersz applications('content-guru')
  // ani jego scope, oba idempotentnie zakładane, nigdy usuwane (patrz
  // ensureContentGuruScopeBaseline niżej).
  await db.delete(users).where(eq(users.email, SCOPE_TESTER_EMAIL))
  await db.delete(roles).where(eq(roles.code, SCOPE_ROLE_CODE))
}

/** Idempotentne — mirror packages/@cortex/db/scripts/seed-content-guru.mjs.
 *  BEZPIECZNE pod współbieżnym użyciem: `ON CONFLICT DO NOTHING`, nigdy nie
 *  nadpisuje ani nie kasuje cudzego stanu, jeśli wiersz już istnieje (np. z
 *  realnego seeda albo z równoległej pracy innego agenta). */
async function ensureContentGuruScopeBaseline(): Promise<{ applicationId: string; scopeId: string }> {
  const db = getDb()

  await db
    .insert(applications)
    .values({ code: APP_CODE, name: "Content Guru", kind: "native", route: "/content-guru" })
    .onConflictDoNothing({ target: applications.code })

  const [application] = await db.select().from(applications).where(eq(applications.code, APP_CODE))
  if (!application) throw new Error("Nie udało się założyć/odczytać applications('content-guru')")

  await db
    .insert(applicationScopes)
    .values({ applicationId: application.id, code: SCOPE_CODE, name: "Zarządzanie szablonami" })
    .onConflictDoNothing({ target: [applicationScopes.applicationId, applicationScopes.code] })

  const [scope] = await db
    .select()
    .from(applicationScopes)
    .where(eq(applicationScopes.applicationId, application.id))
  if (!scope) throw new Error("Nie udało się założyć/odczytać scope'u manage-templates")

  return { applicationId: application.id, scopeId: scope.id }
}

function makeContentGuruRequest(email: string): Request {
  return new Request("http://localhost/api/content-guru/templates", {
    headers: { "x-auth-request-email": email },
  })
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

  // Round B — D6: szablony są zasobem WSPÓLNYM (brak userEmail), stąd testy
  // dowodzą CRUD + unikalności kategoria+nazwa, nie izolacji per-user.
  describe("templates", () => {
    it("createTemplate + listTemplates + getTemplate: zapisuje i czyta z powrotem", async () => {
      const created = await createTemplate(
        { name: "Post rekrutacyjny", category: TEMPLATE_CATEGORY, content: "Treść promptu" },
        OWNER_EMAIL,
      )
      expect(created.createdBy).toBe(OWNER_EMAIL)

      const all = await listTemplates()
      expect(all.some((row) => row.id === created.id)).toBe(true)

      const fetched = await getTemplate(created.id)
      expect(fetched?.name).toBe("Post rekrutacyjny")
    })

    it("updateTemplate zmienia treść, deleteTemplate faktycznie usuwa wiersz", async () => {
      const created = await createTemplate(
        { name: "Do edycji", category: TEMPLATE_CATEGORY, content: "Stara treść" },
        OWNER_EMAIL,
      )

      const updated = await updateTemplate(created.id, {
        name: "Do edycji",
        category: TEMPLATE_CATEGORY,
        content: "Nowa treść",
      })
      expect(updated?.content).toBe("Nowa treść")

      const deleted = await deleteTemplate(created.id)
      expect(deleted).toBe(true)
      expect(await getTemplate(created.id)).toBeUndefined()
    })

    it("duplicateTemplate kopiuje treść pod nazwą '(kopia)'", async () => {
      const source = await createTemplate(
        { name: "Oryginał", category: TEMPLATE_CATEGORY, content: "Treść oryginału" },
        OWNER_EMAIL,
      )

      const copy = await duplicateTemplate(source.id, FOREIGN_OWNER_EMAIL)
      expect(copy?.name).toBe("Oryginał (kopia)")
      expect(copy?.content).toBe("Treść oryginału")
      expect(copy?.createdBy).toBe(FOREIGN_OWNER_EMAIL)
      expect(copy?.id).not.toBe(source.id)
    })

    it("unikalność category+name: druga insercja tej samej pary rzuca (23505), pierwsza zostaje nietknięta", async () => {
      await createTemplate(
        { name: "Unikalny", category: TEMPLATE_CATEGORY, content: "A" },
        OWNER_EMAIL,
      )

      await expect(
        createTemplate({ name: "Unikalny", category: TEMPLATE_CATEGORY, content: "B" }, OWNER_EMAIL),
      ).rejects.toMatchObject({ code: "23505" })
    })

    it("updateTemplate/deleteTemplate zwracają undefined/false dla nieistniejącego id", async () => {
      const missingId = "00000000-0000-0000-0000-000000000000"
      expect(
        await updateTemplate(missingId, { name: "x", category: TEMPLATE_CATEGORY, content: "x" }),
      ).toBeUndefined()
      expect(await deleteTemplate(missingId)).toBe(false)
    })
  })

  describe("client_profiles", () => {
    // Wszystkie wejścia lecą przez clientProfileInputSchema.parse() — dokładnie
    // jak POST/PUT route'y (parsed.data -> createClientProfile()/
    // updateMyClientProfile()). Funkcja serwisowa sama NIE re-waliduje/nie
    // domyśla brakujących pól (code-service nie duplikuje warstwy Zod), więc
    // wywołanie jej z surowym literałem obchodziłoby dokładnie tę normalizację,
    // którą te testy mają dowieść.
    it("createClientProfile + listMyClientProfiles zwraca WYŁĄCZNIE profile właściciela", async () => {
      await createClientProfile(
        OWNER_EMAIL,
        clientProfileInputSchema.parse({ profileName: "Acme", history: "Od 2010." }),
      )
      await createClientProfile(
        FOREIGN_OWNER_EMAIL,
        clientProfileInputSchema.parse({ profileName: "Cudzy profil" }),
      )

      const rows = await listMyClientProfiles(OWNER_EMAIL)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.profileName).toBe("Acme")
      expect(rows.some((row) => row.userEmail === FOREIGN_OWNER_EMAIL)).toBe(false)
    })

    it("getMyClientProfile zwraca undefined dla cudzego id (nigdy nie przecieka)", async () => {
      const foreign = await createClientProfile(
        FOREIGN_OWNER_EMAIL,
        clientProfileInputSchema.parse({ profileName: "Cudzy" }),
      )
      expect(await getMyClientProfile(OWNER_EMAIL, foreign.id)).toBeUndefined()
    })

    it("updateMyClientProfile zwraca undefined dla cudzego id, NIE zmienia cudzego wiersza", async () => {
      const foreign = await createClientProfile(
        FOREIGN_OWNER_EMAIL,
        clientProfileInputSchema.parse({ profileName: "Cudzy", description: "Oryginalny opis" }),
      )

      const result = await updateMyClientProfile(
        OWNER_EMAIL,
        foreign.id,
        clientProfileInputSchema.parse({ profileName: "Cudzy", description: "Przejęty opis" }),
      )
      expect(result).toBeUndefined()

      const stillForeign = await getMyClientProfile(FOREIGN_OWNER_EMAIL, foreign.id)
      expect(stillForeign?.description).toBe("Oryginalny opis")
    })

    it("deleteMyClientProfile zwraca false dla cudzego id, nie usuwa go", async () => {
      const foreign = await createClientProfile(
        FOREIGN_OWNER_EMAIL,
        clientProfileInputSchema.parse({ profileName: "Cudzy" }),
      )

      expect(await deleteMyClientProfile(OWNER_EMAIL, foreign.id)).toBe(false)
      expect(await getMyClientProfile(FOREIGN_OWNER_EMAIL, foreign.id)).toBeDefined()
    })

    it("pole tekstowe puste ('') po przejściu przez clientProfileInputSchema (jak w route) zapisuje się jako null", async () => {
      // Normalizacja pusty-string->null żyje w Zod schemacie (code-api), nie
      // w samej funkcji serwisowej (code-service nie re-waliduje) — ten test
      // dowodzi całości ścieżki: schema.parse() -> createClientProfile() ->
      // realny wiersz w Postgresie, dokładnie jak POST /client-profiles.
      const parsed = clientProfileInputSchema.parse({ profileName: "Puste pola", offer: "" })
      const created = await createClientProfile(OWNER_EMAIL, parsed)
      expect(created.offer).toBeNull()
    })
  })

  describe("market_profiles", () => {
    // Wszystkie wejścia lecą przez marketProfileInputSchema.parse() — patrz
    // uzasadnienie w opisie describe("client_profiles") wyżej.
    it("createMarketProfile + listMyMarketProfiles zwraca WYŁĄCZNIE profile właściciela", async () => {
      await createMarketProfile(
        OWNER_EMAIL,
        marketProfileInputSchema.parse({ profileName: "Rynek IT", sizeTrends: "Rośnie." }),
      )
      await createMarketProfile(
        FOREIGN_OWNER_EMAIL,
        marketProfileInputSchema.parse({ profileName: "Cudzy rynek" }),
      )

      const rows = await listMyMarketProfiles(OWNER_EMAIL)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.profileName).toBe("Rynek IT")
      expect(rows.some((row) => row.userEmail === FOREIGN_OWNER_EMAIL)).toBe(false)
    })

    it("getMyMarketProfile zwraca undefined dla cudzego id", async () => {
      const foreign = await createMarketProfile(
        FOREIGN_OWNER_EMAIL,
        marketProfileInputSchema.parse({ profileName: "Cudzy" }),
      )
      expect(await getMyMarketProfile(OWNER_EMAIL, foreign.id)).toBeUndefined()
    })

    it("updateMyMarketProfile/deleteMyMarketProfile nie dotykają cudzego wiersza", async () => {
      const foreign = await createMarketProfile(
        FOREIGN_OWNER_EMAIL,
        marketProfileInputSchema.parse({ profileName: "Cudzy", needs: "Oryginalne potrzeby" }),
      )

      const updateResult = await updateMyMarketProfile(
        OWNER_EMAIL,
        foreign.id,
        marketProfileInputSchema.parse({ profileName: "Cudzy", needs: "Przejęte potrzeby" }),
      )
      expect(updateResult).toBeUndefined()

      const deleteResult = await deleteMyMarketProfile(OWNER_EMAIL, foreign.id)
      expect(deleteResult).toBe(false)

      const stillForeign = await getMyMarketProfile(FOREIGN_OWNER_EMAIL, foreign.id)
      expect(stillForeign?.needs).toBe("Oryginalne potrzeby")
    })
  })

  // Round B, D6/D9 — dowód na PRAWDZIWYM Postgresie (nie mockowanym
  // rbac-store jak w app/idp/app/api/content-guru/guard-coverage.test.ts),
  // że `manage-templates` genuinely gates mutation dla dokładnie tej pary
  // kodów, której używa app/idp/app/api/content-guru/_lib/guard.ts
  // (CONTENT_GURU_APP_CODE="content-guru", CONTENT_GURU_MANAGE_TEMPLATES_
  // SCOPE="manage-templates"). requireTileScope() sam w sobie jest już
  // dowiedziony generycznie w rbac-scope.integration.test.ts — to tutaj
  // dowodzi KONKRETNIE naszego wiązania, nie tylko generycznego mechanizmu.
  describe("manage-templates scope (real Postgres) — genuinely gates mutation", () => {
    it("user z dostępem do kafelka, BEZ grantu scope'u -> requireTileScope odmawia", async () => {
      const { applicationId } = await ensureContentGuruScopeBaseline()
      const db = getDb()

      const [user] = await db.insert(users).values({ email: SCOPE_TESTER_EMAIL }).returning()
      const [role] = await db
        .insert(roles)
        .values({ code: SCOPE_ROLE_CODE, name: "Rola testowa Content Guru" })
        .returning()
      await db.insert(userRoles).values({ userId: user!.id, roleId: role!.id })
      // Grant do KAFELKA, celowo BEZ role_application_scopes.
      await db.insert(permissionsMatrix).values({ roleId: role!.id, applicationId })

      clearTileAccessCache()
      const access = await requireTileAccess(makeContentGuruRequest(SCOPE_TESTER_EMAIL), APP_CODE)
      expect(access.allowed).toBe(true)

      const scoped = await requireTileScope(
        makeContentGuruRequest(SCOPE_TESTER_EMAIL),
        APP_CODE,
        SCOPE_CODE,
      )
      expect(scoped.allowed).toBe(false)
    })

    it("user Z grantem scope'u -> requireTileScope przepuszcza", async () => {
      const { applicationId, scopeId } = await ensureContentGuruScopeBaseline()
      const db = getDb()

      const [user] = await db.insert(users).values({ email: SCOPE_TESTER_EMAIL }).returning()
      const [role] = await db
        .insert(roles)
        .values({ code: SCOPE_ROLE_CODE, name: "Rola testowa Content Guru" })
        .returning()
      await db.insert(userRoles).values({ userId: user!.id, roleId: role!.id })
      await db.insert(permissionsMatrix).values({ roleId: role!.id, applicationId })
      await db.insert(roleApplicationScopes).values({ roleId: role!.id, applicationScopeId: scopeId })

      clearTileAccessCache()
      const scoped = await requireTileScope(
        makeContentGuruRequest(SCOPE_TESTER_EMAIL),
        APP_CODE,
        SCOPE_CODE,
      )
      expect(scoped.allowed).toBe(true)
      expect(scoped.email).toBe(SCOPE_TESTER_EMAIL)
    })

    it("user bez ŻADNEGO dostępu -> obie warstwy odmawiają", async () => {
      await ensureContentGuruScopeBaseline()

      clearTileAccessCache()
      const access = await requireTileAccess(makeContentGuruRequest(SCOPE_TESTER_EMAIL), APP_CODE)
      expect(access.allowed).toBe(false)

      const scoped = await requireTileScope(
        makeContentGuruRequest(SCOPE_TESTER_EMAIL),
        APP_CODE,
        SCOPE_CODE,
      )
      expect(scoped.allowed).toBe(false)
    })
  })
})
