"use client"

import { apiClient } from "@cortex/api"
import type { OpenwebuiFullSyncResult, OpenwebuiPlanEntry } from "@cortex/service"
import { Alert, AlertDescription, AlertTitle, Button } from "@cortex/ui"
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react"
import { useState } from "react"

/**
 * „Synchronizuj wszystko" — doprowadza OpenWebUI do stanu Konfiguracji Systemu.
 *
 * DWA KROKI, NIE JEDEN. Podgląd liczy różnicę i niczego nie zapisuje; zapis
 * jest osobnym kliknięciem po obejrzeniu listy. Powód nie jest kosmetyczny:
 * pierwsze uruchomienie na instancji liczy różnicę wobec stanu, którego nikt
 * nigdy nie uzgadniał, więc każda niepełność danych w Cortexie trafiłaby do
 * OpenWebUI hurtem — z odcięciem ludzi włącznie. Admin ma zobaczyć KOGO to
 * dotyczy, zanim to się stanie.
 */
const ACTION_LABEL: Record<OpenwebuiPlanEntry["action"], string> = {
  create: "Załóż konto",
  "promote-admin": "Nadaj admina",
  "demote-user": "Odbierz admina",
  revoke: "Odetnij dostęp",
  "orphan-revoke": "Odetnij (spoza Cortexa)",
}

export default function OpenwebuiSyncPage() {
  const [result, setResult] = useState<OpenwebuiFullSyncResult | null>(null)
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(apply: boolean) {
    setBusy(apply ? "apply" : "preview")
    setError(null)
    try {
      const data = apply
        ? await apiClient.post<OpenwebuiFullSyncResult>("/api/system-config/openwebui/sync", {
            jsonBody: { apply: true },
          })
        : await apiClient.get<OpenwebuiFullSyncResult>("/api/system-config/openwebui/sync")
      setResult(data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się połączyć z OpenWebUI")
    } finally {
      setBusy(null)
    }
  }

  const plan = result?.plan ?? []
  const notConfigured = result?.status === "skipped"

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Synchronizacja OpenWebUI</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Doprowadza konta i grupy w OpenWebUI do stanu z Konfiguracji Systemu. Podgląd niczego nie
          zapisuje — zmiany wykonuje dopiero przycisk obok.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => run(false)} disabled={busy !== null} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          {busy === "preview" ? "Liczę różnice…" : "Pokaż różnice"}
        </Button>
        <Button onClick={() => run(true)} disabled={busy !== null || plan.length === 0}>
          {busy === "apply" ? "Synchronizuję…" : `Zastosuj (${plan.length})`}
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Błąd</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {notConfigured ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>OpenWebUI nie jest skonfigurowane</AlertTitle>
          <AlertDescription>{result?.message}</AlertDescription>
        </Alert>
      ) : null}

      {result && !notConfigured && plan.length === 0 ? (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Brak różnic</AlertTitle>
          <AlertDescription>OpenWebUI odzwierciedla stan Konfiguracji Systemu.</AlertDescription>
        </Alert>
      ) : null}

      {plan.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Użytkownik</th>
                <th className="px-4 py-2 font-medium">Operacja</th>
                <th className="px-4 py-2 font-medium">Zmiana</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((entry) => (
                <tr key={`${entry.email}-${entry.action}`} className="border-t border-border">
                  <td className="px-4 py-2">{entry.email}</td>
                  <td className="px-4 py-2">{ACTION_LABEL[entry.action]}</td>
                  <td className="px-4 py-2 text-muted-foreground">{entry.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {result && !result.dryRun ? (
        <Alert variant={result.failures.length > 0 ? "destructive" : "default"}>
          {result.failures.length > 0 ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          <AlertTitle>Wykonano {result.applied} z {result.plan.length}</AlertTitle>
          <AlertDescription>
            Grupy: {result.groups.status}
            {result.failures.length > 0 ? (
              <ul className="mt-2 list-disc pl-5">
                {result.failures.map((failure) => (
                  <li key={failure}>{failure}</li>
                ))}
              </ul>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
