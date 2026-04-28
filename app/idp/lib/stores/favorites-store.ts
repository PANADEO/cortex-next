"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

interface FavoritesState {
  favorites: string[]
  toggleFavorite: (id: string) => void
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set) => ({
      favorites: [],
      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id)
            ? s.favorites.filter((f) => f !== id)
            : [...s.favorites, id],
        })),
    }),
    { name: "cortex.favorites" },
  ),
)
