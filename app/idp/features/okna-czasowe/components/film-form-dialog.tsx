"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@cortex/ui"
import { Loader2, Plus, X } from "lucide-react"
import { useEffect } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { EMPTY_FILM_FORM_VALUES, filmFormSchema, filmFormValuesToInput, type FilmFormValues } from "../schemas"
import type { Film } from "../types"

interface FilmFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present when editing an existing film; absent (or undefined) when creating a new one. */
  film?: Film | undefined
  isSaving?: boolean
  onSubmit: (input: ReturnType<typeof filmFormValuesToInput>) => Promise<void>
}

function filmToFormValues(film: Film): FilmFormValues {
  return {
    title: film.title,
    year: film.year,
    tmdbId: film.tmdbId ?? "",
    foreignTitles: film.foreignTitles.map((value) => ({ value })),
  }
}

export function FilmFormDialog({
  open,
  onOpenChange,
  film,
  isSaving = false,
  onSubmit,
}: FilmFormDialogProps) {
  const form = useForm<FilmFormValues>({
    resolver: zodResolver(filmFormSchema),
    defaultValues: film ? filmToFormValues(film) : EMPTY_FILM_FORM_VALUES,
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "foreignTitles" })

  useEffect(() => {
    if (!open) return
    form.reset(film ? filmToFormValues(film) : EMPTY_FILM_FORM_VALUES)
    // Intentionally excluding `form` — reset only when the dialog opens or the target film changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, film])

  const submit = form.handleSubmit(async (values) => {
    await onSubmit(filmFormValuesToInput(values))
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{film ? "Edytuj film" : "Nowy film"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <div>
              <Label htmlFor="film-title">Tytuł</Label>
              <Input id="film-title" className="mt-1" {...form.register("title")} />
              {form.formState.errors.title ? (
                <p className="mt-1 text-xs text-destructive">
                  {form.formState.errors.title.message}
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="film-year">Rok</Label>
              <Input id="film-year" type="number" className="mt-1" {...form.register("year")} />
              {form.formState.errors.year ? (
                <p className="mt-1 text-xs text-destructive">
                  {form.formState.errors.year.message}
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <Label htmlFor="film-tmdb-id">TMDB ID (opcjonalnie)</Label>
            <Input id="film-tmdb-id" className="mt-1" {...form.register("tmdbId")} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tytuły zagraniczne / lokalizowane</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ value: "" })}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Dodaj tytuł
              </Button>
            </div>
            {fields.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Brak dodatkowych tytułów — wyszukiwanie użyje tylko tytułu głównego.
              </p>
            ) : (
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <Input
                      {...form.register(`foreignTitles.${index}.value` as const)}
                      placeholder="np. tytuł oryginalny lub w innym języku"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Usuń tytuł"
                      onClick={() => remove(index)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Zapisz
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
