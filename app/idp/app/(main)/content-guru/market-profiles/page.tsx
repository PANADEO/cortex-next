"use client"

import { ContentGuruMarkdownPreview } from "@/features/content-guru/components/markdown-preview"
import {
  useCreateMarketProfile,
  useDeleteMarketProfile,
  useMyMarketProfiles,
  useUpdateMarketProfile,
} from "@/features/content-guru/hooks"
import type { MarketProfileDto } from "@/features/content-guru/types"
import { marketProfileToMarkdown } from "@/lib/content-guru/profile-markdown"
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
import { LineChart, Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

const NEW_PROFILE_SENTINEL = "__new__"

// Formularz trzyma WSZYSTKIE pola jako string (nigdy undefined) — mirror
// client-profiles/page.tsx (patrz komentarz tam dla pełnego uzasadnienia).
interface MarketProfileDraft {
  profileName: string
  description: string
  sizeTrends: string
  personas: string
  problems: string
  needs: string
  plans: string
}

const EMPTY_DRAFT: MarketProfileDraft = {
  profileName: "",
  description: "",
  sizeTrends: "",
  personas: "",
  problems: "",
  needs: "",
  plans: "",
}

export default function ContentGuruMarketProfilesPage() {
  const { t } = useTranslation(["content-guru", "common"])
  const profilesQuery = useMyMarketProfiles()
  const createProfile = useCreateMarketProfile()
  const updateProfile = useUpdateMarketProfile()
  const deleteProfile = useDeleteMarketProfile()

  const [editedId, setEditedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<MarketProfileDraft>(EMPTY_DRAFT)
  const [profileToDelete, setProfileToDelete] = useState<MarketProfileDto | null>(null)

  const profiles = profilesQuery.data ?? []
  const editorOpen = editedId !== null
  const isNew = editedId === NEW_PROFILE_SENTINEL

  // DOKŁADNIE ta sama funkcja, której POST /api/content-guru/generate używa
  // do zbudowania kontekstu rynku w system promptcie — patrz
  // app/idp/app/api/content-guru/generate/route.ts i profile-markdown.ts.
  const previewMarkdown = useMemo(
    () =>
      marketProfileToMarkdown({
        ...draft,
        profileName: draft.profileName || t("marketProfiles.unnamedProfile"),
      }),
    [draft, t],
  )

  function openNew() {
    setDraft(EMPTY_DRAFT)
    setEditedId(NEW_PROFILE_SENTINEL)
  }

  function openEdit(profile: MarketProfileDto) {
    setDraft({
      profileName: profile.profileName,
      description: profile.description ?? "",
      sizeTrends: profile.sizeTrends ?? "",
      personas: profile.personas ?? "",
      problems: profile.problems ?? "",
      needs: profile.needs ?? "",
      plans: profile.plans ?? "",
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
        toast.success(t("marketProfiles.toasts.created", { name: draft.profileName }))
      } else if (editedId) {
        await updateProfile.mutateAsync({ id: editedId, body: draft })
        toast.success(t("marketProfiles.toasts.saved"))
      }
      closeEditor()
    } catch (error) {
      toastApiError(error, t("marketProfiles.errors.saveFailed"))
    }
  }

  async function handleDelete() {
    if (!profileToDelete) return
    try {
      await deleteProfile.mutateAsync(profileToDelete.id)
      toast.success(t("marketProfiles.toasts.deleted", { name: profileToDelete.profileName }))
    } catch (error) {
      toastApiError(error, t("marketProfiles.errors.deleteFailed"))
    } finally {
      setProfileToDelete(null)
    }
  }

  const columns: ColumnDef<MarketProfileDto, unknown>[] = [
    { accessorKey: "profileName", header: t("marketProfiles.columns.name"), enableSorting: true },
    {
      accessorKey: "updatedAt",
      header: t("marketProfiles.columns.updatedAt"),
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
            aria-label={t("marketProfiles.a11y.edit", { name: row.original.profileName })}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setProfileToDelete(row.original)}
            aria-label={t("marketProfiles.a11y.delete", { name: row.original.profileName })}
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
        title={t("marketProfiles.title")}
        description={t("marketProfiles.description")}
        actions={
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t("marketProfiles.newButton")}
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        {profilesQuery.isLoading ? (
          <LoadingState label={t("marketProfiles.loading")} />
        ) : (
          <CortexDataGrid
            columns={columns}
            data={profiles}
            bordered
            searchable
            searchPlaceholder={t("marketProfiles.searchPlaceholder")}
            getRowId={(row) => row.id}
            emptyState={
              <EmptyState
                icon={LineChart}
                title={t("marketProfiles.empty.title")}
                description={t("marketProfiles.empty.description")}
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
                ? t("marketProfiles.dialog.newTitle")
                : t("marketProfiles.dialog.editTitle", { name: draft.profileName })}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="market-profile-name">{t("marketProfiles.form.name")}</Label>
                <Input
                  id="market-profile-name"
                  value={draft.profileName}
                  onChange={(event) => setDraft({ ...draft, profileName: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="market-profile-description">
                  {t("marketProfiles.form.description")}
                </Label>
                <Textarea
                  id="market-profile-description"
                  rows={3}
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="market-profile-size-trends">
                  {t("marketProfiles.form.sizeTrends")}
                </Label>
                <Textarea
                  id="market-profile-size-trends"
                  rows={3}
                  value={draft.sizeTrends}
                  onChange={(event) => setDraft({ ...draft, sizeTrends: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="market-profile-personas">{t("marketProfiles.form.personas")}</Label>
                <Textarea
                  id="market-profile-personas"
                  rows={3}
                  value={draft.personas}
                  onChange={(event) => setDraft({ ...draft, personas: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="market-profile-problems">{t("marketProfiles.form.problems")}</Label>
                <Textarea
                  id="market-profile-problems"
                  rows={3}
                  value={draft.problems}
                  onChange={(event) => setDraft({ ...draft, problems: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="market-profile-needs">{t("marketProfiles.form.needs")}</Label>
                <Textarea
                  id="market-profile-needs"
                  rows={3}
                  value={draft.needs}
                  onChange={(event) => setDraft({ ...draft, needs: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="market-profile-plans">{t("marketProfiles.form.plans")}</Label>
                <Textarea
                  id="market-profile-plans"
                  rows={3}
                  value={draft.plans}
                  onChange={(event) => setDraft({ ...draft, plans: event.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t("marketProfiles.previewLabel")}</Label>
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
              {t("marketProfiles.saveButton")}
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
              {t("marketProfiles.deleteDialog.title", { name: profileToDelete?.profileName ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("marketProfiles.deleteDialog.description")}
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
