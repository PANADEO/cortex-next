import { apiClient } from "@cortex/api"
import type { CreateJobResponse, DocumentParserJob } from "./types"

const BASE = "/api/document-parser"

export const queryKeys = {
  all: ["document-parser"] as const,
  jobs: () => [...queryKeys.all, "jobs"] as const,
  job: (id: string) => [...queryKeys.all, "jobs", id] as const,
}

export const endpoints = {
  jobs: {
    list: () => apiClient.get<DocumentParserJob[]>(`${BASE}/jobs`),
    get: (id: string) => apiClient.get<DocumentParserJob>(`${BASE}/jobs/${id}`),
    create: (file: File) => {
      const form = new FormData()
      form.append("file", file)
      return apiClient.post<CreateJobResponse>(`${BASE}/jobs`, { body: form })
    },
  },
}
