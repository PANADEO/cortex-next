"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import type { CoworkGovernanceConfig, CoworkRole } from "@cortex/types"
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
} from "@cortex/ui"
import { Loader2, Pencil, Plus, ShieldCheck, Trash2, UserPlus } from "lucide-react"
import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { useGovernanceConfig, useUpdateGovernance } from "../hooks/use-governance"
import {
  assignmentFormSchema,
  roleFormSchema,
  type AssignmentFormValues,
  type RoleFormValues,
} from "../schemas"
import { CheckboxList, FieldError } from "./form-fields"

// --- Role dialog (role = pure access gate: id, name, description) -------------

const EMPTY_ROLE: RoleFormValues = { id: "", name: "", description: "" }

function RoleDialog({
  open,
  onOpenChange,
  role,
  isSaving,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  role?: CoworkRole | undefined
  isSaving: boolean
  onSubmit: (values: RoleFormValues) => Promise<void>
}) {
  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: role ?? EMPTY_ROLE,
  })

  useEffect(() => {
    if (!open) return
    form.reset(role ?? EMPTY_ROLE)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, role])

  const submit = form.handleSubmit(async (values) => {
    await onSubmit(values)
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{role ? `Edytuj rolę: ${role.name}` : "Nowa rola"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="role-id">Identyfikator</Label>
              <Input id="role-id" className="mt-1" disabled={Boolean(role)} {...form.register("id")} />
              <FieldError message={form.formState.errors.id?.message} />
            </div>
            <div>
              <Label htmlFor="role-name">Nazwa</Label>
              <Input id="role-name" className="mt-1" {...form.register("name")} />
              <FieldError message={form.formState.errors.name?.message} />
            </div>
          </div>
          <div>
            <Label htmlFor="role-description">Opis</Label>
            <Input id="role-description" className="mt-1" {...form.register("description")} />
          </div>
          <p className="text-xs text-muted-foreground">
            Rola to bramka dostępu - decyduje, kto widzi i otwiera kafelki. Zawartość (skille,
            konektory) definiuje kompozycja projektu.
          </p>
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

// --- Assignment dialog --------------------------------------------------------

function AssignmentDialog({
  open,
  onOpenChange,
  email,
  currentRoleIds,
  roles,
  isSaving,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  email?: string | undefined
  currentRoleIds: string[]
  roles: CoworkRole[]
  isSaving: boolean
  onSubmit: (values: AssignmentFormValues) => Promise<void>
}) {
  const form = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentFormSchema),
    defaultValues: { email: email ?? "", roleIds: currentRoleIds },
  })

  useEffect(() => {
    if (!open) return
    form.reset({ email: email ?? "", roleIds: currentRoleIds })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, email])

  const submit = form.handleSubmit(async (values) => {
    await onSubmit(values)
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{email ? `Role użytkownika: ${email}` : "Przypisz role"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="assignment-email">Email użytkownika</Label>
            <Input
              id="assignment-email"
              className="mt-1"
              disabled={Boolean(email)}
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
                    options={roles.map((role) => ({ id: role.id, label: role.name, hint: role.id }))}
                    value={field.value}
                    onChange={field.onChange}
                    emptyText="Najpierw utwórz rolę."
                  />
                )}
              />
              <FieldError message={form.formState.errors.roleIds?.message} />
            </div>
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

function EntityRow({
  name,
  badges,
  onEdit,
  onDelete,
}: {
  name: string
  badges: string[]
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded-md border p-2 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium">{name}</span>
        {badges.map((badge) => (
          <Badge key={badge} variant="secondary">
            {badge}
          </Badge>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

type DialogState =
  | { kind: "none" }
  | { kind: "role"; role?: CoworkRole }
  | { kind: "assignment"; email?: string }

export function GovernancePanel() {
  const governance = useGovernanceConfig()
  const updateGovernance = useUpdateGovernance()
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" })
  const [adminInput, setAdminInput] = useState("")

  if (governance.isPending) return <LoadingState label="Wczytywanie konfiguracji..." />
  if (governance.isError) {
    return (
      <ErrorState
        title="Brak dostępu do konfiguracji"
        message="Panel Cortex Config wymaga uprawnień administratora."
      />
    )
  }

  const config: CoworkGovernanceConfig = governance.data
  const openMode = Object.keys(config.userAssignments).length === 0

  const saveRoles = (roles: CoworkRole[]) => updateGovernance.mutateAsync({ roles })
  const saveAssignments = (assignments: Record<string, string[]>) =>
    updateGovernance.mutateAsync({ userAssignments: assignments })

  const editedRole = dialog.kind === "role" ? dialog.role : undefined

  return (
    <div className="space-y-4">
      {openMode ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <strong>Tryb otwarty:</strong> nikt nie ma jeszcze przypisanej roli, więc każdy użytkownik
          widzi wszystkie kafelki. Governance włączy się przy pierwszym przypisaniu roli.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Role (bramki dostępu)</CardTitle>
                <CardDescription>Kto może otwierać kafelki projektów</CardDescription>
              </div>
              <Button size="sm" onClick={() => setDialog({ kind: "role" })}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Rola
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {config.roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak ról.</p>
            ) : (
              config.roles.map((role) => (
                <EntityRow
                  key={role.id}
                  name={role.name}
                  badges={[role.id]}
                  onEdit={() => setDialog({ kind: "role", role })}
                  onDelete={() => void saveRoles(config.roles.filter((r) => r.id !== role.id))}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Użytkownicy</CardTitle>
                <CardDescription>Przypisania email → role (centralne)</CardDescription>
              </div>
              <Button size="sm" onClick={() => setDialog({ kind: "assignment" })}>
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                Przypisz
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(config.userAssignments).length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak przypisań (tryb otwarty).</p>
            ) : (
              Object.entries(config.userAssignments).map(([email, roleIds]) => (
                <EntityRow
                  key={email}
                  name={email}
                  badges={roleIds}
                  onEdit={() => setDialog({ kind: "assignment", email })}
                  onDelete={() => {
                    const next = { ...config.userAssignments }
                    delete next[email]
                    void saveAssignments(next)
                  }}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <div>
              <CardTitle className="text-base">Administratorzy</CardTitle>
              <CardDescription>
                Kto może otwierać ten panel. Pusta lista = każdy zalogowany (tryb bootstrap).
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {config.adminEmails.length === 0 ? (
                <Badge variant="outline">
                  <ShieldCheck className="mr-1 h-3 w-3" />
                  tryb bootstrap
                </Badge>
              ) : (
                config.adminEmails.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1">
                    {email}
                    <button
                      type="button"
                      className="ml-1 text-muted-foreground hover:text-destructive"
                      aria-label={`Usuń administratora ${email}`}
                      onClick={() =>
                        void updateGovernance.mutateAsync({
                          adminEmails: config.adminEmails.filter((admin) => admin !== email),
                        })
                      }
                    >
                      ×
                    </button>
                  </Badge>
                ))
              )}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                const email = adminInput.trim().toLowerCase()
                if (!email || config.adminEmails.includes(email)) return
                void updateGovernance
                  .mutateAsync({ adminEmails: [...config.adminEmails, email] })
                  .then(() => setAdminInput(""))
              }}
            >
              <Input
                value={adminInput}
                onChange={(event) => setAdminInput(event.target.value)}
                placeholder="admin@firma.pl"
                type="email"
              />
              <Button type="submit" variant="outline" disabled={updateGovernance.isPending}>
                Dodaj
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <RoleDialog
        open={dialog.kind === "role"}
        onOpenChange={(open) => setDialog(open ? dialog : { kind: "none" })}
        role={editedRole}
        isSaving={updateGovernance.isPending}
        onSubmit={async (values) => {
          const next = config.roles.filter((role) => role.id !== values.id)
          await saveRoles([
            ...next,
            {
              id: values.id,
              name: values.name,
              ...(values.description ? { description: values.description } : {}),
            },
          ])
        }}
      />
      <AssignmentDialog
        open={dialog.kind === "assignment"}
        onOpenChange={(open) => setDialog(open ? dialog : { kind: "none" })}
        email={dialog.kind === "assignment" ? dialog.email : undefined}
        currentRoleIds={
          dialog.kind === "assignment" && dialog.email
            ? (config.userAssignments[dialog.email] ?? [])
            : []
        }
        roles={config.roles}
        isSaving={updateGovernance.isPending}
        onSubmit={async (values) => {
          await saveAssignments({
            ...config.userAssignments,
            [values.email.toLowerCase()]: values.roleIds,
          })
        }}
      />
    </div>
  )
}
