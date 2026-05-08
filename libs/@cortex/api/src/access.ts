"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import { queryKeys } from "./query-keys"

export interface AuthorizedAppsResponse {
  allowed: boolean
  email: string
}

interface UseAuthorizedAppsResult {
  allowed: boolean | null
  isLoading: boolean
  isError: boolean
}

export function useAuthorizedApps(): UseAuthorizedAppsResult {
  const query = useQuery<AuthorizedAppsResponse>({
    queryKey: queryKeys.authorizedApps(),
    queryFn: () => apiClient.get<AuthorizedAppsResponse>("/api/me/access"),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  })

  return {
    allowed: query.data?.allowed ?? null,
    isLoading: query.isPending,
    isError: query.isError,
  }
}
