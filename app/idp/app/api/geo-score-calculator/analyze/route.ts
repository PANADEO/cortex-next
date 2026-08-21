// Kontroler HTTP (code-api) — cienki: auth -> walidacja -> config z Postgresa
// -> adapter mikroserwisu -> zapis historii -> odpowiedź. Zero logiki
// biznesowej tutaj (mapowanie configu na kontrakt Pythona żyje w tym pliku
// tylko dlatego, że to czyste przepisanie pól, nie reguła domenowa).
//
// Kolejność auth PRZED parsowaniem ciała — wzorem
// app/api/ilustromat/generate/route.ts (denyUnlessAllowed()), nie skrótu ze
// szkieletu w code-api/SKILL.md (tam parse->auth, ale realny kod w tym repo
// robi odwrotnie, i to jest wersja zgodna z regułą "Auth zawsze pierwsza —
// przed jakąkolwiek pracą").

import {
  GeoScoreServiceError,
  analyzeGeoScore,
  type AnalyzeGeoScoreResponse,
} from "@/lib/geo-score-calculator/integration-client"
import { TEXT_MAX_CHARS } from "@/lib/geo-score-calculator/limits"
import {
  GEO_SCORE_CALCULATOR_APP_CODE,
  GeoScoreConfigMissingError,
  getGeoScoreConfig,
  requireTileAccess,
  saveGeoScoreCalculation,
} from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { z } from "zod"

export const runtime = "nodejs"

const requestSchema = z.object({
  text: z
    .string()
    .max(TEXT_MAX_CHARS, `Tekst nie może przekraczać ${TEXT_MAX_CHARS} znaków`)
    .refine((value) => value.trim().length > 0, "Tekst nie może być pusty"),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const access = await requireTileAccess(request, GEO_SCORE_CALCULATOR_APP_CODE)
  if (!access.allowed || !access.email) {
    return NextResponse.json(
      { error: access.email ? "forbidden" : "missing-email" },
      { status: access.email ? 403 : 401 },
    )
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid-request", message: parsed.error.issues[0]?.message },
      { status: 400 },
    )
  }

  let config: Awaited<ReturnType<typeof getGeoScoreConfig>>
  try {
    config = await getGeoScoreConfig()
  } catch (error) {
    if (error instanceof GeoScoreConfigMissingError) {
      console.error("[geo-score-calculator] config-missing:", error)
      return NextResponse.json({ error: "config-missing" }, { status: 500 })
    }
    throw error
  }

  let analysis: AnalyzeGeoScoreResponse
  try {
    analysis = await analyzeGeoScore({
      text: parsed.data.text,
      weights: {
        statistics: config.weightStatistics,
        actionVerbs: config.weightActionVerbs,
        structure: config.weightStructure,
        objectivity: config.weightObjectivity,
      },
      benchmarks: {
        statsPer100Words: config.benchmarkStats,
        actionVerbRatio: config.benchmarkVerbs,
        bulletsPer500Words: config.benchmarkStructure,
        maxSubjectiveRatio: config.benchmarkObjectivity,
      },
      grades: {
        aMin: config.gradeAMin,
        bMin: config.gradeBMin,
        cMin: config.gradeCMin,
        dMin: config.gradeDMin,
      },
      actionVerbs: config.actionVerbs,
      subjectiveWords: config.subjectiveWords,
      falsePositives: config.falsePositives,
      bulletPatterns: config.bulletPatterns,
    })
  } catch (error) {
    if (error instanceof GeoScoreServiceError) {
      console.error("[geo-score-calculator] błąd mikroserwisu:", error)
      return NextResponse.json({ error: "upstream-error", message: error.message }, { status: 502 })
    }
    throw error
  }

  // Historia jest efektem ubocznym udanej analizy, dokładnie jak w
  // ai-tools/generate: wynik jest już policzony (mikroserwis "opłacony"),
  // więc awaria zapisu (Postgres chwilowo nieosiągalny) nie może skasować
  // odpowiedzi, którą użytkownik już dostał na ekranie.
  try {
    await saveGeoScoreCalculation(access.email, {
      textContent: parsed.data.text,
      wordCount: analysis.wordCount,
      totalScore: analysis.totalScore,
      grade: analysis.grade,
      statsScore: analysis.statistics.score,
      verbsScore: analysis.actionVerbs.score,
      structureScore: analysis.structure.score,
      objectivityScore: analysis.objectivity.score,
      result: analysis,
      configSnapshot: config,
    })
  } catch (error) {
    console.error("[geo-score-calculator] zapis do historii nie powiódł się:", error)
  }

  return NextResponse.json(analysis)
}
