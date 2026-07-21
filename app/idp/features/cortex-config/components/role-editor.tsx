"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, ErrorState, Input, Label, LoadingState } from "@cortex/ui"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { useGovernanceConfig, useUpdateGovernance } from "../hooks/use-governance"
import { roleFormSchema, type RoleFormValues } from "../schemas"
import { AccessDeniedState, ConfigScreen } from "./config-screen"
import { FieldError } from "./form-fields"

const BACK_HREF = "/cortex-config/governance"

/** Full-screen editor for one access-gate role. */
export function RoleEditorScreen({ roleId }: { roleId?: string | undefined }) {
  const governance = useGovernanceConfig()
  const updateGovernance = useUpdateGovernance()
  const router = useRouter()

  if (governance.isPending) return <LoadingState label="Wczytywanie konfiguracji..." />
  if (governance.isError) return <AccessDeniedState />

  const roles = governance.data.roles
  const role = roleId ? roles.find((r) => r.id === roleId) : undefined
  if (roleId && !role) {
    return <ErrorState title="Nie znaleziono roli" message={`Brak roli "${roleId}".`} />
  }

  return (
    <RoleForm
      key={role?.id ?? "new"}
      defaultValues={{ id: role?.id ?? "", name: role?.name ?? "", description: role?.description ?? "" }}
      editing={Boolean(role)}
      isSaving={updateGovernance.isPending}
      onSubmit={async (values) => {
        const next = roles.filter((r) => r.id !== values.id)
        await updateGovernance.mutateAsync({
          roles: [
            ...next,
            {
              id: values.id,
              name: values.name,
              ...(values.description ? { description: values.description } : {}),
            },
          ],
        })
        router.push(BACK_HREF)
      }}
    />
  )
}

function RoleForm({
  defaultValues,
  editing,
  isSaving,
  onSubmit,
}: {
  defaultValues: RoleFormValues
  editing: boolean
  isSaving: boolean
  onSubmit: (values: RoleFormValues) => Promise<void>
}) {
  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues,
  })
  const submit = form.handleSubmit(onSubmit)

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <ConfigScreen
        backHref={BACK_HREF}
        backLabel="Role i dostęp"
        title={editing ? `Edytuj rolę: ${defaultValues.name}` : "Nowa rola"}
        description="Rola to bramka dostępu - decyduje, kto widzi i otwiera kafelki. Zawartość definiują klocki projektu."
        save={{ isSaving, label: "Zapisz" }}
      >
        <Card>
          <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2">
            <div>
              <Label htmlFor="role-id">Identyfikator</Label>
              <Input id="role-id" className="mt-1" disabled={editing} {...form.register("id")} />
              <FieldError message={form.formState.errors.id?.message} />
            </div>
            <div>
              <Label htmlFor="role-name">Nazwa</Label>
              <Input id="role-name" className="mt-1" {...form.register("name")} />
              <FieldError message={form.formState.errors.name?.message} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="role-description">Opis</Label>
              <Input id="role-description" className="mt-1" {...form.register("description")} />
            </div>
          </CardContent>
        </Card>
      </ConfigScreen>
    </form>
  )
}
