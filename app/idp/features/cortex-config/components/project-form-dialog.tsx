"use client"

import { PROJECT_ICON_OPTIONS } from "@/features/cortex-cowork"
import { zodResolver } from "@hookform/resolvers/zod"
import type { CoworkProjectConfig, CoworkRole } from "@cortex/types"
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
  Textarea,
} from "@cortex/ui"
import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import type { CatalogSnapshot, ProjectInput } from "../queries"
import {
  EMPTY_PROJECT_FORM_VALUES,
  projectFormSchema,
  projectFormValuesToInput,
  projectToFormValues,
  type ProjectFormValues,
} from "../schemas"
import { CheckboxList, FieldError, GrantPicker } from "./form-fields"

interface ProjectFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present when editing; absent when creating. */
  project?: CoworkProjectConfig | undefined
  roles: CoworkRole[]
  catalog: CatalogSnapshot
  credentialPaths: string[]
  isSaving?: boolean
  onSubmit: (input: ProjectInput) => Promise<void>
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  roles,
  catalog,
  credentialPaths,
  isSaving = false,
  onSubmit,
}: ProjectFormDialogProps) {
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: project ? projectToFormValues(project) : EMPTY_PROJECT_FORM_VALUES,
  })

  useEffect(() => {
    if (!open) return
    form.reset(project ? projectToFormValues(project) : EMPTY_PROJECT_FORM_VALUES)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project])

  const provider = form.watch("provider")
  const errors = form.formState.errors

  const submit = form.handleSubmit(async (values) => {
    await onSubmit(projectFormValuesToInput(values))
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{project ? `Edytuj projekt: ${project.name}` : "Nowy projekt"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="project-id">Identyfikator (slug)</Label>
              <Input
                id="project-id"
                className="mt-1"
                placeholder="np. raporty-finansowe"
                disabled={Boolean(project)}
                {...form.register("id")}
              />
              <FieldError message={errors.id?.message} />
            </div>
            <div>
              <Label htmlFor="project-name">Nazwa</Label>
              <Input id="project-name" className="mt-1" {...form.register("name")} />
              <FieldError message={errors.name?.message} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="project-description">Opis (widoczny na kafelku)</Label>
              <Input id="project-description" className="mt-1" {...form.register("description")} />
              <FieldError message={errors.description?.message} />
            </div>
            <div>
              <Label>Ikona</Label>
              <Controller
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <Select value={field.value || "bot"} onValueChange={field.onChange}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_ICON_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <Controller
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <Switch id="project-enabled" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <Label htmlFor="project-enabled">Kafelek aktywny</Label>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-medium">Model</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Provider</Label>
                <Controller
                  control={form.control}
                  name="provider"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="openai-compatible">
                          OpenAI-compatible (gateway / cortex-proxy)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div>
                <Label htmlFor="project-model">Model</Label>
                <Input
                  id="project-model"
                  className="mt-1"
                  placeholder="np. claude-sonnet-4-5"
                  {...form.register("modelId")}
                />
                <FieldError message={errors.modelId?.message} />
              </div>
              {provider === "openai-compatible" ? (
                <div className="sm:col-span-2">
                  <Label htmlFor="project-base-url">Base URL</Label>
                  <Input
                    id="project-base-url"
                    className="mt-1"
                    placeholder="https://cortex-proxy.example.com/v1"
                    {...form.register("baseUrl")}
                  />
                  <FieldError message={errors.baseUrl?.message} />
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <Label htmlFor="project-api-key-ref">
                  Klucz API (referencja credential store, np. wspolne/llm/cortex-proxy)
                </Label>
                <Input
                  id="project-api-key-ref"
                  className="mt-1"
                  placeholder="puste = klucz z env serwera"
                  {...form.register("apiKeyRef")}
                />
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-medium">Dostęp (role)</h3>
            <Controller
              control={form.control}
              name="allowedRoleIds"
              render={({ field }) => (
                <CheckboxList
                  options={roles.map((role) => ({ id: role.id, label: role.name, hint: role.id }))}
                  value={field.value}
                  onChange={field.onChange}
                  emptyText="Brak zdefiniowanych ról - dodaj je w zakładce Role i uprawnienia."
                />
              )}
            />
          </section>

          <Separator />

          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-medium">Kompozycja - skille</h3>
              <p className="text-xs text-muted-foreground">
                Zbuduj toolkit projektu z klocków katalogu. Gałąź departamentu ciągnie wszystkie
                zasoby pod nim.
              </p>
            </div>
            <Controller
              control={form.control}
              name="skillBranches"
              render={({ field: branchField }) => (
                <Controller
                  control={form.control}
                  name="skillLeaves"
                  render={({ field: leafField }) => (
                    <GrantPicker
                      departments={catalog.departments}
                      leaves={catalog.skills.map((skill) => ({
                        id: skill.id,
                        label: skill.name,
                        department: skill.department,
                      }))}
                      branchValue={branchField.value}
                      onBranchChange={branchField.onChange}
                      leafValue={leafField.value}
                      onLeafChange={leafField.onChange}
                      leafEmptyText="Katalog skilli jest pusty."
                    />
                  )}
                />
              )}
            />
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-medium">Kompozycja - konektory</h3>
            <Controller
              control={form.control}
              name="connectorBranches"
              render={({ field: branchField }) => (
                <Controller
                  control={form.control}
                  name="connectorLeaves"
                  render={({ field: leafField }) => (
                    <GrantPicker
                      departments={catalog.departments}
                      leaves={catalog.connectors.map((connector) => ({
                        id: connector.id,
                        label: `${connector.name} (${connector.type})`,
                        department: connector.department,
                      }))}
                      branchValue={branchField.value}
                      onBranchChange={branchField.onChange}
                      leafValue={leafField.value}
                      onLeafChange={leafField.onChange}
                      leafEmptyText="Katalog konektorów jest pusty."
                    />
                  )}
                />
              )}
            />
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-medium">Kompozycja - sekrety (strefy danych)</h3>
            <p className="text-xs text-muted-foreground">
              Projekt może użyć tylko sekretów z przyznanych gałęzi/ścieżek. To techniczna granica
              stref danych.
            </p>
            <Controller
              control={form.control}
              name="secretBranches"
              render={({ field: branchField }) => (
                <Controller
                  control={form.control}
                  name="secretLeaves"
                  render={({ field: leafField }) => (
                    <GrantPicker
                      departments={catalog.departments}
                      leaves={credentialPaths.map((path) => ({ id: path, label: path }))}
                      branchValue={branchField.value}
                      onBranchChange={branchField.onChange}
                      leafValue={leafField.value}
                      onLeafChange={leafField.onChange}
                      leafEmptyText="Brak zapisanych sekretów."
                    />
                  )}
                />
              )}
            />
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-medium">Agent</h3>
            <div>
              <Label htmlFor="project-system-prompt">Dodatkowe instrukcje (system prompt)</Label>
              <Textarea
                id="project-system-prompt"
                className="mt-1"
                rows={3}
                placeholder="np. Odpowiadaj po polsku. Raporty formatuj wg standardu działu."
                {...form.register("systemPrompt")}
              />
            </div>
            <div>
              <Label>Sandbox</Label>
              <Controller
                control={form.control}
                name="sandboxMode"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">
                        Lokalny (izolacja katalogowa, wykonanie na hoście)
                      </SelectItem>
                      <SelectItem value="docker">
                        Docker (twarda izolacja, ścieżki jako bind-mounty)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <Label htmlFor="project-sandbox-paths">
                Ścieżki dostępne w sandboxie (jedna na linię, sufiks :ro = tylko odczyt)
              </Label>
              <Textarea
                id="project-sandbox-paths"
                className="mt-1 font-mono text-xs"
                rows={3}
                placeholder={"/mnt/dzial-finanse/dane:ro\n/mnt/wspolne/szablony"}
                {...form.register("sandboxPaths")}
              />
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-medium">Export artefaktów</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="project-export-dir">Folder docelowy (na serwerze)</Label>
                <Input
                  id="project-export-dir"
                  className="mt-1 font-mono text-xs"
                  placeholder="/mnt/dzial-finanse/artefakty"
                  {...form.register("exportDir")}
                />
              </div>
              <div>
                <Label htmlFor="project-export-display">Ścieżka pokazywana użytkownikom</Label>
                <Input
                  id="project-export-display"
                  className="mt-1 font-mono text-xs"
                  placeholder="\\\\nas\\finanse\\artefakty"
                  {...form.register("exportDisplayPath")}
                />
              </div>
            </div>
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {project ? "Zapisz zmiany" : "Utwórz projekt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
