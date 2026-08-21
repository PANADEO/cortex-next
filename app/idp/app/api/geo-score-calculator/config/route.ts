// GET/PUT /api/geo-score-calculator/config — odczyt i aktualizacja
// WSPÓLNEJ, instancyjnej konfiguracji (design doc §4.4). RBAC: jeden poziom
// dostępu (D5, §7 pkt 3) — `requireTileAccess()` do samego kafelka
// wystarcza, bez osobnego scope'u "manage-settings"; `denyUnlessAllowed()`
// z ../_lib/guard.ts to dokładnie ta bramka.
//
// Walidacja sumy wag = 100% żyje TU, w Zod (`.superRefine()`) — dokładnie
// tak samo jak w schemacie klienta
// (features/geo-score-calculator/config-schema.ts). To jest wymóg design
// docu §4.4 wprost: "Zod na route'ie też, nie tylko w UI" — klient blokuje
// submit wcześniej, ale serwer nigdy nie ufa klientowi na słowo.

import {
  GeoScoreConfigMissingError,
  getGeoScoreConfig,
  getRequestEmail,
  updateGeoScoreConfig,
} from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"
import { toGeoScoreConfigDto } from "../_lib/config-dto"
import { denyUnlessAllowed } from "../_lib/guard"

export const runtime = "nodejs"

// Tolerancja zmiennoprzecinkowa dla sumy wag — te same wartości co dziś w
// bazie (0.30/0.25/0.20/0.25) nie sumują się idealnie do 1 w IEEE754.
const WEIGHT_SUM_TOLERANCE = 0.001

const trimmedNonEmpty = (message: string) => z.string().trim().min(1, message)

const dedupedWordList = (message: string) =>
  z
    .array(trimmedNonEmpty(message))
    .min(1, "Lista musi zawierać co najmniej jeden element")
    .transform((values) => Array.from(new Set(values)))

const weightSchema = z.number().min(0).max(1)
const benchmarkSchema = z.number().min(0)
const gradeThresholdSchema = z.number().int().min(0).max(100)

const configSchema = z
  .object({
    weightStatistics: weightSchema,
    weightActionVerbs: weightSchema,
    weightStructure: weightSchema,
    weightObjectivity: weightSchema,
    benchmarkStats: benchmarkSchema,
    benchmarkVerbs: benchmarkSchema,
    benchmarkStructure: benchmarkSchema,
    benchmarkObjectivity: benchmarkSchema,
    gradeAMin: gradeThresholdSchema,
    gradeBMin: gradeThresholdSchema,
    gradeCMin: gradeThresholdSchema,
    gradeDMin: gradeThresholdSchema,
    actionVerbs: dedupedWordList("Czasownik akcji nie może być pusty"),
    subjectiveWords: dedupedWordList("Słowo subiektywne nie może być puste"),
    falsePositives: z
      .array(trimmedNonEmpty("Wyjątek nie może być pusty"))
      .transform((values) => Array.from(new Set(values))),
    bulletPatterns: z.array(trimmedNonEmpty("Wzorzec regex nie może być pusty")),
  })
  .superRefine((data, ctx) => {
    const sum =
      data.weightStatistics + data.weightActionVerbs + data.weightStructure + data.weightObjectivity
    if (Math.abs(sum - 1) > WEIGHT_SUM_TOLERANCE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["weightStatistics"],
        message: `Suma wag musi wynosić 100% (obecnie ${Math.round(sum * 100)}%)`,
      })
    }
    for (const pattern of data.bulletPatterns) {
      try {
        new RegExp(pattern)
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bulletPatterns"],
          message: `Nieprawidłowy wzorzec regex: ${pattern}`,
        })
      }
    }
  })

export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  try {
    const row = await getGeoScoreConfig()
    return NextResponse.json(toGeoScoreConfigDto(row))
  } catch (error) {
    if (error instanceof GeoScoreConfigMissingError) {
      console.error("[geo-score-calculator] config-missing:", error)
      return NextResponse.json({ error: "config-missing" }, { status: 500 })
    }
    throw error
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const email = getRequestEmail(request.headers)
  if (!email) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const parsed = configSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-request", message: parsed.error.issues[0]?.message },
      { status: 400 },
    )
  }

  try {
    const updated = await updateGeoScoreConfig(email, parsed.data)
    return NextResponse.json(toGeoScoreConfigDto(updated))
  } catch (error) {
    if (error instanceof GeoScoreConfigMissingError) {
      console.error("[geo-score-calculator] config-missing:", error)
      return NextResponse.json({ error: "config-missing" }, { status: 500 })
    }
    throw error
  }
}
