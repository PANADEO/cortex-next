// D4 (design doc) krok 1-4: upload -> INSERT queued -> forward do backendu
// -> 202 {jobId} SZYBKO. Ta route NIE czeka na cały pipeline Pythona (konwersja
// + render + wywołanie modelu wizyjnego, dziesiątki sekund) — tylko na
// backendowe przyjęcie pliku, które samo w sobie odpowiada natychmiast
// (services/document-parser/src/main.py `create_job`, asyncio.create_task
// fire-and-forget). Właściwy postęp widać dopiero przez polling
// GET /jobs/:id (route obok), zgodnie z architecture_rules.md §5.

import { createBackendJob, DocumentParserBackendError } from "@/lib/document-parser/backend-client"
import { validateDocumentFile } from "@/lib/document-parser/constraints"
import {
  createQueuedJob,
  getRequestEmail,
  listMyJobs,
  markJobError,
  markJobProcessing,
} from "@cortex/service"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { denyUnlessAllowed } from "../_lib/guard"

export const runtime = "nodejs"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  // denyUnlessAllowed już potwierdziło, że nagłówek niesie znany, uprawniony
  // e-mail — tu tylko go odczytujemy (bez drugiego zapytania do RBAC/cache).
  const email = getRequestEmail(request.headers)
  if (!email) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  return NextResponse.json(await listMyJobs(email))
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const email = getRequestEmail(request.headers)
  if (!email) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json(
      { error: "invalid-request", message: "Nieprawidłowe żądanie." },
      { status: 400 },
    )
  }

  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "invalid-request", message: "Brak pliku w żądaniu." },
      { status: 400 },
    )
  }

  // Walidacja typu/rozmiaru NIGDY nie ufa wyłącznie klientowi (klient
  // waliduje to samo przed submitem, D1, ale to jest tylko UX — jedyne
  // źródło prawdy jest tu, po stronie serwera, patrz constraints.ts).
  const validation = validateDocumentFile({ name: file.name, size: file.size })
  if (!validation.ok) {
    const status = validation.error === "file-too-large" ? 413 : 400
    return NextResponse.json({ error: validation.error, message: validation.message }, { status })
  }

  // D4 krok 2: wiersz istnieje PRZED wywołaniem backendu — dispatch, który
  // się nie powiedzie, ma gdzie wylądować jako błąd (niżej), zamiast zniknąć
  // bez śladu z historii użytkownika.
  const id = crypto.randomUUID()
  await createQueuedJob(email, {
    id,
    fileName: file.name,
    fileSizeBytes: file.size,
    mimeType: file.type || "application/octet-stream",
  })

  try {
    const backendJob = await createBackendJob(file, email)
    await markJobProcessing(email, id, backendJob.jobId)
  } catch (error) {
    const message =
      error instanceof DocumentParserBackendError
        ? error.message
        : "Nie udało się połączyć z usługą przetwarzania dokumentów."
    console.error("[document-parser] błąd wysyłki zadania do backendu:", error)
    await markJobError(email, id, {
      errorMessage: "Nie udało się przekazać dokumentu do usługi przetwarzania. Spróbuj ponownie.",
      errorCode: "conversion-failed",
    })
    return NextResponse.json({ error: "upstream-error", message }, { status: 502 })
  }

  // 202: przyjęte, przetwarzanie w toku — przeglądarka odpytuje dalej stan
  // przez GET /jobs/:id (TanStack Query refetchInterval, D4 krok 5-6).
  return NextResponse.json({ jobId: id, status: "processing" }, { status: 202 })
}
