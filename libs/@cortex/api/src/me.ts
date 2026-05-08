"use client"

import type { UserInfoResponse } from "@cortex/types"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import { queryKeys } from "./query-keys"

export function useMe() {
  return useQuery({
    queryKey: queryKeys.user(),
    queryFn: () => apiClient.get<UserInfoResponse>("/user/me"),
    staleTime: 60_000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  })
}
