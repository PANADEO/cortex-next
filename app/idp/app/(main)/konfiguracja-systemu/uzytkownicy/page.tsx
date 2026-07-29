"use client"

import {
  useKonfiguracjaRoles,
  useKonfiguracjaUsers,
  useSetUserRoles,
} from "@/features/konfiguracja-systemu/hooks"
import type { RoleSummary, UserWithRoles } from "@/features/konfiguracja-systemu/types"
import { toastApiError } from "@cortex/api"
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Label,
  PageHeader,
} from "@cortex/ui"
import { UserCog, Users } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export default function UzytkownicyPage() {
  const usersQuery = useKonfiguracjaUsers()
  const rolesQuery = useKonfiguracjaRoles()
  const setUserRoles = useSetUserRoles()

  const [edited, setEdited] = useState<UserWithRoles | null>(null)
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([])

  const users = usersQuery.data ?? []
  const roles = rolesQuery.data ?? []

  function openRoleDialog(user: UserWithRoles) {
    setEdited(user)
    setSelectedRoleIds(user.roles.map((role) => role.id))
  }

  function toggleRole(roleId: string, checked: boolean) {
    setSelectedRoleIds((current) =>
      checked ? [...new Set([...current, roleId])] : current.filter((id) => id !== roleId),
    )
  }

  async function handleSave() {
    if (!edited) return
    try {
      await setUserRoles.mutateAsync({ id: edited.id, roleIds: selectedRoleIds })
      toast.success(`Zaktualizowano role użytkownika ${edited.email}`)
      setEdited(null)
    } catch (error) {
      toastApiError(error, "Nie udało się zapisać ról")
    }
  }

  return (
    <>
      <PageHeader
        title="Użytkownicy"
        description="Tożsamości i przypisane im role. Uprawnienia wynikają z ról, nie są nadawane bezpośrednio użytkownikowi."
      />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        {usersQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Wczytywanie użytkowników...</p>
        ) : usersQuery.isError ? (
          <EmptyState
            icon={Users}
            title="Nie udało się wczytać użytkowników"
            description="Sprawdź połączenie z bazą danych modułu Konfiguracja Systemu."
          />
        ) : users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Brak użytkowników"
            description="Użytkownicy pojawią się po pierwszym logowaniu albo po uruchomieniu seeda bootstrapowego."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">E-mail</th>
                  <th className="px-4 py-2 font-medium">Imię i nazwisko</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">{user.email}</td>
                    <td className="px-4 py-2 text-muted-foreground">{user.fullName ?? "-"}</td>
                    <td className="px-4 py-2">
                      <Badge variant={user.isActive ? "default" : "secondary"}>
                        {user.isActive ? "Aktywny" : "Nieaktywny"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      {user.roles.length === 0 ? (
                        <span className="text-muted-foreground">Brak ról</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role) => (
                            <Badge key={role.id} variant="outline">
                              {role.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => openRoleDialog(user)}>
                        <UserCog className="mr-1.5 h-3.5 w-3.5" />
                        Zmień role
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={edited !== null} onOpenChange={(open) => !open && setEdited(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Role użytkownika {edited?.email}</DialogTitle>
          </DialogHeader>

          {roles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nie zdefiniowano jeszcze żadnej roli.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {roles.map((role: RoleSummary) => (
                <div key={role.id} className="flex items-start gap-2">
                  <Checkbox
                    id={`role-${role.id}`}
                    checked={selectedRoleIds.includes(role.id)}
                    onCheckedChange={(checked) => toggleRole(role.id, checked === true)}
                  />
                  <div className="grid gap-0.5">
                    <Label htmlFor={`role-${role.id}`} className="cursor-pointer">
                      {role.name}
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      {role.description ?? role.code}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEdited(null)}>
              Anuluj
            </Button>
            <Button onClick={handleSave} disabled={setUserRoles.isPending}>
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
