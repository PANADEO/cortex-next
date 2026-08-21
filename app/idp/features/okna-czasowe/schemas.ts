import { z } from "zod"
import type { FilmInput } from "./types"

// Komunikaty walidacji to KLUCZE przestrzeni `okna-czasowe`, nie napisy —
// schema powstaje na poziomie modułu, poza Reactem, więc nie ma dostępu do
// `t()`. Tłumaczy je miejsce renderu (film-form-dialog.tsx).
export const filmFormSchema = z.object({
  title: z.string().min(1, "form.errors.titleRequired"),
  year: z.coerce
    .number()
    .int("form.errors.yearInteger")
    .min(1900, "form.errors.yearInvalid")
    .max(2100, "form.errors.yearInvalid"),
  tmdbId: z.string().optional(),
  foreignTitles: z.array(z.object({ value: z.string().min(1, "form.errors.titleRequired") })),
})

export type FilmFormValues = z.infer<typeof filmFormSchema>

export function filmFormValuesToInput(values: FilmFormValues): FilmInput {
  const tmdbId = values.tmdbId?.trim()
  return {
    title: values.title.trim(),
    year: values.year,
    foreignTitles: values.foreignTitles.map((t) => t.value.trim()).filter(Boolean),
    ...(tmdbId ? { tmdbId } : {}),
  }
}

export const EMPTY_FILM_FORM_VALUES: FilmFormValues = {
  title: "",
  year: new Date().getFullYear(),
  tmdbId: "",
  foreignTitles: [],
}

/**
 * Server-side validation for the `FilmInput` payload sent to the films API routes.
 *
 * Świadomie BEZ własnych komunikatów: to bramka na payload, a nie warstwa
 * prezentacji. Trasa nie zna języka użytkownika, więc jedyne, co mogłaby tu
 * zrobić, to zamrozić jeden język w odpowiedzi HTTP. Formularz i tak waliduje
 * te same reguły wcześniej (`filmFormSchema`) i to on pokazuje komunikat —
 * tutaj wystarczy techniczny opis od Zoda.
 */
export const filmInputSchema = z.object({
  title: z.string().min(1),
  year: z.number().int().min(1900).max(2100),
  tmdbId: z.string().min(1).optional(),
  foreignTitles: z.array(z.string().min(1)),
})
