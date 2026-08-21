"use client"

import { PROJECT_ICON_OPTIONS } from "@/features/cortex-cowork"
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
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { Controller, useFieldArray, useForm, type FieldErrors } from "react-hook-form"
import { useTranslation } from "react-i18next"
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

// Tab definitions in one place: translation key for the trigger label + the
// fields that live on the tab, so a failed submit can dot the tab that needs
// attention (fields hide behind inactive tabs, so the dot is the only cue).
const TABS = [
  {
    value: "podstawy",
    labelKey: "projectEditor.tabs.basics",
    fields: ["id", "name", "description", "icon", "enabled"],
  },
  { value: "dostep", labelKey: "projectEditor.tabs.access", fields: ["allowedRoleIds"] },
  { value: "model", labelKey: "projectEditor.tabs.model", fields: ["modelId", "apiKeyRef"] },
  {
    value: "klocki",
    labelKey: "projectEditor.tabs.blocks",
    fields: [
      "skillBranches",
      "skillLeaves",
      "connectorBranches",
      "connectorLeaves",
      "secretBranches",
      "secretLeaves",
    ],
  },
  { value: "briefy", labelKey: "projectEditor.tabs.briefs", fields: ["briefs"] },
  {
    value: "agent",
    labelKey: "projectEditor.tabs.agent",
    fields: ["department", "systemPrompt", "sandboxMode", "sandboxPaths"],
  },
  {
    value: "eksport",
    labelKey: "projectEditor.tabs.export",
    fields: ["exportDir", "exportDisplayPath"],
  },
] as const satisfies ReadonlyArray<{
  value: string
  labelKey: string
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
  const { t } = useTranslation("cortex-config")
  const governance = useGovernanceConfig()
  const catalog = useCatalog()
  const credentials = useCredentialPaths()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()

  if (governance.isPending || catalog.isPending) {
    return <LoadingState label={t("state.loadingConfig")} />
  }
  if (governance.isError || catalog.isError || !catalog.data) return <AccessDeniedState />

  const project = projectId
    ? governance.data.projects.find((candidate) => candidate.id === projectId)
    : undefined
  if (projectId && !project) {
    return (
      <ErrorState
        title={t("projectEditor.notFoundTitle")}
        message={t("projectEditor.notFoundMessage", { id: projectId })}
      />
    )
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
  const { t } = useTranslation(["cortex-config", "common"])
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
        backLabel={t("nav.backToProjects")}
        title={
          project
            ? t("projectEditor.editTitle", { name: project.name })
            : t("projectEditor.newTitle")
        }
        description={t("projectEditor.description")}
        save={{
          isSaving,
          label: project ? t("projectEditor.saveChanges") : t("projectEditor.createProject"),
        }}
      >
        <Tabs defaultValue="podstawy">
          <TabsList className="mb-4 flex-wrap">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
                {t(tab.labelKey)}
                {tabHasErrors(tab.fields, errors) ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="podstawy" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("projectEditor.identityTitle")}</CardTitle>
                <CardDescription>{t("projectEditor.identityDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="project-id">{t("projectEditor.slugLabel")}</Label>
                  <Input
                    id="project-id"
                    className="mt-1"
                    placeholder={t("projectEditor.slugPlaceholder")}
                    disabled={Boolean(project)}
                    {...form.register("id")}
                  />
                  <FieldError message={errors.id?.message} />
                </div>
                <div>
                  <Label htmlFor="project-name">{t("fields.name")}</Label>
                  <Input id="project-name" className="mt-1" {...form.register("name")} />
                  <FieldError message={errors.name?.message} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="project-description">{t("projectEditor.descriptionLabel")}</Label>
                  <Input
                    id="project-description"
                    className="mt-1"
                    {...form.register("description")}
                  />
                  <FieldError message={errors.description?.message} />
                </div>
                <div>
                  <Label>{t("projectEditor.iconLabel")}</Label>
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
                              {t(`projectEditor.icons.${option.value}`)}
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
                  <Label htmlFor="project-enabled">{t("projectEditor.enabledLabel")}</Label>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dostep" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("projectEditor.accessTitle")}</CardTitle>
                <CardDescription>{t("projectEditor.accessDescription")}</CardDescription>
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
                      emptyText={t("projectEditor.rolesEmpty")}
                    />
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="model" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("projectEditor.modelTitle")}</CardTitle>
                <CardDescription>{t("projectEditor.modelDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="project-model">{t("projectEditor.modelLabel")}</Label>
                  <Input
                    id="project-model"
                    className="mt-1"
                    placeholder={t("projectEditor.modelPlaceholder")}
                    {...form.register("modelId")}
                  />
                  <FieldError message={errors.modelId?.message} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="project-api-key-ref">{t("projectEditor.apiKeyLabel")}</Label>
                  <Input
                    id="project-api-key-ref"
                    className="mt-1"
                    placeholder={t("projectEditor.apiKeyPlaceholder")}
                    {...form.register("apiKeyRef")}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="klocki" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("projectEditor.skillsTitle")}</CardTitle>
                <CardDescription>{t("projectEditor.skillsDescription")}</CardDescription>
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
                  leafEmptyText={t("projectEditor.skillsEmpty")}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("projectEditor.connectorsTitle")}</CardTitle>
                <CardDescription>{t("projectEditor.connectorsDescription")}</CardDescription>
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
                  leafEmptyText={t("projectEditor.connectorsEmpty")}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("projectEditor.secretsTitle")}</CardTitle>
                <CardDescription>{t("projectEditor.secretsDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                <GrantPickerField
                  control={form.control}
                  branchName="secretBranches"
                  leafName="secretLeaves"
                  departments={catalog.departments}
                  leaves={credentialPaths.map((path) => ({ id: path, label: path }))}
                  leafEmptyText={t("projectEditor.secretsEmpty")}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="briefy" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("projectEditor.briefsTitle")}</CardTitle>
                <CardDescription>{t("projectEditor.briefsDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {briefs.fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("projectEditor.briefsEmpty")}</p>
                ) : null}
                {briefs.fields.map((field, index) => (
                  <div key={field.id} className="space-y-3 rounded-lg border border-border p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor={`brief-title-${index}`}>
                          {t("projectEditor.briefTitleLabel")}
                        </Label>
                        <Input
                          id={`brief-title-${index}`}
                          className="mt-1"
                          placeholder={t("projectEditor.briefTitlePlaceholder")}
                          {...form.register(`briefs.${index}.title`)}
                        />
                        <FieldError message={errors.briefs?.[index]?.title?.message} />
                      </div>
                      <div>
                        <Label htmlFor={`brief-hint-${index}`}>
                          {t("projectEditor.briefHintLabel")}
                        </Label>
                        <Input
                          id={`brief-hint-${index}`}
                          className="mt-1"
                          placeholder={t("projectEditor.briefHintPlaceholder")}
                          {...form.register(`briefs.${index}.hint`)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`brief-prompt-${index}`}>
                        {t("projectEditor.briefPromptLabel")}
                      </Label>
                      <Textarea
                        id={`brief-prompt-${index}`}
                        className="mt-1"
                        rows={3}
                        placeholder={t("projectEditor.briefPromptPlaceholder")}
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
                      {t("projectEditor.removeBrief")}
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
                  {t("projectEditor.addBrief")}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agent" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("projectEditor.agentTitle")}</CardTitle>
                <CardDescription>{t("projectEditor.agentDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t("projectEditor.departmentLabel")}</Label>
                  <div className="mt-1">
                    <Controller
                      control={form.control}
                      name="department"
                      render={({ field }) => (
                        <DepartmentSelect
                          departments={catalog.departments}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder={t("projectEditor.departmentPlaceholder")}
                        />
                      )}
                    />
                  </div>
                  <FieldError message={errors.department?.message} />
                </div>
                <div>
                  <Label htmlFor="project-system-prompt">
                    {t("projectEditor.systemPromptLabel")}
                  </Label>
                  <Textarea
                    id="project-system-prompt"
                    className="mt-1"
                    rows={4}
                    placeholder={t("projectEditor.systemPromptPlaceholder")}
                    {...form.register("systemPrompt")}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("projectEditor.sandboxTitle")}</CardTitle>
                <CardDescription>{t("projectEditor.sandboxDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>{t("projectEditor.sandboxModeLabel")}</Label>
                  <Controller
                    control={form.control}
                    name="sandboxMode"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="local">{t("projectEditor.sandboxLocal")}</SelectItem>
                          <SelectItem value="docker">{t("projectEditor.sandboxDocker")}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <Label htmlFor="project-sandbox-paths">
                    {t("projectEditor.sandboxPathsLabel")}
                  </Label>
                  <Textarea
                    id="project-sandbox-paths"
                    className="mt-1 font-mono text-xs"
                    rows={4}
                    placeholder={t("projectEditor.sandboxPathsPlaceholder")}
                    {...form.register("sandboxPaths")}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="eksport" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("projectEditor.exportTitle")}</CardTitle>
                <CardDescription>{t("projectEditor.exportDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="project-export-dir">{t("projectEditor.exportDirLabel")}</Label>
                  <Input
                    id="project-export-dir"
                    className="mt-1 font-mono text-xs"
                    placeholder={t("projectEditor.exportDirPlaceholder")}
                    {...form.register("exportDir")}
                  />
                </div>
                <div>
                  <Label htmlFor="project-export-display">
                    {t("projectEditor.exportDisplayLabel")}
                  </Label>
                  <Input
                    id="project-export-display"
                    className="mt-1 font-mono text-xs"
                    placeholder={t("projectEditor.exportDisplayPlaceholder")}
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
