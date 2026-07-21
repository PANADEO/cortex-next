"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { endpoints, queryKeys } from "../queries"
import type { FilmInput } from "../types"

export function useFilms() {
  return useQuery({
    queryKey: queryKeys.films(),
    queryFn: endpoints.films.list,
  })
}

export function useCreateFilm() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: FilmInput) => endpoints.films.create(body),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.films() })
    },
  })
}

export function useUpdateFilm() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: FilmInput }) => endpoints.films.update(id, body),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.films() })
    },
  })
}

export function useDeleteFilm() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => endpoints.films.remove(id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.films() })
    },
  })
}
