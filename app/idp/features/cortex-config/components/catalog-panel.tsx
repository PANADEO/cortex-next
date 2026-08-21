"use client"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  LoadingState,
} from "@cortex/ui"
import { Folder, Pencil, Plug, Plus, Trash2, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import {
  useCatalog,
  useUpdateConnectors,
  useUpdateDepartments,
  useUpdateSkillSources,
} from "../hooks/use-governance"
import { AccessDeniedState } from "./config-screen"

// Catalog overview: departments edited inline (tiny entities), skill sources
// and connectors edited on dedicated screens under /cortex-config/catalog/*.

export function CatalogPanel() {
  const catalog = useCatalog()
  const updateDepartments = useUpdateDepartments()
  const updateSources = useUpdateSkillSources()
  const updateConnectors = useUpdateConnectors()
  const [deptInput, setDeptInput] = useState("")

  if (catalog.isPending) return <LoadingState label="Wczytywanie katalogu..." />
  if (catalog.isError || !catalog.data) {
    return <AccessDeniedState title="Brak dostępu do katalogu" />
  }

  const { departments, skills, skillSources, connectors } = catalog.data
  const skillCountByDept = (dept: string) => skills.filter((s) => s.department === dept).length

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Departamenty</CardTitle>
          <CardDescription>
            Drzewo organizacyjne - ścieżki jak finanse/kontroling. Zasoby (skille, konektory,
            sekrety) przypisuje się do departamentów, a projekty wybierają gałęzie.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {departments.map((dept) => (
              <Badge key={dept} variant="secondary" className="gap-1 font-mono">
                {dept}
                <span className="text-muted-foreground">· {skillCountByDept(dept)} sk.</span>
                <button
                  type="button"
                  aria-label={`Usuń departament ${dept}`}
                  className="ml-1 text-muted-foreground hover:text-destructive"
                  onClick={() => updateDepartments.mutate(departments.filter((d) => d !== dept))}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              const dept = deptInput.trim().toLowerCase()
              if (!dept || departments.includes(dept)) return
              updateDepartments.mutate([...departments, dept], {
                onSuccess: () => setDeptInput(""),
              })
            }}
          >
            <Input
              value={deptInput}
              onChange={(event) => setDeptInput(event.target.value)}
              placeholder="finanse/kontroling"
              className="font-mono text-xs"
            />
            <Button type="submit" variant="outline" disabled={updateDepartments.isPending}>
              <Plus className="mr-1.5 h-4 w-4" />
              Departament
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Źródła skilli</CardTitle>
              <CardDescription>
                Folder na dysku → departament. Skanowany do katalogu.
              </CardDescription>
            </div>
            <Button asChild size="sm">
              <Link href="/cortex-config/catalog/sources/new">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Źródło
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {skillSources.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak źródeł.</p>
          ) : (
            skillSources.map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between rounded-md border p-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{source.name}</span>
                  <Badge variant="secondary" className="font-mono">
                    {source.department}
                  </Badge>
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {source.folderPath}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    aria-label={`Edytuj źródło ${source.name}`}
                  >
                    <Link href={`/cortex-config/catalog/sources/${encodeURIComponent(source.id)}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    aria-label={`Usuń źródło ${source.name}`}
                    onClick={() =>
                      updateSources.mutate(skillSources.filter((s) => s.id !== source.id))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
          <p className="pt-1 text-xs text-muted-foreground">
            Wykryte skille: {skills.map((s) => s.name).join(", ") || "brak"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Konektory</CardTitle>
              <CardDescription>
                MCP i CLI per departament. Sekrety jako credential ref.
              </CardDescription>
            </div>
            <Button asChild size="sm">
              <Link href="/cortex-config/catalog/connectors/new">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Konektor
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {connectors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak konektorów.</p>
          ) : (
            connectors.map((connector) => (
              <div
                key={connector.id}
                className="flex items-center justify-between rounded-md border p-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Plug className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{connector.name}</span>
                  <Badge variant="outline">{connector.type}</Badge>
                  <Badge variant="secondary" className="font-mono">
                    {connector.department}
                  </Badge>
                  {!connector.enabled ? <Badge variant="outline">wyłączony</Badge> : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    aria-label={`Edytuj konektor ${connector.name}`}
                  >
                    <Link
                      href={`/cortex-config/catalog/connectors/${encodeURIComponent(connector.id)}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    aria-label={`Usuń konektor ${connector.name}`}
                    onClick={() =>
                      updateConnectors.mutate(connectors.filter((c) => c.id !== connector.id))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
