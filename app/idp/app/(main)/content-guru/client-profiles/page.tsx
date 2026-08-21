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
        profileName: draft.profileName || "(nienazwany profil)",
      }),
    [draft],
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
        toast.success(`Utworzono profil "${draft.profileName}"`)
      } else if (editedId) {
        await updateProfile.mutateAsync({ id: editedId, body: draft })
        toast.success("Zapisano zmiany w profilu")
      }
      closeEditor()
    } catch (error) {
      toastApiError(error, "Nie udało się zapisać profilu klienta")
    }
  }

  async function handleDelete() {
    if (!profileToDelete) return
    try {
      await deleteProfile.mutateAsync(profileToDelete.id)
      toast.success(`Usunięto profil "${profileToDelete.profileName}"`)
    } catch (error) {
      toastApiError(error, "Nie udało się usunąć profilu")
    } finally {
      setProfileToDelete(null)
    }
  }

  const columns: ColumnDef<ClientProfileDto, unknown>[] = [
    { accessorKey: "profileName", header: "Nazwa profilu", enableSorting: true },
    {
      accessorKey: "updatedAt",
      header: "Data edycji",
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
            aria-label={`Edytuj profil ${row.original.profileName}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setProfileToDelete(row.original)}
            aria-label={`Usuń profil ${row.original.profileName}`}
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
        title="Profile klienta"
        description="Kontekst klienta wstrzykiwany do promptu przy generowaniu — widoczny wyłącznie dla Ciebie."
        actions={
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nowy profil
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-4 px-8 py-6">
        {profilesQuery.isLoading ? (
          <LoadingState label="Wczytywanie profili…" />
        ) : (
          <CortexDataGrid
            columns={columns}
            data={profiles}
            bordered
            searchable
            searchPlaceholder="Szukaj po nazwie…"
            getRowId={(row) => row.id}
            emptyState={
              <EmptyState
                icon={Building2}
                title="Brak profili klienta"
                description="Dodaj pierwszy profil, żeby móc go wybrać na ekranie generowania."
              />
            }
          />
        )}
      </div>

      <Dialog open={editorOpen} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {isNew ? "Nowy profil klienta" : `Edycja: ${draft.profileName}`}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="client-profile-name">Nazwa profilu</Label>
                <Input
                  id="client-profile-name"
                  value={draft.profileName}
                  onChange={(event) => setDraft({ ...draft, profileName: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="client-profile-history">Historia</Label>
                <Textarea
                  id="client-profile-history"
                  rows={3}
                  value={draft.history}
                  onChange={(event) => setDraft({ ...draft, history: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="client-profile-description">Opis</Label>
                <Textarea
                  id="client-profile-description"
                  rows={3}
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="client-profile-products">Produkty</Label>
                <Textarea
                  id="client-profile-products"
                  rows={3}
                  value={draft.products}
                  onChange={(event) => setDraft({ ...draft, products: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="client-profile-offer">Oferta</Label>
                <Textarea
                  id="client-profile-offer"
                  rows={3}
                  value={draft.offer}
                  onChange={(event) => setDraft({ ...draft, offer: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="client-profile-use-cases">Przypadki użycia</Label>
                <Textarea
                  id="client-profile-use-cases"
                  rows={3}
                  value={draft.useCases}
                  onChange={(event) => setDraft({ ...draft, useCases: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="client-profile-experience">Doświadczenie</Label>
                <Textarea
                  id="client-profile-experience"
                  rows={3}
                  value={draft.experience}
                  onChange={(event) => setDraft({ ...draft, experience: event.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Podgląd — dokładnie to, co trafia do promptu</Label>
              <Card className="flex-1">
                <CardContent className="pt-6">
                  <ContentGuruMarkdownPreview content={previewMarkdown} />
                </CardContent>
              </Card>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditor}>
              Anuluj
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !draft.profileName.trim() || createProfile.isPending || updateProfile.isPending
              }
            >
              Zapisz profil
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
            <AlertDialogTitle>Usunąć profil {profileToDelete?.profileName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Treści wygenerowane z jego użyciem w przeszłości zostają w archiwum bez zmian. Tej
              operacji nie da się cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteProfile.isPending}>
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
