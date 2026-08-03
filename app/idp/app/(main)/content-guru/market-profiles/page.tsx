"use client"

import { toastApiError } from "@cortex/api"
import { formatAbsolute } from "@cortex/utils"
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
import type { ColumnDef } from "@tanstack/react-table"
import { LineChart, Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ContentGuruMarkdownPreview } from "@/features/content-guru/components/markdown-preview"
import {
  useCreateMarketProfile,
  useDeleteMarketProfile,
  useMyMarketProfiles,
  useUpdateMarketProfile,
} from "@/features/content-guru/hooks"
import type { MarketProfileDto } from "@/features/content-guru/types"
import { marketProfileToMarkdown } from "@/lib/content-guru/profile-markdown"

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
      marketProfileToMarkdown({ ...draft, profileName: draft.profileName || "(nienazwany profil)" }),
    [draft],
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
        toast.success(`Utworzono profil "${draft.profileName}"`)
      } else if (editedId) {
        await updateProfile.mutateAsync({ id: editedId, body: draft })
        toast.success("Zapisano zmiany w profilu")
      }
      closeEditor()
    } catch (error) {
      toastApiError(error, "Nie udało się zapisać profilu rynku")
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

  const columns: ColumnDef<MarketProfileDto, unknown>[] = [
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
        title="Profile rynku"
        description="Kontekst rynku wstrzykiwany do promptu przy generowaniu — widoczny wyłącznie dla Ciebie."
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
                icon={LineChart}
                title="Brak profili rynku"
                description="Dodaj pierwszy profil, żeby móc go wybrać na ekranie generowania."
              />
            }
          />
        )}
      </div>

      <Dialog open={editorOpen} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{isNew ? "Nowy profil rynku" : `Edycja: ${draft.profileName}`}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="market-profile-name">Nazwa profilu</Label>
                <Input
                  id="market-profile-name"
                  value={draft.profileName}
                  onChange={(event) => setDraft({ ...draft, profileName: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="market-profile-description">Opis</Label>
                <Textarea
                  id="market-profile-description"
                  rows={3}
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="market-profile-size-trends">Wielkość rynku i trendy</Label>
                <Textarea
                  id="market-profile-size-trends"
                  rows={3}
                  value={draft.sizeTrends}
                  onChange={(event) => setDraft({ ...draft, sizeTrends: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="market-profile-personas">Persony</Label>
                <Textarea
                  id="market-profile-personas"
                  rows={3}
                  value={draft.personas}
                  onChange={(event) => setDraft({ ...draft, personas: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="market-profile-problems">Problemy</Label>
                <Textarea
                  id="market-profile-problems"
                  rows={3}
                  value={draft.problems}
                  onChange={(event) => setDraft({ ...draft, problems: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="market-profile-needs">Potrzeby</Label>
                <Textarea
                  id="market-profile-needs"
                  rows={3}
                  value={draft.needs}
                  onChange={(event) => setDraft({ ...draft, needs: event.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="market-profile-plans">Plany</Label>
                <Textarea
                  id="market-profile-plans"
                  rows={3}
                  value={draft.plans}
                  onChange={(event) => setDraft({ ...draft, plans: event.target.value })}
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
              disabled={!draft.profileName.trim() || createProfile.isPending || updateProfile.isPending}
            >
              Zapisz profil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={profileToDelete !== null} onOpenChange={(open) => !open && setProfileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć profil {profileToDelete?.profileName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Treści wygenerowane z jego użyciem w przeszłości zostają w archiwum bez zmian. Tej operacji
              nie da się cofnąć.
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
