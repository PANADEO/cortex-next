// Adapter do mikroserwisu Python document-parser (code-integration) —
// jedyne miejsce, z którego wolno wołać ten serwis. Woła się WYŁĄCZNIE
// server-side (app/api/document-parser/jobs/**) — backend nigdy nie jest
// bezpośrednio adresowalny z przeglądarki (D6: brak `ports:` w docker-
// compose.yml, osiągalny wyłącznie przez Docker DNS).
//
// Kontrakt 1:1 z services/document-parser/src/models.py (Pydantic) — pola
// tam są snake_case (to JEST kontrakt wire-format Pythona), mapowane tu na
// camelCase dla reszty TS-owej strony (wzorem geo-score-calculator/
// integration-client.ts, gdzie kontrakt jest już camelCase po obu stronach —
// tu inaczej, bo backend zwraca Pydantic JSON dosłownie, bez transformacji).

import { documentParserConfig } from "./config"

// D4 (design doc): POST /jobs ma być SZYBKIE — backend odpowiada natychmiast
// po przeczytaniu pliku i zaplanowaniu przetwarzania w tle (main.py:
// asyncio.create_task), NIE czeka na cały pipeline. Ten timeout pokrywa
// wyłącznie transfer samego multipart (do MAX_UPLOAD_MB) + odczyt przez
// backend, nie przetwarzanie — stąd znacznie krótszy niż np. IMAGE_TIMEOUT_MS
// w Ilustromacie (90s, tam faktycznie czeka się na wynik generacji).
const CREATE_JOB_TIMEOUT_MS = 30_000
// GET /jobs/:id to tani odczyt stanu w pamięci (jobs.py) — brak I/O poza
// samą odpowiedzią HTTP.
const GET_JOB_TIMEOUT_MS = 10_000

export type BackendJobStatus = "processing" | "done" | "error"

export interface BackendJobRecord {
  jobId: string
  status: BackendJobStatus
  fileName: string
  model: string | null
  markdown: string | null
  errorMessage: string | null
  pageCount: number
  imageCount: number
  truncated: boolean
  elapsedSeconds: number | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

/** Jeden typ błędu dla każdej przyczyny (timeout, sieć, status != 2xx) —
 *  kontroler łapie go i mapuje na 502, nigdy nie zakłada, że backend jest
 *  zawsze dostępny (code-integration regułą). */
export class DocumentParserBackendError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = "DocumentParserBackendError"
  }
}

interface WireJobRecord {
  job_id: string
  status: BackendJobStatus
  file_name: string
  model: string | null
  markdown: string | null
  error_message: string | null
  page_count: number
  image_count: number
  truncated: boolean
  elapsed_seconds: number | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

function fromWire(wire: WireJobRecord): BackendJobRecord {
  return {
    jobId: wire.job_id,
    status: wire.status,
    fileName: wire.file_name,
    model: wire.model,
    markdown: wire.markdown,
    errorMessage: wire.error_message,
    pageCount: wire.page_count,
    imageCount: wire.image_count,
    truncated: wire.truncated,
    elapsedSeconds: wire.elapsed_seconds,
    createdAt: wire.created_at,
    startedAt: wire.started_at,
    completedAt: wire.completed_at,
  }
}

/** D4 krok 2-3: przekazuje plik do backendu, dostaje z powrotem jego własny
 *  job_id natychmiast (backend nigdy nie zwraca "queued" — patrz models.py
 *  komentarz — zawsze "processing" od razu po przyjęciu). `userEmail` idzie
 *  jako pole formularza, żeby backend mógł je przekazać dalej do
 *  cortex-proxy jako X-User-ID (pipeline.py `_run_openai`). */
export async function createBackendJob(
  file: File,
  userEmail: string,
): Promise<{ jobId: string; status: BackendJobStatus }> {
  const { backendUrl } = documentParserConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), CREATE_JOB_TIMEOUT_MS)

  const form = new FormData()
  form.append("file", file)
  form.append("user_email", userEmail)

  try {
    const response = await fetch(`${backendUrl.replace(/\/$/, "")}/jobs`, {
      method: "POST",
      body: form,
      signal: controller.signal,
      cache: "no-store",
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new DocumentParserBackendError(
        text || `document-parser backend zwrócił ${response.status}`,
      )
    }

    const body = (await response.json()) as { job_id: string; status: BackendJobStatus }
    return { jobId: body.job_id, status: body.status }
  } catch (error) {
    if (error instanceof DocumentParserBackendError) throw error
    throw new DocumentParserBackendError("Błąd komunikacji z usługą Parser Dokumentów", error)
  } finally {
    clearTimeout(timeout)
  }
}

/** D4 krok 6: odpytywane przy KAŻDYM pollu GET /api/document-parser/jobs/:id
 *  dopóki status w Postgresie to queued/processing. `null` = backend nie zna
 *  już tego zadania (TTL eviction po jobs.py DEFAULT_TTL_SECONDS, albo
 *  restart kontenera — D4 zaakceptowany kompromis MVP) — odróżnione od
 *  DocumentParserBackendError (błąd sieci/timeout/5xx), żeby wołający mógł
 *  potraktować je inaczej (trwała utrata stanu vs przejściowy błąd). */
export async function getBackendJob(backendJobId: string): Promise<BackendJobRecord | null> {
  const { backendUrl } = documentParserConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GET_JOB_TIMEOUT_MS)

  try {
    const response = await fetch(
      `${backendUrl.replace(/\/$/, "")}/jobs/${encodeURIComponent(backendJobId)}`,
      { signal: controller.signal, cache: "no-store" },
    )

    if (response.status === 404) return null

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new DocumentParserBackendError(
        text || `document-parser backend zwrócił ${response.status}`,
      )
    }

    return fromWire((await response.json()) as WireJobRecord)
  } catch (error) {
    if (error instanceof DocumentParserBackendError) throw error
    throw new DocumentParserBackendError("Błąd komunikacji z usługą Parser Dokumentów", error)
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Backend zwraca wyłącznie wolny tekst (`error_message`, wyjątki domenowe
 * services/document-parser/src/exceptions.py nie przechodzą przez wire) —
 * mapowanie na rozróżnialne `JobErrorCode` (D1: różne komunikaty per
 * przyczyna, nie jeden ogólny "processing failed") jest więc heurystyką po
 * treści, zamierzoną i udokumentowaną tutaj, nie zgadywaniem ad-hoc w route.
 *
 * Źródła komunikatów (pipeline.py): DependencyError/ConversionError z etapu
 * konwersji/renderu -> "conversion-failed"; DependencyError o brakującym
 * kluczu/modelu ORAZ AIProcessingError z etapu wywołania modelu wizyjnego ->
 * "vision-call-failed" (obie dotyczą TEGO SAMEGO kroku pipeline'u — modelu
 * wizyjnego — więc dzielą kod błędu). "unsupported-format"/"file-too-large"
 * nigdy stąd nie wychodzą — te dwa są łapane wcześniej, po stronie
 * klienta/BFF (constraints.ts), zanim plik w ogóle trafi do backendu.
 * "page-limit-exceeded" jest dziś rezerwą na przyszłość: backend TRUNCATES
 * (job.truncated=true) zamiast odrzucać dokument z przekroczonym limitem
 * stron, więc ta gałąź obecnie nigdy się nie uruchamia — kolumna/literał są
 * gotowe, gdyby ta polityka się kiedyś zmieniła.
 */
export function mapBackendErrorToCode(message: string): "conversion-failed" | "vision-call-failed" {
  const lower = message.toLowerCase()
  const visionStepMarkers = [
    "openai request failed",
    "model returned an empty response",
    "cortex_proxy_api_key",
    "vision model resolved",
  ]
  if (visionStepMarkers.some((marker) => lower.includes(marker))) {
    return "vision-call-failed"
  }
  return "conversion-failed"
}
