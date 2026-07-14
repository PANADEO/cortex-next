"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import type { CoworkRole } from "@cortex/types"
import { Button, Card, CardContent, ErrorState, Input, Label, LoadingState } from "@cortex/ui"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { useGovernanceConfig, useUpdateGovernance } from "../hooks/use-governance"
import { assignmentFormSchema, type AssignmentFormValues } from "../schemas"
import { ConfigScreen } from "./config-screen"
import { CheckboxList, FieldError } from "./form-fields"

const BACK_HREF = "/cortex-config/governance"

/** Full-screen editor for one user's role assignment (email -> roles). */
export function AssignmentEditorScreen({ email }: { email?: string | undefined }) {
  const governance = useGovernanceConfig()
  const updateGovernance = useUpdateGovernance()
  const router = useRouter()

  if (governance.isPending) return <LoadingState label="Wczytywanie konfiguracji..." />
  if (governance.isError) {
    return (
      <ErrorState
        title="Brak dostępu do konfiguracji"
        message="Panel Cortex Config wymaga uprawnień administratora."
      />
    )
  }

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
  const submit = form.handleSubmit(onSubmit)

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <ConfigScreen
        backHref={BACK_HREF}
        backLabel="Role i dostęp"
        title={editing ? `Role użytkownika: ${defaultValues.email}` : "Przypisz role"}
        description="Centralne przypisanie email → role; pierwsze przypisanie wyłącza tryb otwarty."
        actions={
          <>
            <Button asChild type="button" variant="outline">
              <Link href={BACK_HREF}>Anuluj</Link>
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Zapisz
            </Button>
          </>
        }
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
