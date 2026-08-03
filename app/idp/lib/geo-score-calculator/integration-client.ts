// Adapter do mikroserwisu Python geo-score-calculator (code-integration) —
// jedyne miejsce, z którego wolno wołać ten serwis. Woła się WYŁĄCZNIE
// server-side (Faza 1: wewnątrz route handlera pod
// app/api/geo-score-calculator/analyze/route.ts, jeszcze nie zbudowanego w
// tej fazie) — mikroserwis nigdy nie jest bezpośrednio adresowalny z
// przeglądarki (brak `ports:` w docker-compose.yml, patrz
// code-python-service/SKILL.md "Bezpieczeństwo").
//
// Kontrakt 1:1 z PROJECT/cortex-frontend-geo-score-calculator-port-projekt.md
// §3 i services/geo-score-calculator/models.py — pola celowo camelCase po
// obu stronach (to JEST kontrakt JSON między dwoma runtime'ami, nie
// wewnętrzne API TS, wzorem models.py po stronie Pythona).

import { geoScoreCalculatorConfig } from "./config"

// Mikroserwis jest w pełni deterministyczny (regex + spaCy, zero wywołań
// zewnętrznych) i wołany na tej samej sieci Docker — rząd wielkości sekund,
// nie dziesiątek sekund jak generacja obrazu (IMAGE_TIMEOUT_MS w Ilustromacie)
// czy LLM (REQUEST_TIMEOUT_MS w cortex-proxy-client.ts). 30s to hojny margines
// bezpieczeństwa, nie oczekiwany czas odpowiedzi.
const REQUEST_TIMEOUT_MS = 30_000

export interface GeoScoreWeights {
  statistics: number
  actionVerbs: number
  structure: number
  objectivity: number
}

export interface GeoScoreBenchmarks {
  statsPer100Words: number
  actionVerbRatio: number
  bulletsPer500Words: number
  maxSubjectiveRatio: number
}

export interface GeoScoreGrades {
  aMin: number
  bMin: number
  cMin: number
  dMin: number
}

/** Migawka pełnej konfiguracji (D3 — mikroserwis jest bezstanowy, nigdy nie
 *  czyta/cache'uje configu sam). Next.js jest jedynym właścicielem configu w
 *  Postgresie (Faza 1+); ten typ jest kontraktem HTTP, nie modelem bazy. */
export interface AnalyzeGeoScoreRequest {
  text: string
  weights: GeoScoreWeights
  benchmarks: GeoScoreBenchmarks
  grades: GeoScoreGrades
  actionVerbs: string[]
  subjectiveWords: string[]
  falsePositives: string[]
  bulletPatterns: string[]
}

/** Znaleziona fraza + jej offset znakowy w tekście źródłowym — do
 *  podświetlania inline w kalkulatorze (Faza 1). */
export interface PositionedMatch {
  value: string
  position: number
}

export interface AnalyzeGeoScoreResponse {
  totalScore: number
  grade: "A" | "B" | "C" | "D" | "F"
  wordCount: number
  statistics: {
    score: number
    count: number
    per100Words: number
    examples: PositionedMatch[]
  }
  actionVerbs: {
    score: number
    actionVerbCount: number
    totalVerbCount: number
    ratio: number
    foundVerbs: string[]
    method: "spacy" | "heuristic"
  }
  structure: {
    score: number
    bulletCount: number
    per500Words: number
    hasHeaders: boolean
    paragraphCount: number
  }
  objectivity: {
    score: number
    subjectiveCount: number
    subjectiveRatio: number
    foundWords: PositionedMatch[]
  }
  recommendations: string[]
}

/** Jeden typ błędu dla każdą przyczynę (timeout, sieć, status != 2xx) — kontroler
 *  (Faza 1, jeszcze nie zbudowany) łapie go i mapuje na 502, nigdy nie
 *  zakłada, że mikroserwis jest zawsze dostępny (code-integration reguła). */
export class GeoScoreServiceError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = "GeoScoreServiceError"
  }
}

export async function analyzeGeoScore(
  request: AnalyzeGeoScoreRequest,
): Promise<AnalyzeGeoScoreResponse> {
  const { serviceUrl } = geoScoreCalculatorConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${serviceUrl.replace(/\/$/, "")}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
      cache: "no-store",
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new GeoScoreServiceError(text || `geo-score-calculator zwrócił ${response.status}`)
    }

    return (await response.json()) as AnalyzeGeoScoreResponse
  } catch (error) {
    if (error instanceof GeoScoreServiceError) throw error
    throw new GeoScoreServiceError("Błąd komunikacji z geo-score-calculator", error)
  } finally {
    clearTimeout(timeout)
  }
}
