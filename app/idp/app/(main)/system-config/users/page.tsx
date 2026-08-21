"use client"

import {
  useCreateUser,
  useRoles,
  useSetUserRoles,
  useUpdateUser,
  useUsers,
} from "@/features/system-config/hooks"
import type { RoleSummary, UserWithRoles } from "@/features/system-config/types"
import { apiErrorMessage } from "@/lib/i18n/api-error"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  Label,
  LoadingState,
  PageHeader,
} from "@cortex/ui"
import { MoreHorizontal, Pencil, Plus, Power, PowerOff, UserCog, Users } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

interface NewUserForm {
  email: string
  fullName: string
}

const EMPTY_NEW_USER: NewUserForm = { email: "", fullName: "" }

export default function UsersPage() {
  const { t } = useTranslation(["system-config", "common"])
  const usersQuery = useUsers()
  const rolesQuery = useRoles()
  const setUserRoles = useSetUserRoles()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()

  const [edited, setEdited] = useState<UserWithRoles | null>(null)
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([])

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newUser, setNewUser] = useState<NewUserForm>(EMPTY_NEW_USER)

  const [editedDetails, setEditedDetails] = useState<UserWithRoles | null>(null)
  const [fullNameDraft, setFullNameDraft] = useState("")

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
      toast.success(t("users.toast.rolesSaved", { email: edited.email }))
      setEdited(null)
    } catch (error) {
      // Zapis odrzucony (np. 409 — ostatni użytkownik z dostępem do modułu):
      // role w bazie zostały po staremu, więc checkboxy też muszą wrócić.
      setSelectedRoleIds(edited.roles.map((role) => role.id))
      // apiErrorMessage, a nie toastApiError: odmowa samo-zablokowania niesie
      // KLUCZ zdania (która granica została naruszona), a ogólny zapas by go
      // nie odtworzył.
      toast.error(apiErrorMessage(t, error, t("users.errors.rolesSaveFailed")))
    }
  }

  function openCreateUser() {
    setNewUser(EMPTY_NEW_USER)
    setIsCreateOpen(true)
  }

  async function handleCreateUser() {
    try {
      const created = await createUser.mutateAsync({
        email: newUser.email.trim(),
        fullName: newUser.fullName.trim() || null,
      })
      toast.success(t("users.toast.created", { email: created.email }))
      setIsCreateOpen(false)
    } catch (error) {
      toastApiError(error, t("users.errors.createFailed"))
    }
  }

  function openEditDetails(user: UserWithRoles) {
    setFullNameDraft(user.fullName ?? "")
    setEditedDetails(user)
  }

  async function handleSaveDetails() {
    if (!editedDetails) return
    try {
      await updateUser.mutateAsync({
        id: editedDetails.id,
        body: { fullName: fullNameDraft.trim() || null },
      })
      toast.success(t("users.toast.detailsSaved", { email: editedDetails.email }))
      setEditedDetails(null)
    } catch (error) {
      toast.error(apiErrorMessage(t, error, t("users.errors.detailsSaveFailed")))
    }
  }

  // Dezaktywacja przechodzi przez assertModuleStaysReachable w serwisie —
  // odrzucenie (409 self-lockout) oznacza, że to ostatni aktywny użytkownik
  // z dostępem do Konfiguracji Systemu. Bez potwierdzenia: to ten sam poziom
  // ryzyka co "Zmień role", które też zapisuje od razu po kliknięciu.
  async function handleToggleActive(user: UserWithRoles) {
    try {
      await updateUser.mutateAsync({ id: user.id, body: { isActive: !user.isActive } })
      toast.success(
        user.isActive
          ? t("users.toast.deactivated", { email: user.email })
          : t("users.toast.activated", { email: user.email }),
      )
    } catch (error) {
      toast.error(
        apiErrorMessage(
          t,
          error,
          user.isActive ? t("users.errors.deactivateFailed") : t("users.errors.activateFailed"),
        ),
      )
    }
  }

  return (
    <>
      <PageHeader
        title={t("users.title")}
        description={t("users.description")}
        actions={
          <Button size="sm" onClick={openCreateUser}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t("users.add")}
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        {usersQuery.isLoading ? (
          <LoadingState label={t("users.loading")} />
        ) : usersQuery.isError ? (
          <EmptyState
            icon={Users}
            title={t("users.loadFailedTitle")}
            description={t("shared.dbConnectionHint")}
          />
        ) : users.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("users.emptyTitle")}
            description={t("users.emptyDescription")}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">{t("users.columnEmail")}</th>
                  <th className="px-4 py-2 font-medium">{t("users.columnFullName")}</th>
                  <th className="px-4 py-2 font-medium">{t("users.columnStatus")}</th>
                  <th className="px-4 py-2 font-medium">{t("users.columnRoles")}</th>
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
                        {user.isActive ? t("users.statusActive") : t("users.statusInactive")}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      {user.roles.length === 0 ? (
                        <span className="text-muted-foreground">{t("users.noRoles")}</span>
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
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openRoleDialog(user)}
                          title={t("users.changeRoles")}
                          aria-label={t("users.changeRolesAria", { email: user.email })}
                        >
                          <UserCog className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={t("users.moreActionsAria", { email: user.email })}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDetails(user)}>
                              <Pencil className="mr-1.5 h-3.5 w-3.5" />
                              {t("users.editDetails")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleActive(user)}>
                              {user.isActive ? (
                                <>
                                  <PowerOff className="mr-1.5 h-3.5 w-3.5" />
                                  {t("users.deactivate")}
                                </>
                              ) : (
                                <>
                                  <Power className="mr-1.5 h-3.5 w-3.5" />
                                  {t("users.activate")}
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("users.createTitle")}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid content-start gap-1.5">
              <Label htmlFor="new-user-email">{t("users.form.emailLabel")}</Label>
              <Input
                id="new-user-email"
                type="email"
                value={newUser.email}
                onChange={(event) =>
                  setNewUser((current) => ({ ...current, email: event.target.value }))
                }
                placeholder={t("users.form.emailPlaceholder")}
              />
              <span className="text-xs text-muted-foreground">{t("users.form.emailHint")}</span>
            </div>

            <div className="grid content-start gap-1.5">
              <Label htmlFor="new-user-name">{t("users.form.fullNameLabel")}</Label>
              <Input
                id="new-user-name"
                value={newUser.fullName}
                onChange={(event) =>
                  setNewUser((current) => ({ ...current, fullName: event.target.value }))
                }
                placeholder={t("shared.optionalPlaceholder")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              {t("common:actions.cancel")}
            </Button>
            <Button onClick={handleCreateUser} disabled={createUser.isPending}>
              {t("common:actions.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editedDetails !== null}
        onOpenChange={(open) => !open && setEditedDetails(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("users.editTitle", { email: editedDetails?.email ?? "" })}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid content-start gap-1.5">
              <Label htmlFor="edit-user-email">{t("users.form.emailLabel")}</Label>
              <Input id="edit-user-email" value={editedDetails?.email ?? ""} disabled />
              <span className="text-xs text-muted-foreground">
                {t("users.form.emailLockedHint")}
              </span>
            </div>

            <div className="grid content-start gap-1.5">
              <Label htmlFor="edit-user-name">{t("users.form.fullNameLabel")}</Label>
              <Input
                id="edit-user-name"
                value={fullNameDraft}
                onChange={(event) => setFullNameDraft(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditedDetails(null)}>
              {t("common:actions.cancel")}
            </Button>
            <Button onClick={handleSaveDetails} disabled={updateUser.isPending}>
              {t("common:actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={edited !== null} onOpenChange={(open) => !open && setEdited(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("users.rolesTitle", { email: edited?.email ?? "" })}</DialogTitle>
          </DialogHeader>

          {roles.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("users.noRolesDefined")}</p>
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
              {t("common:actions.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={setUserRoles.isPending}>
              {t("common:actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
