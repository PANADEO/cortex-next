"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { endpoints, queryKeys } from "./queries"
import type { DocumentParserJob } from "./types"

const POLL_INTERVAL_MS = 2000

function isInProgress(job: DocumentParserJob | undefined): boolean {
  return job?.status === "queued" || job?.status === "processing"
}

export function useMyJobs() {
  return useQuery({
    queryKey: queryKeys.jobs(),
    queryFn: endpoints.jobs.list,
  })
}

/**
 * Polling zgodnie z architecture_rules.md §5: "Polling — tylko z
 * refetchInterval + enabled. Nie używamy setInterval ręcznie." Wyłącza się
 * samo, gdy zadanie osiągnie stan końcowy (done/error, D4) — kolejny poll po
 * tym momencie byłby bez sensu, bo Postgres już ma kompletny rekord.
 *
 * `id: null` wyłącza zapytanie całkowicie (`enabled: false`) — ekran uploadu
 * używa tego zanim ma jeszcze jobId z odpowiedzi POST /jobs.
 */
export function useJob(id: string | null) {
  return useQuery({
    queryKey: queryKeys.job(id ?? ""),
    queryFn: () => endpoints.jobs.get(id as string),
    enabled: id !== null,
    refetchInterval: (query) => (isInProgress(query.state.data) ? POLL_INTERVAL_MS : false),
  })
}

export function useCreateJob() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => endpoints.jobs.create(file),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.jobs() })
    },
  })
}
