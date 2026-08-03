// D4 krok 5-6: na KAŻDYM pollu, jeśli zadanie jest wciąż queued/processing,
// route odpytuje backend Python o aktualny stan i mirroruje zmianę do
// Postgresa PRZED odpowiedzią — Postgres jest jedynym trwałym źródłem
// prawdy, backend jest tylko efemerycznym "silnikiem obliczeniowym" (D2).

import type { JobRow } from "@cortex/db"
import { getMyJob, getRequestEmail, markJobDone, markJobError } from "@cortex/service"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import {
  DocumentParserBackendError,
  getBackendJob,
  mapBackendErrorToCode,
} from "@/lib/document-parser/backend-client"
import { denyUnlessAllowed } from "../../_lib/guard"

export const runtime = "nodejs"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Context): Promise<NextResponse> {
  const denied = await denyUnlessAllowed(request)
  if (denied) return denied

  const email = getRequestEmail(request.headers)
  if (!email) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const { id } = await context.params
  // undefined = "nie istnieje" ALBO "cudze" (code-service "Rekordy per-user"
  // pkt 2) — oba mapowane na 404, NIGDY 403 (403 zdradzałby, że rekord o tym
  // id w ogóle istnieje).
  const row = await getMyJob(email, id)
  if (!row) return NextResponse.json({ error: "not-found" }, { status: 404 })

  if (row.status !== "queued" && row.status !== "processing") {
    return NextResponse.json(row)
  }

  if (!row.backendJobId) {
    // Nie powinno się zdarzyć poza bardzo krótkim oknem tuż po INSERCIE
    // (POST /jobs jeszcze nie zdążył dostać odpowiedzi backendu) — dispatch,
    // który się nie powiódł, jest już oznaczany jako "error" w POST route.
    return NextResponse.json(row)
  }

  const synced = await syncFromBackend(email, row, row.backendJobId)
  return NextResponse.json(synced)
}

async function syncFromBackend(email: string, row: JobRow, backendJobId: string): Promise<JobRow> {
  try {
    const backendRecord = await getBackendJob(backendJobId)

    if (backendRecord === null) {
      // Backend nie zna już tego zadania — TTL eviction albo restart
      // kontenera w trakcie przetwarzania (D4, zaakceptowany kompromis MVP).
      const updated = await markJobError(email, row.id, {
        errorMessage: "Usługa przetwarzania utraciła stan zadania — spróbuj wgrać dokument ponownie.",
        errorCode: "conversion-failed",
      })
      return updated ?? row
    }

    if (backendRecord.status === "done") {
      const updated = await markJobDone(email, row.id, {
        markdown: backendRecord.markdown ?? "",
        model: backendRecord.model,
        pageCount: backendRecord.pageCount,
        imageCount: backendRecord.imageCount,
        truncated: backendRecord.truncated,
        elapsedSeconds: backendRecord.elapsedSeconds,
      })
      return updated ?? row
    }

    if (backendRecord.status === "error") {
      const message = backendRecord.errorMessage ?? "Przetwarzanie nie powiodło się."
      const updated = await markJobError(email, row.id, {
        errorMessage: message,
        errorCode: mapBackendErrorToCode(message),
        model: backendRecord.model,
        pageCount: backendRecord.pageCount,
        imageCount: backendRecord.imageCount,
        truncated: backendRecord.truncated,
        elapsedSeconds: backendRecord.elapsedSeconds,
      })
      return updated ?? row
    }

    // Wciąż "processing" po stronie backendu — nic do zmiany, Postgres już
    // ma ten stan (markJobProcessing w POST route).
    return row
  } catch (error) {
    // Błąd sieci/timeout do backendu jest PRZEJŚCIOWY — nie psujemy trwałego
    // stanu użytkownika za jeden nieudany poll. Kolejny poll spróbuje
    // ponownie; jeśli backend faktycznie już nie żyje, GET wciąż zwraca
    // ostatni znany, poprawny stan Postgresa zamiast fałszywego 500.
    if (error instanceof DocumentParserBackendError) {
      console.error("[document-parser] błąd pollingu backendu:", error)
      return row
    }
    throw error
  }
}
