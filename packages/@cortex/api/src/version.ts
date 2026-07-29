"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import { queryKeys } from "./query-keys"

interface VersionResponse {
  version: string
}

export function useModuleVersion(versionEndpoint: string | undefined) {
  return useQuery<VersionResponse>({
    queryKey: queryKeys.moduleVersion(versionEndpoint ?? ""),
    queryFn: () => apiClient.get<VersionResponse>(versionEndpoint!),
    enabled: Boolean(versionEndpoint),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  })
}
