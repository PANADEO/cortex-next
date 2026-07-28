"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import type { CoworkRole } from "@cortex/types"
import { Card, CardContent, Input, Label, LoadingState } from "@cortex/ui"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { useGovernanceConfig, useUpdateGovernance } from "../hooks/use-governance"
import { assignmentFormSchema, type AssignmentFormValues } from "../schemas"
import { AccessDeniedState, ConfigScreen } from "./config-screen"
import { CheckboxList, FieldError } from "./form-fields"

const BACK_HREF = "/cortex-config/governance"

/** Full-screen editor for one user's role assignment (email -> roles). */
export function AssignmentEditorScreen({ email }: { email?: string | undefined }) {
  const governance = useGovernanceConfig()
  const updateGovernance = useUpdateGovernance()
  const router = useRouter()

  if (governance.isPending) return <LoadingState label="Wczytywanie konfiguracji..." />
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
        backLabel="Role i dostęp"
        title={editing ? `Role użytkownika: ${defaultValues.email}` : "Przypisz role"}
        description="Centralne przypisanie email → role; pierwsze przypisanie wyłącza tryb otwarty."
        save={{ isSaving, label: "Zapisz" }}
      >
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <Label htmlFor="assignment-email">Email użytkownika</Label>
              <Input
                id="assignment-email"
                className="mt-1"
                disabled={editing}
                placeholder="user@firma.pl"
                {...form.register("email")}
              />
              <FieldError message={form.formState.errors.email?.message} />
            </div>
            <div>
              <Label>Role</Label>
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
                      emptyText="Najpierw utwórz rolę."
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
