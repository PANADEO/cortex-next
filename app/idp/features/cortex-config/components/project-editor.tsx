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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@cortex/ui"
import { Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { Controller, useFieldArray, useForm, type FieldErrors } from "react-hook-form"
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
import { AccessDeniedState, ConfigScreen } from "./config-screen"
import { CheckboxList, FieldError, GrantPickerField } from "./form-fields"
import { DepartmentSelect } from "./pickers"

const BACK_HREF = "/cortex-config/projects"

// Tab definitions in one place: label for the trigger + the fields that live on
// the tab, so a failed submit can dot the tab that needs attention (fields hide
// behind inactive tabs, so the dot is the only cue).
const TABS = [
  { value: "podstawy", label: "Podstawy", fields: ["id", "name", "description", "icon", "enabled"] },
  { value: "dostep", label: "Dostęp", fields: ["allowedRoleIds"] },
  { value: "model", label: "Model", fields: ["modelId", "apiKeyRef"] },
  {
    value: "klocki",
    label: "Klocki",
    fields: [
      "skillBranches",
      "skillLeaves",
      "connectorBranches",
      "connectorLeaves",
      "secretBranches",
      "secretLeaves",
    ],
  },
  { value: "briefy", label: "Briefy", fields: ["briefs"] },
  {
    value: "agent",
    label: "Agent i sandbox",
    fields: ["department", "systemPrompt", "sandboxMode", "sandboxPaths"],
  },
  { value: "eksport", label: "Eksport", fields: ["exportDir", "exportDisplayPath"] },
] as const satisfies ReadonlyArray<{
  value: string
  label: string
  fields: ReadonlyArray<keyof ProjectFormValues>
}>

function tabHasErrors(
  fields: ReadonlyArray<keyof ProjectFormValues>,
  errors: FieldErrors<ProjectFormValues>,
): boolean {
  return fields.some((field) => Boolean(errors[field]))
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
  if (governance.isError || catalog.isError || !catalog.data) return <AccessDeniedState />

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
  const errors = form.formState.errors
  const briefs = useFieldArray({ control: form.control, name: "briefs" })

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(projectFormValuesToInput(values))
      router.push(BACK_HREF)
    } catch {
      // Rejected save (e.g. 400 from invalid grant references): stay on the
      // page so the admin can fix it. The mutation's onError already
      // surfaced a toast with the reason - see useCreateProject/useUpdateProject.
    }
  })

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <ConfigScreen
        backHref={BACK_HREF}
        backLabel="Projekty"
        title={project ? `Edytuj projekt: ${project.name}` : "Nowy projekt"}
        description="Kafelek task-chat: model, dostęp, klocki z katalogu i sandbox."
        save={{ isSaving, label: project ? "Zapisz zmiany" : "Utwórz projekt" }}
      >
        <Tabs defaultValue="podstawy">
          <TabsList className="mb-4 flex-wrap">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
                {tab.label}
                {tabHasErrors(tab.fields, errors) ? (
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
                  Każda tura idzie przez cortex-proxy - adres bramki bierze serwer ze swojego
                  środowiska (CORTEX_PROXY_URL), więc projekt przenosi się między instancjami bez
                  edycji. Tu wybierasz tylko model.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="project-model">Model</Label>
                  <Input
                    id="project-model"
                    className="mt-1"
                    placeholder="np. anthropic/claude-sonnet-4.6"
                    {...form.register("modelId")}
                  />
                  <FieldError message={errors.modelId?.message} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="project-api-key-ref">
                    Klucz API (referencja z sekretów, np. wspolne/llm/cortex-proxy)
                  </Label>
                  <Input
                    id="project-api-key-ref"
                    className="mt-1"
                    placeholder="puste = cortex-proxy nie weryfikuje klucza klienta"
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
                <GrantPickerField
                  control={form.control}
                  branchName="skillBranches"
                  leafName="skillLeaves"
                  departments={catalog.departments}
                  leaves={catalog.skills.map((skill) => ({
                    id: skill.id,
                    label: skill.name,
                    department: skill.department,
                  }))}
                  leafEmptyText="Katalog skilli jest pusty."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Konektory</CardTitle>
                <CardDescription>MCP i CLI, które agent dostaje jako narzędzia.</CardDescription>
              </CardHeader>
              <CardContent>
                <GrantPickerField
                  control={form.control}
                  branchName="connectorBranches"
                  leafName="connectorLeaves"
                  departments={catalog.departments}
                  leaves={catalog.connectors.map((connector) => ({
                    id: connector.id,
                    label: `${connector.name} (${connector.type})`,
                    department: connector.department,
                  }))}
                  leafEmptyText="Katalog konektorów jest pusty."
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
                <GrantPickerField
                  control={form.control}
                  branchName="secretBranches"
                  leafName="secretLeaves"
                  departments={catalog.departments}
                  leaves={credentialPaths.map((path) => ({ id: path, label: path }))}
                  leafEmptyText="Brak zapisanych sekretów."
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="briefy" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Karty startowe (briefy)</CardTitle>
                <CardDescription>
                  Gotowe zlecenia widoczne w pustym czacie - kliknięcie wypełnia pole wiadomości.
                  Podpowiedź mówi użytkownikowi, co musi dostarczyć (np. plik z transkrypcją).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {briefs.fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Brak briefów - użytkownik zobaczy pusty czat bez podpowiedzi.
                  </p>
                ) : null}
                {briefs.fields.map((field, index) => (
                  <div key={field.id} className="space-y-3 rounded-lg border border-border p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor={`brief-title-${index}`}>Tytuł karty</Label>
                        <Input
                          id={`brief-title-${index}`}
                          className="mt-1"
                          placeholder="np. Status pack z transkrypcji"
                          {...form.register(`briefs.${index}.title`)}
                        />
                        <FieldError message={errors.briefs?.[index]?.title?.message} />
                      </div>
                      <div>
                        <Label htmlFor={`brief-hint-${index}`}>
                          Podpowiedź (czego potrzebuje user)
                        </Label>
                        <Input
                          id={`brief-hint-${index}`}
                          className="mt-1"
                          placeholder="np. dodaj plik z transkrypcją"
                          {...form.register(`briefs.${index}.hint`)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`brief-prompt-${index}`}>Prompt (trafia do composera)</Label>
                      <Textarea
                        id={`brief-prompt-${index}`}
                        className="mt-1"
                        rows={3}
                        placeholder="np. Zrób status pack z wgranej transkrypcji spotkania."
                        {...form.register(`briefs.${index}.prompt`)}
                      />
                      <FieldError message={errors.briefs?.[index]?.prompt?.message} />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-muted-foreground hover:text-destructive"
                      onClick={() => briefs.remove(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Usuń kartę
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    briefs.append({ id: crypto.randomUUID(), title: "", prompt: "", hint: "" })
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Dodaj kartę
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agent" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Instrukcje agenta</CardTitle>
                <CardDescription>
                  Kafelek dziedziczy AGENTS.md: zasady organizacji, potem działów po ścieżce
                  departamentu, potem poniższe instrukcje, na końcu prywatna notka użytkownika.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Departament kafelka (dziedziczenie AGENTS.md)</Label>
                  <div className="mt-1">
                    <Controller
                      control={form.control}
                      name="department"
                      render={({ field }) => (
                        <DepartmentSelect
                          departments={catalog.departments}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="Brak - tylko zasady organizacji"
                        />
                      )}
                    />
                  </div>
                  <FieldError message={errors.department?.message} />
                </div>
                <div>
                  <Label htmlFor="project-system-prompt">
                    Dodatkowe instrukcje (system prompt)
                  </Label>
                  <Textarea
                    id="project-system-prompt"
                    className="mt-1"
                    rows={4}
                    placeholder="np. Odpowiadaj po polsku. Raporty formatuj wg standardu działu."
                    {...form.register("systemPrompt")}
                  />
                </div>
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
