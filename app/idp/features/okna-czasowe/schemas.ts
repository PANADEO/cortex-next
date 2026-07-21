import { z } from "zod"
import type { FilmInput } from "./types"

export const filmFormSchema = z.object({
  title: z.string().min(1, "Wymagany tytuł"),
  year: z.coerce
    .number()
    .int("Rok musi być liczbą całkowitą")
    .min(1900, "Nieprawidłowy rok")
    .max(2100, "Nieprawidłowy rok"),
  tmdbId: z.string().optional(),
  foreignTitles: z.array(z.object({ value: z.string().min(1, "Wymagany tytuł") })),
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

/** Server-side validation for the `FilmInput` payload sent to the films API routes. */
export const filmInputSchema = z.object({
  title: z.string().min(1, "Wymagany tytuł"),
  year: z.number().int().min(1900).max(2100),
  tmdbId: z.string().min(1).optional(),
  foreignTitles: z.array(z.string().min(1)),
})
