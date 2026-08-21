"use client"

import { apiClient } from "@cortex/api"
import type { OpenwebuiFullSyncResult, OpenwebuiPlanEntry } from "@cortex/service"
import { Alert, AlertDescription, AlertTitle, Button } from "@cortex/ui"
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

/**
 * „Synchronizuj wszystko" — doprowadza OpenWebUI do stanu Konfiguracji Systemu.
 *
 * DWA KROKI, NIE JEDEN. Podgląd liczy różnicę i niczego nie zapisuje; zapis
 * jest osobnym kliknięciem po obejrzeniu listy. Powód nie jest kosmetyczny:
 * pierwsze uruchomienie na instancji liczy różnicę wobec stanu, którego nikt
 * nigdy nie uzgadniał, więc każda niepełność danych w Cortexie trafiłaby do
 * OpenWebUI hurtem — z odcięciem ludzi włącznie. Admin ma zobaczyć KOGO to
 * dotyczy, zanim to się stanie.
 *
 * Mapa niżej trzyma KLUCZE tłumaczeń, nie gotowe napisy: stoi poza
 * komponentem, więc nie ma tu `t`. `Record<...>` wymusza dopisanie klucza,
 * gdy serwis doda nową operację.
 */
const ACTION_LABEL_KEYS: Record<OpenwebuiPlanEntry["action"], string> = {
  "create-group": "openwebui.action.createGroup",
  create: "openwebui.action.create",
  "promote-admin": "openwebui.action.promoteAdmin",
  "demote-user": "openwebui.action.demoteUser",
  restore: "openwebui.action.restore",
  revoke: "openwebui.action.revoke",
  "orphan-revoke": "openwebui.action.orphanRevoke",
}

export default function OpenwebuiSyncPage() {
  const { t } = useTranslation("system-config")
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
      setError(caught instanceof Error ? caught.message : t("openwebui.connectFailed"))
    } finally {
      setBusy(null)
    }
  }

  const plan = result?.plan ?? []
  const notConfigured = result?.status === "skipped"

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">{t("openwebui.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("openwebui.description")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => run(false)} disabled={busy !== null} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          {busy === "preview" ? t("openwebui.previewBusy") : t("openwebui.preview")}
        </Button>
        <Button onClick={() => run(true)} disabled={busy !== null || plan.length === 0}>
          {busy === "apply"
            ? t("openwebui.applyBusy")
            : t("openwebui.apply", { count: plan.length })}
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t("openwebui.errorTitle")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {notConfigured ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t("openwebui.notConfiguredTitle")}</AlertTitle>
          <AlertDescription>{result?.message}</AlertDescription>
        </Alert>
      ) : null}

      {result && !notConfigured && plan.length === 0 ? (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>{t("openwebui.noDiffTitle")}</AlertTitle>
          <AlertDescription>{t("openwebui.noDiffBody")}</AlertDescription>
        </Alert>
      ) : null}

      {plan.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">{t("openwebui.columnSubject")}</th>
                <th className="px-4 py-2 font-medium">{t("openwebui.columnAction")}</th>
                <th className="px-4 py-2 font-medium">{t("openwebui.columnDetail")}</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((entry) => (
                <tr key={`${entry.email}-${entry.action}`} className="border-t border-border">
                  <td className="px-4 py-2">{entry.email}</td>
                  <td className="px-4 py-2">{t(ACTION_LABEL_KEYS[entry.action])}</td>
                  <td className="px-4 py-2 text-muted-foreground">{entry.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {result && !result.dryRun ? (
        <Alert
          variant={
            result.failures.length > 0 || result.groups.status === "failed"
              ? "destructive"
              : "default"
          }
        >
          {result.failures.length > 0 || result.groups.status === "failed" ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          <AlertTitle>
            {t("openwebui.appliedTitle", { applied: result.applied, total: result.plan.length })}
          </AlertTitle>
          <AlertDescription>
            {t("openwebui.groupsLabel")} {result.groups.status}
            {result.groups.message ? ` — ${result.groups.message}` : ""}
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
