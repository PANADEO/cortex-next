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
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { buildFilmsColumns } from "./columns"

export default function OknaCzasoweFilmsPage() {
  const { t } = useTranslation(["okna-czasowe", "common"])
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
        toast.success(t("films.updated"))
      } else {
        await createFilm.mutateAsync(input)
        toast.success(t("films.created"))
      }
    } catch (error) {
      toastApiError(error, t("films.saveFailed"))
      throw error
    }
  }

  async function handleConfirmDelete() {
    if (!deletingFilm) return
    try {
      await deleteFilm.mutateAsync(deletingFilm.id)
      toast.success(t("films.deleted"))
    } catch (error) {
      toastApiError(error, t("films.deleteFailed"))
    } finally {
      setDeletingFilm(null)
    }
  }

  const columns = buildFilmsColumns({ t, onEdit: openEditForm, onDelete: setDeletingFilm })
  const films = filmsQuery.data ?? []

  return (
    <>
      <PageHeader
        title={t("films.title")}
        description={t("films.description")}
        actions={
          <Button size="sm" onClick={openCreateForm}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t("films.add")}
          </Button>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        {!filmsQuery.isLoading && films.length === 0 ? (
          <EmptyState
            icon={FilmIcon}
            title={t("films.emptyTitle")}
            description={t("films.emptyDescription")}
            action={
              <Button size="sm" onClick={openCreateForm}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t("films.add")}
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
            <AlertDialogTitle>
              {t("films.deleteTitle", { title: deletingFilm?.title ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("films.deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteFilm.isPending}>
              {t("common:actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={deleteFilm.isPending}>
              {t("common:actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
