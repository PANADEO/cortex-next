"use client"

import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import { queryKeys } from "./query-keys"

export interface AuthorizedAppsResponse {
  allowed: boolean
  apps: string[]
  email: string
}

interface UseAuthorizedAppsResult {
  allowed: boolean | null
  apps: string[]
  email: string | null
  isLoading: boolean
  isError: boolean
}

const EMPTY_APPS: string[] = []

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
    apps: query.data?.apps ?? EMPTY_APPS,
    email: query.data?.email ?? null,
    isLoading: query.isPending,
    isError: query.isError,
  }
}
