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
import { useTranslation } from "react-i18next"
import { useCatalog, useGovernanceConfig, useUpdateGovernance } from "../hooks/use-governance"
import { AccessDeniedState } from "./config-screen"

// Admin editor for the hierarchical AGENTS.md: the organization-wide layer
// plus one layer per department path. A tile pinned to "a/b" inherits the
// organization layer, then "a", then "a/b" - its own systemPrompt and the
// user's personal note come after (edited elsewhere).

/** Data-loading host: resolves governance + departments before the form mounts. */
export function AgentsPanel() {
  const { t } = useTranslation("cortex-config")
  const governance = useGovernanceConfig()
  const catalog = useCatalog()

  if (governance.isPending || catalog.isPending) {
    return <LoadingState label={t("state.loadingConfig")} />
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
  const { t } = useTranslation("cortex-config")
  const update = useUpdateGovernance()
  const [global, setGlobal] = useState(initial.global ?? "")
  const [byDepartment, setByDepartment] = useState<Record<string, string>>(initial.departments)
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
          <CardTitle className="text-base">{t("agents.orgTitle")}</CardTitle>
          <CardDescription>{t("agents.orgDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={6}
            value={global}
            onChange={(event) => setGlobal(event.target.value)}
            placeholder={t("agents.orgPlaceholder")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("agents.deptTitle")}</CardTitle>
          <CardDescription>{t("agents.deptDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sortedDepartments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("agents.noDepartments")}</p>
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
                  placeholder={t("agents.deptPlaceholder", { department })}
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
          {saved ? t("agents.saved") : t("agents.save")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("agents.order")}</p>
      </div>
    </div>
  )
}
