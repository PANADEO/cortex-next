"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import type { CoworkConnectorConfig, CoworkSkillSource } from "@cortex/types"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorState,
  Input,
  Label,
  LoadingState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@cortex/ui"
import { Folder, Loader2, Pencil, Plus, Plug, Trash2, X } from "lucide-react"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import {
  useCatalog,
  useUpdateConnectors,
  useUpdateDepartments,
  useUpdateSkillSources,
} from "../hooks/use-governance"
import {
  connectorFormSchema,
  connectorFormValuesToConfig,
  connectorToFormValues,
  EMPTY_CONNECTOR_FORM_VALUES,
  skillSourceFormSchema,
  skillSourceToConfig,
  type ConnectorFormValues,
  type SkillSourceFormValues,
} from "../schemas"
import { FieldError } from "./form-fields"

// --- Skill source dialog ------------------------------------------------------

function SkillSourceDialog({
  open,
  onOpenChange,
  source,
  isSaving,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  source?: CoworkSkillSource | undefined
  isSaving: boolean
  onSubmit: (values: SkillSourceFormValues) => Promise<void>
}) {
  const form = useForm<SkillSourceFormValues>({
    resolver: zodResolver(skillSourceFormSchema),
    defaultValues: source ?? { id: "", name: "", folderPath: "", department: "" },
  })

  const submit = form.handleSubmit(async (values) => {
    await onSubmit(values)
    onOpenChange(false)
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) form.reset(source ?? { id: "", name: "", folderPath: "", department: "" })
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{source ? `Edytuj źródło: ${source.name}` : "Nowe źródło skilli"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="source-id">Identyfikator</Label>
              <Input id="source-id" className="mt-1" disabled={Boolean(source)} {...form.register("id")} />
              <FieldError message={form.formState.errors.id?.message} />
            </div>
            <div>
              <Label htmlFor="source-name">Nazwa</Label>
              <Input id="source-name" className="mt-1" {...form.register("name")} />
              <FieldError message={form.formState.errors.name?.message} />
            </div>
          </div>
          <div>
            <Label htmlFor="source-folder">Folder na dysku (absolutny)</Label>
            <Input
              id="source-folder"
              className="mt-1 font-mono text-xs"
              placeholder="/mnt/skille/finanse"
              {...form.register("folderPath")}
            />
            <FieldError message={form.formState.errors.folderPath?.message} />
          </div>
          <div>
            <Label htmlFor="source-dept">Departament</Label>
            <Input
              id="source-dept"
              className="mt-1 font-mono text-xs"
              placeholder="finanse/kontroling"
              {...form.register("department")}
            />
            <FieldError message={form.formState.errors.department?.message} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Zapisz
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Connector dialog ---------------------------------------------------------

function ConnectorDialog({
  open,
  onOpenChange,
  connector,
  isSaving,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  connector?: CoworkConnectorConfig | undefined
  isSaving: boolean
  onSubmit: (values: ConnectorFormValues) => Promise<void>
}) {
  const form = useForm<ConnectorFormValues>({
    resolver: zodResolver(connectorFormSchema),
    defaultValues: connector ? connectorToFormValues(connector) : EMPTY_CONNECTOR_FORM_VALUES,
  })
  const type = form.watch("type")

  const submit = form.handleSubmit(async (values) => {
    await onSubmit(values)
    onOpenChange(false)
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          form.reset(connector ? connectorToFormValues(connector) : EMPTY_CONNECTOR_FORM_VALUES)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{connector ? `Edytuj konektor: ${connector.name}` : "Nowy konektor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="conn-id">Identyfikator</Label>
              <Input id="conn-id" className="mt-1" disabled={Boolean(connector)} {...form.register("id")} />
              <FieldError message={form.formState.errors.id?.message} />
            </div>
            <div>
              <Label htmlFor="conn-name">Nazwa</Label>
              <Input id="conn-name" className="mt-1" {...form.register("name")} />
              <FieldError message={form.formState.errors.name?.message} />
            </div>
            <div>
              <Label>Typ</Label>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mcp">MCP server</SelectItem>
                      <SelectItem value="cli">CLI tool</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <Label htmlFor="conn-dept">Departament</Label>
              <Input
                id="conn-dept"
                className="mt-1 font-mono text-xs"
                placeholder="finanse"
                {...form.register("department")}
              />
              <FieldError message={form.formState.errors.department?.message} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <Switch id="conn-enabled" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label htmlFor="conn-enabled">Aktywny</Label>
          </div>
          <div>
            <Label htmlFor="conn-target">{type === "mcp" ? "URL serwera" : "Ścieżka do narzędzia"}</Label>
            <Input
              id="conn-target"
              className="mt-1 font-mono text-xs"
              placeholder={type === "mcp" ? "https://mcp.example.com/sse" : "/usr/local/bin/tool"}
              {...form.register("target")}
            />
            <FieldError message={form.formState.errors.target?.message} />
          </div>
          <div>
            <Label htmlFor="conn-refs">
              {type === "mcp" ? "Nagłówki" : "Zmienne środowiskowe"} → credential ref (nazwa=ścieżka)
            </Label>
            <Textarea
              id="conn-refs"
              className="mt-1 font-mono text-xs"
              rows={2}
              placeholder={type === "mcp" ? "Authorization=finanse/jira/token" : "API_TOKEN=finanse/token"}
              {...form.register("credentialRefs")}
            />
          </div>
          {type === "cli" ? (
            <div>
              <Label htmlFor="conn-args">Stałe argumenty (opcjonalne)</Label>
              <Input
                id="conn-args"
                className="mt-1 font-mono text-xs"
                placeholder="--format json"
                {...form.register("baseArgs")}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Zapisz
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// --- Panel --------------------------------------------------------------------

export function CatalogPanel() {
  const catalog = useCatalog()
  const updateDepartments = useUpdateDepartments()
  const updateSources = useUpdateSkillSources()
  const updateConnectors = useUpdateConnectors()
  const [deptInput, setDeptInput] = useState("")
  const [sourceDialog, setSourceDialog] = useState<{ open: boolean; source?: CoworkSkillSource }>({
    open: false,
  })
  const [connDialog, setConnDialog] = useState<{ open: boolean; connector?: CoworkConnectorConfig }>(
    { open: false },
  )

  if (catalog.isPending) return <LoadingState label="Wczytywanie katalogu..." />
  if (catalog.isError || !catalog.data) {
    return (
      <ErrorState
        title="Brak dostępu do katalogu"
        message="Panel Cortex Config wymaga uprawnień administratora."
      />
    )
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
                  onClick={() =>
                    updateDepartments.mutate(departments.filter((d) => d !== dept))
                  }
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
              <CardDescription>Folder na dysku → departament. Skanowany do katalogu.</CardDescription>
            </div>
            <Button size="sm" onClick={() => setSourceDialog({ open: true })}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Źródło
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
                  <Button variant="ghost" size="sm" onClick={() => setSourceDialog({ open: true, source })}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
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
              <CardDescription>MCP i CLU per departament. Sekrety jako credential ref.</CardDescription>
            </div>
            <Button size="sm" onClick={() => setConnDialog({ open: true })}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Konektor
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
                    variant="ghost"
                    size="sm"
                    onClick={() => setConnDialog({ open: true, connector })}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
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

      <SkillSourceDialog
        open={sourceDialog.open}
        onOpenChange={(open) => setSourceDialog((prev) => ({ ...prev, open }))}
        source={sourceDialog.source}
        isSaving={updateSources.isPending}
        onSubmit={async (values) => {
          const next = skillSources.filter((s) => s.id !== values.id)
          await updateSources.mutateAsync([...next, skillSourceToConfig(values)])
        }}
      />
      <ConnectorDialog
        open={connDialog.open}
        onOpenChange={(open) => setConnDialog((prev) => ({ ...prev, open }))}
        connector={connDialog.connector}
        isSaving={updateConnectors.isPending}
        onSubmit={async (values) => {
          const next = connectors.filter((c) => c.id !== values.id)
          await updateConnectors.mutateAsync([...next, connectorFormValuesToConfig(values)])
        }}
      />
    </div>
  )
}
