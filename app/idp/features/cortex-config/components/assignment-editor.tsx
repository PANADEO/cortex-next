"use client"

import type { CoworkRole } from "@cortex/types"
import { Card, CardContent, Input, Label, LoadingState } from "@cortex/ui"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useGovernanceConfig, useUpdateGovernance } from "../hooks/use-governance"
import { assignmentFormSchema, type AssignmentFormValues } from "../schemas"
import { AccessDeniedState, ConfigScreen } from "./config-screen"
import { CheckboxList, FieldError } from "./form-fields"

const BACK_HREF = "/cortex-config/governance"

/** Full-screen editor for one user's role assignment (email -> roles). */
export function AssignmentEditorScreen({ email }: { email?: string | undefined }) {
  const { t } = useTranslation("cortex-config")
  const governance = useGovernanceConfig()
  const updateGovernance = useUpdateGovernance()
  const router = useRouter()

  if (governance.isPending) return <LoadingState label={t("state.loadingConfig")} />
  if (governance.isError) return <AccessDeniedState />

  const config = governance.data
  const currentRoleIds = email ? (config.userAssignments[email] ?? []) : []

  return (
    <AssignmentForm
      key={email ?? "new"}
      defaultValues={{ email: email ?? "", roleIds: currentRoleIds }}
      editing={Boolean(email)}
      roles={config.roles}
      isSaving={updateGovernance.isPending}
      onSubmit={async (values) => {
        await updateGovernance.mutateAsync({
          userAssignments: {
            ...config.userAssignments,
            [values.email.toLowerCase()]: values.roleIds,
          },
        })
        router.push(BACK_HREF)
      }}
    />
  )
}

function AssignmentForm({
  defaultValues,
  editing,
  roles,
  isSaving,
  onSubmit,
}: {
  defaultValues: AssignmentFormValues
  editing: boolean
  roles: CoworkRole[]
  isSaving: boolean
  onSubmit: (values: AssignmentFormValues) => Promise<void>
}) {
  const { t } = useTranslation(["cortex-config", "common"])
  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentFormSchema),
    defaultValues,
  })
  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values)
    } catch {
      // Rejected save (e.g. 400 from governance/route.ts validation): stay on
      // the page so the admin can fix it. The mutation's onError already
      // surfaced a toast with the reason - see useUpdateGovernance.
    }
  })

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <ConfigScreen
        backHref={BACK_HREF}
        backLabel={t("nav.backToGovernance")}
        title={
          editing
            ? t("assignmentEditor.editTitle", { email: defaultValues.email })
            : t("assignmentEditor.newTitle")
        }
        description={t("assignmentEditor.description")}
        save={{ isSaving, label: t("common:actions.save") }}
      >
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <Label htmlFor="assignment-email">{t("assignmentEditor.emailLabel")}</Label>
              <Input
                id="assignment-email"
                className="mt-1"
                disabled={editing}
                placeholder={t("assignmentEditor.emailPlaceholder")}
                {...form.register("email")}
              />
              <FieldError message={form.formState.errors.email?.message} />
            </div>
            <div>
              <Label>{t("assignmentEditor.rolesLabel")}</Label>
              <div className="mt-2">
                <Controller
                  control={form.control}
                  name="roleIds"
                  render={({ field }) => (
                    <CheckboxList
                      options={roles.map((role) => ({
                        id: role.id,
                        label: role.name,
                        hint: role.id,
                      }))}
                      value={field.value}
                      onChange={field.onChange}
                      emptyText={t("assignmentEditor.rolesEmpty")}
                    />
                  )}
                />
                <FieldError message={form.formState.errors.roleIds?.message} />
              </div>
            </div>
          </CardContent>
        </Card>
      </ConfigScreen>
    </form>
  )
}
