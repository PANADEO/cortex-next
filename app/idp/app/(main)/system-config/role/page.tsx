"use client"

import {
  useCreateRole,
  useDeleteRole,
  useKonfiguracjaRoles,
  useUpdateRole,
} from "@/features/system-config/hooks"
import type { RoleSummary } from "@/features/system-config/types"
import { toastApiError } from "@cortex/api"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Label,
  LoadingState,
  PageHeader,
} from "@cortex/ui"
import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface RoleForm {
  code: string
  name: string
  description: string
}

const EMPTY_FORM: RoleForm = { code: "", name: "", description: "" }

/** `null` = zamknięty, `{ role: null }` = tworzenie, `{ role }` = edycja. Jeden
 *  dialog dla obu trybów — kod jest edytowalny wyłącznie przy tworzeniu. */
type DialogState = { role: RoleSummary | null } | null

export default function RolePage() {
  const rolesQuery = useKonfiguracjaRoles()
  const createRole = useCreateRole()
  const updateRole = useUpdateRole()
  const deleteRole = useDeleteRole()

  const [dialog, setDialog] = useState<DialogState>(null)
  const [form, setForm] = useState<RoleForm>(EMPTY_FORM)
  const [roleToDelete, setRoleToDelete] = useState<RoleSummary | null>(null)

  const roles = rolesQuery.data ?? []
  const isSaving = createRole.isPending || updateRole.isPending
  const isCreating = dialog !== null && dialog.role === null

  function openCreate() {
    setForm(EMPTY_FORM)
    setDialog({ role: null })
  }

  function openEdit(role: RoleSummary) {
    setForm({ code: role.code, name: role.name, description: role.description ?? "" })
    setDialog({ role })
  }

  function update<K extends keyof RoleForm>(key: K, value: RoleForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit() {
    if (!dialog) return
    const description = form.description.trim() || null

    try {
      if (dialog.role === null) {
        const created = await createRole.mutateAsync({
          code: form.code.trim(),
          name: form.name.trim(),
          description,
        })
        toast.success(`Dodano rolę ${created.name}`)
      } else {
        const updated = await updateRole.mutateAsync({
          id: dialog.role.id,
          body: { name: form.name.trim(), description },
        })
        toast.success(`Zapisano rolę ${updated.name}`)
      }
      setDialog(null)
    } catch (error) {
      toastApiError(error, isCreating ? "Nie udało się dodać roli" : "Nie udało się zapisać roli")
    }
  }

  async function handleDelete() {
    if (!roleToDelete) return
    try {
      await deleteRole.mutateAsync(roleToDelete.id)
      toast.success(`Usunięto rolę ${roleToDelete.name}`)
    } catch (error) {
      toastApiError(error, "Nie udało się usunąć roli")
    } finally {
      setRoleToDelete(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Role"
        description="Role są jedynym nośnikiem uprawnień. Rola systemowa jest chroniona przed usunięciem."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Dodaj rolę
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        {rolesQuery.isLoading ? (
          <LoadingState label="Wczytywanie ról…" />
        ) : rolesQuery.isError ? (
          <EmptyState
            icon={KeyRound}
            title="Nie udało się wczytać ról"
            description="Sprawdź połączenie z bazą danych modułu Konfiguracja Systemu."
          />
        ) : roles.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="Brak ról"
            description="Uruchom seed bootstrapowy, aby utworzyć rolę administratora."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Kod</th>
                  <th className="px-4 py-2 font-medium">Nazwa</th>
                  <th className="px-4 py-2 font-medium">Opis</th>
                  <th className="px-4 py-2 font-medium">Typ</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id} className="border-t border-border">
                    <td className="px-4 py-2 font-mono text-xs">{role.code}</td>
                    <td className="px-4 py-2 font-medium">{role.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{role.description ?? "-"}</td>
                    <td className="px-4 py-2">
                      <Badge variant={role.isSystem ? "default" : "outline"}>
                        {role.isSystem ? "Systemowa" : "Zwykła"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(role)}
                          aria-label={`Edytuj rolę ${role.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={role.isSystem}
                          title={
                            role.isSystem
                              ? "Rola systemowa jest chroniona przed usunięciem"
                              : undefined
                          }
                          onClick={() => setRoleToDelete(role)}
                          aria-label={`Usuń rolę ${role.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isCreating ? "Nowa rola" : `Edytuj rolę ${dialog?.role?.name ?? ""}`}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="code">Kod</Label>
              <Input
                id="code"
                value={form.code}
                disabled={!isCreating}
                onChange={(event) => update("code", event.target.value)}
                placeholder="np. marketing"
              />
              <span className="text-xs text-muted-foreground">
                Małe litery, cyfry i myślnik. Po utworzeniu nie da się zmienić.
              </span>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="name">Nazwa</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder="np. Marketing"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="description">Opis</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
                placeholder="opcjonalnie"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Anuluj
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isCreating ? "Utwórz" : "Zapisz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={roleToDelete !== null} onOpenChange={(open) => !open && setRoleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć rolę {roleToDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Razem z rolą znikną wszystkie jej granty do aplikacji i zakresów oraz wszystkie
              przypisania użytkowników do niej. Tej operacji nie da się cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteRole.isPending}>
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
