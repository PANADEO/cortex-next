"use client"

import type { CoworkAgentsInstructions } from "@cortex/types"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  LoadingState,
  Textarea,
} from "@cortex/ui"
import { Check, Loader2 } from "lucide-react"
import { useState } from "react"
import { useCatalog, useGovernanceConfig, useUpdateGovernance } from "../hooks/use-governance"
import { AccessDeniedState } from "./config-screen"

// Admin editor for the hierarchical AGENTS.md: the organization-wide layer
// plus one layer per department path. A tile pinned to "a/b" inherits the
// organization layer, then "a", then "a/b" - its own systemPrompt and the
// user's personal note come after (edited elsewhere).

/** Data-loading host: resolves governance + departments before the form mounts. */
export function AgentsPanel() {
  const governance = useGovernanceConfig()
  const catalog = useCatalog()

  if (governance.isPending || catalog.isPending) {
    return <LoadingState label="Wczytywanie konfiguracji..." />
  }
  if (governance.isError || catalog.isError || !catalog.data) return <AccessDeniedState />

  return (
    <AgentsForm
      initial={governance.data.agentsInstructions ?? { departments: {} }}
      departments={catalog.data.departments}
    />
  )
}

function AgentsForm({
  initial,
  departments,
}: {
  initial: CoworkAgentsInstructions
  departments: string[]
}) {
  const update = useUpdateGovernance()
  const [global, setGlobal] = useState(initial.global ?? "")
  const [byDepartment, setByDepartment] = useState<Record<string, string>>(
    initial.departments,
  )
  const [saved, setSaved] = useState(false)

  const sortedDepartments = [...departments].sort()

  async function save() {
    try {
      await update.mutateAsync({ agentsInstructions: { global, departments: byDepartment } })
    } catch {
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Zasady organizacji</CardTitle>
          <CardDescription>
            Warstwa globalna - trafia do każdego agenta na platformie, przed warstwami działów.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={6}
            value={global}
            onChange={(event) => setGlobal(event.target.value)}
            placeholder={
              "np. Odpowiadaj po polsku. Nie udostępniaj danych osobowych.\nArtefakty nazywaj wg konwencji RRRRMMDD_nazwa."
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Zasady działów</CardTitle>
          <CardDescription>
            Kafelek przypięty do departamentu dziedziczy warstwy po ścieżce: np.
            &quot;finanse/kontroling&quot; dostaje zasady &quot;finanse&quot;, potem
            &quot;finanse/kontroling&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sortedDepartments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Brak departamentów - dodaj je w Katalogu zasobów.
            </p>
          ) : (
            sortedDepartments.map((department) => (
              <div key={department}>
                <Label htmlFor={`agents-${department}`} className="font-mono text-xs">
                  {department}
                </Label>
                <Textarea
                  id={`agents-${department}`}
                  className="mt-1"
                  rows={3}
                  value={byDepartment[department] ?? ""}
                  onChange={(event) =>
                    setByDepartment((current) => ({
                      ...current,
                      [department]: event.target.value,
                    }))
                  }
                  placeholder={`Zasady dziedziczone przez kafelki działu ${department}...`}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={update.isPending} className="gap-1.5">
          {update.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : null}
          {saved ? "Zapisano" : "Zapisz AGENTS.md"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Kolejność składania: organizacja → działy (po ścieżce) → instrukcje kafelka → notka
          użytkownika.
        </p>
      </div>
    </div>
  )
}
