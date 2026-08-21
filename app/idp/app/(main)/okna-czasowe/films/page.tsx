"use client"

import { FilmFormDialog } from "@/features/okna-czasowe/components/film-form-dialog"
import {
  useCreateFilm,
  useDeleteFilm,
  useFilms,
  useUpdateFilm,
} from "@/features/okna-czasowe/hooks/use-films"
import type { Film, FilmInput } from "@/features/okna-czasowe/types"
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
  DataTable,
  EmptyState,
  PageHeader,
} from "@cortex/ui"
import { Film as FilmIcon, Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { buildFilmsColumns } from "./columns"

export default function OknaCzasoweFilmsPage() {
  const filmsQuery = useFilms()
  const createFilm = useCreateFilm()
  const updateFilm = useUpdateFilm()
  const deleteFilm = useDeleteFilm()

  const [formOpen, setFormOpen] = useState(false)
  const [editingFilm, setEditingFilm] = useState<Film | undefined>(undefined)
  const [deletingFilm, setDeletingFilm] = useState<Film | null>(null)

  function openCreateForm() {
    setEditingFilm(undefined)
    setFormOpen(true)
  }

  function openEditForm(film: Film) {
    setEditingFilm(film)
    setFormOpen(true)
  }

  async function handleSubmit(input: FilmInput) {
    try {
      if (editingFilm) {
        await updateFilm.mutateAsync({ id: editingFilm.id, body: input })
        toast.success("Film zaktualizowany")
      } else {
        await createFilm.mutateAsync(input)
        toast.success("Film dodany")
      }
    } catch (error) {
      toastApiError(error, "Nie udało się zapisać filmu")
      throw error
    }
  }

  async function handleConfirmDelete() {
    if (!deletingFilm) return
    try {
      await deleteFilm.mutateAsync(deletingFilm.id)
      toast.success("Film usunięty")
    } catch (error) {
      toastApiError(error, "Nie udało się usunąć filmu")
    } finally {
      setDeletingFilm(null)
    }
  }

  const columns = buildFilmsColumns({ onEdit: openEditForm, onDelete: setDeletingFilm })
  const films = filmsQuery.data ?? []

  return (
    <>
      <PageHeader
        title="Filmy"
        description="Baza filmów śledzonych w rejestrze okien czasowych — tytuł, rok i tytuły zagraniczne używane do wyszukiwania w JustWatch."
        actions={
          <Button size="sm" onClick={openCreateForm}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Dodaj film
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        {!filmsQuery.isLoading && films.length === 0 ? (
          <EmptyState
            icon={FilmIcon}
            title="Brak filmów"
            description="Dodaj pierwszy film, żeby zacząć codzienne śledzenie dostępności na Rakuten TV PL."
            action={
              <Button size="sm" onClick={openCreateForm}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Dodaj film
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={films}
            isLoading={filmsQuery.isLoading}
            bordered
            getRowId={(film) => film.id}
          />
        )}
      </div>

      <FilmFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        film={editingFilm}
        isSaving={createFilm.isPending || updateFilm.isPending}
        onSubmit={handleSubmit}
      />

      <AlertDialog
        open={deletingFilm !== null}
        onOpenChange={(open) => !open && setDeletingFilm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć „{deletingFilm?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Historia skanów tego filmu zostanie zachowana, ale film zniknie z listy śledzonych.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteFilm.isPending}>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={deleteFilm.isPending}>
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
