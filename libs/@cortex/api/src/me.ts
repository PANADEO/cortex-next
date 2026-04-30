"use client"

import type { User } from "@cortex/types"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import { queryKeys } from "./query-keys"

export function useMe() {
  return useQuery({
    queryKey: queryKeys.user(),
    queryFn: () => apiClient.get<User>("/user/me"),
    gcTime: 5 * 60 * 1000,
    retry: false,
  })
}
