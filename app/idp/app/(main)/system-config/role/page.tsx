"use client"

import {
  useAttachRoleOpenwebuiGroup,
  useCreateRole,
  useDeleteRole,
  useDetachRoleOpenwebuiGroup,
  useRoleOpenwebuiGroup,
  useRoles,
  useSyncRoleOpenwebuiGroup,
  useUpdateRole,
} from "@/features/system-config/hooks"
import type { RoleSummary } from "@/features/system-config/types"
import { apiErrorMessage } from "@/lib/i18n/api-error"
import { formatDateTime } from "@/lib/i18n/formats"
import { useLocaleStore } from "@/lib/i18n/locale-store"
import { toastApiError } from "@cortex/api"
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertTitle,
  Badge,
  Button,
  Combobox,
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
import { KeyRound, Link2, Pencil, Plus, RefreshCw, Trash2, Unlink } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation(["system-config", "common"])
  const rolesQuery = useRoles()
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
        toast.success(t("roles.toast.created", { name: created.name }))
      } else {
        const updated = await updateRole.mutateAsync({
          id: dialog.role.id,
          body: { name: form.name.trim(), description },
        })
        toast.success(t("roles.toast.saved", { name: updated.name }))
      }
      setDialog(null)
    } catch (error) {
      toastApiError(
        error,
        isCreating ? t("roles.errors.createFailed") : t("roles.errors.saveFailed"),
      )
    }
  }

  async function handleDelete() {
    if (!roleToDelete) return
    try {
      await deleteRole.mutateAsync(roleToDelete.id)
      toast.success(t("roles.toast.deleted", { name: roleToDelete.name }))
    } catch (error) {
      // apiErrorMessage, a nie toastApiError: odmowa niesie KLUCZ zdania —
      // rola systemowa albo ostatnia rola z dostępem do modułu.
      toast.error(apiErrorMessage(t, error, t("roles.errors.deleteFailed")))
    } finally {
      setRoleToDelete(null)
    }
  }

  return (
    <>
      <PageHeader
        title={t("roles.title")}
        description={t("roles.description")}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t("roles.add")}
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        {rolesQuery.isLoading ? (
          <LoadingState label={t("roles.loading")} />
        ) : rolesQuery.isError ? (
          <EmptyState
            icon={KeyRound}
            title={t("roles.loadFailedTitle")}
            description={t("shared.dbConnectionHint")}
          />
        ) : roles.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title={t("roles.emptyTitle")}
            description={t("roles.emptyDescription")}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">{t("roles.columnCode")}</th>
                  <th className="px-4 py-2 font-medium">{t("roles.columnName")}</th>
                  <th className="px-4 py-2 font-medium">{t("roles.columnDescription")}</th>
                  <th className="px-4 py-2 font-medium">{t("roles.columnType")}</th>
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
                        {role.isSystem ? t("roles.typeSystem") : t("roles.typeRegular")}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(role)}
                          aria-label={t("roles.editAria", { name: role.name })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={role.isSystem}
                          title={role.isSystem ? t("roles.systemProtectedTooltip") : undefined}
                          onClick={() => setRoleToDelete(role)}
                          aria-label={t("roles.deleteAria", { name: role.name })}
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
            <DialogTitle>
              {isCreating
                ? t("roles.createTitle")
                : t("roles.editTitle", { name: dialog?.role?.name ?? "" })}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="code">{t("roles.form.codeLabel")}</Label>
              <Input
                id="code"
                value={form.code}
                disabled={!isCreating}
                onChange={(event) => update("code", event.target.value)}
                placeholder={t("roles.form.codePlaceholder")}
              />
              <span className="text-xs text-muted-foreground">{t("shared.codeHint")}</span>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="name">{t("roles.form.nameLabel")}</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder={t("roles.form.namePlaceholder")}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="description">{t("roles.form.descriptionLabel")}</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
                placeholder={t("shared.optionalPlaceholder")}
              />
            </div>

            {/* Tylko przy edycji istniejącej roli — świeżo tworzona nie ma
                jeszcze `id`, po którym mapowanie się zapisuje. */}
            {!isCreating && dialog?.role ? (
              <div className="grid gap-1.5">
                <Label>{t("roles.openwebui.sectionLabel")}</Label>
                <OpenwebuiGroupSection role={dialog.role} />
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              {t("common:actions.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isCreating ? t("common:actions.create") : t("common:actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={roleToDelete !== null}
        onOpenChange={(open) => !open && setRoleToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("roles.deleteConfirmTitle", { name: roleToDelete?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("roles.deleteConfirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteRole.isPending}>
              {t("common:actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/**
 * Sekcja "Grupa OpenWebUI" (PROJECT/cortex-frontend-sync-uprawnien-openwebui-
 * projekt.md, D8 zaadaptowane pod Wariant A). Trzy stany: nieskonfigurowane
 * (funkcja wyłączona instancyjnie), skonfigurowane-bez-mapowania (podepnij),
 * zmapowane (status + "Synchronizuj teraz"/"Odepnij").
 */
function OpenwebuiGroupSection({ role }: { role: RoleSummary }) {
  const { t } = useTranslation(["system-config", "common"])
  const locale = useLocaleStore((s) => s.locale)
  const { data, isLoading } = useRoleOpenwebuiGroup(role.id)
  const attach = useAttachRoleOpenwebuiGroup()
  const detach = useDetachRoleOpenwebuiGroup()
  const sync = useSyncRoleOpenwebuiGroup()

  const [selectedGroupName, setSelectedGroupName] = useState("")
  const [confirmGroup, setConfirmGroup] = useState<{ id: string; name: string } | null>(null)

  async function handleCreate() {
    try {
      await attach.mutateAsync({ id: role.id, body: { action: "create" } })
      toast.success(t("roles.openwebui.toast.groupCreated", { name: role.name }))
    } catch (error) {
      toastApiError(error, t("roles.openwebui.errors.createFailed"))
    }
  }

  async function handleAttachExisting() {
    if (!confirmGroup) return
    try {
      await attach.mutateAsync({
        id: role.id,
        body: { action: "existing", groupId: confirmGroup.id },
      })
      toast.success(
        t("roles.openwebui.toast.attached", { group: confirmGroup.name, role: role.name }),
      )
      setSelectedGroupName("")
    } catch (error) {
      // Grupa już podpięta pod INNĄ rolę wraca z kluczem i kodem tamtej roli.
      toast.error(apiErrorMessage(t, error, t("roles.openwebui.errors.attachFailed")))
    } finally {
      setConfirmGroup(null)
    }
  }

  async function handleDetach() {
    try {
      await detach.mutateAsync(role.id)
      toast.success(t("roles.openwebui.toast.detached"))
    } catch (error) {
      toastApiError(error, t("roles.openwebui.errors.detachFailed"))
    }
  }

  async function handleSync() {
    try {
      const result = await sync.mutateAsync(role.id)
      if (result.openwebuiSync.status === "failed") {
        toast.error(
          t("roles.openwebui.errors.syncFailedWithReason", {
            reason: result.openwebuiSync.message ?? t("roles.openwebui.errors.unknownReason"),
          }),
        )
      } else {
        toast.success(t("roles.openwebui.toast.synced"))
      }
    } catch (error) {
      toastApiError(error, t("roles.openwebui.errors.syncFailed"))
    }
  }

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">{t("roles.openwebui.loading")}</p>
  }

  if (!data || !data.configured) {
    return <p className="text-xs text-muted-foreground">{t("roles.openwebui.notConfigured")}</p>
  }

  if (!data.mapping) {
    const groupOptions = data.availableGroups ?? []
    return (
      <div className="grid gap-2 rounded-md border border-dashed border-border p-3">
        <p className="text-xs text-muted-foreground">{t("roles.openwebui.notMapped")}</p>

        <Button size="sm" variant="outline" onClick={handleCreate} disabled={attach.isPending}>
          <Link2 className="mr-1.5 h-3.5 w-3.5" />
          {t("roles.openwebui.createGroup", { name: `cortex:${role.code}` })}
        </Button>

        {groupOptions.length > 0 ? (
          <div className="flex gap-2">
            <Combobox
              value={selectedGroupName}
              onChange={setSelectedGroupName}
              options={groupOptions.map((group) => group.name)}
              placeholder={t("roles.openwebui.attachExistingPlaceholder")}
              className="flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!selectedGroupName || attach.isPending}
              onClick={() => {
                const match = groupOptions.find((group) => group.name === selectedGroupName)
                if (match) setConfirmGroup(match)
              }}
            >
              {t("roles.openwebui.attach")}
            </Button>
          </div>
        ) : null}

        <AlertDialog
          open={confirmGroup !== null}
          onOpenChange={(open) => !open && setConfirmGroup(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("roles.openwebui.attachConfirmTitle", { name: confirmGroup?.name ?? "" })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("roles.openwebui.attachConfirmBody")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleAttachExisting}>
                {t("roles.openwebui.attach")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  const { mapping, preview } = data

  return (
    <div className="grid gap-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs">{mapping.groupName}</span>
        <Badge variant={mapping.lastSyncError ? "destructive" : "outline"}>
          {mapping.lastSyncedAt
            ? t("roles.openwebui.syncedAt", {
                date: formatDateTime(mapping.lastSyncedAt, locale),
              })
            : t("roles.openwebui.neverSynced")}
        </Badge>
      </div>

      {mapping.lastSyncError ? (
        <Alert variant="destructive">
          <AlertTitle>{t("roles.openwebui.lastSyncFailedTitle")}</AlertTitle>
          <AlertDescription>{mapping.lastSyncError}</AlertDescription>
        </Alert>
      ) : null}

      {preview?.status === "ok" ? (
        <p className="text-xs text-muted-foreground">
          {t("roles.openwebui.previewSummary", {
            toAdd: preview.toAdd,
            toRemove: preview.toRemove,
            target: preview.targetCount,
          })}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={handleSync} disabled={sync.isPending}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          {t("roles.openwebui.syncNow")}
        </Button>
        <Button size="sm" variant="ghost" onClick={handleDetach} disabled={detach.isPending}>
          <Unlink className="mr-1.5 h-3.5 w-3.5" />
          {t("roles.openwebui.detach")}
        </Button>
      </div>
    </div>
  )
}
