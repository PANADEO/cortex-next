import { apiClient } from "@cortex/api"
import type { Film, FilmInput, LogEntry, ScanResult, Snapshot } from "./types"

export const queryKeys = {
  all: ["okna-czasowe"] as const,
  films: () => [...queryKeys.all, "films"] as const,
  snapshots: () => [...queryKeys.all, "snapshots"] as const,
  log: () => [...queryKeys.all, "log"] as const,
}

export const endpoints = {
  films: {
    list: () => apiClient.get<Film[]>("/api/okna-czasowe/films"),
    create: (body: FilmInput) =>
      apiClient.post<Film>("/api/okna-czasowe/films", { jsonBody: body }),
    update: (id: string, body: FilmInput) =>
      apiClient.put<Film>(`/api/okna-czasowe/films/${id}`, { jsonBody: body }),
    remove: (id: string) =>
      apiClient.delete<{ ok: true }>(`/api/okna-czasowe/films/${id}`),
  },
  data: {
    snapshots: () => apiClient.get<Snapshot[]>("/api/okna-czasowe/data"),
  },
  log: {
    list: () => apiClient.get<LogEntry[]>("/api/okna-czasowe/log"),
  },
  scan: {
    run: () => apiClient.post<ScanResult>("/api/okna-czasowe/scan"),
  },
}
