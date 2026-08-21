"use client"

import { Card, CardContent, ErrorState, Input, Label, LoadingState } from "@cortex/ui"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useCatalog, useUpdateSkillSources } from "../hooks/use-governance"
import { skillSourceFormSchema, skillSourceToConfig, type SkillSourceFormValues } from "../schemas"
import { AccessDeniedState, ConfigScreen } from "./config-screen"
import { FieldError } from "./form-fields"
import { DepartmentSelect } from "./pickers"

const BACK_HREF = "/cortex-config/catalog"

/** Full-screen editor for one skill source (folder -> department). */
export function SourceEditorScreen({ sourceId }: { sourceId?: string | undefined }) {
  const { t } = useTranslation("cortex-config")
  const catalog = useCatalog()
  const updateSources = useUpdateSkillSources()
  const router = useRouter()

  if (catalog.isPending) return <LoadingState label={t("state.loadingCatalog")} />
  if (catalog.isError || !catalog.data)
    return <AccessDeniedState title={t("access.catalogTitle")} />

  const { skillSources, departments } = catalog.data
  const source = sourceId ? skillSources.find((s) => s.id === sourceId) : undefined
  if (sourceId && !source) {
    return (
      <ErrorState
        title={t("sourceEditor.notFoundTitle")}
        message={t("sourceEditor.notFoundMessage", { id: sourceId })}
      />
    )
  }

  return (
    <SourceForm
      key={source?.id ?? "new"}
      departments={departments}
      defaultValues={source ?? { id: "", name: "", folderPath: "", department: "" }}
      editing={Boolean(source)}
      isSaving={updateSources.isPending}
      onSubmit={async (values) => {
        const next = skillSources.filter((s) => s.id !== values.id)
        await updateSources.mutateAsync([...next, skillSourceToConfig(values)])
        router.push(BACK_HREF)
      }}
    />
  )
}

function SourceForm({
  departments,
  defaultValues,
  editing,
  isSaving,
  onSubmit,
}: {
  departments: string[]
  defaultValues: SkillSourceFormValues
  editing: boolean
  isSaving: boolean
  onSubmit: (values: SkillSourceFormValues) => Promise<void>
}) {
  const { t } = useTranslation(["cortex-config", "common"])
  const form = useForm<SkillSourceFormValues>({
    resolver: zodResolver(skillSourceFormSchema),
    defaultValues,
  })
  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values)
    } catch {
      // Rejected save (e.g. 400 from catalog/skill-sources/route.ts
      // validation): stay on the page so the admin can fix it. The
      // mutation's onError already surfaced a toast - see useUpdateSkillSources.
    }
  })

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <ConfigScreen
        backHref={BACK_HREF}
        backLabel={t("nav.backToCatalog")}
        title={
          editing
            ? t("sourceEditor.editTitle", { name: defaultValues.name })
            : t("sourceEditor.newTitle")
        }
        description={t("sourceEditor.description")}
        save={{ isSaving, label: t("common:actions.save") }}
      >
        <Card>
          <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2">
            <div>
              <Label htmlFor="source-id">{t("fields.id")}</Label>
              <Input id="source-id" className="mt-1" disabled={editing} {...form.register("id")} />
              <FieldError message={form.formState.errors.id?.message} />
            </div>
            <div>
              <Label htmlFor="source-name">{t("fields.name")}</Label>
              <Input id="source-name" className="mt-1" {...form.register("name")} />
              <FieldError message={form.formState.errors.name?.message} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="source-folder">{t("sourceEditor.folderLabel")}</Label>
              <Input
                id="source-folder"
                className="mt-1 font-mono text-xs"
                placeholder={t("sourceEditor.folderPlaceholder")}
                {...form.register("folderPath")}
              />
              <FieldError message={form.formState.errors.folderPath?.message} />
            </div>
            <div>
              <Label>{t("fields.department")}</Label>
              <div className="mt-1">
                <Controller
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <DepartmentSelect
                      departments={departments}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
              <FieldError message={form.formState.errors.department?.message} />
            </div>
          </CardContent>
        </Card>
      </ConfigScreen>
    </form>
  )
}
