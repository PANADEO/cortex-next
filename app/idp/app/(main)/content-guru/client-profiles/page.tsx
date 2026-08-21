"use client"

import { ContentGuruMarkdownPreview } from "@/features/content-guru/components/markdown-preview"
import {
  useCreateClientProfile,
  useDeleteClientProfile,
  useMyClientProfiles,
  useUpdateClientProfile,
} from "@/features/content-guru/hooks"
import type { ClientProfileDto } from "@/features/content-guru/types"
import { clientProfileToMarkdown } from "@/lib/content-guru/profile-markdown"
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
  Button,
  Card,
  CardContent,
  CortexDataGrid,
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
  Textarea,
} from "@cortex/ui"
import { formatAbsolute } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import { Building2, Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

const NEW_PROFILE_SENTINEL = "__new__"

// Formularz trzyma WSZYSTKIE pola jako string (nigdy undefined) — inaczej
// kontrolowane Textarea dostawałyby `value={undefined}` w typach (ClientProfileInputDto
// ma je opcjonalne, bo tam undefined=pomiń pole). Strukturalnie zgodne z
// ClientProfileInputDto przy wysyłce (string jest przypisywalny do string|undefined).
interface ClientProfileDraft {
  profileName: string
  history: string
  description: string
  products: string
  offer: string
  useCases: string
  experience: string
}

const EMPTY_DRAFT: ClientProfileDraft = {
  profileName: "",
  history: "",
  description: "",
  products: "",
  offer: "",
  useCases: "",
  experience: "",
}

export default function ContentGuruClientProfilesPage() {
  const { t } = useTranslation(["content-guru", "common"])
  const profilesQuery = useMyClientProfiles()
  const createProfile = useCreateClientProfile()
  const updateProfile = useUpdateClientProfile()
  const deleteProfile = useDeleteClientProfile()

  const [editedId, setEditedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ClientProfileDraft>(EMPTY_DRAFT)
  const [profileToDelete, setProfileToDelete] = useState<ClientProfileDto | null>(null)

  const profiles = profilesQuery.data ?? []
  const editorOpen = editedId !== null
  const isNew = editedId === NEW_PROFILE_SENTINEL

  // DOKŁADNIE ta sama funkcja, której POST /api/content-guru/generate używa
  // do zbudowania kontekstu klienta w system promptcie (design doc §4.3:
  // podgląd musi być "prowably identical", nie druga, ręcznie napisana
  // aproksymacja) — patrz app/idp/app/api/content-guru/generate/route.ts.
  const previewMarkdown = useMemo(
    () =>
      clientProfileToMarkdown({
        ...draft,
        profileName: draft.profileName || t("clientProfiles.unnamedProfile"),
      }),
    [draft, t],
  )

  function openNew() {
    setDraft(EMPTY_DRAFT)
    setEditedId(NEW_PROFILE_SENTINEL)
  }

  function openEdit(profile: ClientProfileDto) {
    setDraft({
      profileName: profile.profileName,
      history: profile.history ?? "",
      description: profile.description ?? "",
      products: profile.products ?? "",
      offer: profile.offer ?? "",
      useCases: profile.useCases ?? "",
      experience: profile.experience ?? "",
    })
    setEditedId(profile.id)
  }

  function closeEditor() {
    setEditedId(null)
  }

  async function handleSave() {
    try {
      if (isNew) {
        await createProfile.mutateAsync(draft)
        toast.success(t("clientProfiles.toasts.created", { name: draft.profileName }))
      } else if (editedId) {
        await updateProfile.mutateAsync({ id: editedId, body: draft })
        toast.success(t("clientProfiles.toasts.saved"))
      }
      closeEditor()
    } catch (error) {
      toastApiError(error, t("clientProfiles.errors.saveFailed"))
    }
  }

  async function handleDelete() {
    if (!profileToDelete) return
    try {
      await deleteProfile.mutateAsync(profileToDelete.id)
      toast.success(t("clientProfiles.toasts.deleted", { name: profileToDelete.profileName }))
    } catch (error) {
      toastApiError(error, t("clientProfiles.errors.deleteFailed"))
    } finally {
      setProfileToDelete(null)
    }
  }

  const columns: ColumnDef<ClientProfileDto, unknown>[] = [
    { accessorKey: "profileName", header: t("clientProfiles.columns.name"), enableSorting: true },
    {
      accessorKey: "updatedAt",
      header: t("clientProfiles.columns.updatedAt"),
      enableSorting: true,
      cell: ({ row }) => formatAbsolute(row.original.updatedAt),
    },
    {
      id: "actions",
      header: () => null,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => openEdit(row.original)}
            aria-label={t("clientProfiles.a11y.edit", { name: row.original.profileName })}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setProfileToDelete(row.original)}
            aria-label={t("clientProfiles.a11y.delete", { name: row.original.profileName })}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={t("clientProfiles.title")}
        description={t("clientProfiles.description")}
        actions={
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t("clientProfiles.newButton")}
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        {profilesQuery.isLoading ? (
          <LoadingState label={t("clientProfiles.loading")} />
        ) : (
          <CortexDataGrid
            columns={columns}
            data={profiles}
            bordered
            searchable
            searchPlaceholder={t("clientProfiles.searchPlaceholder")}
            getRowId={(row) => row.id}
            emptyState={
              <EmptyState
                icon={Building2}
                title={t("clientProfiles.empty.title")}
                description={t("clientProfiles.empty.description")}
              />
            }
          />
        )}
      </div>

      <Dialog open={editorOpen} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {isNew
                ? t("clientProfiles.dialog.newTitle")
                : t("clientProfiles.dialog.editTitle", { name: draft.profileName })}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="client-profile-name">{t("clientProfiles.form.name")}</Label>
                <Input
                  id="client-profile-name"
                  value={draft.profileName}
                  onChange={(event) => setDraft({ ...draft, profileName: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="client-profile-history">{t("clientProfiles.form.history")}</Label>
                <Textarea
                  id="client-profile-history"
                  rows={3}
                  value={draft.history}
                  onChange={(event) => setDraft({ ...draft, history: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="client-profile-description">
                  {t("clientProfiles.form.description")}
                </Label>
                <Textarea
                  id="client-profile-description"
                  rows={3}
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="client-profile-products">{t("clientProfiles.form.products")}</Label>
                <Textarea
                  id="client-profile-products"
                  rows={3}
                  value={draft.products}
                  onChange={(event) => setDraft({ ...draft, products: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="client-profile-offer">{t("clientProfiles.form.offer")}</Label>
                <Textarea
                  id="client-profile-offer"
                  rows={3}
                  value={draft.offer}
                  onChange={(event) => setDraft({ ...draft, offer: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="client-profile-use-cases">
                  {t("clientProfiles.form.useCases")}
                </Label>
                <Textarea
                  id="client-profile-use-cases"
                  rows={3}
                  value={draft.useCases}
                  onChange={(event) => setDraft({ ...draft, useCases: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="client-profile-experience">
                  {t("clientProfiles.form.experience")}
                </Label>
                <Textarea
                  id="client-profile-experience"
                  rows={3}
                  value={draft.experience}
                  onChange={(event) => setDraft({ ...draft, experience: event.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t("clientProfiles.previewLabel")}</Label>
              <Card className="flex-1">
                <CardContent className="pt-6">
                  <ContentGuruMarkdownPreview content={previewMarkdown} />
                </CardContent>
              </Card>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditor}>
              {t("common:actions.cancel")}
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !draft.profileName.trim() || createProfile.isPending || updateProfile.isPending
              }
            >
              {t("clientProfiles.saveButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={profileToDelete !== null}
        onOpenChange={(open) => !open && setProfileToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("clientProfiles.deleteDialog.title", { name: profileToDelete?.profileName ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("clientProfiles.deleteDialog.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteProfile.isPending}>
              {t("common:actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
