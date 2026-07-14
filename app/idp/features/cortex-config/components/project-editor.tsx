"use client"

import { PROJECT_ICON_OPTIONS } from "@/features/cortex-cowork"
import { zodResolver } from "@hookform/resolvers/zod"
import type { CoworkProjectConfig, CoworkRole } from "@cortex/types"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@cortex/ui"
import { ErrorState, LoadingState } from "@cortex/ui"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Controller, useForm, type FieldErrors } from "react-hook-form"
import {
  useCatalog,
  useCreateProject,
  useCredentialPaths,
  useGovernanceConfig,
  useUpdateProject,
} from "../hooks/use-governance"
import type { CatalogSnapshot, ProjectInput } from "../queries"
import {
  EMPTY_PROJECT_FORM_VALUES,
  projectFormSchema,
  projectFormValuesToInput,
  projectToFormValues,
  type ProjectFormValues,
} from "../schemas"
import { ConfigScreen } from "./config-screen"
import { CheckboxList, FieldError, GrantPicker } from "./form-fields"

const BACK_HREF = "/cortex-config/projects"

// Which form fields live on which tab - drives the error dot on tab triggers
// so a failed submit points at the tab that needs attention.
const TAB_FIELDS: Record<string, Array<keyof ProjectFormValues>> = {
  podstawy: ["id", "name", "description", "icon", "enabled"],
  dostep: ["allowedRoleIds"],
  model: ["provider", "modelId", "baseUrl", "apiKeyRef"],
  klocki: [
    "skillBranches",
    "skillLeaves",
    "connectorBranches",
    "connectorLeaves",
    "secretBranches",
    "secretLeaves",
  ],
  agent: ["systemPrompt", "sandboxMode", "sandboxPaths"],
  eksport: ["exportDir", "exportDisplayPath"],
}

function tabHasErrors(tab: string, errors: FieldErrors<ProjectFormValues>): boolean {
  return (TAB_FIELDS[tab] ?? []).some((field) => Boolean(errors[field]))
}

/** Data-loading host: resolves governance + catalog and wires the mutations. */
export function ProjectEditorScreen({ projectId }: { projectId?: string | undefined }) {
  const governance = useGovernanceConfig()
  const catalog = useCatalog()
  const credentials = useCredentialPaths()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()

  if (governance.isPending || catalog.isPending) {
    return <LoadingState label="Wczytywanie konfiguracji..." />
  }
  if (governance.isError || catalog.isError || !catalog.data) {
    return (
      <ErrorState
        title="Brak dostępu do konfiguracji"
        message="Panel Cortex Config wymaga uprawnień administratora."
      />
    )
  }

  const project = projectId
    ? governance.data.projects.find((candidate) => candidate.id === projectId)
    : undefined
  if (projectId && !project) {
    return <ErrorState title="Nie znaleziono projektu" message={`Brak projektu "${projectId}".`} />
  }

  return (
    <ProjectEditor
      key={project?.id ?? "new"}
      project={project}
      roles={governance.data.roles}
      catalog={catalog.data}
      credentialPaths={credentials.data?.paths ?? []}
      isSaving={createProject.isPending || updateProject.isPending}
      onSubmit={async (input) => {
        if (project) await updateProject.mutateAsync(input)
        else await createProject.mutateAsync(input)
      }}
    />
  )
}

interface ProjectEditorProps {
  /** Present when editing; absent when creating. */
  project?: CoworkProjectConfig | undefined
  roles: CoworkRole[]
  catalog: CatalogSnapshot
  credentialPaths: string[]
  isSaving: boolean
  onSubmit: (input: ProjectInput) => Promise<void>
}

/** Full-screen tabbed editor for one task-chat project (was a dialog). */
export function ProjectEditor({
  project,
  roles,
  catalog,
  credentialPaths,
  isSaving,
  onSubmit,
}: ProjectEditorProps) {
  const router = useRouter()
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: project ? projectToFormValues(project) : EMPTY_PROJECT_FORM_VALUES,
  })
  const provider = form.watch("provider")
  const errors = form.formState.errors

  const submit = form.handleSubmit(async (values) => {
    await onSubmit(projectFormValuesToInput(values))
    router.push(BACK_HREF)
  })

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <ConfigScreen
        backHref={BACK_HREF}
        backLabel="Projekty"
        title={project ? `Edytuj projekt: ${project.name}` : "Nowy projekt"}
        description="Kafelek task-chat: model, dostęp, klocki z katalogu i sandbox."
        actions={
          <>
            <Button asChild type="button" variant="outline">
              <Link href={BACK_HREF}>Anuluj</Link>
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {project ? "Zapisz zmiany" : "Utwórz projekt"}
            </Button>
          </>
        }
      >
        <Tabs defaultValue="podstawy">
          <TabsList className="mb-4 flex-wrap">
            {[
              ["podstawy", "Podstawy"],
              ["dostep", "Dostęp"],
              ["model", "Model"],
              ["klocki", "Klocki"],
              ["agent", "Agent i sandbox"],
              ["eksport", "Eksport"],
            ].map(([value, label]) => (
              <TabsTrigger key={value} value={value as string} className="gap-1.5">
                {label}
                {tabHasErrors(value as string, errors) ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="podstawy" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Identyfikacja kafelka</CardTitle>
                <CardDescription>To, co użytkownik widzi na hubie.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  <Input
                    id="project-description"
                    className="mt-1"
                    {...form.register("description")}
                  />
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
                      <Switch
                        id="project-enabled"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                  <Label htmlFor="project-enabled">Kafelek aktywny</Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dostep" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Role z dostępem</CardTitle>
                <CardDescription>
                  Rola to bramka: decyduje, kto widzi i otwiera kafelek. Zawartość definiują
                  klocki projektu.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Controller
                  control={form.control}
                  name="allowedRoleIds"
                  render={({ field }) => (
                    <CheckboxList
                      options={roles.map((role) => ({
                        id: role.id,
                        label: role.name,
                        hint: role.id,
                      }))}
                      value={field.value}
                      onChange={field.onChange}
                      emptyText="Brak zdefiniowanych ról - dodaj je w zakładce Role i dostęp."
                    />
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="model" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Model językowy</CardTitle>
                <CardDescription>
                  Wszystkie wywołania idą przez jeden provider layer - gotowe pod cortex-proxy.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                    Klucz API (referencja z sekretów, np. wspolne/llm/cortex-proxy)
                  </Label>
                  <Input
                    id="project-api-key-ref"
                    className="mt-1"
                    placeholder="puste = klucz z env serwera"
                    {...form.register("apiKeyRef")}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="klocki" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Skille</CardTitle>
                <CardDescription>
                  Zbuduj toolkit projektu z klocków katalogu. Gałąź departamentu ciągnie
                  wszystkie zasoby pod nim.
                </CardDescription>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Konektory</CardTitle>
                <CardDescription>MCP i CLI, które agent dostaje jako narzędzia.</CardDescription>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Sekrety (strefy danych)</CardTitle>
                <CardDescription>
                  Projekt może użyć tylko sekretów z przyznanych gałęzi/ścieżek. To techniczna
                  granica stref danych.
                </CardDescription>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agent" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Instrukcje agenta</CardTitle>
              </CardHeader>
              <CardContent>
                <Label htmlFor="project-system-prompt">Dodatkowe instrukcje (system prompt)</Label>
                <Textarea
                  id="project-system-prompt"
                  className="mt-1"
                  rows={4}
                  placeholder="np. Odpowiadaj po polsku. Raporty formatuj wg standardu działu."
                  {...form.register("systemPrompt")}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Sandbox</CardTitle>
                <CardDescription>
                  Gdzie agent wykonuje pracę i które ścieżki hosta widzi.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Tryb</Label>
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
                    rows={4}
                    placeholder={"/mnt/dzial-finanse/dane:ro\n/mnt/wspolne/szablony"}
                    {...form.register("sandboxPaths")}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="eksport" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Eksport artefaktów</CardTitle>
                <CardDescription>
                  Opcjonalny dysk sieciowy, na który użytkownik jednym klikiem odkłada plik z
                  sesji.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </ConfigScreen>
    </form>
  )
}
