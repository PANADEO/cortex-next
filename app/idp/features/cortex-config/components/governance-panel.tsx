"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useCoworkSkillCatalog } from "@/features/cortex-cowork"
import type { CoworkGovernanceConfig, CoworkRole, CoworkSkillGroup } from "@cortex/types"
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
  namedSetFormSchema,
  type AssignmentFormValues,
  type NamedSetFormValues,
} from "../schemas"
import { CheckboxList, FieldError } from "./form-fields"

// --- Named-set dialog (roles and skill groups share one form shape) ----------

interface NamedSetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  membersLabel: string
  memberOptions: Array<{ id: string; label: string; hint?: string }>
  emptyText: string
  /** Present when editing an existing entity. */
  initial?: NamedSetFormValues | undefined
  isSaving: boolean
  onSubmit: (values: NamedSetFormValues) => Promise<void>
}

const EMPTY_NAMED_SET: NamedSetFormValues = { id: "", name: "", description: "", memberIds: [] }

function NamedSetDialog({
  open,
  onOpenChange,
  title,
  membersLabel,
  memberOptions,
  emptyText,
  initial,
  isSaving,
  onSubmit,
}: NamedSetDialogProps) {
  const form = useForm<NamedSetFormValues>({
    resolver: zodResolver(namedSetFormSchema),
    defaultValues: initial ?? EMPTY_NAMED_SET,
  })

  useEffect(() => {
    if (!open) return
    form.reset(initial ?? EMPTY_NAMED_SET)
    // Reset only when the dialog opens or the edited entity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial])

  const submit = form.handleSubmit(async (values) => {
    await onSubmit(values)
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="named-set-id">Identyfikator</Label>
              <Input
                id="named-set-id"
                className="mt-1"
                disabled={Boolean(initial)}
                {...form.register("id")}
              />
              <FieldError message={form.formState.errors.id?.message} />
            </div>
            <div>
              <Label htmlFor="named-set-name">Nazwa</Label>
              <Input id="named-set-name" className="mt-1" {...form.register("name")} />
              <FieldError message={form.formState.errors.name?.message} />
            </div>
          </div>
          <div>
            <Label htmlFor="named-set-description">Opis</Label>
            <Input id="named-set-description" className="mt-1" {...form.register("description")} />
          </div>
          <div>
            <Label>{membersLabel}</Label>
            <div className="mt-2">
              <Controller
                control={form.control}
                name="memberIds"
                render={({ field }) => (
                  <CheckboxList
                    options={memberOptions}
                    value={field.value}
                    onChange={field.onChange}
                    emptyText={emptyText}
                  />
                )}
              />
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

// --- Assignment dialog ---------------------------------------------------------

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
  /** Present when editing an existing assignment. */
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

// --- Shared list row -------------------------------------------------------------

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

// --- Panel ----------------------------------------------------------------------

type DialogState =
  | { kind: "none" }
  | { kind: "group"; group?: CoworkSkillGroup }
  | { kind: "role"; role?: CoworkRole }
  | { kind: "assignment"; email?: string }

export function GovernancePanel() {
  const governance = useGovernanceConfig()
  const updateGovernance = useUpdateGovernance()
  const skillCatalog = useCoworkSkillCatalog()
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
  const skillOptions = (skillCatalog.data ?? []).map((skill) => ({
    id: skill.id,
    label: skill.name,
  }))
  const openMode = Object.keys(config.userAssignments).length === 0

  const saveGroups = (groups: CoworkSkillGroup[]) =>
    updateGovernance.mutateAsync({ skillGroups: groups })
  const saveRoles = (roles: CoworkRole[]) => updateGovernance.mutateAsync({ roles })
  const saveAssignments = (assignments: Record<string, string[]>) =>
    updateGovernance.mutateAsync({ userAssignments: assignments })

  const editedGroup = dialog.kind === "group" ? dialog.group : undefined
  const editedRole = dialog.kind === "role" ? dialog.role : undefined

  return (
    <div className="space-y-4">
      {openMode ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <strong>Tryb otwarty:</strong> nikt nie ma jeszcze przypisanej roli, więc każdy użytkownik
          widzi wszystkie kafelki i skille projektów. Governance włączy się przy pierwszym
          przypisaniu roli.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Grupy skilli</CardTitle>
                <CardDescription>Nazwane zestawy skilli przydzielane rolom</CardDescription>
              </div>
              <Button size="sm" onClick={() => setDialog({ kind: "group" })}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Grupa
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {config.skillGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak grup.</p>
            ) : (
              config.skillGroups.map((group) => (
                <EntityRow
                  key={group.id}
                  name={group.name}
                  badges={group.skillIds}
                  onEdit={() => setDialog({ kind: "group", group })}
                  onDelete={() =>
                    void saveGroups(config.skillGroups.filter((g) => g.id !== group.id))
                  }
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Role</CardTitle>
                <CardDescription>Role łączą grupy skilli z użytkownikami</CardDescription>
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
                  badges={role.skillGroupIds}
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

        <Card>
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

      <NamedSetDialog
        open={dialog.kind === "group"}
        onOpenChange={(open) => setDialog(open ? dialog : { kind: "none" })}
        title={editedGroup ? `Edytuj grupę: ${editedGroup.name}` : "Nowa grupa skilli"}
        membersLabel="Skille w grupie"
        memberOptions={skillOptions}
        emptyText="Katalog skilli jest pusty."
        initial={
          editedGroup
            ? {
                id: editedGroup.id,
                name: editedGroup.name,
                description: editedGroup.description ?? "",
                memberIds: editedGroup.skillIds,
              }
            : undefined
        }
        isSaving={updateGovernance.isPending}
        onSubmit={async (values) => {
          const next = config.skillGroups.filter((group) => group.id !== values.id)
          await saveGroups([
            ...next,
            {
              id: values.id,
              name: values.name,
              ...(values.description ? { description: values.description } : {}),
              skillIds: values.memberIds,
            },
          ])
        }}
      />
      <NamedSetDialog
        open={dialog.kind === "role"}
        onOpenChange={(open) => setDialog(open ? dialog : { kind: "none" })}
        title={editedRole ? `Edytuj rolę: ${editedRole.name}` : "Nowa rola"}
        membersLabel="Grupy skilli"
        memberOptions={config.skillGroups.map((group) => ({
          id: group.id,
          label: group.name,
          hint: `${group.skillIds.length} skilli`,
        }))}
        emptyText="Najpierw utwórz grupę skilli."
        initial={
          editedRole
            ? {
                id: editedRole.id,
                name: editedRole.name,
                description: editedRole.description ?? "",
                memberIds: editedRole.skillGroupIds,
              }
            : undefined
        }
        isSaving={updateGovernance.isPending}
        onSubmit={async (values) => {
          const next = config.roles.filter((role) => role.id !== values.id)
          await saveRoles([
            ...next,
            {
              id: values.id,
              name: values.name,
              ...(values.description ? { description: values.description } : {}),
              skillGroupIds: values.memberIds,
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
